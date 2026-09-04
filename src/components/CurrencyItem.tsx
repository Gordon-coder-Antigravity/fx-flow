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
  onFocus?: () => void;
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

  return (
    <ScaleDecorator>
      <Animated.View style={[styles.container, animatedStyle]}>
        {isBase && <View style={styles.baseIndicator} pointerEvents="none" />}
        
        <TouchableOpacity onLongPress={drag} delayLongPress={100} style={styles.dragHandle}>
          <Ionicons name="menu-outline" size={24} color="#8A99AF" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.infoContainer} 
          onPress={onFocus}
          activeOpacity={0.8}
        >
          <Text style={styles.codeText}>{item.code}</Text>
          <Text style={styles.nameText}>{item.symbol} {item.name}</Text>
        </TouchableOpacity>

        <View style={styles.rightContainer}>
          <TextInput
            style={[styles.rateInput, isBase && styles.baseRateText]}
            value={amount}
            onFocus={onFocus}
            onChangeText={(text) => onChangeAmount(item.code, text)}
            onBlur={onBlurFormat}
            keyboardType="numeric"
            returnKeyType="done"
            editable={true}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A253C',
    position: 'relative',
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1.4,
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
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 2.2,
    justifyContent: 'flex-end',
    position: 'relative',
    zIndex: 10,
  },
  rateInput: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    marginRight: 8,
    textAlign: 'right',
    flex: 1,
    paddingVertical: 4,
  },
  baseRateText: {
    color: '#00B4D8',
    fontWeight: '500',
  },
  removeButton: {
    padding: 6,
    marginLeft: 4,
  }
});
