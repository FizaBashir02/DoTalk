import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const onboardingSteps = [
  {
    title: 'Instant Sockets Connection',
    description: 'Experience lightning-fast private and group messaging backed by real-time dual-channel Socket.io delivery pipelines.',
    accent: '#A67C52',
  },
  {
    title: 'Robust Group Moderation',
    description: 'Take charge of your channels. Efficient administrative controls to designate moderators and control group members easily.',
    accent: '#8C6A4D',
  },
  {
    title: 'Secure OTP Handshakes',
    description: 'Security is paramount at DoTalk. Sign up and verify instantly using dual-factor cryptographically-signed OTP verification.',
    accent: '#A67C52',
  },
];

export default function OnboardingScreen({ navigation }: any) {
  const [index, setIndex] = useState(0);

  const handleNext = () => {
    if (index < onboardingSteps.length - 1) {
      setIndex(index + 1);
    } else {
      navigation.replace('Login');
    }
  };

  const handleSkip = () => {
    navigation.replace('Login');
  };

  const currentStep = onboardingSteps[index];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FEEBC5" barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.illustrationPlace}>
          <Text style={styles.logoBadge}>💬 DoTalk</Text>
          <View style={[styles.circle, { backgroundColor: currentStep.accent + '22' }]} />
        </View>

        <Text style={styles.stepTitle}>{currentStep.title}</Text>
        <Text style={styles.stepDescription}>{currentStep.description}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {onboardingSteps.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                { backgroundColor: idx === index ? '#3B2E2B' : '#A67C5244' },
                idx === index ? styles.activeDot : null,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextText}>
            {index === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEEBC5',
  },
  header: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
  },
  skipButton: {
    fontSize: 14,
    color: '#8C6A4D',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illustrationPlace: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  logoBadge: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B2E2B',
    zIndex: 2,
  },
  circle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    zIndex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3B2E2B',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 14,
    color: '#3B2E2B',
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  footer: {
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: 32,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 20,
    height: 6,
    borderRadius: 3,
  },
  nextButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#3B2E2B',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B2E2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  nextText: {
    fontSize: 15,
    color: '#FEEBC5',
    fontWeight: 'bold',
  },
});
