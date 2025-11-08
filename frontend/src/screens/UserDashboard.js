import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  unstable_batchedUpdates,
  View,
  Modal,
} from 'react-native';
import { Button, Card, Text, TextInput, useTheme } from 'react-native-paper';
import Swiper from 'react-native-swiper';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Badge } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { io as ioClient } from 'socket.io-client';
import { ThemeContext } from '../ThemeContext';
import { API_BASE_URL } from '../config/baseURL';
import HistoryComponent from '../components/HistoryComponent';
const BASE_URL = API_BASE_URL;

const getRewardImageSource = image => {
  if (!image || typeof image !== 'string') return null;

  const trimmed = image.trim();
  if (!trimmed) return null;

  if (/^data:image\/[a-zA-Z]+;base64,/.test(trimmed)) {
    return { uri: trimmed };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { uri: trimmed };
  }

  const normalizedPath = trimmed.replace(/\\/g, '/');
  if (/^\/?uploads\//i.test(normalizedPath) || normalizedPath.startsWith('/')) {
    const normalized = normalizedPath.replace(/^\//, '');
    return { uri: `${BASE_URL.replace(/\/$/, '')}/${normalized}` };
  }

  let mime = 'jpeg';
  if (/^(iVBORw0KGgo|IVBORw0KGgo)/.test(trimmed)) {
    mime = 'png';
  } else if (/^(R0lGODdh|R0lGODlh)/.test(trimmed)) {
    mime = 'gif';
  } else if (/^PHN2Zy/.test(trimmed)) {
    mime = 'svg+xml';
  } else if (/^Qk/.test(trimmed)) {
    mime = 'bmp';
  } else if (/^(UklGR|UkZGR)/.test(trimmed)) {
    mime = 'webp';
  } else if (/^AAABAA/.test(trimmed)) {
    mime = 'x-icon';
  }

  return { uri: `data:image/${mime};base64,${trimmed}` };
};
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
  const [lastAddedPoints, setLastAddedPoints] = useState(0); //added recent
  const flatListRef = React.useRef(null);
  const socketRef = React.useRef(null); // Store socket instance for cleanup
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');


  // NEW - history & scan-animation state
  const [historyItems, setHistoryItems] = useState([]);

  const [unreadUser, setUnreadUser] = useState(0);
  const [netPointsHistory, setNetPointsHistory] = useState([]);

  const toggleRewardHistory = useCallback(() => {
    // Single state update (forceRender hata diya)
    setShowRewardHistory(prev => !prev);
  }, []);

  // Navigation Options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      gestureEnabled: false,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Notification Bell */}
          <TouchableOpacity onPress={() => setCurrentTab('history')} style={{ marginRight: 10 }}>
            <MaterialIcons name="notifications" size={24} color={colors.primary} />
            {unreadUser > 0 && (
              <Badge style={{ position: 'absolute', top: -5, right: -5 }}>{unreadUser}</Badge>
            )}
          </TouchableOpacity>

          {/* Dark Mode Toggle */}
          <Switch
            value={isDarkMode}
            onValueChange={() => {
              // console.log("🖱️ Header switch clicked");
              toggleTheme(); // ✅ correct function from ThemeContext
            }}
            style={{ transform: [{ scale: 0.8 }], marginRight: 10 }}
            thumbColor={isDarkMode ? '#FFD700' : '#f4f3f4'}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
          />
          {/* Logout Button */}
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="#f44336" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [unreadUser, navigation, colors, isDarkMode]);

  // ✅ Initialization (fetch profile + setup socket at top-level)
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

          const fetchHistory = async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const res = await axios.get(`${BASE_URL}/history/user/${user.id}`, {
                headers: { Authorization: token },
              });
              // Sort ascending (oldest first) for correct cumulative computation
              const sortedHistory = res.data.sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
              );
              let cumulative = 0;
              const withNet = sortedHistory.map(item => {
                const change = ['scan', 'point_add'].includes(item.action)
                  ? item.details?.amount || item.details?.points || 0
                  : -(item.details?.amount || 0);
                cumulative += change;
                return { ...item, transactionPoint: change, netPoint: cumulative };
              });
              // Reverse for display (newest first, but nets correct)
              const displayHistory = withNet.reverse();
              setHistory(displayHistory);
              setNetPointsHistory(displayHistory);
            } catch (err) {
              console.error('Fetch history error:', err);
            }
          };
          if (!user || !user.id) {
            console.warn('User not loaded yet, skipping fetchHistory');
            return;
          }
          await fetchHistory();
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

  // ✅ Real-time Socket.IO Setup (moved outside initialize)
  useEffect(() => {
    if (!user?.id) return;
    let socket;

    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        // Socket.IO client needs HTTP URL, not WebSocket URL
        // It handles WebSocket connection internally
        socket = ioClient(BASE_URL, {
          transports: ['websocket', 'polling'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });
        
        // Store socket reference for cleanup
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('✅ Socket connected successfully');
          // Register only after connection is established
          socket.emit('register', { role: 'user', userId: user.id.toString() });
        });
        
        socket.on('connect_error', err => {
          console.warn('❌ Socket connection error:', err.message);
        });
        socket.on('disconnect', (reason) => {
          console.log('⚠️ Socket disconnected:', reason);
        });
        
        // Register immediately if already connected, or wait for connect event
        if (socket.connected) {
          socket.emit('register', { role: 'user', userId: user.id.toString() });
        }

        // Events
        socket.on('user:selfUpdated', data => {
          setUser(prev => ({ ...prev, ...data }));
          // CHANGE: Added toast and unread count for user feedback
          Toast.show({ type: 'info', text1: 'Your profile updated' });
          setUnreadUser(prev => prev + 1); // Trigger bell notification
        });

        socket.on('points:updated', data => {
          if (data?.userId?.toString() === user.id.toString()) {
            setUser(prev => ({ ...prev, points: data.points }));
            // CHANGE: Added toast and unread count for points update
            Toast.show({
              type: 'success',
              text1: 'Points updated',
              text2: `New total: ${data.points}`,
            });
            setUnreadUser(prev => prev + 1);
          }
        });

        // ✅ Listen for real-time range updates
        socket.on('range:updated', payload => {
          Toast.show({ type: 'info', text1: 'Barcode Ranges Updated!' });
          // Note: Range updates don't affect user dashboard directly
          // If needed, can refresh barcodes here: fetchUserBarcodes(user.id);
        });

        // ✅ Listen for real-time reward updates
        socket.on('reward:updated', payload => {
          try {
            console.log('🎉 Received reward:updated event:', payload);
            console.log('🔄 Calling fetchRewards to refresh rewards list immediately...');
            // Fetch immediately without delay
            if (fetchRewards) {
              fetchRewards();
            } else {
              console.warn('⚠️ fetchRewards function not available yet');
            }
            Toast.show({ type: 'info', text1: 'Rewards Updated!' });
            setUnreadUser(prev => prev + 1);
          } catch (err) {
            console.error('❌ Error handling reward:updated event:', err);
          }
        });

        // ✅ Also listen for reward created event
        socket.on('rewardCreated', payload => {
          try {
            console.log('🎉 Received rewardCreated event:', payload);
            console.log('🔄 Refreshing rewards list...');
            if (fetchRewards) {
              fetchRewards();
            } else {
              console.warn('⚠️ fetchRewards function not available yet');
            }
            Toast.show({ type: 'success', text1: 'New reward available!' });
            setUnreadUser(prev => prev + 1);
          } catch (err) {
            console.error('❌ Error handling rewardCreated event:', err);
          }
        });

        // ✅ Listen for reward deleted event
        socket.on('reward:deleted', payload => {
          try {
            console.log('🗑️ Received reward:deleted event:', payload);
            if (fetchRewards) {
              fetchRewards();
            } else {
              console.warn('⚠️ fetchRewards function not available yet');
            }
            Toast.show({ type: 'info', text1: 'Reward removed' });
            setUnreadUser(prev => prev + 1);
          } catch (err) {
            console.error('❌ Error handling reward:deleted event:', err);
          }
        });

        // ✅ Listen for real-time redemption updates
        socket.on('redemption:updated', payload => {
          fetchRedemptions(); // Refetch redemption requests
          fetchNotifications(); // Also refresh notifications
        });

        socket.on('notificationCreated', notif => {
          if (notif.userId === user.id) {
            setNotifications(prev => [notif, ...prev]);
            setUnreadUser(prev + 1);
            Toast.show({ type: 'info', text1: notif.message });
          }
        });


        // Inside your socket useEffect
socket.on('rewardCreated', (reward) => {
  fetchRewards(); // REFRESH FROM API
  Toast.show({ type: 'success', text1: 'New reward available!' });
  setUnreadUser(p => p + 1);
});

        const Notifications = ({ navigation }) => {
          return (
            <FlatList
              data={notifications}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setUnreadUser(prev => prev - 1);
                    axios.put(`${BASE_URL}/notifications/${item._id}/read`);
                    if (item.redirectData.tab === 'rewards') {
                      setCurrentTab('rewards');
                      const idx = rewards.findIndex(r => r._id === item.redirectData.focusId);
                      requestAnimationFrame(() => {
                        if (idx >= 0)
                          flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                      });
                    } else {
                      // CHANGE: Redirect non-reward notifications to history tab
                      setCurrentTab('history'); // Redirect to history tab for general notifications
                    }
                    navigation.goBack();
                  }}
                >
                  <Text>{item.message}</Text>
                </TouchableOpacity>
              )}
            />
          );
        };

        // socket.on('barcode:updated', (data) => {
        //   if (data?.userId?.toString() === user.id.toString()) {
        //     fetchUserBarcodes(user.id);
        //     if (typeof data?.pointsAwarded === 'number') {
        //       setAddedPoints(data.pointsAwarded);
        //       setShowPointsAnimation(true);
        //     }
        //     // CHANGE: Added toast and unread count for barcode update
        //     Toast.show({ type: 'info', text1: 'Barcode updated' });
        //     setUnreadUser((prev) => prev + 1);
        //   }
        // });

        socket.on('barcode:deleted', data => {
          if (data?.userId?.toString() === user.id.toString()) {
            fetchUserBarcodes(user.id);
            // CHANGE: Added toast and unread count for barcode deletion
            Toast.show({ type: 'warning', text1: 'Barcode deleted' });
            setUnreadUser(prev => prev + 1);
          }
        });

        socket.on('redemption:updated', data => {
          if (data?.userId?.toString() === user.id.toString()) {
            fetchRedemptions();
            // CHANGE: Added toast and unread count for redemption update
            Toast.show({ type: 'info', text1: 'Redemption status updated', text2: data.status });
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
        socket.on('rewardCreated', reward => {
          setRewards(prev => [...prev, reward]);
          // CHANGE: Added toast and unread count for new reward
          Toast.show({ type: 'success', text1: 'New reward available' });
          setUnreadUser(prev => prev + 1);
        });
        socket.on('notificationCreated', notif => {
          if (notif.userId === user.id) {
            setNotifications(prev => [notif, ...prev]);
            setUnreadUser(prev => prev + 1);
            Toast.show({ type: 'info', text1: notif.message });
          }
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
            // CHANGE: Added toast and unread count for notification update
            Toast.show({ type: 'info', text1: 'Notification updated' });
            setUnreadUser(prev => prev + 1);
          }
        });
        socket.on('history:updated', payload => {
          try {
            if (payload?.userId?.toString() === user.id.toString()) {
              // prepend new history items
              setHistoryItems(prev => [...(payload.items || []), ...prev]);
              // CHANGE: Added toast and unread count for history update
              Toast.show({ type: 'info', text1: 'New history event' });
              setUnreadUser(prev => prev + 1);
            }
          } catch (err) {
            console.warn('history:update listener error', err);
          }
        });

        // Removed duplicate reward:updated listener - already handled above
      } catch (err) {
        console.warn('Socket error (user):', err);
      }
    };

    setupSocket();

    return () => {
      // Clean up socket connection
      if (socketRef.current) {
        socketRef.current.off('reward:updated'); // Remove all reward:updated listeners
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, fetchRewards]); // Added fetchRewards to dependencies

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

  // ✅ Refresh rewards when screen comes into focus (as fallback if socket fails)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('📱 Screen focused - refreshing rewards...');
        fetchRewards();
      }
    }, [user, fetchRewards])
  );
  // ✅ fetch history when "history" tab is active
  useFocusEffect(
    useCallback(() => {
      if (currentTab === 'history') {
        fetchUserHistory(); // 👈 make sure this function is defined for user's own data
      }
    }, [currentTab])
  );

  // ✅ Periodic polling fallback to refresh rewards every 10 seconds (if socket fails)
  useEffect(() => {
    if (!user?.id) return;
    
    const pollingInterval = setInterval(() => {
      console.log('🔄 Periodic refresh - fetching rewards...');
      fetchRewards();
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(pollingInterval);
  }, [user, fetchRewards]);

  useEffect(() => {
    if (showScanner) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [showScanner]);

  // NEW - star animation when points are added
  // useEffect(() => {
  //   if (showStar) {
  //     Animated.sequence([
  //       Animated.timing(starAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
  //       Animated.timing(starAnim, { toValue: 1.2, duration: 300, useNativeDriver: true }),
  //       Animated.timing(starAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
  //     ]).start(() => {
  //       setTimeout(() => setShowStar(false), 800);
  //     });
  //   } else {
  //     starAnim.setValue(0);
  //   }
  // }, [showStar]);

  const scanLineTranslate = useMemo(
    () =>
      scanLineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 180],
      }),
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

        // Token fetch
        const token = await AsyncStorage.getItem('token');
        if (!token) throw new Error('No token found');

        // User fetch
        const response = await axios.get(`${BASE_URL}/users/${userId}`, {
          headers: { Authorization: token },
        });

        // Check approval status
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

        // Build updated user object (⚡ adminId removed)
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

        // ✅ Admin fetch block removed (no adminId usage)
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
        Toast.show({
          type: 'error',
          text1: 'Barcode Fetch Failed',
          text2: errorMessage,
        });
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
      
      // Validate response data
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
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Only show toast for non-network errors or if response exists
      if (error.response) {
        Toast.show({
          type: 'error',
          text1: 'Rewards Fetch Failed',
          text2: error.response?.data?.message || 'Could not load rewards.',
        });
      } else if (error.message && !error.message.includes('Network')) {
        // Don't spam toast for network errors (they're usually temporary)
        console.warn('Network error - will retry automatically');
      }
      
      // Set empty array to prevent showing stale data
      setRewards([]);
    }
  }, []);

  // NEW - fetch user history (timeline)
  const fetchUserHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No token found');

      const res = await axios.get(`${BASE_URL}/history/user/${user.id}`, {
        headers: { Authorization: token }, // keep same style you use elsewhere
      });

      const history = Array.isArray(res.data) ? res.data : [];

      // 1) Sort oldest -> newest (compute running total in chronological order)
      history.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // 2) Compute transactionPoint and running net (oldest -> newest)
      let cumulative = 0;
      const withNet = history.map(item => {
        const amount = Number(item.details?.amount ?? item.details?.points ?? item.points ?? 0);
        const isDeposit = item.action === 'scan' || item.action === 'point_add';
        const change = isDeposit ? amount : -Math.abs(amount);
        cumulative += change;
        return {
          ...item,
          transactionPoint: change,
          netPoint: cumulative,
        };
      });

      // 3) Align final netPoint to current user.points (if available) so net matches user's current balance
      const lastNet = withNet.length ? withNet[withNet.length - 1].netPoint : 0;
      const userPoints = typeof user?.points === 'number' ? user.points : lastNet;
      const offset = userPoints - lastNet;
      const adjusted =
        offset !== 0 ? withNet.map(it => ({ ...it, netPoint: it.netPoint + offset })) : withNet;

      // 4) Save ascending (oldest -> newest). Your UI reverses for newest-first presentation.
      setNetPointsHistory(adjusted);
    } catch (err) {
      console.error('Error fetching user history:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load your history',
      });
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
      // ✅ Use a short delay before hiding the scanner to prevent the UI from crashing (white screen bug).
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

        // ✅ Fetch all necessary data *after* the scan is confirmed.
        await fetchUserProfile(user?.id);
        await fetchRewards();
        await fetchNotifications();
        await fetchUserBarcodes(user?.id);
        setError(''); // Clear any previous errors.

        Toast.show({
          type: 'success',
          text1: 'Scan Successful',
          text2: `You earned ${response.data.pointsAwarded} points!`,
          autoHide: true, // ✅ FIX: Ensures the toast disappears automatically.
          visibilityTime: 4000, // ✅ FIX: Sets the duration to 4 seconds.
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
          autoHide: true, // ✅ FIX: Ensures the toast disappears automatically.
          visibilityTime: 4000, // ✅ FIX: Sets the duration to 4 seconds.
        });
      } finally {
        setLoading(false);
        // ✅ Reset the scanned state after a delay so the user can scan another barcode.
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
      alert("User not loaded. Please login again.");
      return;
    }

    if (!currentPassword || !newPassword) {
      alert("Please fill both fields");
      return;
    }

    try {
      // 🔑 Fetch token from AsyncStorage
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        alert("Session expired! Please login again.");
        return;
      }

      const res = await axios.put(
        `${BASE_URL}/users/${user.id}/password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } } // token from AsyncStorage
      );

      alert(res.data.message || "Password updated!");

      setCurrentPassword('');
      setNewPassword('');
      setIsPasswordModalVisible(false);

    } catch (err) {
      console.log("❌ Error:", err.response?.data || err);
      alert(err.response?.data?.message || "Password change failed");
    }
  };

  const handleSelectScanArea = useCallback(() => {
    setScanRegion({
      top: 100,
      left: 50,
      width: 200,
      height: 200,
    });
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
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Could not log out.',
      });
    }
  }, [navigation]);

  // NEW - Timeline item component (for History tab)
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

  // NEW - History Tab wrapper (used in switch-case)
  const HistoryTab = () => (
    <View>
      <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
        History
      </Text>
      <FlatList
        data={historyItems}
        keyExtractor={(it, idx) => it._id || `${it.action}-${idx}`}
        renderItem={({ item }) => <TimelineEvent item={item} />}
        ListEmptyComponent={() =>
          !loading ? (
            <Text style={[styles.cardText, { color: isDarkMode ? '#FFF' : colors.text }]}>
              No history yet.
            </Text>
          ) : null
        }
      />
    </View>
  );
  // Render Functions
  const renderContent = useCallback(() => {
    switch (currentTab) {






























     // === ONLY REPLACE THIS PART IN renderContent() → case 'home' ===

case 'home':
  return (
    <>
      {user && (
        <>
          {/* === BOX 1: Welcome + Mobile + Change Password Button === */}
          <Card
            style={[
              styles.profileCard,
              { backgroundColor: isDarkMode ? '#333' : colors.surface },
            ]}
          >
            <Card.Content style={{ paddingBottom: 12 }}>
              {/* Bell Icon (kept as-is) */}
              <TouchableOpacity
                onPress={() => {
                  // Optional: Add bell action if needed
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 10,
                  padding: 6,
                }}
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

              {/* Welcome & Mobile */}
              <Text
                style={[
                  styles.welcomeText,
                  { color: isDarkMode ? '#FFD700' : colors.primary },
                ]}
              >
                Welcome back,
              </Text>
              <Text
                style={[
                  styles.nameText,
                  { color: isDarkMode ? '#FFD700' : colors.primary },
                ]}
              >
                {user.name || 'Unknown'}
              </Text>
              <Text
                style={[
                  styles.mobileText,
                  { color: isDarkMode ? '#FFFFFF' : colors.text },
                ]}
              >
                Mobile: {user.mobile || 'Unknown'}
              </Text>
            </Card.Content>
          </Card>

          {/* === BOX 2: Total Points + Total Items Purchased === */}
          <Card
            style={[
              styles.pointsBoxContainer,
              { backgroundColor: isDarkMode ? '#2A2A2A' : '#E3F2FD' },
            ]}
          >
            <View style={styles.pointsRow}>
              {/* Total Points */}
              <View style={styles.pointsColumn}>
                <Text
                  style={[
                    styles.pointsBoxLabel,
                    { color: isDarkMode ? '#64B5F6' : '#1976D2' },
                  ]}
                >
                  Total Reward Points
                </Text>
                <Text
                  style={[
                    styles.pointsBoxValue,
                    { color: isDarkMode ? '#81D4FA' : '#1976D2' },
                  ]}
                >
                  {user.points ?? 0}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Total Items Purchased */}
              <View style={styles.pointsColumn}>
                <Text
                  style={[
                    styles.pointsBoxLabel,
                    { color: isDarkMode ? '#A5D6A7' : '#2E7D32' },
                  ]}
                >
                  Total Items Purchased
                </Text>
                <Text
                  style={[
                    styles.pointsBoxValue,
                    { color: isDarkMode ? '#81C784' : '#2E7D32' },
                  ]}
                >
                  {barcodes.length}
                </Text>
              </View>
            </View>

            <Text
              style={[
                styles.pointsBoxHint,
                { color: isDarkMode ? '#90CAF9' : '#42A5F5' },
              ]}
            >
              Keep scanning to earn more
            </Text>
          </Card>

          {/* Scan Button */}
          <Button
            mode="contained"
            onPress={() => {
              setCurrentTab('scan');
              setShowScanner(true);
            }}
            style={styles.button}
            buttonColor={colors.primary}
            textColor="#FFF"
            labelStyle={styles.buttonLabel}
          >
            Scan Barcode
          </Button>

          {/* Rewards Slider */}
          <View style={styles.sliderContainer}>
            {rewards.length > 0 && (
              <Swiper autoplay autoplayTimeout={3} height={350} showsPagination loop>
                {rewards.map((reward, index) => {
                  const imageSource = getRewardImageSource(reward.image);
                  return (
                    <View key={reward._id || `reward-${index}`} style={styles.slide}>
                    <TouchableOpacity
                      onPress={() => {
                        setCurrentTab('rewards');
                        const idx = rewards.findIndex(r => r._id === reward._id);
                        requestAnimationFrame(() => {
                          if (idx >= 0)
                            flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                        });
                      }}
                    >
                      <Text style={styles.sliderText}>{reward.name}</Text>
                      {imageSource ? (
                        <Image source={imageSource} style={styles.sliderImage} />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <MaterialIcons name="image-not-supported" size={48} color="#9e9e9e" />
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
                  );
                })}
                </Swiper>
              )}
            </View>

            {/* Admin Card (if exists) */}
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
                        ✅ Success! Points added.
                      </Text>
                      {/* 🔥 New Added Points & Total Points */}
                      <Text
                        style={{
                          fontSize: 24, // Big font
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
                        🎯 Total Points: {user?.points}
                      </Text>
                    </>
                  )}
                </Card.Content>
              </Card>
            )}
          </>
        );

      // case 'history':
      //   return (
      //     <HistoryComponent
      //       netPointsHistory={netPointsHistory}
      //       isDarkMode={isDarkMode}
      //       colors={colors}
      //     />
      //   );

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
                  key={item._id}
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
              ListEmptyComponent={() =>
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
    handleChangePassword
  ]);

  // Component Body
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
      {/* <View style={styles.header}>
        <ThemeToggle style={styles.toggle} />
        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor={colors.error}
          textColor="#FFFFFF"
          labelStyle={styles.buttonLabel}
        >
          Logout
        </Button>
      </View> */}
      {/* <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
        User Dashboard
      </Text> */}
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
        {/* <TouchableOpacity
          style={[styles.tabItem, currentTab === 'history' && styles.activeTab]}
          onPress={() => setCurrentTab('history')}
        >
          <MaterialIcons
            name="history"
            size={24}
            color={
              currentTab === 'history'
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
                  currentTab === 'history'
                    ? isDarkMode
                      ? '#FFD700'
                      : colors.primary
                    : isDarkMode
                    ? '#FFF'
                    : colors.text,
              },
            ]}
          >
            History
          </Text>
        </TouchableOpacity> */}
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
        {/* <TouchableOpacity
          style={[styles.tabItem, currentTab === 'rewards' && styles.activeTab]}
          onPress={() => setCurrentTab('rewards')}
        >
          <MaterialIcons
            name="card-giftcard"
            size={24}
            color={
              currentTab === 'rewards'
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
                  currentTab === 'rewards'
                    ? isDarkMode
                      ? '#FFD700'
                      : colors.primary
                    : isDarkMode
                    ? '#FFF'
                    : colors.text,
              },
            ]}
          >
            Rewards
          </Text>
        </TouchableOpacity> */}

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

              {/* ✅ Buttons */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>

                {/* Change Password */}
                <Button
                  mode="contained"
                  onPress={handleChangePassword}
                  style={{ flex: 1, marginRight: 10 }}
                >
                  Change
                </Button>

                {/* Cancel Button */}
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
    </View>
  );
} // End of UserDashboard function

// Styles
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center', // vertically center
    alignItems: 'center', // horizontally center
    backgroundColor: 'rgba(0,0,0,0.5)', // semi-transparent background
  },
  modalContent: {
    width: '85%', // modal width
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000', // shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5, // shadow for Android
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
  // scrollContent: { padding: 12, paddingBottom: 100, flexGrow: 1 },
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
    marginVertical: 9,
    borderRadius: 12,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonLabel: {
    fontSize: 14,
    textAlign: 'center',
    adjustsFontSizeToFit: true,
    minimumFontScale: 0.7,
    paddingHorizontal: 5,
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
    height: 460,
    marginBottom: 25,
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
    height: 440,
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
    resizeMode: 'cover',
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
    padding: 20,
    backgroundColor: '#f9f9f9',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    color: '#222',
  },

  rewardItem: {
    marginVertical: 12,
    borderRadius: 12,
    elevation: 6,
    backgroundColor: '#fff',
    padding: 10,
  },

  rewardImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginVertical: 10,
    borderRadius: 8,
  },
  payoutText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f3f3f3', // soft highlight (optional)
    borderRadius: 8,
    alignSelf: 'center',
  },

  rewardName: { fontSize: 18, fontWeight: 'bold' },
  rewardDetails: { fontSize: 14, marginBottom: 10 },
  // progressBar: { height: 10, borderRadius: 5, marginBottom: 5 }, remove
  progressBar: { height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50' },

  progressText: { fontSize: 12 },
  redeemButton: { marginTop: 10, borderRadius: 12 },
  notificationContent: { flex: 1 },
  notificationItem: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  read: { opacity: 0.7 },
  unread: { elevation: 4 },
  notificationText: { fontSize: 16 },
  notificationDate: { fontSize: 12 },
  historyItem: { marginVertical: 10, borderRadius: 12, elevation: 6 },
  historyImage: { width: 80, height: 80, borderRadius: 10, marginBottom: 10 },
  historyName: { fontSize: 16, fontWeight: 'bold' },
  // historyDetails: { fontSize: 14 },
  // rewardAchieved: { color: '#2196F3', fontWeight: 'bold', textAlign: 'center', marginTop: 5 },
  remainingPoints: { color: '#FF9800', textAlign: 'center', marginTop: 5 },

  historyContainer: { padding: 10 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },

  rewardAchieved: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 8,
  },
  remainingPoints: {
    fontSize: 14,
    color: '#FF5722',
    marginTop: 6,
  },
  redeemButton: {
    marginTop: 10,
    borderRadius: 6,
  },

  rewardHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  clearButton: { marginTop: 5 },
  starContainer: {
    position: 'absolute',
    zIndex: 10,
    backgroundColor: 'green',
    borderRadius: 50,
    padding: 20,
    alignItems: 'center',
  },
  starText: { position: 'absolute', top: 40, color: 'white', fontSize: 24 },
    // === STYLISH POINTS BOX (matches your image) ===
  pointsBoxContainer: {
    marginTop: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBDEFB',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pointsBoxLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  pointsBoxValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1976D2',
    lineHeight: 56,
  },
  pointsBoxHint: {
    fontSize: 14,
    color: '#42A5F5',
    marginTop: 4,
    fontStyle: 'italic',
  },
    // === NEW STYLES FOR BOXES ===
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  mobileText: {
    fontSize: 16,
    fontWeight: '500',
  },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pointsColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pointsBoxLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
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
