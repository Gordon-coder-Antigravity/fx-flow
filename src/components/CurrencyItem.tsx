import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
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
};

export default function CurrencyItem({ item, drag, isActive, onRemove, isBase, amount, onChangeAmount, onBlurFormat }: Props) {
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
        {isBase && <View style={styles.baseIndicator} />}
        
        <TouchableOpacity onPressIn={drag} style={styles.dragHandle}>
          <Ionicons name="menu-outline" size={24} color="#8A99AF" />
        </TouchableOpacity>

        <View style={styles.infoContainer}>
          <Text style={styles.codeText}>{item.code}</Text>
          <Text style={styles.nameText}>{item.symbol} {item.name}</Text>
        </View>

        <View style={styles.rightContainer}>
          <TextInput
            style={[styles.rateInput, isBase && styles.baseRateText]}
            value={amount}
            onChangeText={(text) => onChangeAmount(item.code, text)}
            onBlur={onBlurFormat}
            keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
            returnKeyType="done"
            selectTextOnFocus
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A253C',
    position: 'relative',
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
  dragHandle: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
  }
});
