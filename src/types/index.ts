export interface User {
  id: string;
  auth_user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  public_key: string;
  created_at: string;
  push_token?: string;
}

export interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  last_message_at?: string;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: string;
  ciphertext: string;
  ciphertext_sender?: string; // Encrypted copy for sender (so they can read their own messages)
  ephemeral_pubkey?: string;
  ephemeral_pubkey_sender?: string; // Ephemeral key for sender's copy
  attached_files?: AttachedFile[];
  metadata?: Record<string, any>; // Store media references (file_path, file_type, nonce, etc.)
  created_at: string;
  delivered: boolean;
  read: boolean;
}

export interface AttachedFile {
  id: string;
  path: string;
  type: 'image' | 'video' | 'file';
  size: number;
  mime_type: string;
  thumbnail?: string;
}

export interface GalleryItem {
  id: string;
  owner_a: string;
  owner_b: string;
  file_path: string;
  file_type: 'image' | 'video';
  thumbnail_path?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface Keypair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey?: string;
}

export interface DecryptedMessage {
  text: string;
  timestamp: string;
  attachments?: AttachedFile[];
}
