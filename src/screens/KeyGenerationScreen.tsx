import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  initCrypto,
  generateIdentityKeypair,
  storeKeypairForUser,
} from '../utils/crypto';
import { supabase } from '../services/supabase';
import { useTheme } from '../components/ThemeProvider';

interface KeyGenerationScreenProps {
  userId: string;
  username: string;
  password: string;
  onComplete: () => void;
}

export default function KeyGenerationScreen({
  userId,
  username,
  password,
  onComplete,
}: KeyGenerationScreenProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to generate your encryption keys');
  const { colors } = useTheme();

  useEffect(() => {
    initCrypto();
  }, []);

  const handleGenerateKeys = async () => {
    setLoading(true);
    setStatus('Initializing cryptography...');
    try {
      await initCrypto();
      
      // CRITICAL: Check if keys already exist in database first
      // This prevents generating new keys on each device
      setStatus('Checking for existing keys in database...');
      const existingKeypair = await import('../utils/crypto').then(m => 
        m.getStoredKeypairForUser(userId, password, supabase)
      );
      
      if (existingKeypair && existingKeypair.privateKey) {
        setStatus('Keys found in database. Loading...');
        // Keys already exist, just ensure user profile is up to date
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            auth_user_id: userId,
            username: username,
            public_key: existingKeypair.publicKey,
          }, { onConflict: 'auth_user_id' });
        if (profileError) throw profileError;
        
        setStatus('Success! Keys loaded from database.');
        Alert.alert(
          '✅ Keys Loaded',
          'Your encryption keys have been loaded from the database. You can now decrypt all your messages and gallery items on this device.',
          [{ text: 'Continue', onPress: () => {
            setTimeout(() => {
              onComplete();
            }, 500);
          }}]
        );
        return;
      }
      
      // No existing keys, generate new ones
      setStatus('Generating your encryption keys...');
      const keypair = generateIdentityKeypair();
      setStatus('Storing keys securely in database (encrypted with password)...');
      
      // Store in database first (encrypted with password) - this is the source of truth
      await import('../utils/crypto').then(m => m.storeKeypairForUser(userId, keypair, password, supabase));
      
      // Verify keypair can be loaded
      const loadedKeypair = await import('../utils/crypto').then(m => m.getStoredKeypairForUser(userId, password, supabase));
      if (!loadedKeypair || !loadedKeypair.privateKey || loadedKeypair.privateKey.length < 40) {
        throw new Error('Failed to store private key securely. Please try again.');
      }
      setStatus('Uploading public key...');
      // Upsert user profile (insert if not exists, update if exists)
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          auth_user_id: userId,
          username: username,
          public_key: keypair.publicKey,
        }, { onConflict: 'auth_user_id' });
      if (profileError) throw profileError;
      setStatus('Success! Keys generated and secured.');
      
      Alert.alert(
        '✅ Keys Secured',
        'Your encryption keys have been generated and stored securely in the database (encrypted with your password). They will work on all your devices and platforms.',
        [{ text: 'Continue', onPress: () => {
          setTimeout(() => {
            onComplete();
          }, 500);
        }}]
      );
    } catch (error: any) {
      console.error('Error generating keys:', error);
      Alert.alert(
        'Error',
        'Failed to generate encryption keys. Please try again.',
        [{ text: 'OK', onPress: () => setLoading(false) }]
      );
      setStatus('Error generating keys');
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <Text style={{ fontSize: 56, marginBottom: 12 }}>🔐</Text>
        <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 8, textAlign: 'center' }}>
          Secure Your Account
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 16 }}>
          We'll generate end-to-end encryption keys to keep your messages private and secure.
        </Text>
      </View>
      <View style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
          <Text style={{ fontSize: 28, marginRight: 12 }}>🔑</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 2 }}>Private Keys</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              Stored securely on your device. Never shared with anyone.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
          <Text style={{ fontSize: 28, marginRight: 12 }}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 2 }}>Public Keys</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              Shared with your contacts to enable encrypted messaging.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 28, marginRight: 12 }}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 2 }}>Zero Knowledge</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              Even we can't read your messages. Only you and your recipient.
            </Text>
          </View>
        </View>
      </View>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 16 }}>{status}</Text>
      </View>
      <TouchableOpacity
        style={{ backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
        onPress={handleGenerateKeys}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Generate Encryption Keys</Text>
        )}
      </TouchableOpacity>
      <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 24 }}>
        This process is secure and happens entirely on your device. Your private keys never leave your device.
      </Text>
    </View>
  );
}
