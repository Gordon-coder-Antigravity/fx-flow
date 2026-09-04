import React, { useState, useEffect } from 'react';
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

  const loadRates = async () => {
    setLoading(true);

    let savedCodes = INITIAL_WATCHLIST;
    try {
      const storedWatchlist = await AsyncStorage.getItem('saved_watchlist');
      if (storedWatchlist) {
        const parsed = JSON.parse(storedWatchlist);
        if (Array.isArray(parsed) && parsed.length > 0) savedCodes = parsed;
      }
      // Rule 1: Do NOT load previous amounts or base currency from local storage.
    } catch (e) {
      // default fallback
    }

    const initialData = savedCodes.map(code => {
      const info = AVAILABLE_CURRENCIES.find(c => c.value === code) || { label: code, symbol: '' };
      return { id: code, code, name: info.label.split(' - ')[1] || code, symbol: (info as any).symbol || '' };
    });
    setWatchlist(initialData);

    // Rule 1: Always set default base amount to 1 for the top currency on initialization
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

  // Persist only the watchlist order, never previous amounts
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

  // onFocus: highlight the entire number with select() for instant overwrite
  const handleFocus = (code: string, e?: any) => {
    setEditingCurrency(code);
    const rateBase = rates[calcBaseCurrency] || 1;
    const rateTarget = rates[code] || 1;
    const currentVal = (calcAmount / rateBase) * rateTarget;
    setEditingValue(currentVal.toFixed(4));

    // Call e.target.select() immediately and with a slight timeout for iOS/mobile compatibility
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

    // Strip commas and any non-numeric / non-dot characters
    let clean = text.replace(/,/g, '').replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }
    setEditingValue(clean);

    if (clean !== '') {
      const num = parseFloat(clean);
      if (!isNaN(num)) {
        // Valid number: recalculate global calculation state
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

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newList = [...watchlist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setWatchlist(newList);
  };

  // ---- Web Item Renderer ----
  const renderWebItem = ({ item, index }: { item: CurrencyData; index: number }) => {
    const isBase = (editingCurrency || calcBaseCurrency) === item.code;
    const amount = calculateAmount(item.code);
    
    // Dynamically reduce font size for long numbers to prevent overflow
    const dynamicFontSize = 
      amount.length > 15 ? 15 :
      amount.length > 13 ? 18 :
      amount.length > 11 ? 20 : 24;

    return (
      <View style={[styles.itemContainer, isBase && styles.itemContainerBase]}>
        {isBase && <View style={styles.baseIndicator} pointerEvents="none" />}

        {/* Move up/down buttons on web */}
        <View style={styles.moveButtons}>
          <TouchableOpacity
            onPress={() => moveItem(index, 'up')}
            disabled={index === 0}
            style={styles.moveBtn}
          >
            <Ionicons name="chevron-up" size={16} color={index === 0 ? '#2A364F' : '#8A99AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveItem(index, 'down')}
            disabled={index === watchlist.length - 1}
            style={styles.moveBtn}
          >
            <Ionicons name="chevron-down" size={16} color={index === watchlist.length - 1 ? '#2A364F' : '#8A99AF'} />
          </TouchableOpacity>
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
            adjustsFontSizeToFit={true}
            minimumFontScale={0.5}
            numberOfLines={1}
          />
          <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.removeButton}>
            <Ionicons name="close-outline" size={20} color="#8A99AF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ---- Native Item Renderer ----
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
    fontSize: 28,
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
  },
  itemContainerBase: {
    backgroundColor: 'rgba(0, 180, 216, 0.04)',
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
  moveButtons: {
    flexDirection: 'column',
    marginRight: 4,
    gap: 2,
  },
  moveBtn: {
    padding: 3,
  },
  infoContainer: {
    flex: 0.9,
    paddingRight: 8,
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
});
