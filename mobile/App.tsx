import React from 'react';
import { StatusBar, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';

// Ignore non-blocking logs for smoother production preview
LogBox.ignoreAllLogs();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar backgroundColor="#FAECE1" barStyle="dark-content" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
