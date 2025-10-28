import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onNavigateToSignup: () => void;
}

export default function LoginScreen({ onLogin, onNavigateToSignup }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { colors } = useTheme();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 28, color: colors.primary }}>🔒</Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>Welcome Back</Text>
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>Sign in to your secure account</Text>
          </View>

          <View style={{ gap: 18 }}>
            <View>
              <Text style={{ color: colors.text, marginBottom: 8, fontWeight: '600', fontSize: 15 }}>Email</Text>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  color: colors.text,
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: colors.border,
                  fontSize: 16,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                }}
                placeholder="your@email.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>
            <View>
              <Text style={{ color: colors.text, marginBottom: 6, fontWeight: '500' }}>Password</Text>
              <TextInput
                style={{ backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, fontSize: 16 }}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, marginTop: 16, alignItems: 'center' }}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Sign In</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 12, alignItems: 'center' }}
              onPress={onNavigateToSignup}
              disabled={loading}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                Don't have an account?{' '}
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
