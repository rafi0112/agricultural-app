import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MarketScreen from './market';
import ShopScreen from './shop';
import OrdersScreen from './orders';
import BlogsScreen from './BlogsScreen';
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
              let iconName;

              if (route.name === 'Market') {
                iconName = focused ? 'basket' : 'basket-outline';
              } else if (route.name === 'My Shop') {
                iconName = focused ? 'storefront' : 'storefront-outline';
              } else if (route.name === 'Orders') {
                iconName = focused ? 'list' : 'list-outline';
              } else if (route.name === 'Blogs') {
                iconName = focused ? 'newspaper' : 'newspaper-outline';
              }

              return <Ionicons icon={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#4CAF50',
            tabBarInactiveTintColor: 'gray',
            headerShown: false,
          })}
        >
          <Tab.Screen name="Market" component={MarketScreen} />
          <Tab.Screen name="My Shop" component={ShopScreen} />
          <Tab.Screen name="Orders" component={OrdersScreen} />
          <Tab.Screen name="Blogs" component={BlogsScreen} />
        </Tab.Navigator>
      </ProtectedRoute>
    </AuthProvider>
  );
}