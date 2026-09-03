import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PinchGestureHandler, State, PinchGestureHandlerGestureEvent, PinchGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';

import { AVAILABLE_CURRENCIES } from '../utils/mockData';
import { fetchRealHistory, Timeframe, ChartDataPoint } from '../utils/historyApi';

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
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentRate, setCurrentRate] = useState(1);
  const [percentChange, setPercentChange] = useState(0);
  const [trendColor, setTrendColor] = useState('#2962FF');
  const [lastDate, setLastDate] = useState('');

  const [zoomScale, setZoomScale] = useState(1);
  const baseScale = useRef(1);

  const onPinchEvent = (event: PinchGestureHandlerGestureEvent) => {
    let newScale = baseScale.current * event.nativeEvent.scale;
    if (newScale < 0.5) newScale = 0.5;
    if (newScale > 5) newScale = 5;
    setZoomScale(newScale);
  };

  const onPinchStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      baseScale.current = zoomScale;
    }
  };

  // Y-axis scaling
  const [yAxisOffset, setYAxisOffset] = useState(0);
  const [maxYValue, setMaxYValue] = useState(1);

  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    setZoomScale(1);
    baseScale.current = 1;
    loadData();
  }, [baseCurrency, targetCurrency, timeframe]);

  const loadData = async () => {
    setLoading(true);
    
    const history = await fetchRealHistory(baseCurrency, targetCurrency, timeframe);
    
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
      setPercentChange(((latestRate - firstRate) / firstRate) * 100);
      setLastDate(history[history.length - 1].date);
      
      const isUp = latestRate >= firstRate;
      setTrendColor(isUp ? '#00E676' : '#FF3D00');

      const formattedData = history.map((d, index) => {
        const isLast = index === history.length - 1;
        return {
          ...d,
          hideDataPoint: !isLast,
          dataPointColor: '#2962FF',
          dataPointRadius: isLast ? 5 : 0,
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

  const getSpacing = () => {
    if (chartData.length <= 1) return 10;
    
    // By giving fixed spacing rather than dividing by screen width,
    // the chart naturally becomes a slidable (scrollable) view!
    switch(timeframe) {
      case '1D': return 8;    // ~96 points
      case '1W': return Math.max(30, (screenWidth - 80) / Math.max(1, chartData.length - 1));
      case '1M': return 20;   // ~22 trading days
      case '3M': return 12;   // ~66 trading days
      case '6M': return 8;    // ~130 trading days
      case '1Y': return 6;    // ~260 trading days
      case '5Y': return 6;    // ~260 weeks
      case '10Y': return 8;   // ~120 months
      default: return 10;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: 30 }]}>
      
      {/* Currency Selectors */}
      <View style={styles.selectorsContainer}>
        <View style={styles.pillContainer}>
          <Text style={styles.flagIcon}>{FLAGS[baseCurrency]}</Text>
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
          <Text style={styles.flagIcon}>{FLAGS[targetCurrency]}</Text>
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
        {/* Use a single Text wrapper with adjustsFontSizeToFit so it never wraps to a new line */}
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

      {/* Chart */}
      <View style={styles.chartContainer}>
        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color="#2962FF" size="large" />
          </View>
        ) : chartData.length === 0 ? (
          <View style={styles.loadingWrapper}>
            <Text style={{ color: '#8A99AF' }}>No data available for this pair.</Text>
          </View>
        ) : (
          <PinchGestureHandler
            onGestureEvent={onPinchEvent}
            onHandlerStateChange={onPinchStateChange}
          >
            <View style={{ flex: 1, width: screenWidth - 20 }}>
              <LineChart
                data={chartData}
                width={screenWidth - 80}
                height={260}
                spacing={getSpacing() * zoomScale}
                initialSpacing={15}
                scrollToEnd={true}
                color="#2962FF"
                thickness={2.5}
                startFillColor="#2962FF"
                endFillColor="#2962FF"
                startOpacity={0.3}
                endOpacity={0.01}
                yAxisColor="transparent"
                xAxisColor="transparent"
                yAxisSide={1} 
                yAxisLabelWidth={60} 
                yAxisOffset={yAxisOffset}
                maxValue={maxYValue}
                noOfSections={4}
                yAxisTextStyle={{ color: '#5C6B89', fontSize: 11, textAlign: 'right', paddingRight: 5 }}
                xAxisLabelTextStyle={{ color: '#5C6B89', fontSize: 11, width: 60, textAlign: 'center', marginLeft: -30 }}
                formatYLabel={(label) => Number(label).toFixed(4)}
                rulesColor="#1A253C"
                rulesType="dotted"
                hideDataPoints={false}
                pointerConfig={{
                  pointerStripHeight: 260,
                  pointerStripColor: '#5C6B89',
                  pointerStripWidth: 1,
                  pointerColor: '#2962FF',
                  radius: 6,
                  pointerLabelWidth: 100,
                  pointerLabelHeight: 90,
                  activatePointersOnLongPress: true,
                  autoAdjustPointerLabelPosition: true,
                  pointerLabelComponent: (items: any) => {
                    return (
                      <View style={styles.tooltipContainer}>
                        <Text style={styles.tooltipDate}>{items[0].date}</Text>
                        <Text style={styles.tooltipValue}>{items[0].value.toFixed(6)}</Text>
                      </View>
                    );
                  },
                }}
              />
            </View>
          </PinchGestureHandler>
        )}
      </View>

      {/* Timeframes */}
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
    marginBottom: 20,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 0.47,
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
    marginBottom: 0, // Reduced to give more room for the chart below
  },
  singleLineRate: {
    width: '100%',
    marginBottom: 4,
  },
  mainRateBase: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mainRateEqual: {
    color: '#FFFFFF',
    fontSize: 24,
  },
  mainRateValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  mainRateTarget: {
    color: '#8A99AF',
    fontSize: 22,
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
  chartContainer: {
    height: 270,
    paddingBottom: 20,
    paddingLeft: 10,
    paddingRight: 10,
    justifyContent: 'center',
    marginBottom: 10,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeframeWrapper: {
    marginTop: 'auto', 
    marginBottom: 15,
  },
  timeframeContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
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
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2962FF',
  },
  tooltipDate: {
    color: '#8A99AF',
    fontSize: 12,
    marginBottom: 4,
  },
  tooltipValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
