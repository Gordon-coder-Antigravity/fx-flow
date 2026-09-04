import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Platform, TextInput } from 'react-native';
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
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const currentIndexRef = useRef<number | null>(null);
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
    if (data) setRates(data);

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
    setLoading(true);
    const data = await fetchRates(API_BASE_CURRENCY);
    if (data) setRates(data);
    setLoading(false);
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

  const formatThousands = (val: string) => {
    if (!val) return '';
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const handleFocus = (code: string, e?: any) => {
    setEditingCurrency(code);
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
    setEditingValue(clean);

    if (clean !== '') {
      const num = parseFloat(clean);
      if (!isNaN(num)) {
        setCalcBaseCurrency(code);
        setCalcAmount(num);
      }
    }
  };

  const handleBlurFormat = (code: string) => {
    if (editingCurrency === code) {
      if (editingValue === '') {
        setEditingCurrency(null);
        setEditingValue('');
      } else {
        const num = parseFloat(editingValue);
        if (!isNaN(num)) {
          setCalcAmount(num);
          setCalcBaseCurrency(code);
        }
        setEditingCurrency(null);
        setEditingValue('');
      }
    }
  };

  // iOS Numeric Keypad actions
  const handleKeypadPress = (val: string) => {
    if (!editingCurrency) return;

    let newValue = editingValue;
    if (val === 'backspace') {
      newValue = newValue.slice(0, -1);
    } else if (val === '.') {
      if (!newValue.includes('.')) {
        newValue = newValue === '' ? '0.' : newValue + '.';
      }
    } else {
      newValue = newValue + val;
    }

    handleChangeAmount(editingCurrency, newValue);
  };

  const handleKeypadDone = () => {
    if (editingCurrency) {
      handleBlurFormat(editingCurrency);
    }
    setEditingCurrency(null);
  };

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

  // ---- Web iPhone Home Screen Drag and Drop System ----
  const startDrag = (index: number, clientY: number) => {
    if (Platform.OS !== 'web') return;
    isDraggingRef.current = true;
    currentIndexRef.current = index;
    startYRef.current = clientY;
    setDraggedIndex(index);
    setDragOverIndex(index);
    setDragOffsetY(0);

    const onPointerMove = (e: PointerEvent | MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || currentIndexRef.current === null) return;
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const diffY = currentY - startYRef.current;
      setDragOffsetY(diffY);

      // Approximate height of item is ~70px
      const itemHeight = 70;
      const shifted = Math.round(diffY / itemHeight);
      const newTarget = Math.max(0, Math.min(watchlistRef.current.length - 1, currentIndexRef.current + shifted));
      setDragOverIndex(newTarget);
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current || currentIndexRef.current === null) return;
      const source = currentIndexRef.current;
      const target = dragOverIndex !== null ? dragOverIndex : source;

      if (source !== target && target >= 0 && target < watchlistRef.current.length) {
        const newList = [...watchlistRef.current];
        const [moved] = newList.splice(source, 1);
        newList.splice(target, 0, moved);
        setWatchlist(newList);
      }

      isDraggingRef.current = false;
      currentIndexRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDragOffsetY(0);

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  };

  // Web Item Renderer with iPhone Home Screen Drag & Wobble
  const renderWebItem = ({ item, index }: { item: CurrencyData; index: number }) => {
    const isBase = (editingCurrency || calcBaseCurrency) === item.code;
    const amount = calculateAmount(item.code);
    
    const dynamicFontSize = 
      amount.length > 15 ? 16 :
      amount.length > 13 ? 19 :
      amount.length > 11 ? 22 : 26;

    const isThisDragged = draggedIndex === index;
    const anyDragging = draggedIndex !== null;

    // Calculate shift displacement for items displaced by dragged item
    let translateY = 0;
    if (anyDragging && !isThisDragged && dragOverIndex !== null && draggedIndex !== null) {
      const itemHeight = 70;
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
      transition: isThisDragged ? 'none' : 'transform 0.24s cubic-bezier(0.2, 0, 0, 1)',
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
      >
        {isBase && <View style={styles.baseIndicator} pointerEvents="none" />}

        {/* 3-Horizontal-Lines Drag Handle with iPhone touch/mouse handler */}
        <View 
          style={styles.dragHandle}
          {...(Platform.OS === 'web' ? {
            onPointerDown: (e: any) => {
              e.preventDefault();
              startDrag(index, e.clientY);
            },
            onTouchStart: (e: any) => {
              if (e.touches?.[0]) {
                startDrag(index, e.touches[0].clientY);
              }
            }
          } : {})}
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
          <TextInput
            style={[
              styles.rateInput, 
              isBase && styles.baseRateText,
              { fontSize: dynamicFontSize }
            ]}
            value={amount}
            onFocus={(e) => handleFocus(item.code, e)}
            onChangeText={(text) => handleChangeAmount(item.code, text)}
            onBlur={() => handleBlurFormat(item.code)}
            keyboardType="numeric"
            returnKeyType="done"
            selectTextOnFocus={true}
            editable={true}
            numberOfLines={1}
          />
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
        `}</style>
      )}

      {/* Header matching Image 1 */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>FX FLOW</Text>
          <Text style={styles.subtitle}>LIVE EXCHANGE RATES</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#8A99AF" size="small" />
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
          keyboardShouldPersistTaps="always"
        />
      ) : (
        <DraggableFlatList
          data={watchlist}
          onDragEnd={({ data }: any) => setWatchlist(data)}
          keyExtractor={(item: CurrencyData) => item.id}
          renderItem={renderNativeItem}
          containerStyle={styles.listContainer}
          keyboardShouldPersistTaps="always"
        />
      )}

      {/* iOS Frosted Numeric Keypad & Floating Done Button (matching Image 1) */}
      {editingCurrency && (
        <View style={styles.keypadOverlay}>
          {/* Floating Done Button */}
          <View style={styles.doneBar}>
            <TouchableOpacity style={styles.doneButton} onPress={handleKeypadDone}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Keypad Grid */}
          <View style={styles.keypadGrid}>
            <View style={styles.keypadRow}>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('1')}>
                <Text style={styles.keyNumber}>1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('2')}>
                <Text style={styles.keyNumber}>2</Text>
                <Text style={styles.keyLetters}>ABC</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('3')}>
                <Text style={styles.keyNumber}>3</Text>
                <Text style={styles.keyLetters}>DEF</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.keypadRow}>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('4')}>
                <Text style={styles.keyNumber}>4</Text>
                <Text style={styles.keyLetters}>GHI</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('5')}>
                <Text style={styles.keyNumber}>5</Text>
                <Text style={styles.keyLetters}>JKL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('6')}>
                <Text style={styles.keyNumber}>6</Text>
                <Text style={styles.keyLetters}>MNO</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.keypadRow}>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('7')}>
                <Text style={styles.keyNumber}>7</Text>
                <Text style={styles.keyLetters}>PQRS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('8')}>
                <Text style={styles.keyNumber}>8</Text>
                <Text style={styles.keyLetters}>TUV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('9')}>
                <Text style={styles.keyNumber}>9</Text>
                <Text style={styles.keyLetters}>WXYZ</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.keypadRow}>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('.')}>
                <Text style={styles.keyNumber}>.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('0')}>
                <Text style={styles.keyNumber}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.keypadKey} onPress={() => handleKeypadPress('backspace')}>
                <Ionicons name="backspace-outline" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    cursor: 'grab' as any,
  },
  infoContainer: {
    flex: 0.9,
    paddingRight: 8,
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  nameText: {
    color: '#8A99AF',
    fontSize: 12,
  },
  symbolText: {
    color: '#6B7A90',
    fontSize: 11,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1.1,
    gap: 8,
    position: 'relative',
    zIndex: 10,
  },
  rateInput: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'right',
    flex: 1,
    maxWidth: '90%',
    paddingVertical: 4,
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
  keypadOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(200, 204, 212, 0.92)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 6,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(25px)',
      WebkitBackdropFilter: 'blur(25px)',
    } : {}),
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
    fontSize: 22,
    fontWeight: '500',
  },
  keyLetters: {
    color: '#111827',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: -2,
  },
});
