import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import MarketScreen from './market';
import ShopScreen from './shop';
import OrdersScreen from './orders';
import BlogsScreen from './BlogsScreen';
import ProfileScreen from './ProfileScreen'
import { AuthProvider } from './AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              const iconSize = 24;
              const iconColor = focused ? '#4CAF50' : '#95a5a6';

              return (
                <View style={[styles.iconContainer]}>
                  {route.name === 'Market' && (
                    <MaterialCommunityIcons 
                      name={focused ? 'shopping' : 'shopping-outline'} 
                      size={iconSize} 
                      color={iconColor} 
                    />
                  )}
                  {route.name === 'My Shop' && (
                    <FontAwesome5 
                      name={focused ? 'store-alt' : 'store'} 
                      size={iconSize} 
                      color={iconColor} 
                    />
                  )}
                  {route.name === 'Orders' && (
                    <Ionicons 
                      name={focused ? 'receipt' : 'receipt-outline'} 
                      size={iconSize} 
                      color={iconColor} 
                    />
                  )}
                  {route.name === 'Blogs' && (
                    <Ionicons 
                      name={focused ? 'newspaper' : 'newspaper-outline'} 
                      size={iconSize} 
                      color={iconColor} 
                    />
                  )}
                  {route.name === 'profile' && (
                    <Ionicons 
                      name={focused ? 'people' : 'people-outline'} 
                      size={iconSize} 
                      color={iconColor} 
                    />
                  )}
                </View>
              );
            },
            tabBarLabel: ({ focused, color }) => {
              let labelColor = focused ? '#4CAF50' : '#95a5a6';
              return (
                <Text style={[styles.label, { color: labelColor }]}>
                  {route.name}
                </Text>
              );
            },
            tabBarStyle: styles.tabBar,
            headerShown: false,
          })}
        >
          <Tab.Screen name="Market" component={MarketScreen} />
          <Tab.Screen name="My Shop" component={ShopScreen} />
          <Tab.Screen name="Orders" component={OrdersScreen} />
          <Tab.Screen name="Blogs" component={BlogsScreen} />
          <Tab.Screen name="profile" component={ProfileScreen} />
        </Tab.Navigator>
      </ProtectedRoute>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 0,
    backgroundColor: '#ffffff',
    borderRadius: 15,
    height: 70,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.5,
    borderTopWidth: 0,
    paddingBottom: 0,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: -5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
});