# DoTalk - Full-Stack Mobile Messenger (React + Express + MongoDB + Capacitor)

DoTalk is a premium, production-ready, full-stack real-time messaging and voice/video calling application. This repository has been migrated from React Native CLI to **Capacitor 6+**, allowing you to easily build, compile, and run native Android APKs directly from your Vite-powered React codebase using standard web tools and Android Studio.

---

## 🚀 Migration & Clean Architecture Overview

This project has been restructured for developer-friendly builds, eliminating legacy React Native CLI bottlenecks (e.g., Metro bundler crashes, Gradle compatibility errors, or native CLI conflicts).

### 📁 Streamlined Repository Structure

```
├── android/                 # Clean, modern Capacitor Android native project
├── backend/                 # Node.js + Express + Mongoose (REST API & WebSockets)
├── frontend/                # Vite + React 19 + Tailwind CSS (Web SPA & Mobile views)
│   ├── src/                 # Screen components, utils, assets
│   └── package.json         # Frontend configuration
├── mobile/                  # Centralized Mobile configuration
│   ├── .env                 # Configured mobile environment URL
│   └── .env.example         # Mobile configuration template
├── package.json             # Root-level configuration & task runners
├── capacitor.config.ts      # Modern TypeScript-based Capacitor 6+ configuration
├── server.ts                # Unified dev server & API proxy entry point
└── README.md                # Comprehensive documentation (this file)
```

### 📝 Key Changes Implemented

1. **Removed Legacy React Native CLI**: Deleted all Metro bundler configurations, React Native CLI modules, legacy Java bridge folders, and custom babel configurations that caused compiler warnings and build crashes.
2. **Centralized Capacitor Android Platform**: Integrated a native `/android` workspace directly at the root. Running `npx cap sync android` now copies web assets compiled by Vite straight from the unified `/dist` folder into the Android platform package.
3. **Auto-Adaptive Mobile Views**: The frontend utilizes a smart `<PhoneFrame>` view which automatically detects if it's running inside a mobile webview/Capacitor container, rendering **100% full screen** natively while showing an elegant desktop mockup frame in web browsers.
4. **Robust Permission Configuration**: Injected critical permissions into `/android/app/src/main/AndroidManifest.xml` (e.g., `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `POST_NOTIFICATIONS`) enabling seamless media and push message interaction.
5. **Secured WebRTC NAT Traversal**: Added production-grade **STUN & TURN server placeholders** in `/frontend/src/App.tsx` so call streams work across distinct cellular networks (4G, 5G, LTE) and strict symmetric firewalls.
6. **Centralized Task Runners**: Configured root scripts for easy one-line syncing, debugging, and building.

---

## 💻 Technical Prerequisites

Ensure your system meets the following software requirements before compiling the APK:

| Dependency | Required Version | Verification Command |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or higher | `node -v` |
| **JDK (Java)** | `Java 17` (Required for Gradle 8+) | `java -version` |
| **Android SDK** | API level `34` (Android 14) or higher | Managed via Android Studio |
| **Android Studio** | Koala/Ladybug or newer | - |
| **Operating System** | Windows 10/11, macOS, or Linux | - |

---

## ⚙️ Environment Configuration

DoTalk features an offline-first state engine with fully secure remote endpoints. To deploy or compile:

### 1. Backend Server Environment (`/.env`)

Configure these on your server host (e.g., Railway) or create a local `.env` in the root:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/dotalk"
JWT_SECRET="dotalk_secure_secret_key"
FRONTEND_URL="https://dotalk-production.up.railway.app"
VITE_API_URL="https://dotalk-production.up.railway.app"
```

### 2. Mobile Client Environment (`/mobile/.env`)

Capacitor automatically reads configuration values and compiles them into web assets. Set this file:

```env
BACKEND_URL=https://dotalk-production.up.railway.app
```

*Note: The frontend architecture automatically derives WebSocket (`wss://`) URLs from `BACKEND_URL`, keeping settings synced and eliminating redundant configuration.*

---

## 🚀 Unified Build & Compilation Workflow

To compile your React frontend, synchronize assets, and prepare your Android workspace, run the following commands sequentially from the **project root**:

```bash
# 1. Install all backend, frontend, and Capacitor CLI dependencies
npm install

# 2. Build the unified production bundles (Vite Web App + Node Server)
npm run build

# 3. Copy compiled web assets and plugins to the Android project folder
npm run cap:sync
```

---

## 📱 How to Generate APKs Using Android Studio on Windows

Once your assets are synchronized, follow these instructions to build your APK files.

### Option A: Direct Command Line (Fastest)

From the root directory of the project, run:

```bash
# Generate a Debug APK (saves to android/app/build/outputs/apk/debug/app-debug.apk)
npm run android:debug

# Generate an Unsigned Release APK (saves to android/app/build/outputs/apk/release/app-release-unsigned.apk)
npm run android:release
```

---

### Option B: Interactive Studio GUI (Recommended for Play Store Publishing)

To launch Android Studio and compile using the IDE:

```bash
# Open the native android project directly in Android Studio
npm run cap:open
```

Once Android Studio opens:

#### 1. Generate a Debug APK (For Local Device Testing)
1. Go to the top menu bar and select **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
2. Wait for the Gradle daemon to compile the project.
3. Once completed, a pop-up in the bottom-right corner will show **"APK(s) generated successfully"**. Click **"locate"** to open the file folder containing your active `app-debug.apk` binary.

#### 2. Generate a Signed Release APK (For Play Store or Distribution)
1. In Android Studio, go to the top menu bar and select **Build > Generate Signed Bundle / APK...**
2. Choose **APK** and click **Next**.
3. Create a new Keystore path or select an existing `.jks` file, enter your password credentials, and fill in the certificate information.
4. Select the **Release** build variant, make sure **V4 (Resigned)** is checked if necessary, and click **Finish**.
5. Locate your secure, optimized APK at: `/android/app/release/app-release.apk`.

---

## 📡 WebRTC Calling & NAT Traversal Configuration

WebRTC voice and video streams run over standard browser peer-to-peer pipelines. While development can use standard Google STUN servers, mobile carrier connections (4G, 5G) frequently block peer packets. 

To configure secure, reliable calls globally:
1. Setup a **COTURN** or similar TURN server instance.
2. In `/frontend/src/App.tsx`, locate the `RTCPeerConnection` instance and update the placeholders with your TURN server credentials:

```typescript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Production TURN configurations (symmetric NAT traversal)
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'production_user',
      credential: 'production_secure_credential_here'
    }
  ]
});
```

---

## 🛠️ Troubleshooting & Common Fixes

### 1. Gradle Build Failure: "SDK Location not found"
* **Cause**: Android Studio does not know where your Android SDK is installed.
* **Fix**: Create a file named `local.properties` inside the `/android` folder and add your local SDK path:
  ```properties
  sdk.dir=C\:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk
  ```

### 2. Gradle Build Failure: "Unsupported Class Version (JDK)"
* **Cause**: Gradle 8+ requires **JDK 17** or higher. Your active CLI is pointing to JDK 8 or 11.
* **Fix**: 
  1. Download and install **JDK 17** from Oracle or Adoptium.
  2. In Android Studio, go to **File > Settings > Build, Execution, Deployment > Build Tools > Gradle**.
  3. Under **Gradle JDK**, choose **JDK 17** or the embedded Android Studio JDK.
  4. Restart your terminal session.

### 3. Cleartext / HTTP connection blocked
* **Cause**: Android blocks plain-text HTTP connections (`http://`) by default for security.
* **Fix**: Ensure your `.env` connects to an `https://` secure backend (like Railway). If you absolutely must use plain-text HTTP for temporary testing, update the `<application>` tag in `android/app/src/main/AndroidManifest.xml` to include `android:usesCleartextTraffic="true"`.

### 4. WebSocket (Socket.IO) disconnects or fails on 4G/5G mobile networks
* **Cause**: Mobile network firewalls often kill idle WebSocket connections.
* **Fix**: DoTalk is pre-configured with active heartbeat intervals and automated retry logic inside `/frontend/src/utils/api.ts` to reconnect silently within milliseconds. Make sure your server uses HTTPS and WSS (WebSocket Secure) to prevent proxy blocking.
