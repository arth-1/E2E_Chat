import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../components/ThemeProvider';

interface SignupScreenProps {
  onSignup: (email: string, password: string, username: string) => Promise<void>;
  onNavigateToLogin: () => void;
}

export default function SignupScreen({ onSignup, onNavigateToLogin }: SignupScreenProps) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await onSignup(email, password, username);
    } catch (error: any) {
      Alert.alert('Signup Error', error.message || 'An error occurred');
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
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 }}>
          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 28, marginBottom: 18, textAlign: 'center' }}>Sign Up</Text>

          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: colors.text, marginBottom: 8, fontWeight: '600', fontSize: 15 }}>Username</Text>
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
              placeholder="Choose a username"
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={{ marginBottom: 18 }}>
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
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: colors.text, marginBottom: 8, fontWeight: '600', fontSize: 15 }}>Password</Text>
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
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text style={{ color: colors.text, marginBottom: 8, fontWeight: '600', fontSize: 15 }}>Confirm Password</Text>
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
              placeholder="Re-enter password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 28, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 }}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18 }}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{ marginTop: 18, alignItems: 'center' }}
            onPress={onNavigateToLogin}
          >
            <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 16 }}>
              Already have an account? <Text style={{ textDecorationLine: 'underline' }}>Log In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
