import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import Watchlist from './src/components/Watchlist';
import HistoryChart from './src/components/HistoryChart';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="light" />
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: {
                backgroundColor: '#000000',
                borderTopWidth: 0,
                height: 100, // Taller bar to comfortably fit the elevated frame
                paddingBottom: 30,
              },
              tabBarShowLabel: false, // Turn off native label so we can build a perfect custom frame
              tabBarIconStyle: {
                width: 90,
                height: 70, // Explicitly give the icon container enough height so it never cuts the text
                marginTop: 20,
              },
              tabBarIcon: ({ focused, color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap = 'home';
                let label = 'Home';

                if (route.name === 'Home') {
                  iconName = focused ? 'home' : 'home-outline';
                  label = 'Home';
                } else if (route.name === 'History') {
                  iconName = focused ? 'stats-chart' : 'stats-chart-outline';
                  label = 'Chart';
                }

                return (
                  <View style={[styles.pillContainer, focused && styles.pillActive]}>
                    <Ionicons name={iconName} size={22} color={focused ? '#2962FF' : '#5C6B89'} />
                    <Text style={[styles.pillText, { color: focused ? '#2962FF' : '#5C6B89', fontWeight: focused ? 'bold' : 'normal' }]}>
                      {label}
                    </Text>
                  </View>
                );
              },
            })}
          >
            <Tab.Screen name="Home" component={Watchlist} />
            <Tab.Screen name="History" component={HistoryChart} />
          </Tab.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pillContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10, // Plenty of padding top and bottom
    paddingHorizontal: 20,
    borderRadius: 24, // Smoother round corners
  },
  pillActive: {
    backgroundColor: 'rgba(41, 98, 255, 0.15)',
    // Adding beautiful glowing elevation shadow
    shadowColor: '#2962FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  pillText: {
    fontSize: 12,
    marginTop: 4,
  }
});
