# DoTalk - Full-Stack Mobile Messenger (React + Express + MongoDB + Capacitor)

DoTalk is a premium, 100% production-ready mobile messaging engine built with a fully detached full-stack architecture.

---

## 📱 Folder Architecture

1. **Frontend (`/frontend`)**:
   - Modern React (Vite-powered) SPA with custom Tailwind CSS styles.
   - Built with responsive Viewports to run both on desktop browsers and mobile native handsets.
   - Initialized with **Capacitor CLI** for packing into native Android APKs.
   - **Dynamic API Config**: Settings tab includes an editable **API Server IP** field. Easily change the endpoint on physical devices.

2. **Backend (`/backend` / `/server.ts`)**:
   - Node/Express REST API serving real-time Sockets on port `3000`.
   - Connected to **MongoDB (via Mongoose ODM)** with dual-write JSON resilience.
   - Provides verification OTP hooks, profile settings, dynamic user directories, status story handlers, and read-receipt timers.

---

## 🛠️ Installation & Running

### 1. Unified Development Start
To start both the backend Node server and mount Vite's React compiler:
```bash
# Install core workspace packages
npm install

# Instantly boot the development stack
npm run dev
```

### 2. Configure Live Databases
Create a `.env` in the root folder to route data entries from the JSON disk mirror off to any MongoDB Cloud Cluster:
```env
MONGODB_URI="mongodb+srv://<user>:<pwd>@cluster0.mongodb.net/dotalk"
JWT_SECRET="dotalk_secure_secret_key"
```

---

## 🤖 Capacitor Android APK Compilation

To bundle, sync, and compile a native Android APK:

### 1. Build the production React assets from the project root:
```bash
npm run build
```
This compiles your Vite sources and structures them inside `/dist`.

### 2. Synchronize Assets with Capacitor (inside the `/frontend` folder):
```bash
cd frontend

# Install platform dependencies
npm install @capacitor/core @capacitor/cli @capacitor/android

# Sync the assets to active native platforms
npx cap sync
```

### 3. Open Android Studio to compile and test:
```bash
npx cap open android
```
- From **Android Studio**, click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
- Locate your compiled APK at: `/frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

### ⚡ Critical Cleartext HTTP Android Rule
We pre-configured **`"cleartext": true`** inside `capacitor.config.json`. This guarantees Android OS does not block cleartext HTTP traffic, enabling you to test of your custom `http://<YOUR_LOCAL_IP>:3000` REST calls directly from physical devices or emulator layers.
