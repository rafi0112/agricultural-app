import React from 'react';
import { useAuth } from '../app/(tabs)/AuthContext';
import AuthScreen from '../app/(tabs)/AuthScreen';
import { View, ActivityIndicator } from 'react-native';
import { ReactNode } from 'react';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return currentUser ? children : <AuthScreen />;
};

export default ProtectedRoute;