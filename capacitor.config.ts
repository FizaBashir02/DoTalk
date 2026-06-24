import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dotalk.app',
  appName: 'DoTalk',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'dotalk-production.up.railway.app',
      '*.railway.app'
    ]
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
