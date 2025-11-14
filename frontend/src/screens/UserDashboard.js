// import { MaterialIcons } from '@expo/vector-icons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useFocusEffect } from '@react-navigation/native';
// import axios from 'axios';
// import { BarCodeScanner } from 'expo-barcode-scanner';
// import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
// import {
//   ActivityIndicator,
//   Animated,
//   BackHandler,
//   FlatList,
//   Image,
//   Modal,
//   Platform,
//   ScrollView,
//   StyleSheet,
//   Switch,
//   TouchableOpacity,
//   unstable_batchedUpdates,
//   View,
// } from 'react-native';
// import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';
// import Swiper from 'react-native-swiper';
// import Toast from 'react-native-toast-message';
// import { io as ioClient } from 'socket.io-client';
// import { ThemeContext } from '../ThemeContext';
// import { BASE_URL } from '../config/baseURL';


// export default function UserDashboard({ navigation }) {
//   // State Declarations
//   const { colors } = useTheme();
//   const { isDarkMode, toggleTheme } = useContext(ThemeContext);
//   const [hasPermission, setHasPermission] = useState(null);
//   const [scanned, setScanned] = useState(false);
//   const [barcodeData, setBarcodeData] = useState(null);
//   const [user, setUser] = useState(null);
//   const [admin, setAdmin] = useState(null);
//   const [barcodes, setBarcodes] = useState([]);
//   const [searchBarcode, setSearchBarcode] = useState('');
//   const [error, setError] = useState('');
//   const [showScanner, setShowScanner] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [fetchError, setFetchError] = useState('');
//   const [currentTab, setCurrentTab] = useState('home');
//   const [scanRegion, setScanRegion] = useState(null);
//   const scanLineAnim = React.useRef(new Animated.Value(0)).current;
//   const [rewards, setRewards] = useState([]);
//   const [notifications, setNotifications] = useState([]);
//   const [redemptions, setRedemptions] = useState([]);
//   const [showRewardHistory, setShowRewardHistory] = useState(true);
//   const [forceRender, setForceRender] = useState(0);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [history, setHistory] = useState([]);
//   const [addedPoints, setAddedPoints] = useState(0);
//   const [lastAddedPoints, setLastAddedPoints] = useState(0);
//   const flatListRef = React.useRef(null);
//   const socketRef = React.useRef(null);
//   const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
//   const [currentPassword, setCurrentPassword] = useState('');
//   const [newPassword, setNewPassword] = useState('');
//   const [showPointsAnimation, setShowPointsAnimation] = useState(false);
//   const [historyItems, setHistoryItems] = useState([]);
//   const [unreadUser, setUnreadUser] = useState(0);
//   const [netPointsHistory, setNetPointsHistory] = useState([]);

//   const toggleRewardHistory = useCallback(() => {
//     setShowRewardHistory(prev => !prev);
//   }, []);

//   // Navigation Options
//   React.useLayoutEffect(() => {
//     navigation.setOptions({
//       headerLeft: () => null,
//       gestureEnabled: false,
//       headerRight: () => (
//         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
//           {/* <TouchableOpacity onPress={() => setCurrentTab('history')} style={{ marginRight: 10 }}>
//             <MaterialIcons name="notifications" size={24} color={colors.primary} />
//             {unreadUser > 0 && (
//               <Badge style={{ position: 'absolute', top: -5, right: -5 }}>{unreadUser}</Badge>
//             )}
//           </TouchableOpacity> */}
//           <Switch
//             value={isDarkMode}
//             onValueChange={toggleTheme}
//             style={{ transform: [{ scale: 0.8 }], marginRight: 12 }}
//             thumbColor={isDarkMode ? '#FFD700' : '#f4f3f4'}
//             trackColor={{ false: '#767577', true: '#81b0ff' }}
//           />
//           <TouchableOpacity onPress={handleLogout}>
//             <MaterialIcons name="logout" size={24} color="#f44336" style={{ marginRight: 14 }} />
//           </TouchableOpacity>
//         </View>
//       ),
//     });
//   }, [unreadUser, navigation, colors, isDarkMode, toggleTheme]);

//   // Initialization
//   useEffect(() => {
//     const initialize = async () => {
//       try {
//         const storedUser = await AsyncStorage.getItem('user');
//         if (storedUser) {
//           const parsedUser = JSON.parse(storedUser);
//           if (!parsedUser.id) throw new Error('Invalid user ID');
//           setUser(parsedUser);
//           await fetchUserProfile(parsedUser.id);
//           await fetchUserBarcodes(parsedUser.id);
//           await fetchRewards();
//           await fetchNotifications();
//           await fetchRedemptions();
//           if (parsedUser.id) {
//             await fetchUserHistory();
//           }
//         } else {
//           throw new Error('No user data found');
//         }
//       } catch (err) {
//         await AsyncStorage.clear();
//         navigation.replace('Home');
//         Toast.show({
//           type: 'error',
//           text1: 'Initialization Failed',
//           text2: err.message || 'Could not load user data.',
//         });
//       }
//     };
//     initialize();
//   }, [navigation]);

//   // Socket Setup (cleaned up duplicates)
//   useEffect(() => {
//     if (!user?.id) return;
//     let socket;
//     const setupSocket = async () => {
//       try {
//         const token = await AsyncStorage.getItem('token');
//         if (!token) return;
//         socket = ioClient(BASE_URL.replace(/^http/, 'ws'), {
//           transports: ['websocket'],
//           auth: { token },
//           reconnection: true,
//           reconnectionAttempts: 5,
//           reconnectionDelay: 2000,
//         });
//         socketRef.current = socket;
//         socket.on('connect', () => {
//           console.log('✅ Socket connected');
//           socket.emit('register', { role: 'user', userId: user.id.toString() });
//         });
//         socket.on('connect_error', err => console.warn('❌ Socket error:', err.message));
//         socket.on('disconnect', reason => console.log('⚠️ Socket disconnected:', reason));
//         // Consolidated listeners
//         socket.on('user:selfUpdated', data => {
//           setUser(prev => ({ ...prev, ...data }));
//           Toast.show({ type: 'info', text1: 'Your profile updated' });
//           setUnreadUser(prev => prev + 1);
//         });
//         socket.on('points:updated', data => {
//           if (data?.userId?.toString() === user.id.toString()) {
//             setUser(prev => ({ ...prev, points: data.points }));
//             Toast.show({
//               type: 'success',
//               text1: 'Points updated',
//               text2: `New total: ${data.points}`,
//             });
//             setUnreadUser(prev => prev + 1);
//           }
//         });
//         socket.on('reward:updated', () => {
//           fetchRewards();
//           Toast.show({ type: 'info', text1: 'Rewards Updated!' });
//           setUnreadUser(prev => prev + 1);
//         });
//         socket.on('rewardCreated', () => {
//           fetchRewards();
//           Toast.show({ type: 'success', text1: 'New reward available!' });
//           setUnreadUser(prev => prev + 1);
//         });
//         socket.on('reward:deleted', () => {
//           fetchRewards();
//           Toast.show({ type: 'info', text1: 'Reward removed' });
//           setUnreadUser(prev => prev + 1);
//         });
//         socket.on('redemption:updated', () => {
//           fetchRedemptions();
//           fetchNotifications();
//           setUnreadUser(prev => prev + 1);
//         });
//         socket.on('notificationCreated', notif => {
//           if (notif.userId === user.id) {
//             setNotifications(prev => [notif, ...prev]);
//             setUnreadUser(prev => prev + 1);
//             Toast.show({ type: 'info', text1: notif.message });
//           }
//         });
//         socket.on('barcode:deleted', data => {
//           if (data?.userId?.toString() === user.id.toString()) {
//             fetchUserBarcodes(user.id);
//             Toast.show({ type: 'warning', text1: 'Barcode deleted' });
//             setUnreadUser(prev => prev + 1);
//           }
//         });
//         socket.on('userHistoryUpdated', entry => {
//           setHistory(prev => {
//             const newHistory = [entry, ...prev].sort(
//               (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//             );
//             let cumulative = 0;
//             const withNet = newHistory
//               .map(item => {
//                 const change = ['scan', 'point_add'].includes(item.action)
//                   ? item.details?.amount || item.details?.points || 0
//                   : -(item.details?.amount || 0);
//                 cumulative += change;
//                 return { ...item, transactionPoint: change, netPoint: cumulative };
//               })
//               .reverse();
//             setNetPointsHistory(withNet);
//             return newHistory;
//           });
//           Toast.show({ type: 'info', text1: 'History updated' });
//           setUnreadUser(prev => prev + 1);
//         });
//         socket.on('barcodeScanned', data => {
//           if (data.userId === user.id) {
//             unstable_batchedUpdates(() => {
//               setAddedPoints(data.addedPoints || 0);
//               setShowPointsAnimation(true);
//               setUnreadUser(prev => prev + 1);
//             });
//             Toast.show({ type: 'success', text1: 'Barcode scanned successfully' });
//           }
//         });
//         socket.on('notification:updated', payload => {
//           if (payload?.userId?.toString() === user.id.toString()) {
//             fetchNotifications();
//             Toast.show({ type: 'info', text1: 'Notification updated' });
//             setUnreadUser(prev => prev + 1);
//           }
//         });
//         socket.on('history:updated', payload => {
//           if (payload?.userId?.toString() === user.id.toString()) {
//             setHistoryItems(prev => [...(payload.items || []), ...prev]);
//             Toast.show({ type: 'info', text1: 'New history event' });
//             setUnreadUser(prev => prev + 1);
//           }
//         });
//       } catch (err) {
//         console.warn('Socket setup error:', err);
//       }
//     };
//     setupSocket();
//     return () => {
//       if (socketRef.current) {
//         socketRef.current.off();
//         socketRef.current.disconnect();
//         socketRef.current = null;
//       }
//     };
//   }, [
//     user,
//     fetchRewards,
//     fetchNotifications,
//     fetchRedemptions,
//     fetchUserBarcodes,
//     fetchUserHistory,
//   ]);

//   useFocusEffect(
//     useCallback(() => {
//       if (Platform.OS !== 'web') {
//         const onBackPress = () => {
//           navigation.navigate('UserDashboard');
//           return true;
//         };
//         BackHandler.addEventListener('hardwareBackPress', onBackPress);
//         return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
//       }
//     }, [navigation])
//   );

//   useFocusEffect(
//     useCallback(() => {
//       if (user?.id) {
//         console.log('📱 Screen focused - refreshing rewards...');
//         fetchRewards();
//       }
//     }, [user, fetchRewards])
//   );

//   useFocusEffect(
//     useCallback(() => {
//       if (currentTab === 'history') {
//         fetchUserHistory();
//       }
//     }, [currentTab])
//   );

//   useEffect(() => {
//     if (!user?.id) return;
//     const pollingInterval = setInterval(() => {
//       console.log('🔄 Periodic refresh - fetching rewards...');
//       fetchRewards();
//     }, 10000);
//     return () => clearInterval(pollingInterval);
//   }, [user, fetchRewards]);

//   useEffect(() => {
//     if (showScanner) {
//       Animated.loop(
//         Animated.sequence([
//           Animated.timing(scanLineAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
//           Animated.timing(scanLineAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
//         ])
//       ).start();
//     }
//   }, [showScanner, scanLineAnim]);

//   // Simple animation for points (expand and fade)
//   useEffect(() => {
//     if (showPointsAnimation) {
//       // Add your animation logic here, e.g., using Animated
//       setTimeout(() => setShowPointsAnimation(false), 1000);
//     }
//   }, [showPointsAnimation]);

//   const scanLineTranslate = useMemo(
//     () => scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] }),
//     [scanLineAnim]
//   );

//   const handleUnauthorized = useCallback(
//     async error => {
//       if (error.response?.status === 401 || error.response?.status === 403) {
//         await AsyncStorage.clear();
//         navigation.replace('Home');
//         Toast.show({
//           type: 'error',
//           text1: error.response?.status === 403 ? 'Account Not Approved' : 'Session Expired',
//           text2:
//             error.response?.data?.message ||
//             (error.response?.status === 403
//               ? 'Your account is pending admin approval.'
//               : 'Please log in again.'),
//         });
//         return true;
//       }
//       return false;
//     },
//     [navigation]
//   );

//   const fetchUserProfile = useCallback(
//     async userId => {
//       if (!userId) return;
//       try {
//         setLoading(true);
//         const token = await AsyncStorage.getItem('token');
//         if (!token) throw new Error('No token found');
//         const response = await axios.get(`${BASE_URL}/users/${userId}`, {
//           headers: { Authorization: token },
//         });
//         if (response.data.status !== 'approved') {
//           await AsyncStorage.clear();
//           navigation.replace('Home');
//           Toast.show({
//             type: 'error',
//             text1: 'Account Not Approved',
//             text2:
//               response.data.status === 'pending'
//                 ? 'Your account is pending admin approval.'
//                 : 'Your account has been disapproved.',
//           });
//           return;
//         }
//         const updatedUser = {
//           id: response.data._id,
//           name: response.data.name,
//           mobile: response.data.mobile,
//           points: response.data.points || 0,
//           location: response.data.location || 'Unknown',
//           status: response.data.status,
//           rewardProgress: response.data.rewardProgress || [],
//         };
//         setUser(updatedUser);
//         await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
//       } catch (error) {
//         console.log('Outer catch error:', error);
//         if (await handleUnauthorized(error)) return;
//         Toast.show({
//           type: 'error',
//           text1: 'Profile Fetch Failed',
//           text2: error.response?.data?.message || error.message || 'Could not load profile.',
//         });
//       } finally {
//         setLoading(false);
//       }
//     },
//     [handleUnauthorized, navigation]
//   );

//   const fetchUserBarcodes = useCallback(
//     async userId => {
//       if (!userId) return;
//       setLoading(true);
//       setFetchError('');
//       try {
//         const token = await AsyncStorage.getItem('token');
//         if (!token) throw new Error('No token found');
//         const response = await axios.get(`${BASE_URL}/barcodes/user/${userId}`, {
//           headers: { Authorization: token },
//         });
//         const barcodeData = Array.isArray(response.data)
//           ? response.data
//           : response.data.barcodes || [];
//         setBarcodes(barcodeData);
//       } catch (error) {
//         if (await handleUnauthorized(error)) return;
//         const errorMessage = error.response?.data?.message || 'Failed to fetch barcodes';
//         setFetchError(errorMessage);
//         setBarcodes([]);
//         Toast.show({ type: 'error', text1: 'Barcode Fetch Failed', text2: errorMessage });
//       } finally {
//         setLoading(false);
//       }
//     },
//     [handleUnauthorized]
//   );

//   const fetchRewards = useCallback(async () => {
//     try {
//       console.log('🔄 Fetching rewards from API...');
//       const token = await AsyncStorage.getItem('token');
//       if (!token) {
//         console.warn('⚠️ No token found for fetching rewards');
//         return;
//       }
//       const response = await axios.get(`${BASE_URL}/rewards`, {
//         headers: { Authorization: token },
//       });
//       if (!response || !response.data) {
//         console.warn('⚠️ Invalid response from rewards API');
//         setRewards([]);
//         return;
//       }
//       const rewardsData = Array.isArray(response.data) ? response.data : [];
//       console.log('✅ Rewards fetched successfully, count:', rewardsData.length);
//       setRewards(rewardsData);
//     } catch (error) {
//       console.error('❌ Error fetching rewards:', error);
//       if (error.response) {
//         Toast.show({
//           type: 'error',
//           text1: 'Rewards Fetch Failed',
//           text2: error.response?.data?.message || 'Could not load rewards.',
//         });
//       }
//       setRewards([]);
//     }
//   }, []);

//   const fetchUserHistory = async () => {
//     try {
//       const token = await AsyncStorage.getItem('token');
//       if (!token) throw new Error('No token found');
//       const res = await axios.get(`${BASE_URL}/history/user/${user.id}`, {
//         headers: { Authorization: token },
//       });
//       const historyData = Array.isArray(res.data) ? res.data : [];
//       historyData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
//       let cumulative = 0;
//       const withNet = historyData.map(item => {
//         const amount = Number(item.details?.amount ?? item.details?.points ?? item.points ?? 0);
//         const isDeposit = item.action === 'scan' || item.action === 'point_add';
//         const change = isDeposit ? amount : -Math.abs(amount);
//         cumulative += change;
//         return { ...item, transactionPoint: change, netPoint: cumulative };
//       });
//       const lastNet = withNet.length ? withNet[withNet.length - 1].netPoint : 0;
//       const userPoints = typeof user?.points === 'number' ? user.points : lastNet;
//       const offset = userPoints - lastNet;
//       const adjusted =
//         offset !== 0 ? withNet.map(it => ({ ...it, netPoint: it.netPoint + offset })) : withNet;
//       setNetPointsHistory(adjusted);
//     } catch (err) {
//       console.error('Error fetching user history:', err);
//       // Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load your history' });
//     }
//   };

//   const fetchNotifications = useCallback(async () => {
//     try {
//       const token = await AsyncStorage.getItem('token');
//       const response = await axios.get(`${BASE_URL}/notifications`, {
//         headers: { Authorization: token },
//       });
//       setNotifications(response.data);
//     } catch (error) {
//       console.error('Error fetching notifications:', error);
//       Toast.show({
//         type: 'error',
//         text1: 'Notifications Fetch Failed',
//         text2: error.response?.data?.message || 'Could not load notifications.',
//       });
//     }
//   }, []);

//   const fetchRedemptions = useCallback(async () => {
//     try {
//       const token = await AsyncStorage.getItem('token');
//       const response = await axios.get(`${BASE_URL}/redemptions`, {
//         headers: { Authorization: token },
//       });
//       setRedemptions(response.data);
//     } catch (error) {
//       console.error('Error fetching redemptions:', error);
//       Toast.show({
//         type: 'error',
//         text1: 'Redemptions Fetch Failed',
//         text2: error.response?.data?.message || 'Could not load reward history.',
//       });
//     }
//   }, []);

//   const clearNotification = useCallback(
//     async notificationId => {
//       try {
//         const token = await AsyncStorage.getItem('token');
//         await axios.delete(`${BASE_URL}/notifications/${notificationId}`, {
//           headers: { Authorization: token },
//         });
//         setNotifications(notifications.filter(n => n._id !== notificationId));
//         Toast.show({ type: 'success', text1: 'Notification Cleared' });
//       } catch (error) {
//         Toast.show({
//           type: 'error',
//           text1: 'Clear Failed',
//           text2: error.response?.data?.message || 'Could not clear notification.',
//         });
//       }
//     },
//     [notifications]
//   );

//   const clearRedemption = useCallback(
//     async redemptionId => {
//       try {
//         const token = await AsyncStorage.getItem('token');
//         await axios.delete(`${BASE_URL}/redemptions/${redemptionId}`, {
//           headers: { Authorization: token },
//         });
//         setRedemptions(redemptions.filter(r => r._id !== redemptionId));
//         Toast.show({ type: 'success', text1: 'History Item Cleared' });
//       } catch (error) {
//         console.error('Error clearing redemption:', error);
//         Toast.show({
//           type: 'error',
//           text1: 'Clear Failed',
//           text2: error.response?.data?.message || 'Could not clear history item.',
//         });
//       }
//     },
//     [redemptions]
//   );

//   const memoizedBarcodes = useMemo(() => barcodes, [barcodes]);

//   const filteredBarcodes = useMemo(() => {
//     if (!Array.isArray(barcodes) || barcodes.length === 0) return [];
//     if (!searchBarcode?.trim()) return barcodes;
//     const searchLower = searchBarcode.toLowerCase().trim();
//     return barcodes.filter(barcode => barcode?.value?.toLowerCase().includes(searchLower));
//   }, [barcodes, searchBarcode]);

//   const handleBarCodeScanned = useCallback(
//     async ({ data }) => {
//       setScanned(true);
//       setTimeout(() => setShowScanner(false), 100);
//       setLoading(true);
//       setBarcodeData(data);
//       try {
//         const token = await AsyncStorage.getItem('token');
//         if (!token) throw new Error('No token found');
//         const response = await axios.post(
//           `${BASE_URL}/barcodes`,
//           { value: data.toUpperCase(), location: user?.location || 'Unknown' },
//           { headers: { Authorization: token } }
//         );
//         setLastAddedPoints(response.data.pointsAwarded);
//         await fetchUserProfile(user?.id);
//         await fetchRewards();
//         await fetchNotifications();
//         await fetchUserBarcodes(user?.id);
//         setError('');
//         Toast.show({
//           type: 'success',
//           text1: 'Scan Successful',
//           text2: `You earned ${response.data.pointsAwarded} points!`,
//           autoHide: true,
//           visibilityTime: 4000,
//         });
//       } catch (error) {
//         if (await handleUnauthorized(error)) return;
//         const errorMessage =
//           error.response?.data?.message === 'Barcode already scanned'
//             ? 'Barcode already scanned'
//             : error.response?.data?.message || 'Scan failed';
//         setError(errorMessage);
//         Toast.show({
//           type: 'error',
//           text1: 'Scan Failed',
//           text2: errorMessage,
//           autoHide: true,
//           visibilityTime: 4000,
//         });
//       } finally {
//         setLoading(false);
//         setTimeout(() => setScanned(false), 1500);
//       }
//     },
//     [
//       fetchUserProfile,
//       fetchUserBarcodes,
//       user,
//       fetchRewards,
//       fetchNotifications,
//       handleUnauthorized,
//     ]
//   );

//   const handleScanAction = useCallback(async () => {
//     try {
//       if (hasPermission === null || hasPermission === false) {
//         const { status } = await BarCodeScanner.requestPermissionsAsync();
//         setHasPermission(status === 'granted');
//         if (status === 'granted') {
//           await AsyncStorage.setItem('cameraPermission', 'granted');
//         } else {
//           Toast.show({
//             type: 'error',
//             text1: 'Permission Denied',
//             text2: 'Camera access is required to scan barcodes.',
//           });
//           return;
//         }
//       }
//       if (scanned) {
//         setScanned(false);
//         setBarcodeData(null);
//         setError('');
//       }
//       setShowScanner(true);
//       setScanRegion(null);
//     } catch (error) {
//       Toast.show({
//         type: 'error',
//         text1: 'Permission Error',
//         text2: 'Could not request camera permission.',
//       });
//     }
//   }, [hasPermission, scanned]);

//   const handleScanTabPress = useCallback(async () => {
//     setCurrentTab('scan');
//     if (hasPermission === null) {
//       try {
//         const { status } = await BarCodeScanner.requestPermissionsAsync();
//         setHasPermission(status === 'granted');
//         if (status === 'granted') {
//           await AsyncStorage.setItem('cameraPermission', 'granted');
//         } else {
//           Toast.show({
//             type: 'error',
//             text1: 'Permission Denied',
//             text2: 'Camera access is required to scan barcodes.',
//           });
//         }
//       } catch (error) {
//         Toast.show({
//           type: 'error',
//           text1: 'Permission Error',
//           text2: 'Could not request camera permission.',
//         });
//       }
//     }
//   }, [hasPermission]);

//   const handleCancelScan = useCallback(() => {
//     setShowScanner(false);
//     setScanned(false);
//     setBarcodeData(null);
//     setError('');
//     setScanRegion(null);
//   }, []);

//   const handleChangePassword = async () => {
//     if (!user?.id) {
//       alert('User not loaded. Please login again.');
//       return;
//     }
//     if (!currentPassword || !newPassword) {
//       alert('Please fill both fields');
//       return;
//     }
//     try {
//       const token = await AsyncStorage.getItem('token');
//       if (!token) {
//         alert('Session expired! Please login again.');
//         return;
//       }
//       const res = await axios.put(
//         `${BASE_URL}/users/${user.id}/password`,
//         { currentPassword, newPassword },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       alert(res.data.message || 'Password updated!');
//       setCurrentPassword('');
//       setNewPassword('');
//       setIsPasswordModalVisible(false);
//     } catch (err) {
//       console.log('❌ Error:', err.response?.data || err);
//       alert(err.response?.data?.message || 'Password change failed');
//     }
//   };

//   const handleSelectScanArea = useCallback(() => {
//     setScanRegion({ top: 100, left: 50, width: 200, height: 200 });
//   }, []);

//   const handleLogout = useCallback(async () => {
//     try {
//       await AsyncStorage.clear();
//       navigation.replace('Home');
//       Toast.show({
//         type: 'success',
//         text1: 'Logged Out',
//         text2: 'You have been logged out successfully.',
//       });
//     } catch (error) {
//       Toast.show({ type: 'error', text1: 'Logout Failed', text2: 'Could not log out.' });
//     }
//   }, [navigation]);

//   const TimelineEvent = ({ item }) => (
//     <View style={styles.timelineItem}>
//       <View style={styles.timelineIcon}>
//         <MaterialIcons
//           name={
//             item.action === 'scan'
//               ? 'qr-code'
//               : item.action === 'reward'
//               ? 'star'
//               : item.action === 'edit'
//               ? 'edit'
//               : 'history'
//           }
//           size={22}
//         />
//       </View>
//       <View style={styles.timelineContent}>
//         <Text style={[styles.cardText, { fontWeight: 'bold' }]}>{item.action.toUpperCase()}</Text>
//         <Text style={styles.smallText}>{item.details ? JSON.stringify(item.details) : ''}</Text>
//         <Text style={styles.smallText}>{new Date(item.createdAt).toLocaleString()}</Text>
//       </View>
//     </View>
//   );

//   const HistoryTab = () => (
//     <View>
//       <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//         History
//       </Text>
//       <FlatList
//         data={historyItems}
//         keyExtractor={(it, idx) => it._id || `${it.action}-${idx}`}
//         renderItem={({ item }) => <TimelineEvent item={item} />}
//         ListEmptyComponent={
//           !loading ? (
//             <Text style={[styles.cardText, { color: isDarkMode ? '#FFF' : colors.text }]}>
//               No history yet.
//             </Text>
//           ) : null
//         }
//       />
//     </View>
//   );

//   const NotificationsTab = () => (
//     <FlatList
//       data={notifications}
//       keyExtractor={item => item._id}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           onPress={async () => {
//             setUnreadUser(prev => prev - 1);
//             try {
//               const token = await AsyncStorage.getItem('token');
//               await axios.put(
//                 `${BASE_URL}/notifications/${item._id}/read`,
//                 {},
//                 { headers: { Authorization: token } }
//               );
//             } catch (err) {
//               console.error('Mark as read error:', err);
//             }
//             if (item.redirectData?.tab === 'rewards') {
//               setCurrentTab('rewards');
//               const idx = rewards.findIndex(r => r._id === item.redirectData.focusId);
//               requestAnimationFrame(() => {
//                 if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
//               });
//             } else {
//               setCurrentTab('history');
//             }
//           }}
//         >
//           <View style={styles.notificationItem}>
//             <Text style={styles.notificationText}>{item.message}</Text>
//             <Text style={styles.notificationDate}>{new Date(item.createdAt).toLocaleString()}</Text>
//           </View>
//         </TouchableOpacity>
//       )}
//       ListEmptyComponent={<Text style={styles.emptyText}>No notifications</Text>}
//     />
//   );

//   const renderContent = useCallback(() => {
//     switch (currentTab) {
//       case 'home':
//         return (
//           <>
//             {user && (
//               <>
//                 <Card
//                   style={[
//                     styles.profileCard,
//                     { backgroundColor: isDarkMode ? '#333' : colors.surface },
//                   ]}
//                 >
//                   <Card.Content style={{ paddingBottom: 12 }}>
//                     <TouchableOpacity
//                       style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, padding: 6 }}
//                     >
//                       <Button
//                         mode="contained"
//                         onPress={() => setIsPasswordModalVisible(true)}
//                         style={styles.button}
//                         buttonColor={colors.primary}
//                         textColor="#FFF"
//                       >
//                         <MaterialIcons name="lock-reset" size={24} />
//                       </Button>
//                     </TouchableOpacity>
//                     <Text
//                       style={[
//                         styles.welcomeText,
//                         { color: isDarkMode ? '#FFD700' : colors.primary },
//                       ]}
//                     >
//                       Welcome back,
//                     </Text>
//                     <Text
//                       style={[styles.nameText, { color: isDarkMode ? '#FFD700' : colors.primary }]}
//                     >
//                       {user.name || 'Unknown'}
//                     </Text>
//                     <Text
//                       style={[styles.mobileText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                     >
//                       Mobile: {user.mobile || 'Unknown'}
//                     </Text>
//                   </Card.Content>
//                   <View style={styles.pointsColumn}>
//                     <Text
//                       style={[
//                         styles.pointsBoxLabel,
//                         { color: isDarkMode ? '#004b89ff' : '#0059b1ff' },
//                       ]}
//                     >
//                       Total Reward Points
//                     </Text>
//                     <Text
//                       style={[
//                         styles.pointsBoxValue,
//                         { color: isDarkMode ? '#00618dff' : '#005db9ff' },
//                       ]}
//                     >
//                       {user.points ?? 0}
//                     </Text>
//                   </View>
//                 </Card>

//                 <Button
//                   mode="contained"
//                   onPress={() => {
//                     setCurrentTab('scan');
//                     setShowScanner(true);
//                   }}
//                   style={{
//                     marginVertical: 20,
//                     borderRadius: 16,
//                     paddingVertical: 20,
//                     paddingHorizontal: 20,
//                     elevation: 6,
//                   }}
//                   buttonColor={colors.primary}
//                   textColor="#FFF"
//                   labelStyle={{
//                     fontSize: 20,
//                     fontWeight: '600',
//                     letterSpacing: 0.8,
//                   }}
//                 >
//                   Scan Barcode
//                 </Button>

//                 {
//                   <View style={styles.sliderContainer}>
//                     {rewards.length > 0 ? (
//                       <Swiper
//                         autoplay={false}
//                         autoplayTimeout={3}
//                         height={350}
//                         showsPagination
//                         loop={false}
//                         removeClippedSubviews={false}
//                         key={rewards.map(r => r._id).join('-')}
//                       >
//                         {rewards.map((reward, index) => (
//                           <View key={reward._id || `reward-${index}`} style={styles.slide}>
//                             <TouchableOpacity
//                               onPress={() => {
//                                 setCurrentTab('rewards');
//                                 const idx = rewards.findIndex(r => r._id === reward._id);
//                                 requestAnimationFrame(() => {
//                                   if (idx >= 0)
//                                     flatListRef.current?.scrollToIndex({
//                                       index: idx,
//                                       animated: true,
//                                     });
//                                 });
//                               }}
//                             >
//                               <Text style={styles.sliderText}>{reward.name}</Text>
//                               {reward.image ? (
//                                 <Image
//                                   source={{ uri: reward.image }}
//                                   style={styles.rewardImage}
//                                   resizeMode="contain"
//                                 />
//                               ) : (
//                                 <View style={styles.imagePlaceholder}>
//                                   <MaterialIcons
//                                     name="image-not-supported"
//                                     size={48}
//                                     color="#9e9e9e"
//                                   />
//                                   <Text style={styles.placeholderText}>No image available</Text>
//                                 </View>
//                               )}
//                             </TouchableOpacity>
//                             <View style={styles.pointsContainer} pointerEvents="none">
//                               <View style={styles.pointRow}>
//                                 <View style={styles.pointBadge}>
//                                   <Text style={styles.pointLabel}>Get Points</Text>
//                                   <Text style={styles.pointValue}>{reward.price}</Text>
//                                 </View>
//                                 <View style={styles.pointBadge}>
//                                   <Text style={styles.pointLabel}>Redeem</Text>
//                                   <Text style={styles.pointValue}>{reward.bundalValue}</Text>
//                                 </View>
//                               </View>
//                               <View style={styles.payoutBadge}>
//                                 <Text style={styles.payoutLabel}>Payout</Text>
//                                 <Text style={styles.payoutValue}>{reward.pointsRequired}</Text>
//                               </View>
//                             </View>
//                           </View>
//                         ))}
//                       </Swiper>
//                     ) : (
//                       <Text style={[styles.emptyText, { textAlign: 'center', marginVertical: 20 }]}>
//                         No rewards available
//                       </Text>
//                     )}
//                   </View>
//                 }
//                 {admin && (
//                   <Card
//                     style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
//                   >
//                     <Card.Content>
//                       <Text
//                         style={[
//                           styles.cardText,
//                           { color: isDarkMode ? '#FFD700' : colors.text, fontWeight: 'bold' },
//                         ]}
//                       >
//                         Assigned Admin: {admin.name || 'Unknown'}
//                       </Text>
//                       <Text
//                         style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                       >
//                         Admin Unique Code: {admin.uniqueCode || 'N/A'}
//                       </Text>
//                     </Card.Content>
//                   </Card>
//                 )}
//               </>
//             )}
//           </>
//         );
//       case 'rewards':
//         return (
//           <View style={styles.rewardsContainer}>
//             <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//               Available Rewards
//             </Text>
//             <FlatList
//               ref={flatListRef}
//               data={rewards}
//               keyExtractor={item => item._id}
//               renderItem={({ item: reward }) => (
//                 <View
//                   style={[styles.rewardItem, { backgroundColor: isDarkMode ? '#333' : '#fff' }]}
//                 >
//                   <Text
//                     style={[styles.rewardName, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                   >
//                     {reward.name}
//                   </Text>
//                   {reward.image ? (
//                     <Image
//                       source={{ uri: reward.image }}
//                       style={styles.rewardImage}
//                       resizeMode="contain"
//                     />
//                   ) : (
//                     <View style={styles.imagePlaceholder}>
//                       <MaterialIcons name="image-not-supported" size={48} color="#9e9e9e" />
//                       <Text style={styles.placeholderText}>No image</Text>
//                     </View>
//                   )}
//                   {/* <Text
//                     style={[styles.rewardDetails, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                   >
//                     Price: {reward.price} | Bundle: {reward.bundalValue} | Points Needed:{' '}
//                     {reward.pointsRequired}
//                   </Text> */}

//                   <View style={styles.pointsContainer} pointerEvents="none">
//                     <View style={styles.pointRow}>
//                       <View style={styles.pointBadge}>
//                         <Text style={styles.pointLabel}>Total Points Get Reward</Text>
//                         <Text style={styles.pointValue}>{reward.price}</Text>
//                       </View>
//                       <View style={styles.pointBadge}>
//                         <Text style={styles.pointLabel}>Redeem points</Text>
//                         <Text style={styles.pointValue}>{reward.bundalValue}</Text>
//                       </View>
//                     </View>
//                     <View style={styles.payoutBadge}>
//                       <Text style={styles.payoutLabel}>₹ Payout</Text>
//                       <Text style={styles.payoutValue}>{reward.pointsRequired}</Text>
//                     </View>
//                   </View>

//                   {/* <Button
//                     mode="contained"
//                     onPress={async () => {
//                       if (user?.points >= reward.pointsRequired) {
//                         try {
//                           const token = await AsyncStorage.getItem('token');
//                           await axios.post(
//                             `${BASE_URL}/redemptions`,
//                             { rewardId: reward._id },
//                             { headers: { Authorization: token } }
//                           );
//                           Toast.show({ type: 'success', text1: `Redeeming ${reward.name}...` });
//                           fetchRedemptions();
//                           fetchUserProfile(user.id);
//                         } catch (err) {
//                           Toast.show({
//                             type: 'error',
//                             text1: 'Redemption failed',
//                             text2: err.response?.data?.message,
//                           });
//                         }
//                       } else {
//                         Toast.show({ type: 'error', text1: 'Insufficient points!' });
//                       }
//                     }}
//                     style={styles.redeemButton}
//                     buttonColor={colors.primary}
//                   >
//                     Redeem with ({reward.pointsRequired} pts)
//                   </Button> */}
//                 </View>
//               )}
//               ListEmptyComponent={
//                 <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//                   No rewards available yet.
//                 </Text>
//               }
//               contentContainerStyle={{ paddingBottom: 80 }}
//             />
//           </View>
//         );
//       case 'scan':
//         return Platform.OS === 'web' ? (
//           <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
//             <Card.Content>
//               <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//                 Barcode scanning is not supported on web browsers. Use the mobile app instead.
//               </Text>
//             </Card.Content>
//           </Card>
//         ) : (
//           <>
//             <Card style={styles.profileCard}>
//               <Card.Content>
//                 <Text style={styles.cardText}>Points: {user?.points}</Text>
//               </Card.Content>
//             </Card>
//             <Button
//               mode="contained"
//               onPress={handleScanAction}
//               style={styles.button}
//               buttonColor={colors.primary}
//               textColor={isDarkMode ? '#FFFFFF' : '#212121'}
//               disabled={showScanner || loading}
//               labelStyle={styles.buttonLabel}
//             >
//               {scanned ? 'Scan Again' : 'Scan Barcode'}
//             </Button>
//             {showScanner && (
//               <View style={styles.scannerContainer}>
//                 <BarCodeScanner
//                   onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
//                   style={styles.camera}
//                   barCodeTypes={[
//                     BarCodeScanner.Constants.BarCodeType.qr,
//                     BarCodeScanner.Constants.BarCodeType.ean13,
//                     BarCodeScanner.Constants.BarCodeType.code128,
//                   ]}
//                   scanInterval={100}
//                   region={scanRegion}
//                 />
//                 <TouchableOpacity
//                   style={styles.scanAreaOverlay}
//                   onPress={handleSelectScanArea}
//                   activeOpacity={0.7}
//                 >
//                   <View style={styles.scanAreaBox} />
//                 </TouchableOpacity>
//                 <Animated.View
//                   style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
//                 >
//                   <View style={styles.scanLineInner} />
//                 </Animated.View>
//                 <Button
//                   mode="contained"
//                   onPress={handleCancelScan}
//                   style={styles.cancelButton}
//                   buttonColor={colors.error}
//                   textColor="#FFFFFF"
//                   labelStyle={styles.buttonLabel}
//                 >
//                   Cancel
//                 </Button>
//               </View>
//             )}
//             {loading && (
//               <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
//             )}
//             {scanned && (
//               <Card
//                 style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
//               >
//                 <Card.Content>
//                   <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//                     Scanned Barcode: {barcodeData || 'N/A'}
//                   </Text>
//                   {error ? (
//                     <Text style={[styles.error, { color: isDarkMode ? '#FF5555' : colors.error }]}>
//                       {error}
//                     </Text>
//                   ) : (
//                     <>
//                       <Text
//                         style={[styles.success, { color: isDarkMode ? '#00FF00' : colors.accent }]}
//                       >
//                         Success! Points added.
//                       </Text>
//                       <Text
//                         style={{
//                           fontSize: 24,
//                           fontWeight: 'bold',
//                           color: isDarkMode ? '#FFFFFF' : '#000000',
//                           marginTop: 8,
//                         }}
//                       >
//                         +{lastAddedPoints || 0} Points
//                       </Text>
//                       <Text
//                         style={{
//                           fontSize: 20,
//                           fontWeight: '600',
//                           color: isDarkMode ? '#FFD700' : colors.primary,
//                           marginTop: 4,
//                         }}
//                       >
//                         Total Points: {user?.points}
//                       </Text>
//                     </>
//                   )}
//                 </Card.Content>
//               </Card>
//             )}
//           </>
//         );
//       case 'barcode':
//         return (
//           <>
//             {fetchError && (
//               <Text style={[styles.error, { color: isDarkMode ? '#FF5555' : colors.error }]}>
//                 {fetchError}
//               </Text>
//             )}
//             <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//               Your Barcodes
//             </Text>
//             <TextInput
//               placeholder="Search Barcodes..."
//               value={searchBarcode}
//               onChangeText={setSearchBarcode}
//               style={[
//                 styles.searchBar,
//                 {
//                   backgroundColor: isDarkMode ? '#444' : '#fff',
//                   color: isDarkMode ? '#FFFFFF' : colors.text,
//                 },
//               ]}
//               placeholderTextColor={isDarkMode ? '#999' : '#666'}
//               autoCapitalize="none"
//               mode="outlined"
//             />
//             <FlatList
//               data={filteredBarcodes}
//               keyExtractor={item => item._id || `barcode-${item.value}`}
//               renderItem={({ item }) => (
//                 <Card
//                   style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
//                 >
//                   <Card.Content>
//                     <Text
//                       style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                     >
//                       Value: {item.value || 'N/A'}
//                     </Text>
//                     <Text
//                       style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                     >
//                       User: {item.userId?.name || 'Unknown'} ({item.userId?.mobile || 'N/A'})
//                     </Text>
//                     <Text
//                       style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                     >
//                       Points Awarded: {item.points ?? 0}
//                     </Text>
//                     <Text
//                       style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                     >
//                       Timestamp:{' '}
//                       {item.scannedAt ? new Date(item.scannedAt).toLocaleString() : 'N/A'}
//                     </Text>
//                     <Text
//                       style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
//                     >
//                       Location: {item.location || 'N/A'}
//                     </Text>
//                   </Card.Content>
//                 </Card>
//               )}
//               ListEmptyComponent={
//                 !loading && (
//                   <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//                     No barcodes scanned yet.
//                   </Text>
//                 )
//               }
//               contentContainerStyle={{ paddingBottom: 80 }}
//               keyboardShouldPersistTaps="handled"
//               initialNumToRender={10}
//               maxToRenderPerBatch={10}
//               windowSize={5}
//             />
//           </>
//         );
//       default:
//         return null;
//     }
//   }, [
//     currentTab,
//     user,
//     admin,
//     barcodes,
//     filteredBarcodes,
//     isDarkMode,
//     colors,
//     showScanner,
//     scanned,
//     barcodeData,
//     error,
//     loading,
//     fetchError,
//     handleScanAction,
//     handleCancelScan,
//     handleSelectScanArea,
//     scanLineTranslate,
//     rewards,
//     notifications,
//     redemptions,
//     fetchRedemptions,
//     fetchNotifications,
//     fetchUserProfile,
//     clearNotification,
//     clearRedemption,
//     handleChangePassword,
//     historyItems,
//   ]);

//   if (hasPermission === false) {
//     return (
//       <Text style={[styles.permissionText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
//         No access to camera
//       </Text>
//     );
//   }

//   return (
//     <View style={[styles.container, { backgroundColor: colors.background }]}>
//       {loading && (
//         <View style={styles.loadingOverlay}>
//           <ActivityIndicator size="large" color={colors.primary} />
//         </View>
//       )}
//       <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
//         {renderContent()}
//       </ScrollView>
//       <View style={[styles.tabBar, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
//         <TouchableOpacity
//           style={[styles.tabItem, currentTab === 'home' && styles.activeTab]}
//           onPress={() => setCurrentTab('home')}
//         >
//           <MaterialIcons
//             name="home"
//             size={24}
//             color={
//               currentTab === 'home'
//                 ? isDarkMode
//                   ? '#FFD700'
//                   : colors.primary
//                 : isDarkMode
//                 ? '#FFF'
//                 : colors.text
//             }
//           />
//           <Text
//             style={[
//               styles.tabText,
//               {
//                 color:
//                   currentTab === 'home'
//                     ? isDarkMode
//                       ? '#FFD700'
//                       : colors.primary
//                     : isDarkMode
//                     ? '#FFF'
//                     : colors.text,
//               },
//             ]}
//           >
//             Home
//           </Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[styles.tabItem, currentTab === 'scan' && styles.activeTab]}
//           onPress={handleScanTabPress}
//         >
//           <MaterialIcons
//             name="qr-code-scanner"
//             size={24}
//             color={
//               currentTab === 'scan'
//                 ? isDarkMode
//                   ? '#FFD700'
//                   : colors.primary
//                 : isDarkMode
//                 ? '#FFF'
//                 : colors.text
//             }
//           />
//           <Text
//             style={[
//               styles.tabText,
//               {
//                 color:
//                   currentTab === 'scan'
//                     ? isDarkMode
//                       ? '#FFD700'
//                       : colors.primary
//                     : isDarkMode
//                     ? '#FFF'
//                     : colors.text,
//               },
//             ]}
//           >
//             Scan
//           </Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[styles.tabItem, currentTab === 'rewards' && styles.activeTab]}
//           onPress={() => setCurrentTab('rewards')}
//         >
//           <MaterialIcons
//             name="card-giftcard"
//             size={24}
//             color={
//               currentTab === 'rewards'
//                 ? isDarkMode
//                   ? '#FFD700'
//                   : colors.primary
//                 : isDarkMode
//                 ? '#FFF'
//                 : colors.text
//             }
//           />
//           <Text
//             style={[
//               styles.tabText,
//               {
//                 color:
//                   currentTab === 'rewards'
//                     ? isDarkMode
//                       ? '#FFD700'
//                       : colors.primary
//                     : isDarkMode
//                     ? '#FFF'
//                     : colors.text,
//               },
//             ]}
//           >
//             Rewards
//           </Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={[styles.tabItem, currentTab === 'barcode' && styles.activeTab]}
//           onPress={() => setCurrentTab('barcode')}
//         >
//           <MaterialIcons
//             name="qr-code"
//             size={24}
//             color={
//               currentTab === 'barcode'
//                 ? isDarkMode
//                   ? '#FFD700'
//                   : colors.primary
//                 : isDarkMode
//                 ? '#FFF'
//                 : colors.text
//             }
//           />
//           <Text
//             style={[
//               styles.tabText,
//               {
//                 color:
//                   currentTab === 'barcode'
//                     ? isDarkMode
//                       ? '#FFD700'
//                       : colors.primary
//                     : isDarkMode
//                     ? '#FFF'
//                     : colors.text,
//               },
//             ]}
//           >
//             Barcodes
//           </Text>
//         </TouchableOpacity>
//       </View>
//       <Modal visible={isPasswordModalVisible} transparent animationType="slide">
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalTitle}>Change Password</Text>
//             <TextInput
//               placeholder="Current Password"
//               value={currentPassword}
//               onChangeText={setCurrentPassword}
//               secureTextEntry
//               style={styles.input}
//             />
//             <TextInput
//               placeholder="New Password"
//               value={newPassword}
//               onChangeText={setNewPassword}
//               secureTextEntry
//               style={styles.input}
//             />
//             <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
//               <Button
//                 mode="contained"
//                 onPress={handleChangePassword}
//                 style={{ flex: 1, marginRight: 10 }}
//               >
//                 Change
//               </Button>
//               <Button
//                 mode="outlined"
//                 onPress={() => {
//                   setCurrentPassword('');
//                   setNewPassword('');
//                   setIsPasswordModalVisible(false);
//                 }}
//                 style={{ flex: 1, marginLeft: 10 }}
//               >
//                 Cancel
//               </Button>
//             </View>
//           </View>
//         </View>
//       </Modal>
//     </View>
//   );
// }

// // Styles (added missing ones for new tabs)
// const styles = StyleSheet.create({
//   modalContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0,0,0,0.5)',
//   },
//   modalContent: {
//     width: '85%',
//     backgroundColor: '#fff',
//     borderRadius: 10,
//     padding: 20,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 4,
//     elevation: 5,
//   },
//   modalTitle: {
//     fontSize: 20,
//     fontWeight: 'bold',
//     marginBottom: 15,
//     textAlign: 'center',
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#ccc',
//     borderRadius: 5,
//     padding: 10,
//     marginBottom: 15,
//   },
//   container: { flex: 1 },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     padding: 2,
//   },
//   toggle: { marginLeft: 10 },
//   logoutButton: {
//     marginBottom: 5,
//     borderRadius: 14,
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     marginVertical: 10,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.3,
//     shadowRadius: 4,
//   },
//   title: {
//     fontSize: 32,
//     fontWeight: 'bold',
//     textAlign: 'center',
//     textShadowColor: '#000',
//     textShadowOffset: { width: 1, height: 1 },
//     textShadowRadius: 3,
//     padding: 16,
//   },
//   subtitle: {
//     fontSize: 22,
//     fontWeight: '600',
//     marginVertical: 20,
//     textAlign: 'center',
//     textShadowColor: '#000',
//     textShadowOffset: { width: 0.5, height: 0.5 },
//     textShadowRadius: 2,
//   },
//   scrollContent: { padding: 16, paddingBottom: 80 },
//   profileCard: {
//     marginVertical: 10,
//     borderRadius: 12,
//     elevation: 8,
//     shadowColor: '#000',
//     shadowOffset: { width: 2, height: 4 },
//     shadowOpacity: 0.4,
//     shadowRadius: 6,
//     transform: [{ perspective: 1000 }, { rotateX: '2deg' }],
//   },
//   card: {
//     marginVertical: 10,
//     borderRadius: 12,
//     elevation: 6,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.3,
//     shadowRadius: 4,
//   },
//   cardText: {
//     fontSize: 16,
//     marginVertical: 4,
//     fontWeight: '500',
//     textShadowColor: '#000',
//     textShadowOffset: { width: 0.5, height: 0.5 },
//     textShadowRadius: 1,
//   },
//   scannerContainer: { position: 'relative', marginTop: -10, marginBottom: 20 },
//   camera: { height: 300, marginVertical: 20, borderRadius: 12, overflow: 'hidden' },
//   scanAreaOverlay: {
//     position: 'absolute',
//     top: 20,
//     left: 0,
//     right: 0,
//     bottom: 20,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   scanAreaBox: {
//     width: 200,
//     height: 200,
//     borderWidth: 2,
//     borderColor: '#FFFFFF',
//     backgroundColor: 'rgba(0, 0, 0, 0.3)',
//   },
//   scanLine: {
//     position: 'absolute',
//     top: 50,
//     left: '10%',
//     width: '80%',
//     height: 2,
//     backgroundColor: 'red',
//   },
//   scanLineInner: { width: '20%', height: 4, backgroundColor: '#FF5555', alignSelf: 'center' },
//   cancelButton: {
//     position: 'absolute',
//     bottom: 20,
//     alignSelf: 'center',
//     borderRadius: 12,
//     paddingVertical: 8,
//     marginVertical: 15,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.3,
//     shadowRadius: 4,
//   },
//   button: {
//     marginVertical: 12,
//     borderRadius: 16,
//     paddingVertical: 10,
//     paddingHorizontal: 10,
//     backgroundColor: '#4C9EEB',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.25,
//     shadowRadius: 6,
//     elevation: 5,
//   },
//   buttonLabel: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#fff',
//     textAlign: 'center',
//     letterSpacing: 0.5,
//   },
//   error: {
//     marginTop: 10,
//     fontSize: 16,
//     textAlign: 'center',
//     fontWeight: '500',
//     textShadowColor: '#000',
//     textShadowOffset: { width: 0.5, height: 0.5 },
//     textShadowRadius: 1,
//   },
//   success: {
//     marginTop: 10,
//     fontSize: 16,
//     textAlign: 'center',
//     fontWeight: '500',
//     textShadowColor: '#000',
//     textShadowOffset: { width: 0.5, height: 0.5 },
//     textShadowRadius: 1,
//   },
//   loading: { marginVertical: 20 },
//   loadingOverlay: {
//     ...StyleSheet.absoluteFillObject,
//     backgroundColor: 'rgba(0, 0, 0, 0.5)',
//     justifyContent: 'center',
//     alignItems: 'center',
//     zIndex: 1000,
//   },
//   emptyText: {
//     textAlign: 'center',
//     fontSize: 16,
//     marginVertical: 10,
//     textShadowColor: '#000',
//     textShadowOffset: { width: 0.5, height: 0.5 },
//     textShadowRadius: 1,
//   },
//   permissionText: {
//     flex: 1,
//     textAlign: 'center',
//     fontSize: 18,
//     textShadowColor: '#000',
//     textShadowOffset: { width: 0.5, height: 0.5 },
//     textShadowRadius: 1,
//   },
//   searchBar: { marginBottom: 16, borderRadius: 25, paddingHorizontal: 10, height: 50 },
//   tabBar: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     paddingVertical: 10,
//     borderTopWidth: 1,
//     borderTopColor: '#ccc',
//     elevation: 8,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: -2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//   },
//   tabItem: { flex: 1, alignItems: 'center', paddingBottom: 8 },
//   activeTab: { borderBottomWidth: 2, borderBottomColor: '#FFD700' },
//   tabText: { fontSize: 12, marginTop: 4 },
//   sliderContainer: {
//     height: 460,
//     marginBottom: 25,
//   },
//   slide: {
//     flex: 1,
//     justifyContent: 'flex-start',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     borderRadius: 20,
//     marginHorizontal: 10,
//     paddingVertical: 16,
//     paddingHorizontal: 16,
//     elevation: 6,
//     shadowColor: '#000',
//     shadowOpacity: 0.15,
//     shadowRadius: 8,
//     shadowOffset: { width: 0, height: 3 },
//     height: 440,
//   },
//   sliderText: {
//     fontSize: 20,
//     fontWeight: '700',
//     color: '#1a1a1a',
//     marginBottom: 12,
//     textAlign: 'center',
//   },
//   sliderImage: {
//     width: '100%',
//     height: 200,
//     borderRadius: 16,
//     marginBottom: 16,
//     backgroundColor: '#f5f5f5',
//   },
//   imagePlaceholder: {
//     width: '100%',
//     height: 200,
//     borderRadius: 16,
//     marginBottom: 16,
//     backgroundColor: '#f5f5f5',
//     alignItems: 'center',
//     justifyContent: 'center',
//     borderWidth: 1,
//     borderColor: '#e0e0e0',
//   },
//   placeholderText: {
//     marginTop: 8,
//     fontSize: 14,
//     color: '#757575',
//     fontWeight: '600',
//   },
//   pointsContainer: {
//     width: '100%',
//     gap: 10,
//   },
//   pointRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     gap: 10,
//     width: '100%',
//   },
//   pointBadge: {
//     flex: 1,
//     backgroundColor: '#f0f7ff',
//     borderRadius: 12,
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#d0e7ff',
//   },
//   pointLabel: {
//     fontSize: 12,
//     fontWeight: '600',
//     color: '#666',
//     marginBottom: 4,
//     textTransform: 'uppercase',
//     letterSpacing: 0.5,
//   },
//   pointValue: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: '#007bff',
//   },
//   payoutBadge: {
//     width: '100%',
//     backgroundColor: '#e8f5e9',
//     borderRadius: 12,
//     paddingVertical: 14,
//     paddingHorizontal: 16,
//     alignItems: 'center',
//     borderWidth: 1,
//     borderColor: '#c8e6c9',
//   },
//   payoutLabel: {
//     fontSize: 12,
//     fontWeight: '600',
//     color: '#666',
//     marginBottom: 4,
//     textTransform: 'uppercase',
//     letterSpacing: 0.5,
//   },
//   payoutValue: {
//     fontSize: 20,
//     fontWeight: '700',
//     color: '#4caf50',
//   },
//   rewardsContainer: {
//     flex: 1,
//     padding: 16,
//   },
//   sectionTitle: {
//     fontSize: 20,
//     fontWeight: 'bold',
//     marginBottom: 12,
//     textAlign: 'center',
//   },
//   rewardItem: {
//     marginVertical: 12,
//     padding: 16,
//     backgroundColor: '#fff',
//     borderRadius: 12,
//     elevation: 4,
//   },
//   rewardImage: {
//     width: '100%',
//     height: 200,
//     borderRadius: 8,
//     marginVertical: 8,
//   },
//   rewardName: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginBottom: 8,
//   },
//   rewardDetails: {
//     fontSize: 14,
//     marginBottom: 12,
//     color: '#666',
//   },
//   redeemButton: {
//     marginTop: 10,
//     borderRadius: 12,
//   },
//   notificationItem: {
//     padding: 15,
//     borderRadius: 10,
//     marginBottom: 10,
//     elevation: 2,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//   },
//   notificationText: { fontSize: 16, flex: 1 },
//   notificationDate: { fontSize: 12, color: '#666' },
//   timelineItem: {
//     flexDirection: 'row',
//     marginVertical: 8,
//     alignItems: 'center',
//   },
//   timelineIcon: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#e0e0e0',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },
//   timelineContent: { flex: 1 },
//   smallText: { fontSize: 12, color: '#666' },
//   pointsBoxContainer: {
//     marginVertical: 16,
//     borderRadius: 20,
//     paddingVertical: 20,
//     paddingHorizontal: 24,
//     elevation: 6,
//     shadowColor: '#000',
//     shadowOpacity: 0.15,
//     shadowRadius: 8,
//     shadowOffset: { width: 0, height: 4 },
//   },
//   pointsRow: {
//     flexDirection: 'column',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 12,
//     height: '50%',
//   },
//   pointsColumn: {
//     flex: 1,
//     paddingHorizontal: 20,
//   },
//   pointsBoxLabel: {
//     fontSize: 13,
//     fontWeight: '700',
//     letterSpacing: 0.8,
//     textTransform: 'uppercase',
//     marginBottom: 8,
//   },
//   pointsBoxValue: {
//     fontSize: 36,
//     fontWeight: '800',
//     lineHeight: 42,
//   },
//   divider: {
//     width: 1,
//     height: '100%',
//     backgroundColor: '#BBDEFB',
//     marginHorizontal: 16,
//     opacity: 0.6,
//   },
//   pointsBoxHint: {
//     fontSize: 14,
//     fontStyle: 'italic',
//     textAlign: 'center',
//     marginTop: 8,
//   },
//   welcomeText: {
//     fontSize: 20,
//     fontWeight: '600',
//     marginBottom: 4,
//   },
//   nameText: {
//     fontSize: 30,
//     fontWeight: 'bold',
//     marginBottom: 6,
//   },
//   mobileText: {
//     fontSize: 18,
//     fontWeight: '500',
//   },
//   welcomeBackText: {
//     fontSize: 26,
//     fontWeight: '800',
//     fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
//     letterSpacing: 0.5,
//     textShadowColor: 'rgba(0, 0, 0, 0.15)',
//     textShadowOffset: { width: 1, height: 1 },
//     textShadowRadius: 3,
//     marginBottom: 8,
//     textAlign: 'left',
//   },
// });

import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { BarCodeScanner } from 'expo-barcode-scanner';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  unstable_batchedUpdates,
  View,
} from 'react-native';
import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';
import Swiper from 'react-native-swiper';
import Toast from 'react-native-toast-message';
import { io as ioClient } from 'socket.io-client';
import { ThemeContext } from '../ThemeContext';
import { BASE_URL } from '../config/baseURL';



export default function UserDashboard({ navigation }) {
  // State Declarations
  const { colors } = useTheme();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [barcodeData, setBarcodeData] = useState(null);
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [searchBarcode, setSearchBarcode] = useState('');
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [currentTab, setCurrentTab] = useState('home');
  const [scanRegion, setScanRegion] = useState(null);
  const scanLineAnim = React.useRef(new Animated.Value(0)).current;
  const [rewards, setRewards] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [showRewardHistory, setShowRewardHistory] = useState(true);
  const [forceRender, setForceRender] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [history, setHistory] = useState([]);
  const [addedPoints, setAddedPoints] = useState(0);
  const [lastAddedPoints, setLastAddedPoints] = useState(0);
  const flatListRef = React.useRef(null);
  const socketRef = React.useRef(null);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [unreadUser, setUnreadUser] = useState(0);
  const [netPointsHistory, setNetPointsHistory] = useState([]);

  const toggleRewardHistory = useCallback(() => {
    setShowRewardHistory(prev => !prev);
  }, []);

  // Navigation Options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      gestureEnabled: false,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* <TouchableOpacity onPress={() => setCurrentTab('history')} style={{ marginRight: 10 }}>
            <MaterialIcons name="notifications" size={24} color={colors.primary} />
            {unreadUser > 0 && (
              <Badge style={{ position: 'absolute', top: -5, right: -5 }}>{unreadUser}</Badge>
            )}
          </TouchableOpacity> */}
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            style={{ transform: [{ scale: 0.8 }], marginRight: 12 }}
            thumbColor={isDarkMode ? '#FFD700' : '#f4f3f4'}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
          />
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#f44336" style={{ marginRight: 14 }} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [unreadUser, navigation, colors, isDarkMode, toggleTheme]);

  // Initialization
  useEffect(() => {
    const initialize = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          if (!parsedUser.id) throw new Error('Invalid user ID');
          setUser(parsedUser);
          await fetchUserProfile(parsedUser.id);
          await fetchUserBarcodes(parsedUser.id);
          await fetchRewards();
          await fetchNotifications();
          await fetchRedemptions();
          if (parsedUser.id) {
            await fetchUserHistory();
          }
        } else {
          throw new Error('No user data found');
        }
      } catch (err) {
        await AsyncStorage.clear();
        navigation.replace('Home');
        Toast.show({
          type: 'error',
          text1: 'Initialization Failed',
          text2: err.message || 'Could not load user data.',
        });
      }
    };
    initialize();
  }, [navigation]);

  // Socket Setup (cleaned up duplicates)
  useEffect(() => {
    if (!user?.id) return;
    let socket;
    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        socket = ioClient(BASE_URL.replace(/^http/, 'ws'), {
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });
        socketRef.current = socket;
        socket.on('connect', () => {
          console.log('✅ Socket connected');
          socket.emit('register', { role: 'user', userId: user.id.toString() });
        });
        socket.on('connect_error', err => console.warn('❌ Socket error:', err.message));
        socket.on('disconnect', reason => console.log('⚠️ Socket disconnected:', reason));
        // Consolidated listeners
        socket.on('user:selfUpdated', data => {
          setUser(prev => ({ ...prev, ...data }));
          Toast.show({ type: 'info', text1: 'Your profile updated' });
          setUnreadUser(prev => prev + 1);
        });
        socket.on('points:updated', data => {
          if (data?.userId?.toString() === user.id.toString()) {
            setUser(prev => ({ ...prev, points: data.points }));
            Toast.show({
              type: 'success',
              text1: 'Points updated',
              text2: `New total: ${data.points}`,
            });
            setUnreadUser(prev => prev + 1);
          }
        });
        socket.on('reward:updated', () => {
          fetchRewards();
          Toast.show({ type: 'info', text1: 'Rewards Updated!' });
          setUnreadUser(prev => prev + 1);
        });
        socket.on('rewardCreated', () => {
          fetchRewards();
          Toast.show({ type: 'success', text1: 'New reward available!' });
          setUnreadUser(prev => prev + 1);
        });
        socket.on('reward:deleted', () => {
          fetchRewards();
          Toast.show({ type: 'info', text1: 'Reward removed' });
          setUnreadUser(prev => prev + 1);
        });
        socket.on('redemption:updated', () => {
          fetchRedemptions();
          fetchNotifications();
          setUnreadUser(prev => prev + 1);
        });
        socket.on('notificationCreated', notif => {
          if (notif.userId === user.id) {
            setNotifications(prev => [notif, ...prev]);
            setUnreadUser(prev => prev + 1);
            Toast.show({ type: 'info', text1: notif.message });
          }
        });
        socket.on('barcode:deleted', data => {
          if (data?.userId?.toString() === user.id.toString()) {
            fetchUserBarcodes(user.id);
            Toast.show({ type: 'warning', text1: 'Barcode deleted' });
            setUnreadUser(prev => prev + 1);
          }
        });
        socket.on('userHistoryUpdated', entry => {
          setHistory(prev => {
            const newHistory = [entry, ...prev].sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
            let cumulative = 0;
            const withNet = newHistory
              .map(item => {
                const change = ['scan', 'point_add'].includes(item.action)
                  ? item.details?.amount || item.details?.points || 0
                  : -(item.details?.amount || 0);
                cumulative += change;
                return { ...item, transactionPoint: change, netPoint: cumulative };
              })
              .reverse();
            setNetPointsHistory(withNet);
            return newHistory;
          });
          Toast.show({ type: 'info', text1: 'History updated' });
          setUnreadUser(prev => prev + 1);
        });
        socket.on('barcodeScanned', data => {
          if (data.userId === user.id) {
            unstable_batchedUpdates(() => {
              setAddedPoints(data.addedPoints || 0);
              setShowPointsAnimation(true);
              setUnreadUser(prev => prev + 1);
            });
            Toast.show({ type: 'success', text1: 'Barcode scanned successfully' });
          }
        });
        socket.on('notification:updated', payload => {
          if (payload?.userId?.toString() === user.id.toString()) {
            fetchNotifications();
            Toast.show({ type: 'info', text1: 'Notification updated' });
            setUnreadUser(prev => prev + 1);
          }
        });
        socket.on('history:updated', payload => {
          if (payload?.userId?.toString() === user.id.toString()) {
            setHistoryItems(prev => [...(payload.items || []), ...prev]);
            Toast.show({ type: 'info', text1: 'New history event' });
            setUnreadUser(prev => prev + 1);
          }
        });
      } catch (err) {
        console.warn('Socket setup error:', err);
      }
    };
    setupSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [
    user,
    fetchRewards,
    fetchNotifications,
    fetchRedemptions,
    fetchUserBarcodes,
    fetchUserHistory,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        const onBackPress = () => {
          navigation.navigate('UserDashboard');
          return true;
        };
        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [navigation])
  );

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('📱 Screen focused - refreshing rewards...');
        fetchRewards();
      }
    }, [user, fetchRewards])
  );

  useFocusEffect(
    useCallback(() => {
      if (currentTab === 'history') {
        fetchUserHistory();
      }
    }, [currentTab])
  );

  useEffect(() => {
    if (!user?.id) return;
    const pollingInterval = setInterval(() => {
      console.log('🔄 Periodic refresh - fetching rewards...');
      fetchRewards();
    }, 10000);
    return () => clearInterval(pollingInterval);
  }, [user, fetchRewards]);

  useEffect(() => {
    if (showScanner) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [showScanner, scanLineAnim]);

  // Simple animation for points (expand and fade)
  useEffect(() => {
    if (showPointsAnimation) {
      // Add your animation logic here, e.g., using Animated
      setTimeout(() => setShowPointsAnimation(false), 1000);
    }
  }, [showPointsAnimation]);

  const scanLineTranslate = useMemo(
    () => scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 180] }),
    [scanLineAnim]
  );

  const handleUnauthorized = useCallback(
    async error => {
      if (error.response?.status === 401 || error.response?.status === 403) {
        await AsyncStorage.clear();
        navigation.replace('Home');
        Toast.show({
          type: 'error',
          text1: error.response?.status === 403 ? 'Account Not Approved' : 'Session Expired',
          text2:
            error.response?.data?.message ||
            (error.response?.status === 403
              ? 'Your account is pending admin approval.'
              : 'Please log in again.'),
        });
        return true;
      }
      return false;
    },
    [navigation]
  );

  const fetchUserProfile = useCallback(
    async userId => {
      if (!userId) return;
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('token');
        if (!token) throw new Error('No token found');
        const response = await axios.get(`${BASE_URL}/users/${userId}`, {
          headers: { Authorization: token },
        });
        if (response.data.status !== 'approved') {
          await AsyncStorage.clear();
          navigation.replace('Home');
          Toast.show({
            type: 'error',
            text1: 'Account Not Approved',
            text2:
              response.data.status === 'pending'
                ? 'Your account is pending admin approval.'
                : 'Your account has been disapproved.',
          });
          return;
        }
        const updatedUser = {
          id: response.data._id,
          name: response.data.name,
          mobile: response.data.mobile,
          points: response.data.points || 0,
          location: response.data.location || 'Unknown',
          status: response.data.status,
          rewardProgress: response.data.rewardProgress || [],
        };
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (error) {
        console.log('Outer catch error:', error);
        if (await handleUnauthorized(error)) return;
        Toast.show({
          type: 'error',
          text1: 'Profile Fetch Failed',
          text2: error.response?.data?.message || error.message || 'Could not load profile.',
        });
      } finally {
        setLoading(false);
      }
    },
    [handleUnauthorized, navigation]
  );

  const fetchUserBarcodes = useCallback(
    async userId => {
      if (!userId) return;
      setLoading(true);
      setFetchError('');
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) throw new Error('No token found');
        const response = await axios.get(`${BASE_URL}/barcodes/user/${userId}`, {
          headers: { Authorization: token },
        });
        const barcodeData = Array.isArray(response.data)
          ? response.data
          : response.data.barcodes || [];
        setBarcodes(barcodeData);
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        const errorMessage = error.response?.data?.message || 'Failed to fetch barcodes';
        setFetchError(errorMessage);
        setBarcodes([]);
        Toast.show({ type: 'error', text1: 'Barcode Fetch Failed', text2: errorMessage });
      } finally {
        setLoading(false);
      }
    },
    [handleUnauthorized]
  );

  const fetchRewards = useCallback(async () => {
    try {
      console.log('🔄 Fetching rewards from API...');
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ No token found for fetching rewards');
        return;
      }
      const response = await axios.get(`${BASE_URL}/rewards`, {
        headers: { Authorization: token },
      });
      if (!response || !response.data) {
        console.warn('⚠️ Invalid response from rewards API');
        setRewards([]);
        return;
      }
      const rewardsData = Array.isArray(response.data) ? response.data : [];
      console.log('✅ Rewards fetched successfully, count:', rewardsData.length);
      setRewards(rewardsData);
    } catch (error) {
      console.error('❌ Error fetching rewards:', error);
      if (error.response) {
        Toast.show({
          type: 'error',
          text1: 'Rewards Fetch Failed',
          text2: error.response?.data?.message || 'Could not load rewards.',
        });
      }
      setRewards([]);
    }
  }, []);

  const fetchUserHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No token found');
      const res = await axios.get(`${BASE_URL}/history/user/${user.id}`, {
        headers: { Authorization: token },
      });
      const historyData = Array.isArray(res.data) ? res.data : [];
      historyData.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      let cumulative = 0;
      const withNet = historyData.map(item => {
        const amount = Number(item.details?.amount ?? item.details?.points ?? item.points ?? 0);
        const isDeposit = item.action === 'scan' || item.action === 'point_add';
        const change = isDeposit ? amount : -Math.abs(amount);
        cumulative += change;
        return { ...item, transactionPoint: change, netPoint: cumulative };
      });
      const lastNet = withNet.length ? withNet[withNet.length - 1].netPoint : 0;
      const userPoints = typeof user?.points === 'number' ? user.points : lastNet;
      const offset = userPoints - lastNet;
      const adjusted =
        offset !== 0 ? withNet.map(it => ({ ...it, netPoint: it.netPoint + offset })) : withNet;
      setNetPointsHistory(adjusted);
    } catch (err) {
      console.error('Error fetching user history:', err);
      // Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load your history' });
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/notifications`, {
        headers: { Authorization: token },
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Toast.show({
        type: 'error',
        text1: 'Notifications Fetch Failed',
        text2: error.response?.data?.message || 'Could not load notifications.',
      });
    }
  }, []);

  const fetchRedemptions = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/redemptions`, {
        headers: { Authorization: token },
      });
      setRedemptions(response.data);
    } catch (error) {
      console.error('Error fetching redemptions:', error);
      Toast.show({
        type: 'error',
        text1: 'Redemptions Fetch Failed',
        text2: error.response?.data?.message || 'Could not load reward history.',
      });
    }
  }, []);

  const clearNotification = useCallback(
    async notificationId => {
      try {
        const token = await AsyncStorage.getItem('token');
        await axios.delete(`${BASE_URL}/notifications/${notificationId}`, {
          headers: { Authorization: token },
        });
        setNotifications(notifications.filter(n => n._id !== notificationId));
        Toast.show({ type: 'success', text1: 'Notification Cleared' });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Clear Failed',
          text2: error.response?.data?.message || 'Could not clear notification.',
        });
      }
    },
    [notifications]
  );

  const clearRedemption = useCallback(
    async redemptionId => {
      try {
        const token = await AsyncStorage.getItem('token');
        await axios.delete(`${BASE_URL}/redemptions/${redemptionId}`, {
          headers: { Authorization: token },
        });
        setRedemptions(redemptions.filter(r => r._id !== redemptionId));
        Toast.show({ type: 'success', text1: 'History Item Cleared' });
      } catch (error) {
        console.error('Error clearing redemption:', error);
        Toast.show({
          type: 'error',
          text1: 'Clear Failed',
          text2: error.response?.data?.message || 'Could not clear history item.',
        });
      }
    },
    [redemptions]
  );

  const memoizedBarcodes = useMemo(() => barcodes, [barcodes]);

  const filteredBarcodes = useMemo(() => {
    if (!Array.isArray(barcodes) || barcodes.length === 0) return [];
    if (!searchBarcode?.trim()) return barcodes;
    const searchLower = searchBarcode.toLowerCase().trim();
    return barcodes.filter(barcode => barcode?.value?.toLowerCase().includes(searchLower));
  }, [barcodes, searchBarcode]);

  const handleBarCodeScanned = useCallback(
    async ({ data }) => {
      setScanned(true);
      setTimeout(() => setShowScanner(false), 100);
      setLoading(true);
      setBarcodeData(data);
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) throw new Error('No token found');
        const response = await axios.post(
          `${BASE_URL}/barcodes`,
          { value: data.toUpperCase(), location: user?.location || 'Unknown' },
          { headers: { Authorization: token } }
        );
        setLastAddedPoints(response.data.pointsAwarded);
        await fetchUserProfile(user?.id);
        await fetchRewards();
        await fetchNotifications();
        await fetchUserBarcodes(user?.id);
        setError('');
        Toast.show({
          type: 'success',
          text1: 'Scan Successful',
          text2: `You earned ${response.data.pointsAwarded} points!`,
          autoHide: true,
          visibilityTime: 4000,
        });
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        const errorMessage =
          error.response?.data?.message === 'Barcode already scanned'
            ? 'Barcode already scanned'
            : error.response?.data?.message || 'Scan failed';
        setError(errorMessage);
        Toast.show({
          type: 'error',
          text1: 'Scan Failed',
          text2: errorMessage,
          autoHide: true,
          visibilityTime: 4000,
        });
      } finally {
        setLoading(false);
        setTimeout(() => setScanned(false), 1500);
      }
    },
    [
      fetchUserProfile,
      fetchUserBarcodes,
      user,
      fetchRewards,
      fetchNotifications,
      handleUnauthorized,
    ]
  );

  const handleScanAction = useCallback(async () => {
    try {
      if (hasPermission === null || hasPermission === false) {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        if (status === 'granted') {
          await AsyncStorage.setItem('cameraPermission', 'granted');
        } else {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Camera access is required to scan barcodes.',
          });
          return;
        }
      }
      if (scanned) {
        setScanned(false);
        setBarcodeData(null);
        setError('');
      }
      setShowScanner(true);
      setScanRegion(null);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Permission Error',
        text2: 'Could not request camera permission.',
      });
    }
  }, [hasPermission, scanned]);

  const handleScanTabPress = useCallback(async () => {
    setCurrentTab('scan');
    if (hasPermission === null) {
      try {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
        if (status === 'granted') {
          await AsyncStorage.setItem('cameraPermission', 'granted');
        } else {
          Toast.show({
            type: 'error',
            text1: 'Permission Denied',
            text2: 'Camera access is required to scan barcodes.',
          });
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: 'Permission Error',
          text2: 'Could not request camera permission.',
        });
      }
    }
  }, [hasPermission]);

  const handleCancelScan = useCallback(() => {
    setShowScanner(false);
    setScanned(false);
    setBarcodeData(null);
    setError('');
    setScanRegion(null);
  }, []);

  const handleChangePassword = async () => {
    if (!user?.id) {
      alert('User not loaded. Please login again.');
      return;
    }
    if (!currentPassword || !newPassword) {
      alert('Please fill both fields');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        alert('Session expired! Please login again.');
        return;
      }
      const res = await axios.put(
        `${BASE_URL}/users/${user.id}/password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data.message || 'Password updated!');
      setCurrentPassword('');
      setNewPassword('');
      setIsPasswordModalVisible(false);
    } catch (err) {
      console.log('❌ Error:', err.response?.data || err);
      alert(err.response?.data?.message || 'Password change failed');
    }
  };

  const handleSelectScanArea = useCallback(() => {
    setScanRegion({ top: 100, left: 50, width: 200, height: 200 });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      navigation.replace('Home');
      Toast.show({
        type: 'success',
        text1: 'Logged Out',
        text2: 'You have been logged out successfully.',
      });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Logout Failed', text2: 'Could not log out.' });
    }
  }, [navigation]);

  const TimelineEvent = ({ item }) => (
    <View style={styles.timelineItem}>
      <View style={styles.timelineIcon}>
        <MaterialIcons
          name={
            item.action === 'scan'
              ? 'qr-code'
              : item.action === 'reward'
              ? 'star'
              : item.action === 'edit'
              ? 'edit'
              : 'history'
          }
          size={22}
        />
      </View>
      <View style={styles.timelineContent}>
        <Text style={[styles.cardText, { fontWeight: 'bold' }]}>{item.action.toUpperCase()}</Text>
        <Text style={styles.smallText}>{item.details ? JSON.stringify(item.details) : ''}</Text>
        <Text style={styles.smallText}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
    </View>
  );


  const NotificationsTab = () => (
    <FlatList
      data={notifications}
      keyExtractor={item => item._id}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={async () => {
            setUnreadUser(prev => prev - 1);
            try {
              const token = await AsyncStorage.getItem('token');
              await axios.put(
                `${BASE_URL}/notifications/${item._id}/read`,
                {},
                { headers: { Authorization: token } }
              );
            } catch (err) {
              console.error('Mark as read error:', err);
            }
            if (item.redirectData?.tab === 'rewards') {
              setCurrentTab('rewards');
              const idx = rewards.findIndex(r => r._id === item.redirectData.focusId);
              requestAnimationFrame(() => {
                if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
              });
            } else {
              setCurrentTab('history');
            }
          }}
        >
          <View style={styles.notificationItem}>
            <Text style={styles.notificationText}>{item.message}</Text>
            <Text style={styles.notificationDate}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No notifications</Text>}
    />
  );

  const renderContent = useCallback(() => {
    switch (currentTab) {
      case 'home':
        return (
          <>
            {user && (
              <>
                <Card
                  style={[
                    styles.profileCard,
                    { backgroundColor: isDarkMode ? '#333' : colors.surface },
                  ]}
                >
                  <Card.Content style={{ paddingBottom: 12 }}>
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, padding: 6 }}
                    >
                      <Button
                        mode="contained"
                        onPress={() => setIsPasswordModalVisible(true)}
                        style={styles.button}
                        buttonColor={colors.primary}
                        textColor="#FFF"
                      >
                        <MaterialIcons name="lock-reset" size={24} />
                      </Button>
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.welcomeText,
                        { color: isDarkMode ? '#FFD700' : colors.primary },
                      ]}
                    >
                      Welcome back,
                    </Text>
                    <Text
                      style={[styles.nameText, { color: isDarkMode ? '#FFD700' : colors.primary }]}
                    >
                      {user.name || 'Unknown'}
                    </Text>
                    <Text
                      style={[styles.mobileText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Mobile: {user.mobile || 'Unknown'}
                    </Text>
                  </Card.Content>
                  <View style={styles.pointsColumn}>
                    <Text
                      style={[
                        styles.pointsBoxLabel,
                        { color: isDarkMode ? '#004b89ff' : '#0059b1ff' },
                      ]}
                    >
                      Total Reward Points
                    </Text>
                    <Text
                      style={[
                        styles.pointsBoxValue,
                        { color: isDarkMode ? '#00618dff' : '#005db9ff' },
                      ]}
                    >
                      {user.points ?? 0}
                    </Text>
                  </View>
                </Card>

                <View style={styles.sliderContainer}>
                  {rewards.length > 0 ? (
                    <Swiper
                      autoplay={false}
                      autoplayTimeout={3}
                      height={440}
                      showsPagination
                      loop={false}
                      removeClippedSubviews={false}
                      key={rewards.map(r => r._id).join('-')}
                    >
                      {rewards.map((reward, index) => (
                        <View key={reward._id || `reward-${index}`} style={styles.slide}>
                          <TouchableOpacity
                            // FIXED: Add flex:1 and align to ensure full space usage and centering
                            style={{ flex: 1, alignItems: 'center', width: '100%' }}
                            onPress={() => {
                              setCurrentTab('rewards');
                              const idx = rewards.findIndex(r => r._id === reward._id);
                              requestAnimationFrame(() => {
                                if (idx >= 0)
                                  flatListRef.current?.scrollToIndex({
                                    index: idx,
                                    animated: true,
                                  });
                              });
                            }}
                          >
                            <Text style={styles.sliderText}>{reward.name}</Text>
                            {reward.image ? (
                              <Image
                                source={{ uri: reward.image }}
                                style={styles.rewardImage}
                                resizeMode="contain"
                                onError={e =>
                                  console.log(
                                    '❌ Home Image error:',
                                    e.nativeEvent.error,
                                    reward.image
                                  )
                                }
                              />
                            ) : (
                              <View style={styles.imagePlaceholder}>
                                <MaterialIcons
                                  name="image-not-supported"
                                  size={48}
                                  color="#9e9e9e"
                                />
                                <Text style={styles.placeholderText}>No image available</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          <View style={styles.pointsContainer} pointerEvents="none">
                            <View style={styles.pointRow}>
                              <View style={styles.pointBadge}>
                                <Text style={styles.pointLabel}>Get Points</Text>
                                <Text style={styles.pointValue}>{reward.price}</Text>
                              </View>
                              <View style={styles.pointBadge}>
                                <Text style={styles.pointLabel}>Redeem</Text>
                                <Text style={styles.pointValue}>{reward.bundalValue}</Text>
                              </View>
                            </View>
                            <View style={styles.payoutBadge}>
                              <Text style={styles.payoutLabel}>Payout</Text>
                              <Text style={styles.payoutValue}>{reward.pointsRequired}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </Swiper>
                  ) : (
                    <Text style={[styles.emptyText, { textAlign: 'center', marginVertical: 20 }]}>
                      No rewards available
                    </Text>
                  )}
                </View>

                {admin && (
                  <Card
                    style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
                  >
                    <Card.Content>
                      <Text
                        style={[
                          styles.cardText,
                          { color: isDarkMode ? '#FFD700' : colors.text, fontWeight: 'bold' },
                        ]}
                      >
                        Assigned Admin: {admin.name || 'Unknown'}
                      </Text>
                      <Text
                        style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                      >
                        Admin Unique Code: {admin.uniqueCode || 'N/A'}
                      </Text>
                    </Card.Content>
                  </Card>
                )}
                <Button
                  mode="contained"
                  onPress={() => {
                    setCurrentTab('scan');
                    setShowScanner(true);
                  }}
                  style={{
                    marginVertical: 20,
                    borderRadius: 16,
                    paddingVertical: 20,
                    paddingHorizontal: 20,
                    elevation: 6,
                  }}
                  buttonColor={colors.primary}
                  textColor="#FFF"
                  labelStyle={{
                    fontSize: 20,
                    fontWeight: '600',
                    letterSpacing: 0.8,
                  }}
                >
                  Scan Barcode
                </Button>
              </>
            )}
          </>
        );

      case 'scan':
        return Platform.OS === 'web' ? (
          <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
            <Card.Content>
              <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                Barcode scanning is not supported on web browsers. Use the mobile app instead.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Card style={styles.profileCard}>
              <Card.Content>
                <Text style={styles.cardText}>Points: {user?.points}</Text>
              </Card.Content>
            </Card>
            <Button
              mode="contained"
              onPress={handleScanAction}
              style={styles.button}
              buttonColor={colors.primary}
              textColor={isDarkMode ? '#FFFFFF' : '#212121'}
              disabled={showScanner || loading}
              labelStyle={styles.buttonLabel}
            >
              {scanned ? 'Scan Again' : 'Scan Barcode'}
            </Button>
            {showScanner && (
              <View style={styles.scannerContainer}>
                <BarCodeScanner
                  onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                  style={styles.camera}
                  barCodeTypes={[
                    BarCodeScanner.Constants.BarCodeType.qr,
                    BarCodeScanner.Constants.BarCodeType.ean13,
                    BarCodeScanner.Constants.BarCodeType.code128,
                  ]}
                  scanInterval={100}
                  region={scanRegion}
                />
                <TouchableOpacity
                  style={styles.scanAreaOverlay}
                  onPress={handleSelectScanArea}
                  activeOpacity={0.7}
                >
                  <View style={styles.scanAreaBox} />
                </TouchableOpacity>
                <Animated.View
                  style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
                >
                  <View style={styles.scanLineInner} />
                </Animated.View>
                <Button
                  mode="contained"
                  onPress={handleCancelScan}
                  style={styles.cancelButton}
                  buttonColor={colors.error}
                  textColor="#FFFFFF"
                  labelStyle={styles.buttonLabel}
                >
                  Cancel
                </Button>
              </View>
            )}
            {loading && (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
            )}
            {scanned && (
              <Card
                style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
              >
                <Card.Content>
                  <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                    Scanned Barcode: {barcodeData || 'N/A'}
                  </Text>
                  {error ? (
                    <Text style={[styles.error, { color: isDarkMode ? '#FF5555' : colors.error }]}>
                      {error}
                    </Text>
                  ) : (
                    <>
                      <Text
                        style={[styles.success, { color: isDarkMode ? '#00FF00' : colors.accent }]}
                      >
                        Success! Points added.
                      </Text>
                      <Text
                        style={{
                          fontSize: 24,
                          fontWeight: 'bold',
                          color: isDarkMode ? '#FFFFFF' : '#000000',
                          marginTop: 8,
                        }}
                      >
                        +{lastAddedPoints || 0} Points
                      </Text>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: '600',
                          color: isDarkMode ? '#FFD700' : colors.primary,
                          marginTop: 4,
                        }}
                      >
                        Total Points: {user?.points}
                      </Text>
                    </>
                  )}
                </Card.Content>
              </Card>
            )}
          </>
        );
      case 'barcode':
        return (
          <>
            {fetchError && (
              <Text style={[styles.error, { color: isDarkMode ? '#FF5555' : colors.error }]}>
                {fetchError}
              </Text>
            )}
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
              Your Barcodes
            </Text>
            <TextInput
              placeholder="Search Barcodes..."
              value={searchBarcode}
              onChangeText={setSearchBarcode}
              style={[
                styles.searchBar,
                {
                  backgroundColor: isDarkMode ? '#444' : '#fff',
                  color: isDarkMode ? '#FFFFFF' : colors.text,
                },
              ]}
              placeholderTextColor={isDarkMode ? '#999' : '#666'}
              autoCapitalize="none"
              mode="outlined"
            />
            <FlatList
              data={filteredBarcodes}
              keyExtractor={item => item._id || `barcode-${item.value}`}
              renderItem={({ item }) => (
                <Card
                  style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
                >
                  <Card.Content>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Value: {item.value || 'N/A'}
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      User: {item.userId?.name || 'Unknown'} ({item.userId?.mobile || 'N/A'})
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Points Awarded: {item.points ?? 0}
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Timestamp:{' '}
                      {item.scannedAt ? new Date(item.scannedAt).toLocaleString() : 'N/A'}
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Location: {item.location || 'N/A'}
                    </Text>
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={
                !loading && (
                  <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                    No barcodes scanned yet.
                  </Text>
                )
              }
              contentContainerStyle={{ paddingBottom: 80 }}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          </>
        );
      default:
        return null;
    }
  }, [
    currentTab,
    user,
    admin,
    barcodes,
    filteredBarcodes,
    isDarkMode,
    colors,
    showScanner,
    scanned,
    barcodeData,
    error,
    loading,
    fetchError,
    handleScanAction,
    handleCancelScan,
    handleSelectScanArea,
    scanLineTranslate,
    rewards,
    notifications,
    redemptions,
    fetchRedemptions,
    fetchNotifications,
    fetchUserProfile,
    clearNotification,
    clearRedemption,
    handleChangePassword,
    historyItems,
  ]);

  if (hasPermission === false) {
    return (
      <Text style={[styles.permissionText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
        No access to camera
      </Text>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {renderContent()}
      </ScrollView>
      <View style={[styles.tabBar, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'home' && styles.activeTab]}
          onPress={() => setCurrentTab('home')}
        >
          <MaterialIcons
            name="home"
            size={24}
            color={
              currentTab === 'home'
                ? isDarkMode
                  ? '#FFD700'
                  : colors.primary
                : isDarkMode
                ? '#FFF'
                : colors.text
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  currentTab === 'home'
                    ? isDarkMode
                      ? '#FFD700'
                      : colors.primary
                    : isDarkMode
                    ? '#FFF'
                    : colors.text,
              },
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'scan' && styles.activeTab]}
          onPress={handleScanTabPress}
        >
          <MaterialIcons
            name="qr-code-scanner"
            size={24}
            color={
              currentTab === 'scan'
                ? isDarkMode
                  ? '#FFD700'
                  : colors.primary
                : isDarkMode
                ? '#FFF'
                : colors.text
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  currentTab === 'scan'
                    ? isDarkMode
                      ? '#FFD700'
                      : colors.primary
                    : isDarkMode
                    ? '#FFF'
                    : colors.text,
              },
            ]}
          >
            Scan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'barcode' && styles.activeTab]}
          onPress={() => setCurrentTab('barcode')}
        >
          <MaterialIcons
            name="qr-code"
            size={24}
            color={
              currentTab === 'barcode'
                ? isDarkMode
                  ? '#FFD700'
                  : colors.primary
                : isDarkMode
                ? '#FFF'
                : colors.text
            }
          />
          <Text
            style={[
              styles.tabText,
              {
                color:
                  currentTab === 'barcode'
                    ? isDarkMode
                      ? '#FFD700'
                      : colors.primary
                    : isDarkMode
                    ? '#FFF'
                    : colors.text,
              },
            ]}
          >
            Barcodes
          </Text>
        </TouchableOpacity>
      </View>
      <Modal visible={isPasswordModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <TextInput
              placeholder="Current Password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              placeholder="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
              <Button
                mode="contained"
                onPress={handleChangePassword}
                style={{ flex: 1, marginRight: 10 }}
              >
                Change
              </Button>
              <Button
                mode="outlined"
                onPress={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setIsPasswordModalVisible(false);
                }}
                style={{ flex: 1, marginLeft: 10 }}
              >
                Cancel
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Styles (added missing ones for new tabs)
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 2,
  },
  toggle: { marginLeft: 10 },
  logoutButton: {
    marginBottom: 5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    padding: 16,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '600',
    marginVertical: 20,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  scrollContent: { padding: 16, paddingBottom: 80 },
  profileCard: {
    marginVertical: 10,
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    transform: [{ perspective: 1000 }, { rotateX: '2deg' }],
  },
  card: {
    marginVertical: 10,
    borderRadius: 12,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  cardText: {
    fontSize: 16,
    marginVertical: 4,
    fontWeight: '500',
    textShadowColor: '#000',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  scannerContainer: { position: 'relative', marginTop: -10, marginBottom: 20 },
  camera: { height: 300, marginVertical: 20, borderRadius: 12, overflow: 'hidden' },
  scanAreaOverlay: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanAreaBox: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  scanLine: {
    position: 'absolute',
    top: 50,
    left: '10%',
    width: '80%',
    height: 2,
    backgroundColor: 'red',
  },
  scanLineInner: { width: '20%', height: 4, backgroundColor: '#FF5555', alignSelf: 'center' },
  cancelButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    borderRadius: 12,
    paddingVertical: 8,
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  button: {
    marginVertical: 12,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#4C9EEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  error: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: '#000',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  success: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: '#000',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  loading: { marginVertical: 20 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 10,
    textShadowColor: '#000',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  permissionText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    textShadowColor: '#000',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  searchBar: { marginBottom: 16, borderRadius: 25, paddingHorizontal: 10, height: 50 },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingBottom: 8 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  tabText: { fontSize: 12, marginTop: 4 },
  sliderContainer: {
    height: 480,
    marginBottom: 5,
  },
  slide: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    height: 480,
  },
  sliderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  sliderImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#757575',
    fontWeight: '600',
  },
  pointsContainer: {
    width: '100%',
    gap: 10,
  },
  pointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
  },
  pointBadge: {
    flex: 1,
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0e7ff',
  },
  pointLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pointValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007bff',
  },
  payoutBadge: {
    width: '100%',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  payoutLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payoutValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4caf50',
  },
  rewardsContainer: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  rewardItem: {
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 4,
  },
  rewardImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginVertical: 8,
  },
  rewardName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rewardDetails: {
    fontSize: 14,
    marginBottom: 12,
    color: '#666',
  },
  redeemButton: {
    marginTop: 10,
    borderRadius: 12,
  },
  notificationItem: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationText: { fontSize: 16, flex: 1 },
  notificationDate: { fontSize: 12, color: '#666' },
  timelineItem: {
    flexDirection: 'row',
    marginVertical: 8,
    alignItems: 'center',
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  timelineContent: { flex: 1 },
  smallText: { fontSize: 12, color: '#666' },
  pointsBoxContainer: {
    marginVertical: 16,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  pointsRow: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    height: '50%',
  },
  pointsColumn: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pointsBoxLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pointsBoxValue: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
  },
  divider: {
    width: 1,
    height: '100%',
    backgroundColor: '#BBDEFB',
    marginHorizontal: 16,
    opacity: 0.6,
  },
  pointsBoxHint: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  mobileText: {
    fontSize: 18,
    fontWeight: '500',
  },
  welcomeBackText: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8,
    textAlign: 'left',
  },
});
