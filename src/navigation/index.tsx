import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { initCrypto } from '../utils/crypto';
import { removeKeypairForUser } from '../utils/crypto';
import { supabase } from '../services/supabase';
import { setSessionPassword, clearSessionPassword } from '../services/sessionStore';

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import KeyGenerationScreen from '../screens/KeyGenerationScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import GalleryScreen from '../screens/GalleryScreen';

import { Conversation, User } from '../types';

type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  KeyGeneration: { userId: string; username: string; password: string };
  MainTabs: undefined;
  Chat: { conversation: Conversation; otherUser: User };
};

type MainTabsParamList = {
  ChatList: undefined;
  Gallery: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

export default function Navigation() {
  const { session, user, loading, signUp, signIn, signOut, refetchUser } = useAuth();
  const [hasKeys, setHasKeys] = useState<boolean | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'signup'>('login');
  const [currentPassword, setCurrentPassword] = useState<string>(''); // Store password temporarily for key loading
  const [newUserData, setNewUserData] = useState<{
    userId: string;
    username: string;
    password: string;
  } | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [showPasswordRetry, setShowPasswordRetry] = useState(false);
  const [passwordRetryError, setPasswordRetryError] = useState<string>('');
  const [retryPassword, setRetryPassword] = useState<string>('');
  const [retryAttempts, setRetryAttempts] = useState<number>(0);

  useEffect(() => {
    initCrypto();
    checkForKeys();
    fetchOtherUser();
  }, [user]);

  const checkForKeys = async () => {
    try {
      if (!user) {
        setHasKeys(false);
        return;
      }
      // If we have the password, try DB-first load
      if (currentPassword) {
        const keypair = await import('../utils/crypto').then(m =>
          m.getStoredKeypairForUser(user.id, currentPassword, supabase)
        );
        setHasKeys(!!keypair);
        return;
      }
      // No password available (e.g., after reload). Check if encrypted key exists in DB.
      const { data, error } = await supabase
        .from('users')
        .select('encrypted_private_key')
        .eq('id', user.id)
        .maybeSingle();
      if (!error && data?.encrypted_private_key) {
        // Prompt for password to unlock instead of forcing key generation
        setShowPasswordRetry(true);
        setPasswordRetryError('');
        setHasKeys(false);
        return;
      }
      // Otherwise, no keys exist yet
      setHasKeys(false);
    } catch (err: any) {
      // If decryption failed, show password retry modal
      if (err.message && err.message.includes('Failed to decrypt private key')) {
        setShowPasswordRetry(true);
        setPasswordRetryError('Incorrect password. Please try again.');
      } else {
        setHasKeys(false);
      }
    }
  };

  const fetchOtherUser = async () => {
    if (!user) return;
    
    try {
      // Fetch the other user (in a 1:1 app, there should be only one other user)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', user.id)
        .limit(1)
        .single();

      if (data) {
        setOtherUser(data);
      }
    } catch (error) {
      console.error('Error fetching other user:', error);
    }
  };

  const handleSignup = async (
    email: string,
    password: string,
    username: string,
    navigation?: any
  ) => {
    try {
      const result = await signUp(email, password, username);
      if (result?.user) {
        // Don't create user profile here - let key generation do it
        // Just set newUserData to trigger key generation flow
        setNewUserData({ userId: result.user.id, username, password });
        setAuthScreen('login');
      } else {
        throw new Error('Signup failed. No user returned.');
      }
    } catch (error: any) {
      throw error;
    }
  };

  const handleLogin = async (email: string, password: string, navigation?: any) => {
    try {
      const result = await signIn(email, password);
      if (!result?.session) {
        throw new Error('Login failed. No session returned.');
      }
      // Store password in session for key loading across all screens
      setCurrentPassword(password);
      setSessionPassword(password);
      
      // If newUserData exists, set it again to trigger key generation flow
      if (!newUserData && result.session.user) {
        // Check if user profile exists
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', result.session.user.id)
          .maybeSingle();
        // If no user profile or no public key, need to generate keys
        if (!userData || !userData.public_key) {
          const username = result.session.user.user_metadata?.username || result.session.user.email?.split('@')[0] || 'user';
          setNewUserData({ userId: result.session.user.id, username, password });
        }
      }
      // After login, navigation is handled by conditional rendering
    } catch (error: any) {
      throw error;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    if (user) {
      await removeKeypairForUser(user.id);
    }
    clearSessionPassword();
    setHasKeys(false);
  };

  const handleKeysGenerated = async () => {
    setHasKeys(true);
    setNewUserData(null);
    // Refetch user profile from database after keys are generated
    await refetchUser();
  };

  if (loading || hasKeys === null) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
        {/* Password retry modal */}
        {showPasswordRetry && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000a', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, width: 320 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Enter Password to Unlock Keys</Text>
              {passwordRetryError ? <Text style={{ color: 'red', marginBottom: 8 }}>{passwordRetryError}</Text> : null}
              <TextInput
                secureTextEntry
                placeholder="Password"
                value={retryPassword}
                onChangeText={setRetryPassword}
                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 16 }}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                  style={{ backgroundColor: '#6366f1', padding: 10, borderRadius: 8 }}
                  onPress={async () => {
                    setPasswordRetryError('');
                    if (!user) {
                      setPasswordRetryError('No user found.');
                      return;
                    }
                    try {
                      const keypair = await import('../utils/crypto').then(m =>
                        m.getStoredKeypairForUser(user.id, retryPassword, supabase)
                      );
                      if (keypair) {
                        setCurrentPassword(retryPassword);
                        setHasKeys(true);
                        setShowPasswordRetry(false);
                        setRetryPassword('');
                        setPasswordRetryError('');
                        setRetryAttempts(0);
                      } else {
                        setPasswordRetryError('Failed to unlock keys.');
                        setRetryAttempts((prev) => {
                          const next = prev + 1;
                          if (next >= 3) {
                            // Self destruct: wipe this user's data without warning
                            import('../services/selfDestruct').then(async (m) => {
                              try {
                                await m.wipeAllUserData(user.id);
                              } catch {}
                              // Clear local
                              if (user) { await removeKeypairForUser(user.id); }
                              setShowPasswordRetry(false);
                              setRetryPassword('');
                              setPasswordRetryError('');
                              // Optionally sign out
                              await signOut();
                            });
                          }
                          return next;
                        });
                      }
                    } catch (err: any) {
                      setPasswordRetryError('Incorrect password. Please try again.');
                      setRetryAttempts((prev) => {
                        const next = prev + 1;
                        if (next >= 3 && user) {
                          import('../services/selfDestruct').then(async (m) => {
                            try {
                              await m.wipeAllUserData(user.id);
                            } catch {}
                            if (user) { await removeKeypairForUser(user.id); }
                            setShowPasswordRetry(false);
                            setRetryPassword('');
                            setPasswordRetryError('');
                            await signOut();
                          });
                        }
                        return next;
                      });
                    }
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#eee', padding: 10, borderRadius: 8 }}
                  onPress={() => {
                    setShowPasswordRetry(false);
                    setRetryPassword('');
                    setPasswordRetryError('');
                    clearSessionPassword();
                    // Optionally, offer reset account here
                  }}
                >
                  <Text style={{ color: '#333' }}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={{ marginTop: 16, alignSelf: 'center' }}
                onPress={() => {
                  // Reset account logic: clear keys, force key regeneration
                  if (user) { removeKeypairForUser(user.id); }
                  setHasKeys(false);
                  setShowPasswordRetry(false);
                  setRetryPassword('');
                  setPasswordRetryError('');
                  if (user) {
                    // Use user metadata for username/email fallback
                    const username = (user as any).user_metadata?.username || (user as any).email?.split('@')[0] || 'user';
                    setNewUserData({ userId: user.id, username, password: '' });
                  }
                }}
              >
                <Text style={{ color: 'red', fontWeight: 'bold' }}>Reset Account (Lose old messages)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Not authenticated OR authenticated but need to generate keys
  if (!session) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {authScreen === 'login' ? (
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen
                  {...props}
                  onLogin={(email, password) => handleLogin(email, password, props.navigation)}
                  onNavigateToSignup={() => setAuthScreen('signup')}
                />
              )}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Signup">
              {(props) => (
                <SignupScreen
                  {...props}
                  onSignup={(email, password, username) => handleSignup(email, password, username, props.navigation)}
                  onNavigateToLogin={() => setAuthScreen('login')}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Only show KeyGeneration when explicitly required (fresh signup or detected missing public_key)
  if (newUserData) {
    const userDataForKeys = newUserData || {
      userId: session.user.id,
      username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
      password: currentPassword || '', // Use stored password from login
    };
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="KeyGeneration">
            {(props) => (
              <KeyGenerationScreen
                {...props}
                userId={userDataForKeys.userId}
                username={userDataForKeys.username}
                password={userDataForKeys.password}
                onComplete={handleKeysGenerated}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Authenticated with keys - user must exist at this point
  if (!user) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  // Authenticated with keys
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs">
          {() => (
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: {
                  backgroundColor: '#1e293b',
                  borderTopColor: '#475569',
                },
                tabBarActiveTintColor: '#6366f1',
                tabBarInactiveTintColor: '#94a3b8',
              }}
            >
              <Tab.Screen
                name="ChatList"
                options={{
                  tabBarLabel: 'Messages',
                  tabBarIcon: ({ color }) => (
                    <Text style={{ fontSize: 24 }}>💬</Text>
                  ),
                }}
              >
                {(props) => (
                  <ChatListScreen
                    {...props}
                    currentUserId={user.id}
                    onChatPress={(conversation, otherUser) =>
                      props.navigation.navigate('Chat' as never, { conversation, otherUser } as never)
                    }
                    onSignOut={handleSignOut}
                  />
                )}
              </Tab.Screen>

              <Tab.Screen
                name="Gallery"
                options={{
                  tabBarLabel: 'Gallery',
                  tabBarIcon: ({ color }) => (
                    <Text style={{ fontSize: 24 }}>📸</Text>
                  ),
                }}
              >
                {(props) => (
                  <GalleryScreen
                    {...props}
                    currentUser={user}
                    otherUser={otherUser}
                    onBack={() => props.navigation.navigate('ChatList')}
                  />
                )}
              </Tab.Screen>
            </Tab.Navigator>
          )}
        </Stack.Screen>

        <Stack.Screen name="Chat">
          {({ route, navigation }) => (
            <ChatScreen
              conversation={route.params.conversation}
              currentUser={user}
              otherUser={route.params.otherUser}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
