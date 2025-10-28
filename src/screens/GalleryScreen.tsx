import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Image,
  Dimensions,
  StyleSheet,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { supabase } from '../services/supabase';
import { getSessionPassword } from '../services/sessionStore';
import { GalleryItem, User } from '../types';
import { getStoredKeypairForUser, deriveSharedKey, encryptFileData, decryptFileData } from '../utils/crypto';
import { useTheme } from '../components/ThemeProvider';
import { MAX_FILE_SIZE_NATIVE, MAX_FILE_SIZE_WEB } from '../constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GalleryItemThumbnailProps {
  item: GalleryItem;
  index: number;
  onPress: (index: number) => void;
  decryptImage: (item: GalleryItem) => Promise<string | null>;
  colors: any;
}

const GalleryItemThumbnail: React.FC<GalleryItemThumbnailProps> = ({ 
  item, 
  index, 
  onPress, 
  decryptImage,
  colors 
}) => {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(true);

  useEffect(() => {
    const loadThumbnail = async () => {
      const uri = await decryptImage(item);
      setThumbnailUri(uri);
      setLoadingThumb(false);
    };
    loadThumbnail();
  }, [item.id]);

  return (
    <TouchableOpacity
      style={{ width: '32%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, margin: 2 }}
      onPress={() => onPress(index)}
    >
      {loadingThumb ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : thumbnailUri ? (
        <Image
          source={{ uri: thumbnailUri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32 }}>
            {item.file_type === 'video' ? '🎥' : '📷'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

interface FullScreenViewerProps {
  visible: boolean;
  currentIndex: number;
  galleryItems: GalleryItem[];
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onNext: () => void;
  onPrevious: () => void;
  decryptImage: (item: GalleryItem) => Promise<string | null>;
  downloading: boolean;
  deleting: boolean;
}

const FullScreenViewer: React.FC<FullScreenViewerProps> = ({
  visible,
  currentIndex,
  galleryItems,
  onClose,
  onDownload,
  onDelete,
  onNext,
  onPrevious,
  decryptImage,
  downloading,
  deleting,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      if (galleryItems[currentIndex]) {
        setImageLoading(true);
        const uri = await decryptImage(galleryItems[currentIndex]);
        setImageUri(uri);
        setImageLoading(false);
      }
    };
    loadImage();
  }, [currentIndex]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Header */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: '#fff', fontSize: 28 }}>×</Text>
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 16 }}>
            {currentIndex + 1} / {galleryItems.length}
          </Text>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={onDelete} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#ff4444', fontSize: 24 }}>🗑️</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={onDownload} disabled={downloading}>
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 24 }}>⬇</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Image */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {imageLoading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ color: '#fff' }}>Failed to load image</Text>
          )}
        </View>

        {/* Navigation buttons */}
        <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 }}>
          {currentIndex > 0 && (
            <TouchableOpacity
              onPress={onPrevious}
              style={{ backgroundColor: 'rgba(255,255,255,0.3)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>‹</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {currentIndex < galleryItems.length - 1 && (
            <TouchableOpacity
              onPress={onNext}
              style={{ backgroundColor: 'rgba(255,255,255,0.3)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 24 }}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

interface GalleryScreenProps {
  currentUser: User;
  otherUser: User | null;
  onBack: () => void;
}

const GalleryScreen: React.FC<GalleryScreenProps> = ({ currentUser, otherUser, onBack }) => {
  const { colors } = useTheme();
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decryptedImages, setDecryptedImages] = useState<Map<string, string>>(new Map());
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (otherUser) fetchGalleryItems();
    // eslint-disable-next-line
  }, [otherUser]);

  const fetchGalleryItems = async () => {
    if (!otherUser) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('galleries')
        .select('*')
        .or(
          `and(owner_a.eq.${currentUser.id},owner_b.eq.${otherUser.id}),and(owner_a.eq.${otherUser.id},owner_b.eq.${currentUser.id})`
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGalleryItems(data || []);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadMedia(result.assets[0]);
      }
    }
  };

  const takePicture = async () => {
    if (Platform.OS === 'web') {
      // On web, fallback to file picker
      pickImage();
    } else {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await uploadMedia(result.assets[0]);
      }
    }
  };

  const uploadMedia = async (asset: ImagePicker.ImagePickerAsset | File) => {
    if (!otherUser) return;
    setUploading(true);
    try {
      let bytes: Uint8Array;
      let fileType: string;
      let mimeType: string = '';
      let width: number | undefined;
      let height: number | undefined;
      // Accept both ImagePickerAsset and File
      if (Platform.OS === 'web') {
        // asset is a File object
        const file = asset as unknown as File;
        // Size guard for web
        if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_WEB) {
          Alert.alert(
            'File Too Large',
            `This file is too large (max ${MAX_FILE_SIZE_WEB / (1024 * 1024)}MB). Please compress it or try a smaller file.`
          );
          setUploading(false);
          return;
        }
        mimeType = file.type || '';
        fileType = mimeType.startsWith('video') ? 'video' : 'image';
        const arrayBuffer = await file.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
        // width/height not available for web upload
      } else {
        const rnAsset = asset as ImagePicker.ImagePickerAsset;
        // Size guard for native
        const info = await FileSystem.getInfoAsync(rnAsset.uri);
        if ('size' in info && typeof (info as any).size === 'number' && (info as any).size > MAX_FILE_SIZE_NATIVE) {
          Alert.alert(
            'File Too Large',
            `This file is too large (max ${MAX_FILE_SIZE_NATIVE / (1024 * 1024)}MB on mobile). Please compress it or upload from the web.`
          );
          setUploading(false);
          return;
        }
        const base64 = await FileSystem.readAsStringAsync(rnAsset.uri, { encoding: 'base64' });
        const binaryString = atob(base64);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        fileType = rnAsset.type === 'video' ? 'video' : 'image';
        mimeType = rnAsset.mimeType || '';
        width = rnAsset.width;
        height = rnAsset.height;
      }
      const sessionPassword = getSessionPassword();
      const keypair = await import('../utils/crypto').then(m => m.getStoredKeypairForUser(currentUser.id, sessionPassword || undefined, sessionPassword ? supabase : undefined));
      if (!keypair) throw new Error('No keypair found');
      const sharedKey = deriveSharedKey(keypair.privateKey, otherUser.public_key);
      const encrypted = encryptFileData(sharedKey, bytes);
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.enc`;
      const filePath = `galleries/${currentUser.id}/${fileName}`;
      // Convert base64 ciphertext to Uint8Array for upload
      const encryptedBinary = atob(encrypted.ciphertext);
      const encryptedBytes = new Uint8Array(encryptedBinary.length);
      for (let i = 0; i < encryptedBinary.length; i++) {
        encryptedBytes[i] = encryptedBinary.charCodeAt(i);
      }
      const { error: uploadError } = await supabase.storage
        .from('message-media')
        .upload(filePath, encryptedBytes, {
          contentType: 'application/octet-stream',
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from('galleries').insert({
        owner_a: currentUser.id,
        owner_b: otherUser.id,
        file_path: filePath,
        file_type: fileType,
        metadata: {
          nonce: encrypted.nonce,
          originalType: mimeType,
          width,
          height,
        },
      });
      if (dbError) throw dbError;
      Alert.alert('Success', 'Media uploaded successfully!');
      fetchGalleryItems();
    } catch (error) {
      console.error('Error uploading media:', error);
      Alert.alert('Error', 'Failed to upload media. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const showUploadOptions = () => {
    Alert.alert('Upload Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: takePicture },
      { text: 'Choose from Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const decryptAndDisplayImage = async (item: GalleryItem): Promise<string | null> => {
    // Check if already decrypted
    if (decryptedImages.has(item.id)) {
      return decryptedImages.get(item.id)!;
    }

    try {
      if (!otherUser) return null;
      
      // Download encrypted file
      const { data, error } = await supabase.storage
        .from('message-media')
        .download(item.file_path);
      
      if (error) throw error;
      
      // Convert Blob to base64 then to Uint8Array (React Native compatible)
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
      
      // Get shared key - determine which user's public key to use
      // If current user uploaded it, use other user's public key
      // If other user uploaded it, use current user's key with other user's public key
      const sessionPassword = getSessionPassword();
      const keypair = await import('../utils/crypto').then(m => m.getStoredKeypairForUser(currentUser.id, sessionPassword || undefined, sessionPassword ? supabase : undefined));
      if (!keypair) throw new Error('No keypair found');
      
      // Determine the uploader to get the correct public key for decryption
      const uploaderPublicKey = item.owner_a === currentUser.id ? currentUser.public_key : otherUser.public_key;
      const receiverPublicKey = item.owner_a === currentUser.id ? otherUser.public_key : currentUser.public_key;
      
      // Use the shared key between current user and other user
      const sharedKey = deriveSharedKey(keypair.privateKey, otherUser.public_key);
      
      // Decrypt
      const nonce = item.metadata?.nonce;
      if (!nonce) throw new Error('No nonce found in metadata');
      
      // Convert encrypted bytes to base64 for decryptFileData
      let binary = '';
      encryptedBytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      const base64Encrypted = btoa(binary);
      
      const decryptedBytes = decryptFileData(sharedKey, base64Encrypted, nonce);
      
      // Convert to base64 data URI
      let decryptedBinary = '';
      decryptedBytes.forEach((byte) => {
        decryptedBinary += String.fromCharCode(byte);
      });
      const base64Image = btoa(decryptedBinary);
      const mimeType = item.metadata?.originalType || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${base64Image}`;
      
      // Cache the decrypted image
      setDecryptedImages(prev => new Map(prev).set(item.id, dataUri));
      
      return dataUri;
    } catch (error) {
      console.error('Error decrypting image:', error);
      return null;
    }
  };

  const downloadImage = async () => {
    if (!galleryItems[currentIndex]) return;
    setDownloading(true);
    try {
      const item = galleryItems[currentIndex];
      const dataUri = await decryptAndDisplayImage(item);
      if (!dataUri) {
        throw new Error('Failed to decrypt image');
      }
      if (Platform.OS === 'web') {
        // Trigger browser download
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = `gallery_${Date.now()}.${item.file_type === 'video' ? 'mp4' : 'jpg'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Success', 'Image downloaded!');
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant media library permissions to download.');
          setDownloading(false);
          return;
        }
        // Save to file system
        const fileName = `gallery_${Date.now()}.${item.file_type === 'video' ? 'mp4' : 'jpg'}`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        // Remove data URI prefix and save
        const base64Data = dataUri.split(',')[1];
        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Save to media library
        await MediaLibrary.saveToLibraryAsync(fileUri);
        Alert.alert('Success', 'Image saved to your gallery!');
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      Alert.alert('Error', 'Failed to download image.');
    } finally {
      setDownloading(false);
    }
  };

  const openViewer = (index: number) => {
    setCurrentIndex(index);
    setViewerVisible(true);
  };

  const deleteImage = async () => {
    if (!galleryItems[currentIndex]) return;
    
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const item = galleryItems[currentIndex];
              
              // Delete from storage
              const { error: storageError } = await supabase.storage
                .from('message-media')
                .remove([item.file_path]);
              
              if (storageError) {
                console.warn('Storage delete error:', storageError);
              }
              
              // Delete from database
              const { error: dbError } = await supabase
                .from('galleries')
                .delete()
                .eq('id', item.id);
              
              if (dbError) throw dbError;
              
              // Remove from decrypted cache
              setDecryptedImages(prev => {
                const newMap = new Map(prev);
                newMap.delete(item.id);
                return newMap;
              });
              
              // Close viewer and refresh
              setViewerVisible(false);
              Alert.alert('Success', 'Image deleted successfully!');
              fetchGalleryItems();
            } catch (error) {
              console.error('Error deleting image:', error);
              Alert.alert('Error', 'Failed to delete image.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const goToNext = () => {
    if (currentIndex < galleryItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const renderGalleryItem = ({ item, index }: { item: GalleryItem; index: number }) => (
    <GalleryItemThumbnail
      item={item}
      index={index}
      onPress={openViewer}
      decryptImage={decryptAndDisplayImage}
      colors={colors}
    />
  );

  if (!otherUser) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🚫</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
          No user available for gallery
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 16 }}>
          You need a chat partner to view or upload memories in the gallery.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Hidden file input for web uploads */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          title="Upload image or video"
          aria-label="Upload image or video"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await uploadMedia(file as unknown as File);
            }
          }}
        />
      )}
      <FullScreenViewer
        visible={viewerVisible}
        currentIndex={currentIndex}
        galleryItems={galleryItems}
        onClose={() => setViewerVisible(false)}
        onDownload={downloadImage}
        onDelete={deleteImage}
        onNext={goToNext}
        onPrevious={goToPrevious}
        decryptImage={decryptAndDisplayImage}
        downloading={downloading}
        deleting={deleting}
      />
      <View style={{ backgroundColor: colors.surface, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={onBack} style={{ marginRight: 16 }}>
              <Text style={{ color: colors.primary, fontSize: 24 }}>←</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 20 }}>Our Gallery</Text>
          </View>
          <TouchableOpacity
            onPress={showUploadOptions}
            disabled={uploading}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24 }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Upload</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 8 }}>
          {galleryItems.length} {galleryItems.length === 1 ? 'memory' : 'memories'}
        </Text>
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : galleryItems.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>📸</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
            No memories yet
          </Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }}>
            Upload your first photo or video to start building your private gallery
          </Text>
          <TouchableOpacity
            onPress={showUploadOptions}
            style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Upload First Memory</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={galleryItems}
          renderItem={renderGalleryItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ padding: 4 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchGalleryItems}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

export default GalleryScreen;
