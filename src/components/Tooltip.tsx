import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface TooltipProps {
  visible: boolean;
  x: number;
  y: number;
  value: number;
  date: string;
  baseCurrency: string;
  targetCurrency: string;
  chartHeight: number;
  chartWidth: number;
}

export default function Tooltip({
  visible,
  x,
  y,
  value,
  date,
  baseCurrency,
  targetCurrency,
  chartHeight,
  chartWidth,
}: TooltipProps) {
  if (!visible) return null;

  const tooltipWidth = 148;
  const tooltipHeight = 52;

  // Position tooltip above the point; if too close to the top, position below
  const isAbove = y > 65;
  const topPos = isAbove ? y - tooltipHeight - 12 : y + 14;
  
  // Keep tooltip within horizontal bounds of the chart
  const leftPos = Math.max(12, Math.min(chartWidth - tooltipWidth - 12, x - tooltipWidth / 2));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        {
          left: leftPos,
          top: topPos,
          width: tooltipWidth,
        },
      ]}
    >
      <Text style={styles.dateText}>{date}</Text>
      <Text style={styles.valueText}>
        1 {baseCurrency} = {value.toFixed(4)} {targetCurrency}
      </Text>
      {/* Downward triangle arrow */}
      {isAbove ? (
        <View style={[styles.arrowDown, { left: Math.max(12, Math.min(tooltipWidth - 24, x - leftPos - 6)) }]} />
      ) : (
        <View style={[styles.arrowUp, { left: Math.max(12, Math.min(tooltipWidth - 24, x - leftPos - 6)) }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    backgroundColor: '#161F30',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2962FF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 25,
  },
  dateText: {
    color: '#8A99AF',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  valueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2962FF',
  },
  arrowUp: {
    position: 'absolute',
    top: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#2962FF',
  },
});
