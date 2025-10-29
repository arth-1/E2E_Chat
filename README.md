# E2E_Chat - Secure 1:1 Messaging App
## i'll edit this by tonight and make it more client friendly

A production-ready, private 1:1 messaging app built with React Native, Expo, and Supabase. Features end-to-end encryption, sticker/GIF support, and a private gallery for sharing moments.

## Features

- 🔐 **End-to-End Encryption**: Messages encrypted on-device using libsodium (X25519 + XSalsa20-Poly1305)
- 💬 **1:1 Messaging**: Secure private conversations with username-based accounts
- 📸 **Media Gallery**: Private photo/video gallery with encrypted storage
- 🎨 **Stickers & GIFs**: Expressive messaging with sticker packs and GIF search
- 🔔 **Push Notifications**: Stay updated without compromising message content
- 🌐 **Cross-Platform**: Works on iOS, Android, and Web

## Tech Stack

- **Frontend**: React Native, Expo, TypeScript
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Encryption**: libsodium-wrappers
- **Navigation**: React Navigation

## Security
Saanvi
- End-to-end encrypted messages using X25519 key exchange and XSalsa20-Poly1305 authenticated encryption
- Private keys stored securely in device Keychain/Keystore (mobile) or IndexedDB (web)
- Row-Level Security (RLS) policies in Supabase
- Encrypted media files in Supabase Storage
- No plaintext message content on server
Auric
