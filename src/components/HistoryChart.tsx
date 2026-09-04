import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AVAILABLE_CURRENCIES } from '../utils/mockData';
import { fetchHistory, Timeframe, ChartDataPoint } from '../utils/historyApi';

const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

const FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', CAD: '🇨🇦', TWD: '🇹🇼', JPY: '🇯🇵', CNY: '🇨🇳', 
  MYR: '🇲🇾', GBP: '🇬🇧', AUD: '🇦🇺', SGD: '🇸🇬', PHP: '🇵🇭', TRY: '🇹🇷'
};

const TIMEFRAME_INTERVALS: Record<Timeframe, string> = {
  '1D': '1 min',
  '5D': '5 min',
  '1M': '1 hour',
  '3M': '1 day',
  '6M': '1 day',
  'YTD': '1 day',
  '1Y': '1 day',
  '5Y': '1 wk',
  'All': '1 mo',
};

export default function HistoryChart() {
  const insets = useSafeAreaInsets();
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('JPY');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentRate, setCurrentRate] = useState(1);
  const [percentChange, setPercentChange] = useState(0);
  const [trendColor, setTrendColor] = useState('#00C853');
  const [lastDate, setLastDate] = useState('');

  // OHLC bar state for Yahoo Finance header
  const [hoveredOHLC, setHoveredOHLC] = useState<{ open: number; high: number; low: number; close: number } | null>(null);

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
      const latestPoint = history[history.length - 1];
      const latestRate = latestPoint.value;
      
      setCurrentRate(latestRate);
      setPercentChange(((latestRate - firstRate) / (firstRate || 1)) * 100);
      setLastDate(latestPoint.date);
      setTrendColor(latestRate >= firstRate ? '#00C853' : '#FF3D00');
      setHoveredOHLC({
        open: latestPoint.open,
        high: latestPoint.high,
        low: latestPoint.low,
        close: latestPoint.close,
      });
    }
    setChartData(history);
    setLoading(false);
  };

  // Initialize Lightweight Charts (Web Only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !chartContainerRef.current) return;

    let chart: any = null;
    let resizeObserver: ResizeObserver | null = null;
    let isMounted = true;

    const initChart = async () => {
      try {
        const lwCharts = await import('lightweight-charts');
        if (!isMounted || !chartContainerRef.current) return;

        const container = chartContainerRef.current;
        const width = container.clientWidth || 360;
        const height = container.clientHeight || 340;

        chart = lwCharts.createChart(container, {
          width,
          height,
          layout: {
            background: { type: lwCharts.ColorType.Solid, color: '#0B0E14' },
            textColor: '#8A99AF',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: '#1B2333', style: lwCharts.LineStyle.Dotted },
            horzLines: { color: '#1B2333', style: lwCharts.LineStyle.Dotted },
          },
          rightPriceScale: {
            borderVisible: true,
            borderColor: '#242F45',
            scaleMargins: { top: 0.12, bottom: 0.15 },
          },
          timeScale: {
            borderVisible: true,
            borderColor: '#242F45',
            timeVisible: true,
            secondsVisible: false,
          },
          crosshair: {
            mode: lwCharts.CrosshairMode.Normal,
            vertLine: {
              color: '#4A5D78',
              width: 1,
              style: lwCharts.LineStyle.Dashed,
              labelBackgroundColor: '#1F2937',
            },
            horzLine: {
              color: '#4A5D78',
              width: 1,
              style: lwCharts.LineStyle.Dashed,
              labelBackgroundColor: '#1F2937',
            },
          },
          handleScroll: true,
          handleScale: true,
        });

        chartRef.current = chart;

        // In Lightweight Charts v5: chart.addSeries(AreaSeries, options)
        const areaSeries = chart.addSeries(lwCharts.AreaSeries, {
          lineColor: '#2962FF',
          topColor: 'rgba(41, 98, 255, 0.38)',
          bottomColor: 'rgba(41, 98, 255, 0.00)',
          lineWidth: 2,
          priceLineVisible: true,
          priceLineColor: '#00C853',
          priceLineStyle: lwCharts.LineStyle.Dotted,
          lastValueVisible: true,
          priceFormat: {
            type: 'price',
            precision: 4,
            minMove: 0.0001,
          },
        });
        seriesRef.current = areaSeries;

        // Crosshair move subscription to update Yahoo Finance OHLC banner
        chart.subscribeCrosshairMove((param: any) => {
          if (!param || !param.time || !param.seriesData) {
            return;
          }
          const dataVal = param.seriesData.get(areaSeries);
          if (dataVal) {
            const val = dataVal.value || 0;
            setHoveredOHLC({
              open: val,
              high: val,
              low: val,
              close: val,
            });
          }
        });

        if (chartData && chartData.length > 0) {
          applyDataToSeries(chartData, areaSeries, chart);
        }

        resizeObserver = new ResizeObserver(entries => {
          if (entries.length === 0 || entries[0].target !== container) return;
          const newRect = entries[0].contentRect;
          if (chart && newRect.width > 0 && newRect.height > 0) {
            chart.applyOptions({ width: newRect.width, height: newRect.height });
          }
        });
        resizeObserver.observe(container);
      } catch (err) {
        console.error('Fatal Lightweight Charts Error:', err);
      }
    };

    initChart();

    return () => {
      isMounted = false;
      if (resizeObserver) resizeObserver.disconnect();
      if (chart) {
        try { chart.remove(); } catch (e) { console.error('Error removing chart:', e); }
      }
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update Data in Lightweight Charts when chartData changes
  useEffect(() => {
    if (Platform.OS === 'web' && seriesRef.current && chartRef.current && chartData.length > 0) {
      applyDataToSeries(chartData, seriesRef.current, chartRef.current);
    }
  }, [chartData]);

  const applyDataToSeries = (data: ChartDataPoint[], series: any, chartInst: any) => {
    try {
      if (!data || data.length === 0) return;

      const isIntraday = timeframe === '1D';

      const rawMapped = data.map(d => {
        let timeVal: any = '';
        if (isIntraday) {
          timeVal = typeof d.timestamp === 'number' && d.timestamp > 0 ? Math.floor(d.timestamp) : 0;
        } else {
          if (d.dateStr && /^\d{4}-\d{2}-\d{2}$/.test(d.dateStr)) {
            timeVal = d.dateStr;
          } else if (d.timestamp) {
            timeVal = new Date(d.timestamp * 1000).toISOString().split('T')[0];
          }
        }

        return {
          time: timeVal,
          value: Number(d.value) || 0,
        };
      }).filter(d => Boolean(d.time) && d.value > 0);

      const uniqueMap = new Map<string | number, number>();
      for (const item of rawMapped) {
        uniqueMap.set(item.time, item.value);
      }

      const formattedData: { time: any; value: number }[] = [];
      for (const [time, value] of uniqueMap.entries()) {
        formattedData.push({ time, value });
      }

      formattedData.sort((a, b) => {
        if (typeof a.time === 'string' && typeof b.time === 'string') {
          return a.time.localeCompare(b.time);
        }
        return Number(a.time) - Number(b.time);
      });

      if (formattedData.length > 0) {
        series.setData(formattedData);
        chartInst.timeScale().fitContent();
      }
    } catch (e) {
      console.error('Lightweight charts data formatting error:', e);
    }
  };

  const handleSwap = () => {
    setBaseCurrency(targetCurrency);
    setTargetCurrency(baseCurrency);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const logicalRange = timeScale.getVisibleLogicalRange();
      if (logicalRange) {
        const span = logicalRange.to - logicalRange.from;
        const delta = direction === 'in' ? span * 0.25 : -span * 0.25;
        timeScale.setVisibleLogicalRange({
          from: logicalRange.from + delta,
          to: logicalRange.to - delta,
        });
      }
    }
  };

  const currentDisplayRate = hoveredOHLC ? hoveredOHLC.close : currentRate;
  const activeOHLC = hoveredOHLC || { open: currentRate, high: currentRate, low: currentRate, close: currentRate };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) + 4, paddingBottom: 12 }]}>
      {Platform.OS === 'web' && (
        <style type="text/css">{`
          .tv-chart-container {
            touch-action: none !important;
          }
          .dropdown-popup,
          div[role="listbox"],
          div[role="combobox"] + div,
          [class*="dropdownPopup"],
          [class*="dropdown-popup"] {
            min-width: 220px !important;
            width: max-content !important;
            white-space: nowrap !important;
            background-color: #14203B !important;
            border: 1px solid #1A253C !important;
          }
          .dropdown-item-text,
          div[role="listbox"] *,
          div[role="listbox"] span,
          div[role="listbox"] div,
          div[role="combobox"],
          div[role="combobox"] * {
            white-space: nowrap !important;
            color: #ffffff !important;
          }
          .zoom-buttons-row {
            opacity: 0.55 !important;
            transition: opacity 0.2s ease, background-color 0.2s ease !important;
          }
          .zoom-buttons-row:hover {
            opacity: 0.95 !important;
            background-color: rgba(22, 31, 46, 0.75) !important;
          }
        `}</style>
      )}
      
      {/* Currency Selectors */}
      <View style={styles.selectorsContainer}>
        <View style={styles.pillContainer}>
          <Text style={styles.flagIcon}>{FLAGS[baseCurrency] || '🌐'}</Text>
          <Dropdown
            style={styles.dropdown}
            data={AVAILABLE_CURRENCIES}
            labelField="code"
            valueField="code"
            value={baseCurrency}
            onChange={item => setBaseCurrency(item.code || item.value)}
            placeholderStyle={styles.dropdownText}
            selectedTextStyle={styles.dropdownText}
            itemTextStyle={styles.dropdownItemText}
            itemContainerStyle={{ backgroundColor: '#14203B', minWidth: 220 }}
            containerStyle={styles.dropdownPopup}
            activeColor="#1A253C"
            iconColor="#FFFFFF"
            showsVerticalScrollIndicator={false}
            renderItem={(item) => (
              <View style={styles.dropdownItemRow}>
                <Text style={styles.dropdownItemText}>
                  {item.code || item.value} - {item.label?.split(' - ')[1] || item.label}
                </Text>
              </View>
            )}
          />
        </View>

        <TouchableOpacity style={styles.swapButton} onPress={handleSwap}>
          <Ionicons name="swap-horizontal" size={24} color="#8A99AF" />
        </TouchableOpacity>

        <View style={styles.pillContainer}>
          <Text style={styles.flagIcon}>{FLAGS[targetCurrency] || '🌐'}</Text>
          <Dropdown
            style={styles.dropdown}
            data={AVAILABLE_CURRENCIES}
            labelField="code"
            valueField="code"
            value={targetCurrency}
            onChange={item => setTargetCurrency(item.code || item.value)}
            placeholderStyle={styles.dropdownText}
            selectedTextStyle={styles.dropdownText}
            itemTextStyle={styles.dropdownItemText}
            itemContainerStyle={{ backgroundColor: '#14203B', minWidth: 220 }}
            containerStyle={styles.dropdownPopup}
            activeColor="#1A253C"
            iconColor="#FFFFFF"
            showsVerticalScrollIndicator={false}
            renderItem={(item) => (
              <View style={styles.dropdownItemRow}>
                <Text style={styles.dropdownItemText}>
                  {item.code || item.value} - {item.label?.split(' - ')[1] || item.label}
                </Text>
              </View>
            )}
          />
        </View>
      </View>

      {/* Yahoo Finance Header Bar: O: ... H: ... L: ... C: ... V: 0  +  Green Price Badge */}
      <View style={styles.yahooHeaderBar}>
        <View style={styles.ohlcContainer}>
          <Text style={styles.ohlcText}>
            <Text style={styles.ohlcLabel}>O:</Text>{activeOHLC.open.toFixed(4)}{'  '}
            <Text style={styles.ohlcLabel}>H:</Text>{activeOHLC.high.toFixed(4)}{'  '}
            <Text style={styles.ohlcLabel}>L:</Text>{activeOHLC.low.toFixed(4)}{'  '}
            <Text style={styles.ohlcLabel}>C:</Text>{activeOHLC.close.toFixed(4)}{'  '}
            <Text style={styles.ohlcLabel}>V:</Text>0
          </Text>
          <View style={styles.volTag}>
            <Text style={styles.volTagText}>vol undr</Text>
            <Ionicons name="chevron-up" size={10} color="#8A99AF" style={{ marginLeft: 2 }} />
          </View>
        </View>
        <View style={[styles.priceBadge, { backgroundColor: trendColor }]}>
          <Text style={styles.priceBadgeText}>{currentDisplayRate.toFixed(4)}</Text>
        </View>
      </View>

      {/* Primary Rate & Percentage Header */}
      <View style={styles.rateDisplayContainer}>
        <View style={styles.rateRow}>
          <Text style={styles.rateValueText}>
            1 {baseCurrency} = {currentRate.toFixed(4)} {targetCurrency}
          </Text>
          <View style={styles.changeBadge}>
            <Ionicons name={percentChange >= 0 ? 'caret-up' : 'caret-down'} size={12} color={trendColor} />
            <Text style={[styles.changeText, { color: trendColor }]}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
            </Text>
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

          {/* Yahoo Finance Volume & Zoom Controls Overlay */}
          <View style={styles.chartControlsOverlay} pointerEvents="box-none">
            <Text style={styles.volumeWatermark}>Volume Not Available</Text>
            <View 
              style={styles.zoomButtonsRow} 
              {...(Platform.OS === 'web' ? { className: 'zoom-buttons-row' } : {})}
            >
              <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('out')}>
                <Ionicons name="remove" size={14} color="#C4D1EB" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('in')}>
                <Ionicons name="add" size={14} color="#C4D1EB" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Yahoo Finance Timeframe Bar (1D 5D 1M 3M 6M YTD 1Y 5Y All) */}
      <View style={styles.timeframeWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.timeframeScrollView}
          contentContainerStyle={styles.timeframeContainer}
        >
          {TIMEFRAMES.map((tf) => {
            const isActive = timeframe === tf;
            return (
              <TouchableOpacity 
                key={tf} 
                style={[styles.tfButton, isActive && styles.tfButtonActive]}
                onPress={() => setTimeframe(tf)}
              >
                <Text style={[styles.tfText, isActive && styles.tfTextActive]}>{tf}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.intervalDivider} />

          {/* Interval Indicator */}
          <View style={styles.intervalBadge}>
            <Ionicons name="calendar-outline" size={13} color="#8A99AF" style={{ marginRight: 6 }} />
            <Text style={styles.intervalText}>Interval: {TIMEFRAME_INTERVALS[timeframe]}</Text>
            <Ionicons name="chevron-down" size={12} color="#8A99AF" style={{ marginLeft: 4 }} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  selectorsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14203B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flex: 0.46,
    borderWidth: 1,
    borderColor: '#1A253C',
  },
  flagIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  dropdown: {
    flex: 1,
    height: 28,
  },
  dropdownText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    ...(Platform.OS === 'web' ? { whiteSpace: 'nowrap' } as any : {}),
  },
  dropdownItemRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#14203B',
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownPopup: {
    backgroundColor: '#14203B',
    borderWidth: 1,
    borderColor: '#1A253C',
    borderRadius: 12,
    minWidth: 220,
    width: 220,
  },
  swapButton: {
    padding: 6,
  },
  yahooHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#0E131C',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1A2333',
  },
  ohlcContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  ohlcText: {
    color: '#C4D1EB',
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  ohlcLabel: {
    color: '#6B7A90',
    fontWeight: '600',
  },
  volTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161F2E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#243247',
  },
  volTagText: {
    color: '#8A99AF',
    fontSize: 10,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priceBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  rateDisplayContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateValueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14203B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  changeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  chartWrapper: {
    flex: 1,
    width: '100%',
    position: 'relative',
    marginTop: 2,
  },
  chartDualLayerContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
    position: 'relative',
  },
  loadingWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 14, 20, 0.7)',
    zIndex: 10,
  },
  chartControlsOverlay: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  volumeWatermark: {
    color: 'rgba(66, 81, 107, 0.7)',
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
  zoomButtonsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(22, 31, 46, 0.35)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(36, 50, 71, 0.4)',
    overflow: 'hidden',
    opacity: 0.6,
  },
  zoomBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeframeWrapper: {
    height: 44,
    width: '100%',
    backgroundColor: '#0E131C',
    borderTopWidth: 1,
    borderColor: '#1A2333',
    justifyContent: 'center',
  },
  timeframeScrollView: {
    width: '100%',
    ...(Platform.OS === 'web' ? {
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    } : {}),
  },
  timeframeContainer: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tfButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tfButtonActive: {
    backgroundColor: '#1E40AF',
  },
  tfText: {
    color: '#8A99AF',
    fontSize: 12,
    fontWeight: '600',
  },
  tfTextActive: {
    color: '#FFFFFF',
  },
  intervalDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#243247',
    marginHorizontal: 8,
  },
  intervalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#161F2E',
    borderWidth: 1,
    borderColor: '#243247',
  },
  intervalText: {
    color: '#8A99AF',
    fontSize: 11,
    fontWeight: '500',
  },
});
