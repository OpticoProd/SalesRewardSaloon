const withCleartextTraffic = require('./withCleartextTraffic');

module.exports = {
  expo: {
    // development
    // name: 'DigiScanner-dev',
    // slug: 'DigiScanner-dev',
    // production
    // name: 'salun-1',
    // slug: 'salun-1',
    name: 'salun',
    slug: 'salun',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSCameraUsageDescription: 'Allow Digi Scanner to access your camera for barcode scanning.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.example.DigiScannerPTD',
      // package: 'com.example.Salun',
      permissions: ['CAMERA', 'INTERNET', 'android.permission.CAMERA'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'react-native-vision-camera',
        {
          cameraPermissionText: 'Allow DigiScanner to access your camera for barcode scanning.',
        },
      ],
      'expo-notifications',
      'expo-barcode-scanner',
    ],
    owner: 'krishna_p',
    
    //pass = OpticoProd@2025
    // owner: 'sameer2210',
    // pass = Sameerkhan007#
     "extra": {
      "eas": {
        "projectId": "b26ffcf0-91a4-4a40-bb53-52bf4078bbdc"
        //  "projectId": "f27e8127-fc85-4d47-a02b-eacf8192ad4f"
      }
    },

   
    newArchEnabled: true,
  },
};
