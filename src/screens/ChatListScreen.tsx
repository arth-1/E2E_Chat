import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { supabase } from '../services/supabase';
import { getOrCreateConversation } from '../services/conversations';
import { Conversation, User } from '../types';

interface ChatListScreenProps {
  currentUserId: string;
  onChatPress: (conversation: Conversation, otherUser: User) => void;
  onSignOut: () => void;
}

export default function ChatListScreen({
  currentUserId,
  onChatPress,
  onSignOut,
}: ChatListScreenProps) {
  const [conversations, setConversations] = useState<
    Array<Conversation & { otherUser: User; lastMessagePreview?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const { colors } = require('../components/ThemeProvider').useTheme();

  useEffect(() => {
    fetchConversations();
    initializeConversation();

    // Subscribe to new messages
    const subscription = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [currentUserId]);

  const initializeConversation = async () => {
    try {
      // Get the other user
      const { data: otherUsers } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUserId)
        .limit(1);

      if (otherUsers && otherUsers.length > 0) {
        // Create conversation if it doesn't exist
        await getOrCreateConversation(currentUserId, otherUsers[0].id);
        fetchConversations();
      }
    } catch (error) {
      console.error('Error initializing conversation:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Fetch other user details for each conversation
      const conversationsWithUsers = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId =
            conv.user_a === currentUserId ? conv.user_b : conv.user_a;

          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', otherUserId)
            .single();

          return {
            ...conv,
            otherUser: userData,
          };
        })
      );

      setConversations(conversationsWithUsers as any);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const renderConversation = ({
    item,
  }: {
    item: Conversation & { otherUser: User; lastMessagePreview?: string };
  }) => (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
      onPress={() => onChatPress(item, item.otherUser)}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 16,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>
          {item.otherUser?.username?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 18 }}>
            {item.otherUser?.username || 'Unknown User'}
          </Text>
          {item.last_message_at && (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {formatTime(item.last_message_at)}
            </Text>
          )}
        </View>
        <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
          {item.lastMessagePreview || 'Start a conversation'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Find People modal state
  const [findModalVisible, setFindModalVisible] = useState(false);
  const [findUsername, setFindUsername] = useState('');
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState('');

  const handleFindUser = async () => {
    setFindLoading(true);
    setFindError('');
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', findUsername)
        .single();
      if (error || !userData) {
        setFindError('User not found');
        setFindLoading(false);
        return;
      }
  // Create or get conversation using users.id (primary key)
  const conversation = await getOrCreateConversation(currentUserId, userData.id);
  setFindModalVisible(false);
  setFindUsername('');
  setFindLoading(false);
  setFindError('');
  onChatPress(conversation, userData);
    } catch (err) {
      setFindError('Error finding user');
      setFindLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>Messages</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setFindModalVisible(true)} style={{ marginRight: 16 }}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 16 }}>Find People</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSignOut}>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 16 }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Find People Modal */}
      {findModalVisible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background + 'CC', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
          <View style={{ backgroundColor: colors.surface, padding: 24, borderRadius: 18, width: '80%', shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 }}>
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 20, marginBottom: 12 }}>Find People by Username</Text>
            <TextInput
              style={{ backgroundColor: colors.background, color: colors.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 16, marginBottom: 12 }}
              placeholder="Enter Username"
              placeholderTextColor={colors.textSecondary}
              value={findUsername}
              onChangeText={setFindUsername}
              editable={!findLoading}
            />
            {findError ? <Text style={{ color: 'red', marginBottom: 8 }}>{findError}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity onPress={() => setFindModalVisible(false)} style={{ marginRight: 16 }} disabled={findLoading}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleFindUser} disabled={findLoading || !findUsername}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>{findLoading ? 'Finding...' : 'Start Chat'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {conversations.length === 0 && !loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>💬</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
            No conversations yet
          </Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Start chatting with someone to see your conversations here
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchConversations}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}
