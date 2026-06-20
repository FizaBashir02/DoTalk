import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { lightTheme } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// Screens for React Native Native Views compilation references
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import OneToOneChatScreen from '../screens/OneToOneChatScreen';
import StatusFeedScreen from '../screens/StatusFeedScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: lightTheme.primary,
        tabBarInactiveTintColor: lightTheme.secondary,
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 0.5 },
      }}
    >
      <Tab.Screen name="Chats" component={StatusFeedScreen} />
      <Tab.Screen name="Groups" component={StatusFeedScreen} />
      <Tab.Screen name="Profile" component={StatusFeedScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEEBC5' }}>
        <ActivityIndicator size="large" color="#3B2E2B" />
      </View>
    );
  }

  const isAuthenticated = !!token;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeTabs} />
          <Stack.Screen name="ChatWindow" component={OneToOneChatScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
