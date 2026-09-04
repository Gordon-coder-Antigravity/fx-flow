import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence, 
  useSharedValue 
} from 'react-native-reanimated';

export type CurrencyData = {
  id: string;
  code: string;
  name: string;
  symbol: string;
};

type Props = {
  item: CurrencyData;
  drag: () => void;
  isActive: boolean;
  onRemove: (id: string) => void;
  isBase: boolean;
  amount: string;
  onChangeAmount: (code: string, amount: string) => void;
  onBlurFormat: () => void;
  onFocus?: (e?: any) => void;
};

export default function CurrencyItem({ 
  item, 
  drag, 
  isActive, 
  onRemove, 
  isBase, 
  amount, 
  onChangeAmount, 
  onBlurFormat,
  onFocus 
}: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      rotation.value = withRepeat(
        withSequence(
          withTiming(-2.5, { duration: 120 }),
          withTiming(2.5, { duration: 120 })
        ),
        -1,
        true
      );
    } else {
      rotation.value = withTiming(0, { duration: 150 });
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withTiming(isActive ? 1.05 : 1, { duration: 150 }) },
        { rotate: `${rotation.value}deg` }
      ],
      elevation: isActive ? 15 : 0,
      shadowColor: isActive ? '#00B4D8' : '#000',
      shadowOffset: { width: 0, height: isActive ? 8 : 2 },
      shadowOpacity: isActive ? 0.6 : 0.1,
      shadowRadius: isActive ? 12 : 4,
      backgroundColor: isActive ? '#14203B' : 'transparent',
      zIndex: isActive ? 99 : 1,
    };
  });

  const handleInputFocus = (e: any) => {
    onFocus?.(e);
    if (e?.target?.select) {
      e.target.select();
    }
    setTimeout(() => {
      try {
        e?.target?.select?.();
      } catch (_) {}
    }, 50);
  };
  
  const len = amount.length;
  const dynamicFontSize = 
    len > 21 ? 9.5 :
    len > 18 ? 10 :
    len > 16 ? 11 :
    len > 14 ? 13.5 :
    len > 12 ? 15 :
    len > 10 ? 17 :
    len > 8 ? 19 :
    len > 7 ? 21 : 22;

  return (
    <ScaleDecorator>
      <Animated.View style={[styles.container, animatedStyle]}>
        {isBase && <View style={styles.baseIndicator} pointerEvents="none" />}
        
        <TouchableOpacity onLongPress={drag} delayLongPress={100} style={styles.dragHandle}>
          <Ionicons name="menu-outline" size={18} color="#8A99AF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.infoContainer} 
          onPress={handleInputFocus}
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
            onFocus={handleInputFocus}
            onChangeText={(text) => onChangeAmount(item.code, text)}
            onBlur={onBlurFormat}
            keyboardType="numeric"
            returnKeyType="done"
            selectTextOnFocus={true}
            editable={true}
            numberOfLines={1}
          />
          <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.removeButton}>
            <Ionicons name="close-outline" size={20} color="#8A99AF" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A253C',
    position: 'relative',
    paddingHorizontal: 10,
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
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    width: 80,
    flexShrink: 0,
    paddingRight: 4,
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
    flex: 1,
    gap: 6,
    position: 'relative',
    zIndex: 10,
  },
  rateInput: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'right',
    flex: 1,
    flexShrink: 1,
    paddingVertical: 2,
  },
  baseRateText: {
    color: '#00B4D8',
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
    marginLeft: 2,
  }
});
