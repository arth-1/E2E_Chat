import * as nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { Keypair, EncryptedMessage } from '../types';

// Store keys per user for multi-account support
function getPrivateKeyStorageKey(userId: string) {
  return `user_private_key_${userId}`;
}
function getPublicKeyStorageKey(userId: string) {
  return `user_public_key_${userId}`;
}
function getPasswordHashStorageKey(userId: string) {
  return `user_password_hash_${userId}`;
}

// Set up random bytes for tweetnacl using expo-crypto
if (Platform.OS !== 'web') {
  nacl.setPRNG((buffer: Uint8Array, length: number) => {
    const randomBytes = Crypto.getRandomBytes(length);
    buffer.set(randomBytes);
  });
}

/**
 * Derive a key from password using PBKDF2
 */
async function deriveKeyFromPassword(password: string, salt: string): Promise<Uint8Array> {
  // Use PBKDF2 with 100,000 iterations
  const iterations = 100000;
  const keyMaterial = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + salt
  );
  // In production, use proper PBKDF2 library. This is simplified.
  // For now, hash multiple times to simulate PBKDF2
  let key = keyMaterial;
  for (let i = 0; i < 1000; i++) {
    key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key + salt);
  }
  // Convert hex string to Uint8Array (take first 32 bytes for XSalsa20)
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = parseInt(key.substr(i * 2, 2), 16);
  }
  return keyBytes;
}

/**
 * Encrypt private key with user's password
 */
export async function encryptPrivateKeyWithPassword(
  privateKey: string,
  password: string
): Promise<{ encryptedKey: string; salt: string; nonce: string }> {
  const salt = naclUtil.encodeBase64(nacl.randomBytes(32));
  const derivedKey = await deriveKeyFromPassword(password, salt);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const privateKeyBytes = naclUtil.decodeUTF8(privateKey);
  const encrypted = nacl.secretbox(privateKeyBytes, nonce, derivedKey);
  
  return {
    encryptedKey: naclUtil.encodeBase64(encrypted),
    salt,
    nonce: naclUtil.encodeBase64(nonce),
  };
}

/**
 * Decrypt private key with user's password
 */
export async function decryptPrivateKeyWithPassword(
  encryptedKey: string,
  salt: string,
  nonce: string,
  password: string
): Promise<string> {
  const derivedKey = await deriveKeyFromPassword(password, salt);
  const encryptedBytes = naclUtil.decodeBase64(encryptedKey);
  const nonceBytes = naclUtil.decodeBase64(nonce);
  const decrypted = nacl.secretbox.open(encryptedBytes, nonceBytes, derivedKey);
  
  if (!decrypted) {
    throw new Error('Failed to decrypt private key. Wrong password?');
  }
  
  return naclUtil.encodeUTF8(decrypted);
}

// Set up random bytes for tweetnacl using expo-crypto
if (Platform.OS !== 'web') {
  nacl.setPRNG((buffer: Uint8Array, length: number) => {
    const randomBytes = Crypto.getRandomBytes(length);
    buffer.set(randomBytes);
  });
}

/**
 * Initialize libsodium (must be called before any crypto operations)
 */
export async function initCrypto(): Promise<void> {
  // No initialization needed for tweetnacl
  return Promise.resolve();
}

/**
 * Generate an identity keypair using X25519 (Curve25519)
 */
export function generateIdentityKeypair(): Keypair {
  const kp = nacl.box.keyPair();
  return {
    publicKey: naclUtil.encodeBase64(kp.publicKey),
    privateKey: naclUtil.encodeBase64(kp.secretKey),
  };
}

/**
 * Store keypair securely
 * Mobile: Uses SecureStore (Keychain/Keystore)
 * Web: Uses IndexedDB (should be password-protected in production)
 */
/**
 * Store keypair securely for a specific user (local storage + database backup)
 */
export async function storeKeypairForUser(
  userId: string,
  keypair: Keypair,
  password?: string,
  supabase?: any
): Promise<void> {
  // Store locally first
  if (Platform.OS === 'web') {
    localStorage.setItem(getPrivateKeyStorageKey(userId), keypair.privateKey);
    localStorage.setItem(getPublicKeyStorageKey(userId), keypair.publicKey);
  } else {
    if (keypair.privateKey.length > 2048) {
      throw new Error('Private key too large for SecureStore');
    }
    try {
      await SecureStore.setItemAsync(getPrivateKeyStorageKey(userId), keypair.privateKey);
    } catch (err) {
      throw new Error('Failed to store private key securely');
    }
  }

  // Also store encrypted private key in database if password and supabase provided
  if (password && supabase) {
    try {
      const encrypted = await encryptPrivateKeyWithPassword(keypair.privateKey, password);
      const encryptedData = JSON.stringify(encrypted);
      
      const { error } = await supabase
        .from('users')
        .update({ encrypted_private_key: encryptedData })
        .eq('id', userId);
      
      if (error) {
        console.error('Failed to store encrypted private key in database:', error);
      }
    } catch (error) {
      console.error('Error encrypting private key for database:', error);
    }
  }
}
/**
 * Load keypair for a specific user (try database first if password provided, then local as cache)
 * This ensures keys are always account-bound, not device-bound.
 */
export async function getStoredKeypairForUser(
  userId: string,
  password?: string,
  supabase?: any
): Promise<Keypair | null> {
  let privateKey: string | null = null;
  let publicKey: string | null = null;
  
  // PRIORITY 1: Try loading from database first if password + supabase provided
  // This ensures cross-device/cross-platform consistency
  if (password && supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('encrypted_private_key, public_key')
        .eq('id', userId)
        .single();
      
      if (data?.encrypted_private_key) {
        // Decrypt the private key
        const encrypted = JSON.parse(data.encrypted_private_key);
        privateKey = await decryptPrivateKeyWithPassword(
          encrypted.encryptedKey,
          encrypted.salt,
          encrypted.nonce,
          password
        );
        publicKey = data.public_key;

        // Validate: derive public key from decrypted private key and compare
        try {
          const privBytes = naclUtil.decodeBase64(privateKey);
          const derivedPub = nacl.box.keyPair.fromSecretKey(privBytes).publicKey;
          const derivedPubB64 = naclUtil.encodeBase64(derivedPub);
          if (publicKey && derivedPubB64 !== publicKey) {
            throw new Error('Decrypted private key does not match public key. Wrong password?');
          }
        } catch (e) {
          throw new Error('Failed to validate decrypted private key. Wrong password?');
        }

        // Cache decrypted key locally for faster future access
        if (privateKey) {
          if (Platform.OS === 'web') {
            localStorage.setItem(getPrivateKeyStorageKey(userId), privateKey);
            localStorage.setItem(getPublicKeyStorageKey(userId), publicKey || '');
          } else {
            try {
              await SecureStore.setItemAsync(getPrivateKeyStorageKey(userId), privateKey);
            } catch (err) {
              console.warn('Failed to cache private key locally:', err);
            }
          }
        }
        
        return { privateKey, publicKey: publicKey || '' };
      }
    } catch (error) {
      console.error('Error loading encrypted private key from database:', error);
      throw error;
    }
  }
  
  // PRIORITY 2: Fallback to local storage if no password or DB load failed
  // This is only used as a cache or when operating offline
  if (Platform.OS === 'web') {
    privateKey = localStorage.getItem(getPrivateKeyStorageKey(userId));
    publicKey = localStorage.getItem(getPublicKeyStorageKey(userId));
  } else {
    privateKey = await SecureStore.getItemAsync(getPrivateKeyStorageKey(userId));
  }
  
  if (!privateKey) return null;
  return { privateKey, publicKey: publicKey || '' };
}

/**
 * Derive a session key using your private key and peer's public key (Diffie-Hellman)
 */
export function deriveSessionKey(myPrivateKeyBase64: string, peerPublicKeyBase64: string): Uint8Array {
  const myPrivateKey = naclUtil.decodeBase64(myPrivateKeyBase64);
  const peerPublicKey = naclUtil.decodeBase64(peerPublicKeyBase64);
  // Use nacl.box.before for shared secret
  return nacl.box.before(peerPublicKey, myPrivateKey);
}
/**
 * Generate a fingerprint/security code for a public key
 */
export async function getPublicKeyFingerprint(publicKeyBase64: string): Promise<string> {
  // Use SHA-256 and return first 8 hex chars
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, publicKeyBase64);
  return hash.slice(0, 8);
}

/**
 * @deprecated Use getStoredKeypairForUser(userId) instead
 * Retrieve stored keypair (legacy - do not use)
 */
export async function getStoredKeypair(): Promise<Keypair | null> {
  throw new Error('getStoredKeypair() is deprecated. Use getStoredKeypairForUser(userId) instead.');
}

/**
 * Derive a shared symmetric key from local private key and remote public key
 */
export function deriveSharedKey(
  localPrivateB64: string,
  remotePublicB64: string
): Uint8Array {
  const localPriv = naclUtil.decodeBase64(localPrivateB64);
  const remotePub = naclUtil.decodeBase64(remotePublicB64);
  const shared = nacl.box.before(remotePub, localPriv);
  return shared;
}

/**
 * Encrypt a message using symmetric key (XSalsa20-Poly1305)
 */
export function encryptMessage(
  symKey: Uint8Array,
  plaintext: string
): EncryptedMessage {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageUint8 = naclUtil.decodeUTF8(plaintext);
  const cipher = nacl.secretbox(messageUint8, nonce, symKey);
  return {
    ciphertext: naclUtil.encodeBase64(cipher),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

/**
 * Decrypt a message using symmetric key
 */
export function decryptMessage(
  symKey: Uint8Array,
  ciphertextB64: string,
  nonceB64: string
): string {
  const cipher = naclUtil.decodeBase64(ciphertextB64);
  const nonce = naclUtil.decodeBase64(nonceB64);
  const decrypted = nacl.secretbox.open(cipher, nonce, symKey);
  if (!decrypted) {
    throw new Error('Decryption failed');
  }
  return naclUtil.encodeUTF8(decrypted);
}

/**
 * Generate ephemeral keypair for forward secrecy
 */
export function generateEphemeralKeypair(): Keypair {
  return generateIdentityKeypair();
}

/**
 * Encrypt message with ephemeral key (for forward secrecy)
 */
export function encryptMessageWithEphemeral(
  recipientPublicKeyB64: string,
  plaintext: string
): EncryptedMessage {
  const ephemeralKeypair = generateEphemeralKeypair();
  const symKey = deriveSharedKey(
    ephemeralKeypair.privateKey,
    recipientPublicKeyB64
  );
  const encrypted = encryptMessage(symKey, plaintext);
  return {
    ...encrypted,
    ephemeralPublicKey: ephemeralKeypair.publicKey,
  };
}

/**
 * Decrypt message using ephemeral public key
 */
export function decryptMessageWithEphemeral(
  localPrivateKeyB64: string,
  ephemeralPublicKeyB64: string,
  ciphertextB64: string,
  nonceB64: string
): string {
  const symKey = deriveSharedKey(localPrivateKeyB64, ephemeralPublicKeyB64);
  return decryptMessage(symKey, ciphertextB64, nonceB64);
}

/**
 * Encrypt file data (for media attachments)
 */
export function encryptFileData(
  symKey: Uint8Array,
  fileData: Uint8Array
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(fileData, nonce, symKey);
  return {
    ciphertext: naclUtil.encodeBase64(cipher),
    nonce: naclUtil.encodeBase64(nonce),
  };
}

/**
 * Decrypt file data
 */
export function decryptFileData(
  symKey: Uint8Array,
  ciphertextB64: string,
  nonceB64: string
): Uint8Array {
  const cipher = naclUtil.decodeBase64(ciphertextB64);
  const nonce = naclUtil.decodeBase64(nonceB64);
  const decrypted = nacl.secretbox.open(cipher, nonce, symKey);
  if (!decrypted) {
    throw new Error('File decryption failed');
  }
  return decrypted;
}

/**
 * Remove stored keypair for a specific user (for logout/reset)
 */
export async function removeKeypairForUser(userId: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(getPrivateKeyStorageKey(userId));
    localStorage.removeItem(getPublicKeyStorageKey(userId));
  } else {
    try {
      await SecureStore.deleteItemAsync(getPrivateKeyStorageKey(userId));
      await SecureStore.deleteItemAsync(getPublicKeyStorageKey(userId));
    } catch (err) {
      console.warn('Failed to remove keypair for user:', err);
    }
  }
}
