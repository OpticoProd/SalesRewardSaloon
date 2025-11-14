const withCleartextTraffic = require('./withCleartextTraffic');

module.exports = {
  expo: {
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

    extra: {
      eas: {
        projectId: 'b26ffcf0-91a4-4a40-bb53-52bf4078bbdc',
      },
    },

    newArchEnabled: true,
  },
};



//production wale ke liye --------------------------------------------------------------------------

// const withCleartextTraffic = require('./withCleartextTraffic');

// module.exports = {
//   expo: {
//     // development
//     name: 'Salon-dev',
//     slug: 'Salon-dev',
//     // production
//     // name: 'SalesRewardSalon',
//     // slug: 'SalesRewardSalon',
//     version: '1.0.0',
//     orientation: 'portrait',
//     icon: './assets/icon.png',
//     userInterfaceStyle: 'automatic',
//     splash: {
//       image: './assets/logo.png',
//       resizeMode: 'contain',
//       backgroundColor: '#ffffff',
//     },
//     updates: {
//       fallbackToCacheTimeout: 0,
//     },
//     assetBundlePatterns: ['**/*'],
//     ios: {
//       supportsTablet: true,
//       infoPlist: {
//         NSCameraUsageDescription: 'Allow Digi Scanner to access your camera for barcode scanning.',
//       },
//     },
//     android: {
//       adaptiveIcon: {
//         foregroundImage: './assets/adaptive-icon.png',
//         backgroundColor: '#ffffff',
//       },
//       package: 'com.example.SalesRewardSalon',
//       // package: 'com.example.SalesRewardSalon',
//       versionCode: 1,
//       permissions: ['CAMERA', 'INTERNET', 'android.permission.CAMERA'],
//     },
//     web: {
//       favicon: './assets/favicon.png',
//     },
//     plugins: [
//       [
//         'react-native-vision-camera',
//         {
//           cameraPermissionText: 'Allow DigiScanner to access your camera for barcode scanning.',
//         },
//       ],
//       'expo-notifications',
//       'expo-barcode-scanner',
//     ],
//     owner: 'opticoprod',
//     //pass = OpticoProd@2025
//     // owner: 'sameer2210',
//     extra: {
//       eas: {
//         //development id
//         // projectId: 'e69934f5-43ad-4aae-98c7-066ac5bc5c4f',
//         //main production id
//         projectId: '4b8104c0-e80f-40a4-9689-4c73ee90c879',
//       },
//     },
//     newArchEnabled: true,
//   },
// };
