import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, StatusBar } from 'react-native';

export default function SplashScreen({ navigation }: any) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#3B2E2B" barStyle="light-content" />
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>DoTalk</Text>
        <Text style={styles.subtitle}>Premium Real-Time Messenger</Text>
      </View>
      <ActivityIndicator size="small" color="#FEEBC5" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3B2E2B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FEEBC5',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: '#A67C52',
    fontWeight: '600',
    marginTop: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  loader: {
    position: 'absolute',
    bottom: 60,
  },
});
