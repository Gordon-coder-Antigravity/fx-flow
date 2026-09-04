import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, LayoutChangeEvent, Platform } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AVAILABLE_CURRENCIES } from '../utils/mockData';
import { fetchHistory, Timeframe, ChartDataPoint } from '../utils/historyApi';
import Tooltip from './Tooltip';

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

  const [selectedPoint, setSelectedPoint] = useState<{
    index: number;
    x: number;
    y: number;
    value: number;
    date: string;
  } | null>(null);

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

  // Wide minimum width (800px) so data stretches out legibly for horizontal swiping
  const chartContentWidth = Math.max(800, chartData.length * 48);
  const calculatedSpacing = chartData.length > 1
    ? Math.max(36, Math.floor((chartContentWidth - 126) / (chartData.length - 1)))
    : 40;

  // Set the latest point as active whenever chart data loads or geometry updates
  useEffect(() => {
    if (chartData.length > 0) {
      const lastIdx = chartData.length - 1;
      const lastItem = chartData[lastIdx];
      const norm = maxYValue > 0 ? (lastItem.value - yAxisOffset) / maxYValue : 0.5;
      const ptY = Math.max(15, Math.min(chartHeight - 15, chartHeight - norm * chartHeight));
      const ptX = 50 + lastIdx * calculatedSpacing;
      setSelectedPoint({
        index: lastIdx,
        x: ptX,
        y: ptY,
        value: lastItem.value,
        date: lastItem.date,
      });
    }
  }, [chartData, chartHeight, calculatedSpacing, maxYValue, yAxisOffset]);

  const handlePointPress = (item: ChartDataPoint, index: number, colX: number) => {
    const norm = maxYValue > 0 ? (item.value - yAxisOffset) / maxYValue : 0.5;
    const ptY = Math.max(15, Math.min(chartHeight - 15, chartHeight - norm * chartHeight));
    
    setSelectedPoint({
      index,
      x: colX,
      y: ptY,
      value: item.value,
      date: item.date,
    });

    setCurrentRate(item.value);
    setLastDate(item.date);
    if (chartData.length > 0) {
      const firstRate = chartData[0].value;
      setPercentChange(((item.value - firstRate) / (firstRate || 1)) * 100);
      setTrendColor(item.value >= firstRate ? '#00E676' : '#FF3D00');
    }
  };

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
        {/* .chart-container: dual-layer layout with absolute-positioned pinned Y-axis overlay */}
        <View style={styles.chartDualLayerContainer} onLayout={onChartContainerLayout}>
          {loading ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator color="#2962FF" size="large" />
            </View>
          ) : chartData.length === 0 ? (
            <View style={styles.loadingWrapper}>
              <Text style={{ color: '#8A99AF' }}>No data available for this pair.</Text>
            </View>
          ) : (
            <>
              {/* Layer 1 (Underneath): Horizontally scrollable wrapper with overflow-x: auto and scrollbar-width: none */}
              <ScrollView
                ref={horizontalScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                bounces={true}
                style={styles.chartScrollWrapper}
                contentContainerStyle={{ width: chartContentWidth, height: chartHeight + 40 }}
                {...(Platform.OS === 'web' ? {
                  onMouseDown: handleMouseDown,
                  onMouseMove: handleMouseMove,
                  onMouseUp: handleMouseUp,
                  onMouseLeave: handleMouseUp,
                } : {})}
              >
                <View style={{ width: chartContentWidth, height: chartHeight + 40, position: 'relative' }}>
                  {/* Layer 1A: Underlying SVG line chart and X-axis dates */}
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: chartContentWidth }}>
                    <LineChart
                      data={chartData}
                      width={chartContentWidth}
                      height={chartHeight}
                      spacing={calculatedSpacing}
                      initialSpacing={50}
                      endSpacing={76}
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
                      rulesLength={chartContentWidth}
                      yAxisOffset={yAxisOffset}
                      maxValue={maxYValue}
                      noOfSections={4}
                      rulesColor="#1A253C"
                      rulesType="dotted"
                      hideDataPoints={false}
                      dataPointsRadius={3}
                      dataPointsColor="#2962FF"
                      maintainAspectRatio={false}
                      disableScroll={true}
                      xAxisLabelsHeight={24}
                      labelsExtraHeight={16}
                      overflowBottom={24}
                      xAxisLabelTextStyle={{ 
                        color: '#5C6B89', 
                        fontSize: 11, 
                        width: 80, 
                        textAlign: 'center', 
                        marginLeft: -40,
                        transform: [{ rotate: '0deg' }]
                      }}
                    />
                  </View>

                  {/* Layer 1B: Vertical guideline for active point */}
                  {selectedPoint && (
                    <View
                      pointerEvents="none"
                      style={[styles.activeGuideLine, { left: selectedPoint.x, height: chartHeight }]}
                    />
                  )}

                  {/* Layer 1C: Active highlighted dot */}
                  {selectedPoint && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.activeDotRing,
                        { left: selectedPoint.x - 10, top: selectedPoint.y - 10 },
                      ]}
                    >
                      <View style={styles.activeDotCenter} />
                    </View>
                  )}

                  {/* Layer 1D: Tooltip component explicitly imported and rendered inside the chart */}
                  {selectedPoint && (
                    <Tooltip
                      visible={true}
                      x={selectedPoint.x}
                      y={selectedPoint.y}
                      value={selectedPoint.value}
                      date={selectedPoint.date}
                      baseCurrency={baseCurrency}
                      targetCurrency={targetCurrency}
                      chartHeight={chartHeight}
                      chartWidth={chartContentWidth}
                    />
                  )}

                  {/* Layer 1E: Mobile-friendly touch targets across each column so tapping near line triggers label */}
                  <View style={styles.touchOverlay}>
                    {chartData.map((d, index) => {
                      const colX = 50 + index * calculatedSpacing;
                      const colWidth = calculatedSpacing;
                      return (
                        <TouchableOpacity
                          key={index}
                          activeOpacity={1}
                          onPress={() => handlePointPress(d, index, colX)}
                          style={[
                            styles.touchColumn,
                            {
                              left: colX - colWidth / 2,
                              width: colWidth,
                              height: chartHeight + 30,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Layer 2 (Top): Separate, absolute-positioned Y-axis overlay permanently pinned on the right */}
              <View 
                style={[styles.yAxisAbsoluteOverlay, { height: chartHeight }]} 
                pointerEvents="none"
              >
                {yAxisLabels.map((val, idx) => (
                  <View key={idx} style={styles.yAxisLabelRow}>
                    <Text style={styles.fixedYAxisText}>{val}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Period Option Buttons row with overflow-x: auto and flex gap */}
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
  // .chart-container: dual-layer container with relative positioning
  chartDualLayerContainer: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  loadingWrapper: {
    flex: 1,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Layer 1: Scrollable chart wrapper with overflow-x: auto and scrollbar-width: none
  chartScrollWrapper: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    ...(Platform.OS === 'web' ? {
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      WebkitOverflowScrolling: 'touch',
      cursor: 'grab',
      userSelect: 'none',
    } : {}),
  },
  // Layer 2: Absolute-positioned pinned Y-axis overlay permanently on top of the view on the right
  yAxisAbsoluteOverlay: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 66,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingLeft: 8,
    paddingRight: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderLeftWidth: 1,
    borderLeftColor: '#1A253C',
    zIndex: 30,
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
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  touchColumn: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  activeGuideLine: {
    position: 'absolute',
    top: 0,
    width: 1,
    backgroundColor: '#5C6B89',
    opacity: 0.6,
    zIndex: 21,
  },
  activeDotRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(41, 98, 255, 0.3)',
    borderWidth: 2,
    borderColor: '#2962FF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 22,
  },
  activeDotCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
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
