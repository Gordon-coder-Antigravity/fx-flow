import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Keyboard, TouchableWithoutFeedback, FlatList, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CurrencyData } from './CurrencyItem';
import { fetchRates } from '../utils/api';
import { AVAILABLE_CURRENCIES } from '../utils/mockData';

// Only import DraggableFlatList on native
let DraggableFlatList: any = null;
let ScaleDecorator: any = null;
if (Platform.OS !== 'web') {
  const draggable = require('react-native-draggable-flatlist');
  DraggableFlatList = draggable.default;
  ScaleDecorator = draggable.ScaleDecorator;
}

const INITIAL_WATCHLIST = ['USD', 'TWD', 'JPY'];
const API_BASE_CURRENCY = 'USD';

export default function Watchlist() {
  const insets = useSafeAreaInsets();
  const [watchlist, setWatchlist] = useState<CurrencyData[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [baseAmount, setBaseAmount] = useState('1.0000');

  const loadRates = async () => {
    setLoading(true);

    let savedCodes = INITIAL_WATCHLIST;
    try {
      const storedWatchlist = await AsyncStorage.getItem('saved_watchlist');
      if (storedWatchlist) savedCodes = JSON.parse(storedWatchlist);
      const storedBase = await AsyncStorage.getItem('saved_baseCurrency');
      if (storedBase) setBaseCurrency(storedBase);
      const storedAmount = await AsyncStorage.getItem('saved_baseAmount');
      if (storedAmount) {
        const num = parseFloat(storedAmount);
        setBaseAmount(!isNaN(num) ? num.toFixed(4) : '1.0000');
      }
    } catch (e) {
      // AsyncStorage may not work on web — use defaults
    }

    const initialData = savedCodes.map(code => {
      const info = AVAILABLE_CURRENCIES.find(c => c.value === code) || { label: code, symbol: '' };
      return { id: code, code, name: info.label.split(' - ')[1] || code, symbol: (info as any).symbol || '' };
    });
    setWatchlist(initialData);

    const data = await fetchRates(API_BASE_CURRENCY);
    if (data) setRates(data);

    setLoading(false);
  };

  useEffect(() => {
    loadRates();
  }, []);

  useEffect(() => {
    const saveState = async () => {
      if (!loading && watchlist.length > 0) {
        try {
          const codes = watchlist.map(item => item.code);
          await AsyncStorage.setItem('saved_watchlist', JSON.stringify(codes));
          await AsyncStorage.setItem('saved_baseCurrency', baseCurrency);
          await AsyncStorage.setItem('saved_baseAmount', baseAmount);
        } catch (e) {
          console.error('Failed to save state', e);
        }
      }
    };
    saveState();
  }, [watchlist, baseCurrency, baseAmount, loading]);

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
    setWatchlist(watchlist.filter(item => item.id !== id));
  };

  const handleChangeAmount = (code: string, amount: string) => {
    setBaseCurrency(code);
    // Strip commas so internal state is pure number
    setBaseAmount(amount.replace(/,/g, ''));
  };

  const formatThousands = (val: string) => {
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join('.');
  };

  const handleBlurFormat = () => {
    if (baseAmount === '') return;
    const amountNum = parseFloat(baseAmount);
    if (!isNaN(amountNum)) {
      setBaseAmount(amountNum.toFixed(4));
    }
  };

  const calculateAmount = (targetCode: string): string => {
    if (targetCode === baseCurrency) {
      return formatThousands(baseAmount);
    }
    if (baseAmount === '') return '';
    const amountNum = parseFloat(baseAmount);
    if (isNaN(amountNum)) return '0.0000';

    const rateBase = rates[baseCurrency] || 1;
    const rateTarget = rates[targetCode] || 1;
    const result = (amountNum / rateBase) * rateTarget;
    return formatThousands(result.toFixed(4));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newList = [...watchlist];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setWatchlist(newList);
  };

  // ---- Web version: plain FlatList with move buttons ----
  const renderWebItem = ({ item, index }: { item: CurrencyData; index: number }) => {
    const isBase = item.code === baseCurrency;
    const amount = calculateAmount(item.code);
    return (
      <View style={[styles.itemContainer, isBase && styles.itemContainerBase]}>
        {isBase && <View style={styles.baseIndicator} />}

        {/* Move buttons */}
        <View style={styles.moveButtons}>
          <TouchableOpacity
            onPress={() => moveItem(index, 'up')}
            disabled={index === 0}
            style={styles.moveBtn}
          >
            <Ionicons name="chevron-up" size={16} color={index === 0 ? '#333' : '#8A99AF'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveItem(index, 'down')}
            disabled={index === watchlist.length - 1}
            style={styles.moveBtn}
          >
            <Ionicons name="chevron-down" size={16} color={index === watchlist.length - 1 ? '#333' : '#8A99AF'} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.codeText}>{item.code}</Text>
          <Text style={styles.nameText}>{item.symbol} {item.name}</Text>
        </View>

        <View style={styles.rightContainer}>
          <TextInput
            style={[styles.rateInput, isBase && styles.baseRateText]}
            value={amount}
            onChangeText={(text) => handleChangeAmount(item.code, text)}
            onBlur={handleBlurFormat}
            keyboardType="default"
            returnKeyType="done"
            selectTextOnFocus
          />
          <TouchableOpacity onPress={() => handleRemove(item.id)} style={styles.removeButton}>
            <Ionicons name="close-outline" size={20} color="#8A99AF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ---- Native version: DraggableFlatList ----
  const renderNativeItem = ({ item, drag, isActive }: any) => {
    const CurrencyItemComponent = require('./CurrencyItem').default;
    return (
      <CurrencyItemComponent
        item={item}
        drag={drag}
        isActive={isActive}
        onRemove={handleRemove}
        isBase={item.code === baseCurrency}
        amount={calculateAmount(item.code)}
        onChangeAmount={handleChangeAmount}
        onBlurFormat={handleBlurFormat}
      />
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
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
            <Text style={styles.addButtonText}>+ 新增</Text>
          </TouchableOpacity>
        </View>

        {loading && watchlist.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#00B4D8" size="large" />
          </View>
        ) : Platform.OS === 'web' ? (
          <FlatList
            data={watchlist}
            keyExtractor={(item) => item.id}
            renderItem={renderWebItem}
            style={styles.listContainer}
            keyboardShouldPersistTaps="handled"
          />
        ) : DraggableFlatList ? (
          <DraggableFlatList
            data={watchlist}
            onDragEnd={({ data }: any) => setWatchlist(data)}
            keyExtractor={(item: CurrencyData) => item.id}
            renderItem={renderNativeItem}
            containerStyle={styles.listContainer}
            keyboardShouldPersistTaps="handled"
          />
        ) : null}
      </View>
    </TouchableWithoutFeedback>
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
    paddingTop: 20,
    paddingBottom: 24,
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
    marginBottom: 20,
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
  },
  dropdownContainer: {
    backgroundColor: '#14203B',
    borderWidth: 0,
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
  // Web item styles
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A253C',
    position: 'relative',
    paddingHorizontal: 8,
  },
  itemContainerBase: {
    // slight highlight for base
  },
  baseIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    backgroundColor: '#00B4D8',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  moveButtons: {
    flexDirection: 'column',
    marginRight: 8,
    gap: 2,
  },
  moveBtn: {
    padding: 4,
  },
  infoContainer: {
    flex: 1.5,
    paddingRight: 10,
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nameText: {
    color: '#8A99AF',
    fontSize: 10,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2,
    justifyContent: 'flex-end',
  },
  rateInput: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    marginRight: 12,
    textAlign: 'right',
    flex: 1,
  },
  baseRateText: {
    color: '#00B4D8',
  },
  removeButton: {
    padding: 8,
    marginRight: 8,
  },
});
