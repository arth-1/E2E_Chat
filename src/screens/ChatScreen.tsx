import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
  Image as RNImage,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { getSessionPassword } from '../services/sessionStore';
import { Message, User, Conversation } from '../types';
import { useTheme } from '../components/ThemeProvider';
import {
  initCrypto,
  getStoredKeypairForUser,
  encryptMessageWithEphemeral,
  decryptMessageWithEphemeral,
  storeKeypairForUser,
  generateIdentityKeypair,
  getPublicKeyFingerprint,
} from '../utils/crypto';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { deriveSharedKey, encryptFileData, decryptFileData } from '../utils/crypto';
import { MAX_FILE_SIZE_NATIVE, MAX_FILE_SIZE_WEB } from '../constants';

interface ChatScreenProps {
  conversation: Conversation;
  currentUser: User;
  otherUser: User;
  onBack: () => void;
}

interface DecryptedMessageItem extends Message {
  decryptedText: string;
  decryptError?: boolean;
}

export default function ChatScreen({
  conversation,
  currentUser,
  otherUser,
  onBack,
}: ChatScreenProps) {
  const [messages, setMessages] = useState<DecryptedMessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [securityCode, setSecurityCode] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  // Web-only inputs for file pick and camera capture
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  const webCameraInputRef = useRef<HTMLInputElement | null>(null);
  const { colors, isDark } = useTheme();
  // Cache plaintexts of our sent messages (messageId -> plaintext)
  const sentMessagesCache = useRef<Map<string, string>>(new Map());
  // Cache decrypted media URIs
  const [decryptedMediaCache, setDecryptedMediaCache] = useState<Map<string, string>>(new Map());
  // Media viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerMediaUri, setViewerMediaUri] = useState<string | null>(null);
  const [viewerMediaType, setViewerMediaType] = useState<'image' | 'video'>('image');

  useEffect(() => {
    initCrypto();
    fetchMessages();
    loadSecurityCode();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          handleNewMessage(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [conversation.id]);

  const loadSecurityCode = async () => {
    try {
      const code = await getPublicKeyFingerprint(otherUser.public_key);
      setSecurityCode(code.toUpperCase());
    } catch (error) {
      console.error('Error generating security code:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Decrypt all messages
      const decryptedMessages = await Promise.all(
        (data || []).map(async (msg) => await decryptMessage(msg))
      );

      setMessages(decryptedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const decryptMessage = async (
    message: Message
  ): Promise<DecryptedMessageItem> => {
    try {
      const sessionPassword = getSessionPassword();
      console.log('[DEBUG] Session password available:', !!sessionPassword);
      let keypair = await getStoredKeypairForUser(currentUser.id, sessionPassword || undefined, sessionPassword ? supabase : undefined);
      console.log('[DEBUG] Decrypting message:', message.id, 'Keypair exists:', !!keypair);
      if (!keypair) {
        // Auto-generate new keypair and update public key in Supabase
        console.log('[DEBUG] No keypair found! Generating new keys...');
        keypair = generateIdentityKeypair();
        await storeKeypairForUser(currentUser.id, keypair, sessionPassword || undefined, sessionPassword ? supabase : undefined);
        // Update public key in Supabase
        await supabase.from('users').update({ public_key: keypair.publicKey }).eq('id', currentUser.id);
        Alert.alert(
          'New Encryption Keys Generated',
          'Your encryption keys were lost and have been regenerated. Old messages cannot be decrypted, but new messages will work.',
          [{ text: 'OK' }]
        );
        // Return error for this message, but future messages will work
        return { ...message, decryptedText: '[Unable to decrypt - new keys generated]', decryptError: true };
      }
      console.log('[DEBUG] Keypair private key length:', keypair.privateKey?.length || 0);
      console.log('[DEBUG] Keypair private key (first 20 chars):', keypair.privateKey?.substring(0, 20) + '...');
      console.log('[DEBUG] Current user public key:', currentUser.public_key?.substring(0, 20) + '...');
      console.log('[DEBUG] Other user public key:', otherUser.public_key?.substring(0, 20) + '...');
      console.log('[DEBUG] Message sender:', message.sender);
      console.log('[DEBUG] Current user ID:', currentUser.id);

      // If this is our own message, decrypt using the sender's copy
      if (message.sender === currentUser.id) {
        // Check cache first for immediate display
        const cachedPlaintext = sentMessagesCache.current.get(message.id);
        if (cachedPlaintext) {
          return { ...message, decryptedText: cachedPlaintext, decryptError: false };
        }

        // Decrypt from ciphertext_sender
        if (!message.ciphertext_sender || !message.ephemeral_pubkey_sender) {
          return { ...message, decryptedText: '[Unable to decrypt - no sender copy]', decryptError: true };
        }

        const parts = message.ciphertext_sender.split(':');
        if (parts.length !== 2) {
          throw new Error('Invalid sender ciphertext format');
        }
        const [ciphertext, nonce] = parts;

        const decryptedText = decryptMessageWithEphemeral(
          keypair.privateKey,
          message.ephemeral_pubkey_sender,
          ciphertext,
          nonce
        );

        return { ...message, decryptedText };
      }

      // Decrypt received message using the recipient's copy
      if (!message.ephemeral_pubkey) {
        return { ...message, decryptedText: '[Unable to decrypt - no ephemeral key]', decryptError: true };
      }

      const parts = message.ciphertext.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid ciphertext format');
      }
      const [ciphertext, nonce] = parts;

      const decryptedText = decryptMessageWithEphemeral(
        keypair.privateKey,
        message.ephemeral_pubkey,
        ciphertext,
        nonce
      );

      return { ...message, decryptedText };
    } catch (error) {
      console.error('Error decrypting message:', error);
      return { ...message, decryptedText: '[Decryption failed]', decryptError: true };
    }
  };

  const handleNewMessage = async (message: Message) => {
    const decrypted = await decryptMessage(message);
    setMessages((prev) => {
      // Prevent duplicates - check if message with this ID already exists
      if (prev.some((m) => m.id === decrypted.id)) {
        return prev;
      }
      return [...prev, decrypted];
    });
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const plaintextToSend = inputText.trim();
    setSending(true);
    try {
      // Encrypt message for recipient
      const encryptedForRecipient = encryptMessageWithEphemeral(
        otherUser.public_key,
        plaintextToSend
      );

      // Encrypt message for sender (so we can read our own messages later)
      const encryptedForSender = encryptMessageWithEphemeral(
        currentUser.public_key,
        plaintextToSend
      );

      // Combine ciphertext and nonce for storage
      const ciphertextWithNonce = `${encryptedForRecipient.ciphertext}:${encryptedForRecipient.nonce}`;
      const ciphertextSenderWithNonce = `${encryptedForSender.ciphertext}:${encryptedForSender.nonce}`;

      // Insert message with both encrypted versions
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender: currentUser.id,
          ciphertext: ciphertextWithNonce,
          ephemeral_pubkey: encryptedForRecipient.ephemeralPublicKey,
          ciphertext_sender: ciphertextSenderWithNonce,
          ephemeral_pubkey_sender: encryptedForSender.ephemeralPublicKey,
          delivered: false,
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Cache the plaintext for immediate display (until subscription picks it up)
      if (data) {
        sentMessagesCache.current.set(data.id, plaintextToSend);
      }
      
      // The real-time subscription will handle adding the message to state

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      setInputText('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const sendMediaMessage = async (filePath: string, fileType: 'image' | 'video', nonce: string, mimeType: string) => {
    setSending(true);
    try {
      // Encrypt a placeholder text "[Photo]" or "[Video]"
      const plaintextToSend = fileType === 'video' ? '[Video]' : '[Photo]';
      const encryptedForRecipient = encryptMessageWithEphemeral(otherUser.public_key, plaintextToSend);
      const encryptedForSender = encryptMessageWithEphemeral(currentUser.public_key, plaintextToSend);
      const ciphertextWithNonce = `${encryptedForRecipient.ciphertext}:${encryptedForRecipient.nonce}`;
      const ciphertextSenderWithNonce = `${encryptedForSender.ciphertext}:${encryptedForSender.nonce}`;

      // Store media metadata in message
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender: currentUser.id,
          ciphertext: ciphertextWithNonce,
          ephemeral_pubkey: encryptedForRecipient.ephemeralPublicKey,
          ciphertext_sender: ciphertextSenderWithNonce,
          ephemeral_pubkey_sender: encryptedForSender.ephemeralPublicKey,
          metadata: { file_path: filePath, file_type: fileType, nonce, mime_type: mimeType },
          delivered: false,
          read: false,
        })
        .select()
        .single();
      if (error) throw error;

      // Cache plaintext
      if (data) {
        sentMessagesCache.current.set(data.id, plaintextToSend);
      }

      // Update conversation
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
    } catch (error) {
      console.error('Error sending media message:', error);
      throw error;
    } finally {
      setSending(false);
    }
  };

  // Chat media: pick from library
  const pickMediaInChat = async () => {
    if (Platform.OS === 'web') {
      // Trigger hidden file input on web
      if (webFileInputRef.current) {
        webFileInputRef.current.value = '' as any;
        webFileInputRef.current.click();
      }
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant media library permissions.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await handleChatMediaUpload(result.assets[0]);
    }
  };

  // Chat media: take photo
  const takePhotoInChat = async () => {
    if (Platform.OS === 'web') {
      // Trigger hidden camera-capture input on web (mobile browsers)
      if (webCameraInputRef.current) {
        webCameraInputRef.current.value = '' as any;
        webCameraInputRef.current.click();
      }
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      await handleChatMediaUpload(result.assets[0]);
    }
  };

  const handleChatMediaUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      // Size guard to avoid OOM on native
      const info = await FileSystem.getInfoAsync(asset.uri);
      if ('size' in info && typeof (info as any).size === 'number' && (info as any).size > MAX_FILE_SIZE_NATIVE) {
        Alert.alert(
          'File Too Large',
          'This file is too large to encrypt on this device. Please compress it or upload from the web.'
        );
        return;
      }
      // Read file and encrypt (native path)
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const sessionPassword = getSessionPassword();
      const keypair = await getStoredKeypairForUser(currentUser.id, sessionPassword || undefined, sessionPassword ? supabase : undefined);
      if (!keypair) throw new Error('No keypair found');
      const sharedKey = deriveSharedKey(keypair.privateKey, otherUser.public_key);
      const { ciphertext, nonce } = encryptFileData(sharedKey, bytes);

      // Upload to storage
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.enc`;
      const filePath = `galleries/${currentUser.id}/${fileName}`;
      const encryptedBinary = atob(ciphertext);
      const encryptedBytes = new Uint8Array(encryptedBinary.length);
      for (let i = 0; i < encryptedBinary.length; i++) encryptedBytes[i] = encryptedBinary.charCodeAt(i);
      const { error: uploadError } = await supabase.storage
        .from('message-media')
        .upload(filePath, encryptedBytes, { contentType: 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;

      // Insert into galleries (auto-save behavior)
      await supabase.from('galleries').insert({
        owner_a: currentUser.id,
        owner_b: otherUser.id,
        file_path: filePath,
        file_type: asset.type === 'video' ? 'video' : 'image',
        metadata: { nonce, originalType: asset.mimeType, width: asset.width, height: asset.height },
      });

      // Send chat message with media metadata (not stub)
      await sendMediaMessage(filePath, asset.type === 'video' ? 'video' : 'image', nonce, asset.mimeType || '');
      Alert.alert('Success', `${asset.type === 'video' ? 'Video' : 'Photo'} sent`);
    } catch (e) {
      console.error('Chat media upload error:', e);
      Alert.alert('Error', 'Failed to send media.');
    }
  };

  // Web-only: handle selected file from file input
  const handleChatMediaUploadWeb = async (file: File) => {
    try {
      // Size guard
      if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_WEB) {
        Alert.alert(
          'File Too Large',
          'This file is too large to encrypt in the browser. Please compress it or try a smaller file.'
        );
        return;
      }
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      const sessionPassword = getSessionPassword();
      const keypair = await getStoredKeypairForUser(
        currentUser.id,
        sessionPassword || undefined,
        sessionPassword ? supabase : undefined
      );
      if (!keypair) throw new Error('No keypair found');

      const sharedKey = deriveSharedKey(keypair.privateKey, otherUser.public_key);
      const { ciphertext, nonce } = encryptFileData(sharedKey, bytes);

      // Upload to storage
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.enc`;
      const filePath = `galleries/${currentUser.id}/${fileName}`;
      const encryptedBinary = atob(ciphertext);
      const encryptedBytes = new Uint8Array(encryptedBinary.length);
      for (let i = 0; i < encryptedBinary.length; i++) encryptedBytes[i] = encryptedBinary.charCodeAt(i);
      const { error: uploadError } = await supabase.storage
        .from('message-media')
        .upload(filePath, encryptedBytes, { contentType: 'application/octet-stream', upsert: false });
      if (uploadError) throw uploadError;

      // Insert into galleries (auto-save behavior)
      const fileType = (file.type || '').startsWith('video') ? 'video' : 'image';
      await supabase.from('galleries').insert({
        owner_a: currentUser.id,
        owner_b: otherUser.id,
        file_path: filePath,
        file_type: fileType,
        metadata: { nonce, originalType: file.type || '', width: undefined, height: undefined },
      });

      // Send media message
      await sendMediaMessage(filePath, fileType, nonce, file.type || '');
      Alert.alert('Success', `${fileType === 'video' ? 'Video' : 'Photo'} sent`);
    } catch (e) {
      console.error('Chat media upload (web) error:', e);
      Alert.alert('Error', 'Failed to send media.');
    }
  };

  const decryptAndCacheMedia = async (messageId: string, file_path: string, nonce: string, mimeType?: string): Promise<string | null> => {
    // Check cache first
    const cacheKey = `${messageId}_${file_path}`;
    if (decryptedMediaCache.has(cacheKey)) {
      return decryptedMediaCache.get(cacheKey)!;
    }

    try {
      // Download encrypted file
      const { data, error } = await supabase.storage
        .from('message-media')
        .download(file_path);
      if (error) throw error;

      // Convert Blob to base64 then Uint8Array
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (reader.result) {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          } else {
            reject(new Error('Failed to read blob'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(data);
      });
      const base64Data = await base64Promise;
      const binaryString = atob(base64Data);
      const encryptedBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        encryptedBytes[i] = binaryString.charCodeAt(i);
      }

      // Decrypt
      const sessionPassword = getSessionPassword();
      const keypair = await getStoredKeypairForUser(currentUser.id, sessionPassword || undefined, sessionPassword ? supabase : undefined);
      if (!keypair) throw new Error('No keypair found');
      const sharedKey = deriveSharedKey(keypair.privateKey, otherUser.public_key);
      let binary = '';
      encryptedBytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const base64Encrypted = btoa(binary);
      const decryptedBytes = decryptFileData(sharedKey, base64Encrypted, nonce);

      // Convert to data URI
      let decryptedBinary = '';
      decryptedBytes.forEach((byte: number) => { decryptedBinary += String.fromCharCode(byte); });
      const base64Image = btoa(decryptedBinary);
      const mimeToUse = mimeType || 'image/jpeg';
      const dataUri = `data:${mimeToUse};base64,${base64Image}`;

      // Cache
      setDecryptedMediaCache(prev => new Map(prev).set(cacheKey, dataUri));
      return dataUri;
    } catch (error) {
      console.error('Error decrypting media:', error);
      return null;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderMessage = ({ item }: { item: DecryptedMessageItem }) => {
    const isOwnMessage = item.sender === currentUser.id;
    const hasMedia = item.metadata?.file_path && item.metadata?.nonce;

    return (
      <View
        style={{
          marginBottom: 12,
          marginHorizontal: 16,
          alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            maxWidth: hasMedia ? '70%' : '80%',
            paddingHorizontal: hasMedia ? 4 : 16,
            paddingVertical: hasMedia ? 4 : 10,
            borderRadius: 20,
            backgroundColor: isOwnMessage ? colors.primary : colors.surface,
            borderBottomRightRadius: isOwnMessage ? 4 : 20,
            borderBottomLeftRadius: isOwnMessage ? 20 : 4,
            opacity: item.decryptError ? 0.6 : 1,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          {hasMedia ? (
            <MessageMediaThumbnail
              messageId={item.id}
              filePath={item.metadata!.file_path}
              fileType={item.metadata!.file_type || 'image'}
              nonce={item.metadata!.nonce}
              mimeType={item.metadata!.mime_type}
              onPress={(uri, type) => {
                setViewerMediaUri(uri);
                setViewerMediaType(type);
                setViewerVisible(true);
              }}
            />
          ) : (
            <Text
              style={{
                color: isOwnMessage ? '#ffffff' : colors.text,
                fontSize: 15,
                lineHeight: 20,
              }}
            >
              {item.decryptedText}
            </Text>
          )}
          <Text
            style={{
              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textSecondary,
              fontSize: 11,
              marginTop: 4,
              marginHorizontal: hasMedia ? 8 : 0,
              alignSelf: 'flex-end',
            }}
          >
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const MessageMediaThumbnail = ({
    messageId,
    filePath,
    fileType,
    nonce,
    mimeType,
    onPress,
  }: {
    messageId: string;
    filePath: string;
    fileType: 'image' | 'video';
    nonce: string;
    mimeType?: string;
    onPress: (uri: string, type: 'image' | 'video') => void;
  }) => {
    const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
    const [loadingThumb, setLoadingThumb] = useState(true);

    useEffect(() => {
      const loadThumbnail = async () => {
        const uri = await decryptAndCacheMedia(messageId, filePath, nonce, mimeType);
        setThumbnailUri(uri);
        setLoadingThumb(false);
      };
      loadThumbnail();
    }, [messageId]);

    return (
      <TouchableOpacity
        onPress={() => thumbnailUri && onPress(thumbnailUri, fileType)}
        style={{
          width: 200,
          height: 200,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: colors.surfaceLight,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {loadingThumb ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : thumbnailUri ? (
          <RNImage
            source={{ uri: thumbnailUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ fontSize: 48 }}>
            {fileType === 'video' ? '🎥' : '📷'}
          </Text>
        )}
        {fileType === 'video' && (
          <View
            style={{
              position: 'absolute',
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: 'rgba(0,0,0,0.6)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 24 }}>▶️</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />
      {/* Hidden web file inputs for attach/camera */}
      {Platform.OS === 'web' && (
        <>
          <input
            ref={webFileInputRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) await handleChatMediaUploadWeb(file);
            }}
          />
          <input
            ref={webCameraInputRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) await handleChatMediaUploadWeb(file);
            }}
          />
        </>
      )}
      
      {/* Header */}
      <View
        style={{
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 50 : 12,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          style={{
            marginRight: 12,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 20, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>

        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>
            {otherUser.username.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 17 }}>
            {otherUser.username}
          </Text>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                '🔐 Security Code',
                `Verify this code with ${otherUser.username} to ensure your connection is secure:\n\n${securityCode || 'Loading...'}\n\nThis code is unique to your conversation and should match on both devices.`,
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              🔐 Tap to verify security code
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 14 }}>
            Loading messages...
          </Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
            No messages yet
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
            Send a message to start the conversation. All messages are end-to-end encrypted.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: Platform.OS === 'ios' ? 28 : 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 5,
          }}
        >
          {/* Attach and Camera buttons */}
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surfaceLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={pickMediaInChat}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>📎</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surfaceLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={takePhotoInChat}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>📷</Text>
          </TouchableOpacity>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 10,
              marginRight: 8,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <TextInput
              style={{
                color: colors.text,
                fontSize: 15,
                maxHeight: 80,
              }}
              placeholder="Message..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              onKeyPress={(e) => {
                if (Platform.OS === 'web') {
                  const nativeEvent = e.nativeEvent as any;
                  if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim()) {
                      sendMessage();
                    }
                  }
                }
              }}
              blurOnSubmit={Platform.OS !== 'web'}
              onSubmitEditing={() => {
                if (Platform.OS !== 'web' && inputText.trim()) {
                  sendMessage();
                }
              }}
            />
          </View>

          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: inputText.trim() ? colors.primary : colors.surfaceLight,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: inputText.trim() ? colors.primary : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: inputText.trim() ? 3 : 0,
            }}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold' }}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Full-screen media viewer */}
      <Modal
        visible={viewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.7)',
              paddingTop: Platform.OS === 'ios' ? 50 : 20,
              paddingHorizontal: 20,
              paddingBottom: 15,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <TouchableOpacity onPress={() => setViewerVisible(false)}>
              <Text style={{ color: '#fff', fontSize: 28 }}>×</Text>
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 16 }}>
              {viewerMediaType === 'video' ? 'Video' : 'Photo'}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {viewerMediaUri ? (
              <RNImage
                source={{ uri: viewerMediaUri }}
                style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height }}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ color: '#fff' }}>Failed to load media</Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
