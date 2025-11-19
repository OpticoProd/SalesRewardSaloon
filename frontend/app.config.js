// const withCleartextTraffic = require('./withCleartextTraffic');

// module.exports = {
//   expo: {
//     name: 'salun',
//     slug: 'salun',
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
//       package: 'com.example.DigiScannerPTD',
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
//     owner: 'krishna_p',

//     extra: {
//       eas: {
//         projectId: 'b26ffcf0-91a4-4a40-bb53-52bf4078bbdc',
//       },
//     },

//     newArchEnabled: true,
//   },
// };





//production wale ke liye --------------------------------------------------------------------------

const withCleartextTraffic = require('./withCleartextTraffic');


module.exports = {
  expo: {
    // development
    // name: 'Salon-dev',
    // slug: 'Salon-dev',
    // production
    name: 'SalesRewardSalon',
    slug: 'SalesRewardSalon',
    version: '1.0.2',
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
      enabled: true,
      url: 'https://u.expo.dev/c2ff98cc-6ed9-49d2-9c8d-fc6ba528bb93',
    },
    assetBundlePatterns: ['**/*'],
    scheme: 'SalesRewardSalon',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.example.SalesRewardSalon',
      infoPlist: {
        NSCameraUsageDescription:
          'Allow SalesRewardSalon to access your camera for barcode scanning.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      // package: 'com.example.SalesRewardSalon-dev',
      package: 'com.example.SalesRewardSalon',
      versionCode: 2,
      permissions: ['CAMERA', 'INTERNET', 'android.permission.CAMERA'],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
      output: 'static',
    },
    plugins: [
      [
        'react-native-vision-camera',
        {
          cameraPermissionText:
            'Allow SalesRewardSalon to access your camera for barcode scanning.',
        },
      ],
      'expo-notifications',
      'expo-barcode-scanner',
    ],
    owner: 'opticoprod',
    //pass = OpticoProd@2025
    // owner: 'sameer2210',
    extra: {
      eas: {
        //development id
        // projectId: 'e69934f5-43ad-4aae-98c7-066ac5bc5c4f',
        //main production id
        projectId: 'c2ff98cc-6ed9-49d2-9c8d-fc6ba528bb93',
      },
    },
    newArchEnabled: true,
  },
};
