import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getDiagnosticErrorMessage } from '../utils/api';

export default function LoginScreen({ navigation }: any) {
  const { login: performLogin, registerUser: performRegister, verifyOtpCode: performVerify } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [isVerifyStep, setIsVerifyStep] = useState(false);
  
  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in core credentials (email and password).');
      return;
    }

    setLoading(true);

    try {
      if (isVerifyStep) {
        const success = await performVerify(email, otpCode);
        setLoading(false);
        if (success) {
          Alert.alert('Activation Complete', 'Your account has been successfully verified! Welcome to DoTalk.');
          // Context changes token, causing navigator stack to update automatically
        }
        return;
      }

      if (isRegister) {
        if (!fullName || !username) {
          setLoading(false);
          Alert.alert('Error', 'Full name and username are required for sign up.');
          return;
        }

        const otpSecret = await performRegister({
          fullName,
          username,
          email,
          password,
          confirmPassword: password,
        });

        setLoading(false);
        if (otpSecret) {
          setIsVerifyStep(true);
          Alert.alert(
            'Activation Code Sent',
            'We have sent your 6-digit confirmation key. Check your email.'
          );
        }
      } else {
        const success = await performLogin(email, password);
        setLoading(false);
        if (success) {
          // Context changes token, causing navigator stack to update automatically
        }
      }
    } catch (e: any) {
      setLoading(false);
      const detailedMessage = getDiagnosticErrorMessage(e);
      Alert.alert(
        isVerifyStep ? 'Verification Failure' : isRegister ? 'Registration Failure' : 'Sign In Failure',
        detailedMessage
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FEEBC5" barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        <View style={styles.header}>
          <Text style={styles.logoTitle}>DoTalk</Text>
          <Text style={styles.tagline}>
            {isVerifyStep 
              ? 'Security Hub verification' 
              : isRegister ? 'Set up your luxury account' : 'Welcome back to elegant chats'}
          </Text>
        </View>

        <View style={styles.formCard}>
          {isVerifyStep ? (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>6-Digit Passcode</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter 6-digit OTP code"
                placeholderTextColor="#A67C52"
                keyboardType="numeric"
                maxLength={6}
                value={otpCode}
                onChangeText={setOtpCode}
              />
              <Text style={styles.infoText}>The code expires in 5 minutes.</Text>
            </View>
          ) : (
            <>
              {isRegister && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Liam Sterling"
                      placeholderTextColor="#A67C52"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Preferred Username</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. liam_design"
                      placeholderTextColor="#A67C52"
                      autoCapitalize="none"
                      value={username}
                      onChangeText={setUsername}
                    />
                  </View>
                </>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. liam@example.com"
                  placeholderTextColor="#A67C52"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Access Password</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Insert secure password"
                  placeholderTextColor="#A67C52"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleAction} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FEEBC5" />
            ) : (
              <Text style={styles.btnText}>
                {isVerifyStep 
                  ? 'Verify Now' 
                  : isRegister ? 'Send OTP Code' : 'Sign In Securely'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {!isVerifyStep && (
          <TouchableOpacity 
            style={styles.switchWrapper} 
            onPress={() => { setIsRegister(!isRegister); }}
          >
            <Text style={styles.switchText}>
              {isRegister 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        )}

        {isVerifyStep && (
          <TouchableOpacity 
            style={styles.switchWrapper} 
            onPress={() => { setIsVerifyStep(false); }}
          >
            <Text style={styles.switchText}>Back to Sign Up</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEEBC5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 36,
    alignItems: 'center',
  },
  logoTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#3B2E2B',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 13,
    color: '#8C6A4D',
    fontWeight: '600',
    marginTop: 6,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#3B2E2B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#3B2E2B',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  textInput: {
    height: 48,
    backgroundColor: '#FAECE144',
    borderWidth: 1,
    borderColor: '#8C6A4D22',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#3B2E2B',
  },
  infoText: {
    fontSize: 11,
    color: '#8C6A4D',
    marginTop: 6,
    fontStyle: 'italic',
  },
  primaryBtn: {
    height: 50,
    backgroundColor: '#3B2E2B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  btnText: {
    fontSize: 14,
    color: '#FEEBC5',
    fontWeight: 'bold',
  },
  switchWrapper: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 13,
    color: '#3B2E2B',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
