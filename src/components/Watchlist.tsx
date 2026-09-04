import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Platform, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CurrencyData } from './CurrencyItem';
import { fetchRates } from '../utils/api';
import { AVAILABLE_CURRENCIES } from '../utils/mockData';

// Only load DraggableFlatList on native
let DraggableFlatList: any = null;
if (Platform.OS !== 'web') {
  try {
    DraggableFlatList = require('react-native-draggable-flatlist').default;
  } catch (e) {
    // fallback to FlatList
  }
}

const INITIAL_WATCHLIST = ['USD', 'TWD', 'JPY'];
const API_BASE_CURRENCY = 'USD';

export default function Watchlist() {
  const insets = useSafeAreaInsets();
  const [watchlist, setWatchlist] = useState<CurrencyData[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');

  // Global calculation state
  const [calcBaseCurrency, setCalcBaseCurrency] = useState('USD');
  const [calcAmount, setCalcAmount] = useState(1);

  // Active input editing state
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Web drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const sourceIndexRef = useRef<number | null>(null);
  const targetIndexRef = useRef<number | null>(null);
  const startYRef = useRef<number>(0);
  const watchlistRef = useRef<CurrencyData[]>([]);
  watchlistRef.current = watchlist;

  const loadRates = async () => {
    setLoading(true);

    let savedCodes = INITIAL_WATCHLIST;
    try {
      const storedWatchlist = await AsyncStorage.getItem('saved_watchlist');
      if (storedWatchlist) {
        const parsed = JSON.parse(storedWatchlist);
        if (Array.isArray(parsed) && parsed.length > 0) savedCodes = parsed;
      }
    } catch (e) {
      // default fallback
    }

    const initialData = savedCodes.map(code => {
      const info = AVAILABLE_CURRENCIES.find(c => c.value === code) || { label: code, symbol: '' };
      return { id: code, code, name: info.label.split(' - ')[1] || code, symbol: (info as any).symbol || '' };
    });
    setWatchlist(initialData);

    const topCurrency = savedCodes[0] || 'USD';
    setCalcBaseCurrency(topCurrency);
    setCalcAmount(1);
    setEditingCurrency(null);
    setEditingValue('');

    const data = await fetchRates(API_BASE_CURRENCY);
    if (data) {
      setRates(data);
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadRates();
  }, []);

  // Persist watchlist order
  useEffect(() => {
    const saveState = async () => {
      if (!loading && watchlist.length > 0) {
        try {
          const codes = watchlist.map(item => item.code);
          await AsyncStorage.setItem('saved_watchlist', JSON.stringify(codes));
        } catch (e) {
          console.error('Failed to save state', e);
        }
      }
    };
    saveState();
  }, [watchlist, loading]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const [data] = await Promise.all([
        fetchRates(API_BASE_CURRENCY, true),
        new Promise(resolve => setTimeout(resolve, 600)),
      ]);
      if (data) {
        setRates(data);
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAdd = () => {
    if (!watchlist.find(c => c.code === selectedCurrency)) {
      const info = AVAILABLE_CURRENCIES.find(c => c.value === selectedCurrency);
      if (info) {
        setWatchlist([...watchlist, {
          id: selectedCurrency,
          code: selectedCurrency,
          name: info.label.split(' - ')[1] || selectedCurrency,
          symbol: info.symbol
        }]);
      }
    }
  };

  const handleRemove = (id: string) => {
    const updated = watchlist.filter(item => item.id !== id);
    setWatchlist(updated);
    if (calcBaseCurrency === id && updated.length > 0) {
      setCalcBaseCurrency(updated[0].code);
      setCalcAmount(1);
    }
  };

  // Reorder helper
  const reorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setWatchlist(prev => {
      const updated = [...prev];
      if (fromIndex >= updated.length || toIndex >= updated.length) return prev;
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  const formatThousands = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const isInitialInputRef = useRef<boolean>(true);

  const handleFocus = (code: string, e?: any) => {
    setEditingCurrency(code);
    isInitialInputRef.current = true;
    const rateBase = rates[calcBaseCurrency] || 1;
    const rateTarget = rates[code] || 1;
    const currentVal = (calcAmount / rateBase) * rateTarget;
    setEditingValue(currentVal.toFixed(4));

    if (e?.target?.select) {
      e.target.select();
    }
    setTimeout(() => {
      try {
        e?.target?.select?.();
      } catch (_) {}
    }, 50);
  };

  const handleChangeAmount = (code: string, text: string) => {
    setEditingCurrency(code);

    let clean = text.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }
    if (clean.includes('.')) {
      const p = clean.split('.');
      clean = p[0] + '.' + p[1].slice(0, 4);
    }
    setEditingValue(clean);

    if (clean !== '' && clean !== '.') {
      const num = parseFloat(clean);
      if (!isNaN(num)) {
        setCalcBaseCurrency(code);
        setCalcAmount(num);
      }
    }
  };

  const handleBlurFormat = (code: string) => {
    if (editingCurrency === code) {
      if (editingValue === '' || editingValue === '.' || isNaN(parseFloat(editingValue))) {
        setEditingCurrency(null);
        setEditingValue('');
      } else {
        const num = parseFloat(editingValue);
        setCalcAmount(num);
        setCalcBaseCurrency(code);
        setEditingCurrency(null);
        setEditingValue('');
      }
    }
  };

  // iOS Numeric Keypad actions
  const handleKeypadPress = (val: string) => {
    if (!editingCurrency) return;

    let newValue = editingValue;
    if (isInitialInputRef.current) {
      isInitialInputRef.current = false;
      if (val === 'backspace') {
        newValue = '';
      } else if (val === '.') {
        newValue = '0.';
      } else {
        newValue = val;
      }
    } else {
      if (val === 'backspace') {
        newValue = newValue.slice(0, -1);
      } else if (val === '.') {
        if (!newValue.includes('.')) {
          newValue = newValue === '' ? '0.' : newValue + '.';
        }
      } else {
        const dotIndex = newValue.indexOf('.');
        if (dotIndex !== -1 && newValue.slice(dotIndex + 1).length >= 4) {
          return; // Max 4 decimal places reached
        }
        newValue = newValue + val;
      }
    }

    handleChangeAmount(editingCurrency, newValue);
  };

  const handleKeypadDone = () => {
    if (editingCurrency) {
      handleBlurFormat(editingCurrency);
    }
    setEditingCurrency(null);
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !editingCurrency) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeypadPress('backspace');
      } else if (e.key === 'Enter' || e.key === 'Escape') {
        handleKeypadDone();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingCurrency, editingValue]);

  const calculateAmount = (code: string): string => {
    if (editingCurrency === code) {
      if (editingValue === '') return '';
      const parts = editingValue.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    }

    const rateBase = rates[calcBaseCurrency] || 1;
    const rateTarget = rates[code] || 1;
    const result = (calcAmount / rateBase) * rateTarget;
    return formatThousands(result.toFixed(4));
  };

  // Safe clientY coordinate extraction across Touch and Pointer events
  const extractClientY = (e: any): number => {
    if (!e) return 0;
    if (typeof e.clientY === 'number') return e.clientY;
    if (e.nativeEvent && typeof e.nativeEvent.clientY === 'number') return e.nativeEvent.clientY;
    if (e.nativeEvent && typeof e.nativeEvent.pageY === 'number') return e.nativeEvent.pageY;
    if (e.touches && e.touches[0] && typeof e.touches[0].clientY === 'number') return e.touches[0].clientY;
    if (e.nativeEvent?.touches && e.nativeEvent.touches[0] && typeof e.nativeEvent.touches[0].clientY === 'number') {
      return e.nativeEvent.touches[0].clientY;
    }
    return 0;
  };

  // Pointer / Touch Dragging Handler
  const handlePointerDown = (index: number, e: any) => {
    if (Platform.OS !== 'web') return;
    const clientY = extractClientY(e);
    sourceIndexRef.current = index;
    targetIndexRef.current = index;
    startYRef.current = clientY;
    setDraggedIndex(index);
    setDragOverIndex(index);
    setDragOffsetY(0);

    const handlePointerMove = (ev: any) => {
      if (sourceIndexRef.current === null) return;
      const currentY = extractClientY(ev);
      const diff = currentY - startYRef.current;
      setDragOffsetY(diff);

      const shifted = Math.round(diff / 68);
      const newTarget = Math.max(0, Math.min(watchlistRef.current.length - 1, sourceIndexRef.current + shifted));
      targetIndexRef.current = newTarget;
      setDragOverIndex(newTarget);
    };

    const handlePointerUp = () => {
      const src = sourceIndexRef.current;
      const tgt = targetIndexRef.current;
      if (src !== null && tgt !== null && src !== tgt) {
        reorder(src, tgt);
      }
      sourceIndexRef.current = null;
      targetIndexRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDragOffsetY(0);

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  };

  // HTML5 Drag and Drop Handlers (for Desktop Web)
  const handleDragStart = (index: number, e: any) => {
    sourceIndexRef.current = index;
    targetIndexRef.current = index;
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  };

  const handleDragOver = (index: number, e: any) => {
    if (e.preventDefault) e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    targetIndexRef.current = index;
    setDragOverIndex(index);
  };

  const handleDrop = (index: number, e: any) => {
    if (e.preventDefault) e.preventDefault();
    const src = sourceIndexRef.current ?? parseInt(e.dataTransfer?.getData('text/plain'), 10);
    if (!isNaN(src) && src !== index) {
      reorder(src, index);
    }
    sourceIndexRef.current = null;
    targetIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOffsetY(0);
  };

  const handleDragEnd = () => {
    sourceIndexRef.current = null;
    targetIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDragOffsetY(0);
  };

  // Web Item Renderer with iPhone Home Screen Drag & Wobble
  const renderWebItem = ({ item, index }: { item: CurrencyData; index: number }) => {
    const isBase = (editingCurrency || calcBaseCurrency) === item.code;
    const amount = calculateAmount(item.code);
    
    const len = amount.length;
    const dynamicFontSize = 
      len > 21 ? 9.5 :
      len > 18 ? 10 :
      len > 16 ? 11 :
      len > 14 ? 13.5 :
      len > 12 ? 15 :
      len > 10 ? 17 :
      len > 8 ? 19 :
      len > 7 ? 21 : 22;

    const isThisDragged = draggedIndex === index;
    const anyDragging = draggedIndex !== null;

    let translateY = 0;
    if (anyDragging && !isThisDragged && dragOverIndex !== null && draggedIndex !== null) {
      const itemHeight = 68;
      if (draggedIndex < dragOverIndex && index > draggedIndex && index <= dragOverIndex) {
        translateY = -itemHeight;
      } else if (draggedIndex > dragOverIndex && index >= dragOverIndex && index < draggedIndex) {
        translateY = itemHeight;
      }
    }

    const itemWebStyle: any = {
      transform: isThisDragged 
        ? `translateY(${dragOffsetY}px) scale(1.06)` 
        : `translateY(${translateY}px)`,
      zIndex: isThisDragged ? 999 : 1,
      transition: isThisDragged ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)',
      cursor: isThisDragged ? 'grabbing' : 'default',
    };

    return (
      <View 
        style={[
          styles.itemContainer, 
          isBase && styles.itemContainerBase,
          isThisDragged && styles.itemContainerDragging,
          Platform.OS === 'web' && itemWebStyle,
        ]}
        {...(Platform.OS === 'web' ? {
          draggable: true,
          onDragStart: (e: any) => handleDragStart(index, e),
          onDragOver: (e: any) => handleDragOver(index, e),
          onDrop: (e: any) => handleDrop(index, e),
          onDragEnd: handleDragEnd,
        } as any : {})}
      >
        {isBase && <View style={styles.baseIndicator} pointerEvents="none" />}

        {/* 3-Horizontal-Lines Drag Handle with iPhone touch/mouse handler */}
        <View 
          style={styles.dragHandle}
          {...(Platform.OS === 'web' ? {
            onPointerDown: (e: any) => {
              e.preventDefault();
              handlePointerDown(index, e);
            },
            onMouseDown: (e: any) => {
              e.preventDefault();
              handlePointerDown(index, e);
            },
            onTouchStart: (e: any) => {
              handlePointerDown(index, e);
            }
          } as any : {})}
        >
          <Ionicons name="menu-outline" size={24} color={isThisDragged ? '#00B4D8' : '#8A99AF'} />
        </View>

        <TouchableOpacity 
          style={styles.infoContainer} 
          onPress={(e) => handleFocus(item.code, e)}
          activeOpacity={0.8}
        >
          <Text style={styles.codeText}>{item.code}</Text>
          <Text style={styles.nameText}>{item.name}</Text>
          <Text style={styles.symbolText}>{item.symbol}</Text>
        </TouchableOpacity>

        <View style={styles.rightContainer}>
          <TouchableOpacity 
            style={[styles.rateDisplayBtn, editingCurrency === item.code && styles.rateDisplayBtnActive]}
            onPress={() => handleFocus(item.code)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.rateInput, 
                isBase && styles.baseRateText,
                { fontSize: dynamicFontSize }
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.45}
            >
              {amount}
            </Text>
            {editingCurrency === item.code && (
              <View 
                style={styles.rateCursor} 
                {...(Platform.OS === 'web' ? { className: 'ios-cursor-blink' } : {})} 
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.removeButton}>
            <Ionicons name="close-outline" size={20} color="#8A99AF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Native Item Renderer
  const renderNativeItem = ({ item, drag, isActive }: any) => {
    const CurrencyItemComponent = require('./CurrencyItem').default;
    return (
      <CurrencyItemComponent
        item={item}
        drag={drag}
        isActive={isActive}
        onRemove={handleRemove}
        isBase={(editingCurrency || calcBaseCurrency) === item.code}
        amount={calculateAmount(item.code)}
        onChangeAmount={handleChangeAmount}
        onBlurFormat={() => handleBlurFormat(item.code)}
        onFocus={(e: any) => handleFocus(item.code, e)}
      />
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {Platform.OS === 'web' && (
        <style type="text/css">{`
          @keyframes iosWiggle {
            0% { transform: rotate(-1.5deg) translateY(0px); }
            25% { transform: rotate(1.2deg) translateY(-1px); }
            50% { transform: rotate(-1.2deg) translateY(0px); }
            75% { transform: rotate(1.5deg) translateY(1px); }
            100% { transform: rotate(-1.5deg) translateY(0px); }
          }
          .ios-drag-handle {
            cursor: grab !important;
            touch-action: none !important;
            user-select: none !important;
          }
          .ios-drag-handle:active {
            cursor: grabbing !important;
          }
          .ios-wobble-active {
            animation: iosWiggle 0.28s ease-in-out infinite !important;
            transform-origin: 50% 50% !important;
          }
          .ios-modal-root {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 999999 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-end !important;
          }
          .ios-keypad-backdrop {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            z-index: 1 !important;
            background-color: transparent !important;
          }
          .ios-keypad-overlay {
            position: relative !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            z-index: 2 !important;
            padding-bottom: max(28px, env(safe-area-inset-bottom, 28px)) !important;
            backdrop-filter: blur(28px) !important;
            -webkit-backdrop-filter: blur(28px) !important;
            border-top-left-radius: 20px !important;
            border-top-right-radius: 20px !important;
            border-bottom-left-radius: 0px !important;
            border-bottom-right-radius: 0px !important;
          }
          .ios-cursor-blink {
            animation: iosBlink 1s infinite !important;
          }
          @keyframes iosBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      )}

      {/* Header matching Image 1 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>FX FLOW</Text>
          <Text style={styles.subtitle}>
            {lastUpdated ? `LIVE RATES · UPDATED ${lastUpdated.toUpperCase()}` : 'LIVE EXCHANGE RATES'}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={handleRefresh} 
          style={[styles.refreshButton, refreshing && styles.refreshButtonActive]} 
          disabled={refreshing}
          activeOpacity={0.7}
        >
          {refreshing ? (
            <ActivityIndicator color="#00B4D8" size="small" />
          ) : (
            <Ionicons name="sync" size={20} color="#8A99AF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Add Section matching Image 1 */}
      <View style={styles.addSection}>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.dropdownText}
          selectedTextStyle={styles.dropdownText}
          itemTextStyle={styles.dropdownItemText}
          data={AVAILABLE_CURRENCIES}
          labelField="label"
          valueField="value"
          value={selectedCurrency}
          onChange={item => setSelectedCurrency(item.value)}
          containerStyle={styles.dropdownContainer}
          activeColor="#1A253C"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Watchlist Items */}
      {loading && watchlist.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#00B4D8" size="large" />
        </View>
      ) : Platform.OS === 'web' || !DraggableFlatList ? (
        <FlatList
          data={watchlist}
          keyExtractor={(item) => item.id}
          renderItem={renderWebItem}
          style={styles.listContainer}
          contentContainerStyle={styles.listContentContainer}
          keyboardShouldPersistTaps="always"
        />
      ) : (
        <DraggableFlatList
          data={watchlist}
          onDragEnd={({ data }: any) => setWatchlist(data)}
          keyExtractor={(item: CurrencyData) => item.id}
          renderItem={renderNativeItem}
          containerStyle={styles.listContainer}
          contentContainerStyle={styles.listContentContainer}
          keyboardShouldPersistTaps="always"
        />
      )}

      {/* iOS Frosted Numeric Keypad Modal (attached firmly to the bottom of the screen) */}
      <Modal
        visible={!!editingCurrency}
        transparent={true}
        animationType="none"
        onRequestClose={handleKeypadDone}
        statusBarTranslucent={true}
      >
        <View 
          style={styles.modalRoot}
          {...(Platform.OS === 'web' ? { className: 'ios-modal-root' } : {})}
        >
          {/* Fullscreen Backdrop */}
          <TouchableOpacity 
            style={styles.keypadBackdrop}
            activeOpacity={1}
            onPress={handleKeypadDone}
            {...(Platform.OS === 'web' ? { className: 'ios-keypad-backdrop' } : {})}
          />
          
          {/* Bottom Frosted Keypad Card */}
          <View 
            style={styles.keypadOverlay}
            {...(Platform.OS === 'web' ? { className: 'ios-keypad-overlay' } : {})}
          >
            {/* Floating Done Button */}
            <View style={styles.doneBar}>
              <TouchableOpacity style={styles.doneButton} onPress={handleKeypadDone} activeOpacity={0.8}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Keypad Grid - 4 Full Rows */}
            <View style={styles.keypadGrid}>
              {/* Row 1: 1, 2 ABC, 3 DEF */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('1')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('2')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>2</Text>
                  <Text style={styles.keyLetters}>ABC</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('3')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>3</Text>
                  <Text style={styles.keyLetters}>DEF</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2: 4 GHI, 5 JKL, 6 MNO */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('4')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>4</Text>
                  <Text style={styles.keyLetters}>GHI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('5')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>5</Text>
                  <Text style={styles.keyLetters}>JKL</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('6')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>6</Text>
                  <Text style={styles.keyLetters}>MNO</Text>
                </TouchableOpacity>
              </View>

              {/* Row 3: 7 PQRS, 8 TUV, 9 WXYZ */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('7')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>7</Text>
                  <Text style={styles.keyLetters}>PQRS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('8')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>8</Text>
                  <Text style={styles.keyLetters}>TUV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('9')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>9</Text>
                  <Text style={styles.keyLetters}>WXYZ</Text>
                </TouchableOpacity>
              </View>

              {/* Row 4: . , 0 , backspace */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('.')} activeOpacity={0.6}>
                  <Text style={[styles.keyNumber, styles.keyDot]}>.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('0')} activeOpacity={0.6}>
                  <Text style={styles.keyNumber}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('backspace')} activeOpacity={0.6}>
                  <Ionicons name="backspace-outline" size={26} color="#111827" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1128',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#8A99AF',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 4,
  },
  refreshButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#14203B',
  },
  refreshButtonActive: {
    backgroundColor: '#1C2E54',
  },
  addSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  dropdown: {
    flex: 1,
    height: 50,
    backgroundColor: '#14203B',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1A253C',
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  dropdownItemText: {
    color: '#FFFFFF',
    ...(Platform.OS === 'web' ? { whiteSpace: 'nowrap' } as any : {}),
  },
  dropdownContainer: {
    backgroundColor: '#14203B',
    borderWidth: 0,
    minWidth: 220,
  },
  addButton: {
    backgroundColor: '#00B4D8',
    paddingHorizontal: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00B4D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: '#0A1128',
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
  },
  listContentContainer: {
    paddingBottom: 360,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A253C',
    position: 'relative',
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  itemContainerBase: {
    backgroundColor: 'rgba(0, 180, 216, 0.04)',
  },
  itemContainerDragging: {
    backgroundColor: '#14203B',
    borderRadius: 12,
    shadowColor: '#00B4D8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  baseIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 4,
    backgroundColor: '#00B4D8',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  dragHandle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    width: 90,
    flexShrink: 0,
    paddingRight: 6,
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  nameText: {
    color: '#8A99AF',
    fontSize: 11,
  },
  symbolText: {
    color: '#6B7A90',
    fontSize: 10,
    marginTop: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 6,
    position: 'relative',
    zIndex: 10,
  },
  rateDisplayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  rateDisplayBtnActive: {
    backgroundColor: 'rgba(0, 180, 216, 0.12)',
  },
  rateInput: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'right',
    paddingVertical: 2,
    flexShrink: 1,
    ...(Platform.OS === 'web' ? {
      fontVariant: ['tabular-nums'],
      whiteSpace: 'nowrap',
    } as any : {}),
  },
  rateCursor: {
    width: 2,
    height: 22,
    backgroundColor: '#00B4D8',
    marginLeft: 3,
    borderRadius: 1,
  },
  baseRateText: {
    color: '#00B4D8',
    fontWeight: '500',
  },
  removeButton: {
    padding: 6,
    marginLeft: 4,
  },
  // iOS Numeric Keypad Styles (Image 1)
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 999999,
    } as any : {}),
  },
  keypadBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  keypadOverlay: {
    position: 'relative',
    width: '100%',
    backgroundColor: 'rgba(215, 218, 226, 0.96)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'web' ? 'max(28px, env(safe-area-inset-bottom, 28px))' : 28,
    paddingHorizontal: 8,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 25,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      boxSizing: 'border-box',
    } as any : {}),
  },
  doneBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  doneButton: {
    backgroundColor: 'rgba(20, 28, 48, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  keypadGrid: {
    gap: 6,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 6,
  },
  keypadKey: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  keyNumber: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '500',
  },
  keyDot: {
    fontSize: 28,
    lineHeight: 24,
    fontWeight: 'bold',
  },
  keyLetters: {
    color: '#111827',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: -2,
  },
});
