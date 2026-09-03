import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CurrencyItem, { CurrencyData } from './CurrencyItem';
import { fetchRates } from '../utils/api';
import { AVAILABLE_CURRENCIES } from '../utils/mockData';

const INITIAL_WATCHLIST = ['USD', 'TWD', 'JPY', 'CNY', 'MYR'];
// We always fetch against USD to have a common base for math
const API_BASE_CURRENCY = 'USD';

export default function Watchlist() {
  const insets = useSafeAreaInsets();
  const [watchlist, setWatchlist] = useState<CurrencyData[]>([]);
  
  // rates mapping (1 USD = X other currency)
  const [rates, setRates] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('EUR');

  // Multi-way calculation state
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [baseAmount, setBaseAmount] = useState('1.0000');

  const loadRates = async () => {
    setLoading(true);
    const data = await fetchRates(API_BASE_CURRENCY);
    if (data) {
      setRates(data);
      
      let savedCodes = INITIAL_WATCHLIST;
      try {
        const storedWatchlist = await AsyncStorage.getItem('saved_watchlist');
        if (storedWatchlist) {
          savedCodes = JSON.parse(storedWatchlist);
        }
        const storedBase = await AsyncStorage.getItem('saved_baseCurrency');
        if (storedBase) setBaseCurrency(storedBase);

        const storedAmount = await AsyncStorage.getItem('saved_baseAmount');
        if (storedAmount) {
          const num = parseFloat(storedAmount);
          setBaseAmount(!isNaN(num) ? num.toFixed(4) : '1.0000');
        } else {
          setBaseAmount('1.0000');
        }
      } catch (e) {
        console.error('Failed to load saved state', e);
      }

      // Initialize watchlist metadata
      const initialData = savedCodes.map(code => {
        const info = AVAILABLE_CURRENCIES.find(c => c.value === code) || { label: code, symbol: '' };
        return {
          id: code,
          code,
          name: info.label.split(' - ')[1] || code,
          symbol: info.symbol,
        };
      });
      setWatchlist(initialData);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRates();
  }, []);

  // Save state whenever it changes (after initial load)
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
    if (data) {
      setRates(data);
    }
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
      // If it's the active input, format it only if it doesn't end with a dot, 
      // but if they just typed it, let them keep typing. 
      // It will auto-format to 4 decimals when they blur!
      return formatThousands(baseAmount);
    }
    
    // Parse the amount, allowing intermediate trailing dots for user typing
    if (baseAmount === '') return '';
    const amountNum = parseFloat(baseAmount);
    if (isNaN(amountNum)) return '0.0000';

    const rateBase = rates[baseCurrency] || 1;
    const rateTarget = rates[targetCode] || 1;
    
    const result = (amountNum / rateBase) * rateTarget;
    return formatThousands(result.toFixed(4));
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<CurrencyData>) => {
    return (
      <CurrencyItem 
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
        ) : (
          <DraggableFlatList
            data={watchlist}
            onDragEnd={({ data }) => setWatchlist(data)}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            containerStyle={styles.listContainer}
            keyboardShouldPersistTaps="handled"
          />
        )}
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
  }
});
