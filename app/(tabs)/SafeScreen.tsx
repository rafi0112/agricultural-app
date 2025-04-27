// SafeScreen.tsx
import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ViewStyle } from 'react-native';

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

const SafeScreen = ({ children, style }: SafeScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View 
      style={[
        styles.container,
        {
          paddingTop: insets.top + 10, // Add extra padding to the top
          paddingBottom: insets.bottom + 10, // Add extra padding to the bottom
          paddingLeft: insets.left + 10, // Add extra padding to the left
          paddingRight: insets.right + 10, // Add extra padding to the right
        },
        style
      ]}
    >
      <StatusBar barStyle="dark-content" />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default SafeScreen;