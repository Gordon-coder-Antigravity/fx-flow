import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, LayoutChangeEvent, Platform } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AVAILABLE_CURRENCIES } from '../utils/mockData';
import { fetchHistory, Timeframe, ChartDataPoint } from '../utils/historyApi';

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', '10Y'];

const FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', TWD: '🇹🇼', JPY: '🇯🇵', CNY: '🇨🇳', 
  MYR: '🇲🇾', GBP: '🇬🇧', AUD: '🇦🇺', PHP: '🇵🇭', TRY: '🇹🇷'
};

export default function HistoryChart() {
  const insets = useSafeAreaInsets();
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [targetCurrency, setTargetCurrency] = useState('EUR');
  const [timeframe, setTimeframe] = useState<Timeframe>('1W');
  
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentRate, setCurrentRate] = useState(1);
  const [percentChange, setPercentChange] = useState(0);
  const [trendColor, setTrendColor] = useState('#2962FF');
  const [lastDate, setLastDate] = useState('');

  const horizontalScrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);

  // Dynamic chart height to fill remaining vertical space
  const [chartHeight, setChartHeight] = useState(240);

  // Y-axis scaling
  const [yAxisOffset, setYAxisOffset] = useState(0);
  const [maxYValue, setMaxYValue] = useState(1);

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadData();
  }, [baseCurrency, targetCurrency, timeframe]);

  // Scroll to the latest data point on the right whenever data loads
  useEffect(() => {
    if (chartData.length > 0) {
      const timer = setTimeout(() => {
        try {
          horizontalScrollRef.current?.scrollToEnd({ animated: false });
        } catch (e) {}
        if (Platform.OS === 'web') {
          const node = (horizontalScrollRef.current as any)?.getScrollableNode?.() || (horizontalScrollRef.current as any);
          if (node && typeof node.scrollLeft === 'number') {
            node.scrollLeft = node.scrollWidth || 99999;
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [chartData, timeframe]);

  const handleMouseDown = (e: any) => {
    if (Platform.OS !== 'web') return;
    isDragging.current = true;
    startX.current = e.pageX ?? e.clientX ?? 0;
    const node = (horizontalScrollRef.current as any)?.getScrollableNode?.() || (horizontalScrollRef.current as any);
    if (node && typeof node.scrollLeft === 'number') {
      scrollLeftPos.current = node.scrollLeft;
    }
  };

  const handleMouseMove = (e: any) => {
    if (Platform.OS !== 'web' || !isDragging.current) return;
    const currentX = e.pageX ?? e.clientX ?? 0;
    const walk = (startX.current - currentX);
    const node = (horizontalScrollRef.current as any)?.getScrollableNode?.() || (horizontalScrollRef.current as any);
    if (node && typeof node.scrollLeft === 'number') {
      node.scrollLeft = scrollLeftPos.current + walk;
    }
  };

  const handleMouseUp = () => {
    if (Platform.OS !== 'web') return;
    isDragging.current = false;
  };

  const loadData = async () => {
    setLoading(true);
    
    const history = await fetchHistory(baseCurrency, targetCurrency, timeframe);
    
    if (history.length > 0) {
      const minVal = Math.min(...history.map(d => d.value));
      const maxVal = Math.max(...history.map(d => d.value));
      
      const diff = maxVal - minVal;
      const padding = diff === 0 ? minVal * 0.001 : diff * 0.15;
      
      setYAxisOffset(Math.max(0, minVal - padding));
      setMaxYValue(diff + padding * 2);

      const firstRate = history[0].value;
      const latestRate = history[history.length - 1].value;
      
      setCurrentRate(latestRate);
      setPercentChange(((latestRate - firstRate) / (firstRate || 1)) * 100);
      setLastDate(history[history.length - 1].date);
      
      const isUp = latestRate >= firstRate;
      setTrendColor(isUp ? '#00E676' : '#FF3D00');

      const formattedData = history.map((d, index) => {
        const isLast = index === history.length - 1;
        return {
          ...d,
          hideDataPoint: !isLast,
          dataPointColor: '#2962FF',
          dataPointRadius: isLast ? 4 : 0,
        };
      });

      setChartData(formattedData);
    } else {
      setChartData([]);
    }
    
    setLoading(false);
  };

  const handleSwap = () => {
    const temp = baseCurrency;
    setBaseCurrency(targetCurrency);
    setTargetCurrency(temp);
  };

  const onChartContainerLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0) {
      // Reserve ~50px for X-axis labels and bottom padding
      const dynamicHeight = Math.max(160, Math.floor(height - 50));
      setChartHeight(dynamicHeight);
    }
  };

  // Wide width so historical data on the X-axis is comfortably slidable (minimum 800px)
  const targetWidth = Math.max(800, chartData.length * 48);
  const calculatedSpacing = chartData.length > 1
    ? Math.max(36, Math.floor((targetWidth - 50) / (chartData.length - 1)))
    : 40;
  const totalChartWidth = 20 + (chartData.length - 1) * calculatedSpacing + 30;

  // Compute 5 fixed Y-axis labels matching the 4 grid line sections
  const yStep = maxYValue / 4;
  const yAxisLabels = [
    (yAxisOffset + maxYValue).toFixed(4),
    (yAxisOffset + yStep * 3).toFixed(4),
    (yAxisOffset + yStep * 2).toFixed(4),
    (yAxisOffset + yStep).toFixed(4),
    yAxisOffset.toFixed(4),
  ];

  return (
    <View 
      style={[
        styles.container, 
        { paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: 16 }
      ]}
    >
      {/* Currency Selectors */}
      <View style={styles.selectorsContainer}>
        <View style={styles.pillContainer}>
          <Text style={styles.flagIcon}>{FLAGS[baseCurrency] || '🌐'}</Text>
          <Dropdown
            style={styles.dropdown}
            selectedTextStyle={styles.dropdownText}
            itemTextStyle={styles.dropdownItemText}
            data={AVAILABLE_CURRENCIES}
            labelField="value"
            valueField="value"
            value={baseCurrency}
            onChange={item => setBaseCurrency(item.value)}
            containerStyle={styles.dropdownPopup}
            activeColor="#1A253C"
            iconColor="#8A99AF"
          />
        </View>

        <TouchableOpacity onPress={handleSwap} style={styles.swapButton}>
          <Ionicons name="swap-horizontal" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.pillContainer}>
          <Text style={styles.flagIcon}>{FLAGS[targetCurrency] || '🌐'}</Text>
          <Dropdown
            style={styles.dropdown}
            selectedTextStyle={styles.dropdownText}
            itemTextStyle={styles.dropdownItemText}
            data={AVAILABLE_CURRENCIES}
            labelField="value"
            valueField="value"
            value={targetCurrency}
            onChange={item => setTargetCurrency(item.value)}
            containerStyle={styles.dropdownPopup}
            activeColor="#1A253C"
            iconColor="#8A99AF"
          />
        </View>
      </View>

      {/* Rate Display */}
      <View style={styles.rateDisplayContainer}>
        <Text 
          style={styles.singleLineRate} 
          adjustsFontSizeToFit 
          numberOfLines={1}
        >
          <Text style={styles.mainRateBase}>1 {baseCurrency}</Text>
          <Text style={styles.mainRateEqual}> = </Text>
          <Text style={styles.mainRateValue}>{currentRate.toFixed(4)}</Text>
          <Text style={styles.mainRateTarget}> {targetCurrency}</Text>
        </Text>
        
        <View style={styles.changeContainer}>
          <Ionicons 
            name={percentChange >= 0 ? 'arrow-up' : 'arrow-down'} 
            size={14} 
            color={trendColor} 
          />
          <Text style={[styles.changeText, { color: trendColor }]}>
            {Math.abs(percentChange).toFixed(2)}%
          </Text>
          <Text style={styles.dateText}>{lastDate}</Text>
        </View>
      </View>

      {/* .chart-wrapper: Dynamically fills remaining vertical space using Flexbox (flex: 1) with 16px gap */}
      <View style={styles.chartWrapper}>
        {/* .chart-container: flex: 1 and min-height: 0 so chart stretches to become taller */}
        <View style={styles.chartContainer} onLayout={onChartContainerLayout}>
          {loading ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator color="#2962FF" size="large" />
            </View>
          ) : chartData.length === 0 ? (
            <View style={styles.loadingWrapper}>
              <Text style={{ color: '#8A99AF' }}>No data available for this pair.</Text>
            </View>
          ) : (
            /* Split layout: Horizontally scrollable chart on left/center + Fixed Y-axis container permanently pinned on RIGHT */
            <View style={styles.splitChartLayout}>
              {/* Slidable chart area with native horizontal scrolling for line and X-axis dates */}
              <View
                style={styles.scrollableChartArea}
                {...(Platform.OS === 'web' ? {
                  onMouseDown: handleMouseDown,
                  onMouseMove: handleMouseMove,
                  onMouseUp: handleMouseUp,
                  onMouseLeave: handleMouseUp,
                } : {})}
              >
                <LineChart
                  data={chartData}
                  height={chartHeight}
                  spacing={calculatedSpacing}
                  initialSpacing={20}
                  endSpacing={30}
                  color="#2962FF"
                  thickness={2.5}
                  startFillColor="#2962FF"
                  endFillColor="#2962FF"
                  startOpacity={0.25}
                  endOpacity={0.01}
                  hideYAxisText={true}
                  yAxisLabelWidth={0}
                  yAxisThickness={0}
                  yAxisColor="transparent"
                  xAxisColor="transparent"
                  rulesLength={totalChartWidth}
                  yAxisOffset={yAxisOffset}
                  maxValue={maxYValue}
                  noOfSections={4}
                  rulesColor="#1A253C"
                  rulesType="dotted"
                  hideDataPoints={false}
                  maintainAspectRatio={false}
                  scrollRef={horizontalScrollRef}
                  scrollToEnd={true}
                  scrollAnimation={false}
                  showScrollIndicator={true}
                  indicatorColor="white"
                  xAxisLabelsHeight={24}
                  labelsExtraHeight={16}
                  overflowBottom={24}
                  xAxisLabelTextStyle={{ 
                    color: '#5C6B89', 
                    fontSize: 11, 
                    width: 76, 
                    textAlign: 'center', 
                    marginLeft: -28,
                    transform: [{ rotate: '0deg' }]
                  }}
                />
              </View>

              {/* Fixed container permanently pinned on the RIGHT for the Y-axis (price labels) */}
              <View style={[styles.fixedYAxisContainer, { height: chartHeight }]}>
                {yAxisLabels.map((val, idx) => (
                  <View key={idx} style={styles.yAxisLabelRow}>
                    <Text style={styles.fixedYAxisText}>{val}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Period Option Buttons row naturally pushed down to bottom */}
        <View style={styles.timeframeWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeframeContainer}>
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
  // .chart-wrapper dynamically fills remaining vertical space using Flexbox (flex: 1) with 16px gap
  chartWrapper: {
    flex: 1,
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 4,
  },
  // .chart-container: flex: 1 and min-height: 0 so chart stretches to become taller
  chartContainer: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  loadingWrapper: {
    flex: 1,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Split layout: Horizontally scrollable chart on left + Fixed Y-axis column permanently pinned on RIGHT
  splitChartLayout: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    minHeight: 0,
  },
  scrollableChartArea: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      cursor: 'grab',
      userSelect: 'none',
    } : {}),
  },
  fixedYAxisContainer: {
    width: 62,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 8,
    zIndex: 10,
  },
  yAxisLabelRow: {
    height: 16,
    justifyContent: 'center',
  },
  fixedYAxisText: {
    color: '#5C6B89',
    fontSize: 11,
    textAlign: 'left',
  },
  timeframeWrapper: {
    height: 48,
    justifyContent: 'center',
    marginBottom: 4,
  },
  timeframeContainer: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
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
  tooltipContainer: {
    backgroundColor: '#1C1C1E',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2962FF',
  },
  tooltipDate: {
    color: '#8A99AF',
    fontSize: 11,
    marginBottom: 2,
  },
  tooltipValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
