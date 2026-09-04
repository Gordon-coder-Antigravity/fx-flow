import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AVAILABLE_CURRENCIES } from '../utils/mockData';
import { fetchHistory, Timeframe, ChartDataPoint } from '../utils/historyApi';

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', '10Y'];

const FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', CAD: '🇨🇦', TWD: '🇹🇼', JPY: '🇯🇵', CNY: '🇨🇳', 
  MYR: '🇲🇾', GBP: '🇬🇧', AUD: '🇦🇺', PHP: '🇵🇭', TRY: '🇹🇷'
};

export default function HistoryChart() {
  const insets = useSafeAreaInsets();
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('EUR');
  const [timeframe, setTimeframe] = useState<Timeframe>('1Y');
  
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentRate, setCurrentRate] = useState(1);
  const [percentChange, setPercentChange] = useState(0);
  const [trendColor, setTrendColor] = useState('#2962FF');
  const [lastDate, setLastDate] = useState('');

  // Refs for Lightweight Charts
  const chartContainerRef = useRef<any>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useEffect(() => {
    loadData();
  }, [baseCurrency, targetCurrency, timeframe]);

  const loadData = async () => {
    setLoading(true);
    const history = await fetchHistory(baseCurrency, targetCurrency, timeframe);
    
    if (history.length > 0) {
      const firstRate = history[0].value;
      const latestRate = history[history.length - 1].value;
      
      setCurrentRate(latestRate);
      setPercentChange(((latestRate - firstRate) / (firstRate || 1)) * 100);
      setLastDate(history[history.length - 1].date);
      setTrendColor(latestRate >= firstRate ? '#00E676' : '#FF3D00');
    }
    setChartData(history);
    setLoading(false);
  };

  // Initialize Lightweight Charts (Web Only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !chartContainerRef.current) return;

    // Dynamically require lightweight-charts so it doesn't break Native Metro builds
    const { createChart } = require('lightweight-charts');

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8A99AF',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      localization: {
        locale: 'en-US',
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const lineSeries = chart.addAreaSeries({
      lineColor: '#2962FF',
      topColor: 'rgba(41, 98, 255, 0.4)',
      bottomColor: 'rgba(41, 98, 255, 0.0)',
      lineWidth: 2,
    });
    seriesRef.current = lineSeries;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      const newRect = entries[0].contentRect;
      chart.applyOptions({ width: newRect.width, height: newRect.height });
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update Data in Lightweight Charts
  useEffect(() => {
    if (Platform.OS !== 'web' || !seriesRef.current || chartData.length === 0) return;

    // Map to { time, value } format
    const formattedData = chartData.map(d => ({
      time: d.timestamp,
      value: d.value,
    }));

    // Ensure strict chronological order and unique timestamps
    const uniqueData: any[] = [];
    const seen = new Set();
    for (const d of formattedData) {
      if (!seen.has(d.time)) {
        seen.add(d.time);
        uniqueData.push(d);
      }
    }
    uniqueData.sort((a, b) => a.time - b.time);

    try {
      seriesRef.current.setData(uniqueData);
      chartRef.current?.timeScale().fitContent();
    } catch (e) {
      console.warn('Lightweight charts data error', e);
    }
  }, [chartData]);

  const handleSwap = () => {
    setBaseCurrency(targetCurrency);
    setTargetCurrency(baseCurrency);
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: 16 }]}>
      {Platform.OS === 'web' && (
        <style type="text/css">{`
          .tv-chart-container {
            touch-action: none !important;
          }
        `}</style>
      )}
      
      {/* Currency Selectors */}
      <View style={styles.selectorsContainer}>
        <View style={styles.pillContainer}>
          <Text style={styles.flagIcon}>{FLAGS[baseCurrency]}</Text>
          <Dropdown
            style={styles.dropdown}
            data={AVAILABLE_CURRENCIES}
            labelField="code"
            valueField="code"
            value={baseCurrency}
            onChange={item => setBaseCurrency(item.code)}
            selectedTextStyle={styles.dropdownText}
            itemTextStyle={styles.dropdownItemText}
            containerStyle={styles.dropdownPopup}
            activeColor="rgba(255,255,255,0.1)"
            iconColor="#FFFFFF"
            showsVerticalScrollIndicator={false}
          />
        </View>

        <TouchableOpacity style={styles.swapButton} onPress={handleSwap}>
          <Ionicons name="swap-horizontal" size={24} color="#8A99AF" />
        </TouchableOpacity>

        <View style={styles.pillContainer}>
          <Text style={styles.flagIcon}>{FLAGS[targetCurrency]}</Text>
          <Dropdown
            style={styles.dropdown}
            data={AVAILABLE_CURRENCIES}
            labelField="code"
            valueField="code"
            value={targetCurrency}
            onChange={item => setTargetCurrency(item.code)}
            selectedTextStyle={styles.dropdownText}
            itemTextStyle={styles.dropdownItemText}
            containerStyle={styles.dropdownPopup}
            activeColor="rgba(255,255,255,0.1)"
            iconColor="#FFFFFF"
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>

      {/* Rate Display */}
      <View style={styles.rateDisplayContainer}>
        <Text style={styles.singleLineRate} adjustsFontSizeToFit numberOfLines={1}>
          <Text style={styles.mainRateBase}>1 {baseCurrency}</Text>
          <Text style={styles.mainRateEqual}> = </Text>
          <Text style={styles.mainRateValue}>{currentRate.toFixed(4)}</Text>
          <Text style={styles.mainRateTarget}> {targetCurrency}</Text>
        </Text>
        
        <View style={styles.rateSubRow}>
          <View style={styles.changeContainer}>
            <Ionicons name={percentChange >= 0 ? 'arrow-up' : 'arrow-down'} size={14} color={trendColor} />
            <Text style={[styles.changeText, { color: trendColor }]}>
              {Math.abs(percentChange).toFixed(2)}%
            </Text>
            <Text style={styles.dateText}>{lastDate}</Text>
          </View>
        </View>
      </View>

      {/* Chart Canvas */}
      <View style={styles.chartWrapper}>
        <View 
          ref={chartContainerRef} 
          style={styles.chartDualLayerContainer} 
          {...(Platform.OS === 'web' ? { className: 'tv-chart-container' } : {})}
        >
          {loading && (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator color="#2962FF" size="large" />
            </View>
          )}
          {Platform.OS !== 'web' && (
            <View style={styles.loadingWrapper}>
              <Text style={{ color: '#8A99AF' }}>Lightweight charts requires Web DOM.</Text>
            </View>
          )}
        </View>
      </View>

      {/* Period Option Buttons */}
      <View style={styles.timeframeWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.timeframeScrollView}
          contentContainerStyle={styles.timeframeContainer}
        >
          {TIMEFRAMES.map((tf) => (
            <TouchableOpacity 
              key={tf} 
              style={[styles.tfButton, timeframe === tf && styles.tfButtonActive]}
              onPress={() => setTimeframe(tf)}
            >
              <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  selectorsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 0.46,
  },
  flagIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  dropdown: {
    flex: 1,
    height: 30,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownItemText: {
    color: '#FFFFFF',
  },
  dropdownPopup: {
    backgroundColor: '#1C1C1E',
    borderWidth: 0,
    borderRadius: 12,
  },
  swapButton: {
    padding: 8,
  },
  rateDisplayContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  singleLineRate: {
    width: '100%',
    marginBottom: 4,
  },
  mainRateBase: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  mainRateEqual: {
    color: '#FFFFFF',
    fontSize: 22,
  },
  mainRateValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
  },
  mainRateTarget: {
    color: '#8A99AF',
    fontSize: 20,
  },
  rateSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    marginRight: 12,
  },
  dateText: {
    color: '#5C6B89',
    fontSize: 14,
  },
  chartWrapper: {
    flex: 1,
    flexDirection: 'column',
    width: '100%',
    paddingHorizontal: 0, 
    marginTop: 4,
  },
  chartDualLayerContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
    position: 'relative',
  },
  loadingWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  timeframeWrapper: {
    height: 48,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 4,
  },
  timeframeScrollView: {
    width: '100%',
    ...(Platform.OS === 'web' ? {
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      WebkitOverflowScrolling: 'touch',
    } : {}),
  },
  timeframeContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  tfButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tfButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  tfText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  tfTextActive: {
    color: '#000000',
  },
});
