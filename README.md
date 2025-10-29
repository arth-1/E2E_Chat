# 💬 E2E_Chat: Secure End-to-End Encrypted Messaging App

## 🛡️ Overview

**E2E_Chat** is a modern, cross-platform **1:1 messaging application** built with **React Native** and **Supabase**, ensuring **strong privacy** through **client-side end-to-end encryption**.
All messages and media remain **confidential** — never stored or transmitted in plaintext form.

---

## ✨ Features

* 🔐 **End-to-end encrypted** text & media messaging
* 👥 **Secure user authentication** and persistent sessions
* ⚡ **Real-time messaging** via WebSocket updates
* 📱 **Cross-platform** support (iOS, Android, Web)
* 😄 **Stickers & GIFs** for expressive communication
* 🖼️ **Private encrypted media gallery**
* ✅ **Message delivery acknowledgements** & **read receipts**

---

## 🎥 Video Demonstration

[![Watch the demo](./thumbnail.png)](./demo%20video.mp4)

---

## 🧠 Tech Stack

| Component      | Technology                    | Purpose                              |
| -------------- | ----------------------------- | ------------------------------------ |
| **Frontend**   | React Native, Expo            | Cross-platform app development       |
| **Styling**    | NativeWind (Tailwind CSS)     | Modern UI & consistent design        |
| **Backend**    | Supabase (PostgreSQL, Auth)   | Authentication & data persistence    |
| **Realtime**   | Supabase Realtime (WebSocket) | Instant message synchronization      |
| **Encryption** | libsodium-wrappers            | End-to-end encryption & key handling |
| **Navigation** | React Navigation              | Screen routing & transitions         |
| **Storage**    | Supabase Storage              | Secure encrypted media storage       |

---

## ⚙️ Implementation Details

### 1. 🧩 Project Setup & Configuration

* **Concept:** Modular architecture and dependency management.
* **Implementation:** Initialized via **Expo + TypeScript** with organized folders for scalability and maintainability.

### 2. 🌐 Backend & WebSocket Connection

* **Concept:** Real-time bidirectional communication.
* **Implementation:** Supabase integrates PostgreSQL, Auth, and Realtime APIs (WebSocket-based).

### 3. 🎨 Frontend UI with React & Tailwind

* **Concept:** Component-driven reactive UI using utility-first CSS.
* **Implementation:** React Native components styled with **NativeWind** for rapid UI prototyping.

### 4. 🔒 Authentication & Encryption

* **Concept:** Secure login and end-to-end encrypted communication.
* **Implementation:**

  * **Auth:** Managed by Supabase Auth (email/password or OAuth).
  * **Encryption:** Handled by **libsodium** using `X25519` (key exchange) and `XSalsa20-Poly1305` (message encryption).

### 5. 📡 Protocol Handling (ACKs & Read Receipts)

* **Concept:** Message delivery confirmation protocols.
* **Implementation:** Supabase Realtime triggers update message metadata (status flags: sent, delivered, seen).

### 6. 🧪 Testing & Benchmarking

* **Concept:** Quality assurance and performance measurement.
* **Implementation:** Unit/integration tests located in `/tests`, with profiling for encryption and rendering latency.

### 7. 🚀 Performance Optimization

* **Concept:** Responsive performance and efficient state management.
* **Implementation:** Lazy resource loading, optimized React hooks, and minimized re-renders.

### 8. 📘 Documentation & Demo

* **Concept:** Developer-friendly documentation and structured project presentation.
* **Implementation:** Comprehensive README, inline comments, and walkthrough materials prepared.

### 9. 🎯 Future Integration (WebRTC)

* **Concept:** Peer-to-peer communication via WebRTC.
* **Implementation (Planned):** Secure real-time audio/video streaming between users.

---

## 🔮 Future Scope

* 🎥 **WebRTC-based** real-time voice/video calls
* 👨‍👩‍👧 **Group messaging** with E2E encryption
* ⏱️ **Self-destructing messages** and timed visibility
* 📡 **Offline synchronization** for queued messages
* 🔧 **Custom encryption protocols** beyond WebRTC defaults

---

## 📄 License

This project is licensed under the [MIT License](./LICENSE) © 2025 **Arth Agarwal**.
