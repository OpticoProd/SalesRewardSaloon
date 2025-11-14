import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Button, Card, TextInput, useTheme } from 'react-native-paper';
import Swiper from 'react-native-swiper';
import Toast from 'react-native-toast-message';
import { ThemeContext } from '../ThemeContext';
// import * as ImagePicker from 'react-native-image-picker';
import * as ImagePicker from 'expo-image-picker';
import { io as ioClient } from 'socket.io-client';
import HistoryComponent from '../components/HistoryComponent';
import TopUsers from '../components/TopUsers';
import { BASE_URL } from '../config/baseURL';


const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

// Reusable ButtonText component
const ButtonText = ({ children, style }) => (
  <Text
    adjustsFontSizeToFit
    numberOfLines={2}
    minimumFontScale={0.7}
    style={[
      {
        textAlign: 'center',
        paddingHorizontal: 2,
        fontSize: 14,
        lineHeight: 16,
        flexWrap: 'wrap',
        flexShrink: 1,
        width: '100%',
        overflow: 'hidden',
      },
      style,
    ]}
  >
    {children}
  </Text>
);

export default function AdminDashboard({ navigation }) {
  const { colors } = useTheme();
  // const { isDarkMode } = useContext(ThemeContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [unreadAdmin, setUnreadAdmin] = useState(0);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      gestureEnabled: false,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Notification Bell */}
          <TouchableOpacity onPress={() => setCurrentTab('history')} style={{ marginRight: 10 }}>
            <MaterialIcons
              name="notifications"
              size={24}
              color={isDarkMode ? '#FFD700' : colors.primary}
            />
            {unreadAdmin > 0 && (
              <Badge style={{ position: 'absolute', top: -5, right: -5 }}>{unreadAdmin}</Badge>
            )}
          </TouchableOpacity>

          {/* Dark Mode Toggle */}
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
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
  }, [navigation, unreadAdmin, isDarkMode, colors.primary]); // new
  const [users, setUsers] = useState([]);
  const [barcodes, setBarcodes] = useState([]);
  const [adminHistory, setAdminHistory] = useState([]);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptMessage, setPromptMessage] = useState('');
  const [promptCallback, setPromptCallback] = useState(null);
  const [promptInput, setPromptInput] = useState('');
  const { width: screenWidth } = Dimensions.get('window');
  const [barcodeRanges, setBarcodeRanges] = useState([]);
  const [searchUser, setSearchUser] = useState('');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [searchUniqueCode, setSearchUniqueCode] = useState('');
  const [shouldScrollToUser, setShouldScrollToUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userBarcodes, setUserBarcodes] = useState([]);
  const [selectedBarcodeUser, setSelectedBarcodeUser] = useState(null);
  const [selectedBarcodeId, setSelectedBarcodeId] = useState(null);
  const [currentTab, setCurrentTab] = useState('home');
  const [adminUser, setAdminUser] = useState(null);
  const [searchUniqueCodeResult, setSearchUniqueCodeResult] = useState(null);
  const [searchUniqueCodeLoading, setSearchUniqueCodeLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(null);
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [barcodeSettings, setBarcodeSettings] = useState({
    startBarcode: '',
    endBarcode: '',
    pointsPerScan: '10',
  });
  const [editRange, setEditRange] = useState(null);
  const [showHistory, setShowHistory] = useState(null);
  const [generateRandomSuffix, setGenerateRandomSuffix] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  // stopee here working things like history user stuck on every

  // ✅ Added state for pagination management.
  const [currentPage, setCurrentPage] = useState(1);
  const ENTRIES_PER_PAGE = 10;
  const MAX_VISIBLE_PAGES = 4;

  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingRewardId, setDeletingRewardId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const userListRef = useRef(null);
  const showHistoryRef = useRef(null);
  const fetchUserHistoryRef = useRef(null);
  const fetchAdminHistoryRef = useRef(null);
  const historyRef = useRef();
  const [oldPassword, setOldPassword] = useState('');
  const [newPasswords, setNewPasswords] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [pwTargetUserId, setPwTargetUserId] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          setLoggedInUser(JSON.parse(stored));
        }
      } catch (err) {
        console.log('Failed to load logged in user', err);
      }
    };

    loadUser();
  }, []);

  // Example: jab nayi transaction add ho
  const handleNewTransaction = newItem => {
    historyRef.current?.addNewHistoryItem(newItem);
  };

  const fetchAdminHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.warn('No token found for fetching admin history');
        return;
      }
      const response = await axios.get(`${BASE_URL}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAdminHistory(response.data);
    } catch (err) {
      console.warn('Error fetching admin history:', err);
      // Toast.show({ type: 'error', text1: 'Failed to fetch history' });
    }
  };

  const [newReward, setNewReward] = useState({
    name: '',
    price: '',
    bundalValue: '',
    pointsRequired: '',
    image: null,
  });

  const showConfirmDialog = useCallback(
    (title, message, onConfirm, onCancel) => {
      if (isWeb) {
        if (window.confirm(`${title}\n${message}`)) onConfirm();
        else onCancel?.();
      } else {
        Alert.alert(title, message, [
          { text: 'Cancel', style: 'cancel', onPress: onCancel },
          {
            text: title.includes('Delete') ? 'Delete' : 'Confirm',
            style: 'destructive',
            onPress: onConfirm,
          },
        ]);
      }
    },
    [isWeb]
  );

  const filteredUsers = useMemo(() => {
    return users.filter(
      user =>
        (user.name || '').toLowerCase().includes(searchUser.toLowerCase()) ||
        (user.mobile || '').toLowerCase().includes(searchUser.toLowerCase())
    );
  }, [users, searchUser]);

  const handleUnauthorized = useCallback(
    async error => {
      if (error.response?.status === 401) {
        await AsyncStorage.clear();
        navigation.replace('Home');
        Toast.show({ type: 'error', text1: 'Session Expired' });
        return true;
      }
      return false;
    },
    [navigation]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No token found');
      const [usersRes, barcodesRes, rangesRes] = await Promise.all([
        axios.get(`${BASE_URL}/users`, { headers: { Authorization: token } }),
        axios.get(`${BASE_URL}/barcodes`, { headers: { Authorization: token } }),
        axios.get(`${BASE_URL}/barcode-ranges`, { headers: { Authorization: token } }),
      ]);
      const validUsers = usersRes.data.filter(
        user => user.name && user.mobile && user.role === 'user'
      );
      const sortedUsers = validUsers.sort((a, b) => {
        // Rule 1: 'pending' users always come first.
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;

        // Rule 2: For users with the same status ('approved' or 'disapproved'), sort by points descending.
        if (a.status === b.status) {
          return (b.points || 0) - (a.points || 0);
        }

        // Rule 3: If statuses are different and neither is 'pending', sort 'approved' before 'disapproved'.
        if (a.status === 'approved' && b.status === 'disapproved') return -1;
        if (b.status === 'approved' && a.status === 'disapproved') return 1;

        return 0; // Default case
      });
      setUsers(sortedUsers);
      setBarcodes(barcodesRes.data);
      setBarcodeRanges(rangesRes.data);
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      Toast.show({ type: 'error', text1: 'Fetch Failed', text2: error.message });
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);

  const promptAmount = async message => {
    return new Promise(resolve => {
      setPromptMessage(message);
      setPromptCallback(() => resolve); // ✅ Set callback for OK/Cancel
      setShowPromptModal(true);
    });
  };

  // New: Handle modal submit
  const handlePromptSubmit = () => {
    const amount = parseInt(promptInput) || null;
    promptCallback(amount);
    setShowPromptModal(false);
    setPromptInput('');
  };

  const handlePromptCancel = () => {
    promptCallback(null);
    setShowPromptModal(false);
    setPromptInput('');
  };

  const fetchRewards = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/rewards`, {
        headers: { Authorization: token },
      });
      setRewards(response.data);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      Toast.show({ type: 'error', text1: 'Fetch Rewards Failed' });
    }
  }, []);

  const fetchUserHistory = useCallback(
    async userId => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) throw new Error('No token found');

        // ✅ Fetch user details if not in memory
        let user = users.find(u => u._id?.toString() === userId.toString());
        if (!user) {
          const userRes = await axios.get(`${BASE_URL}/users/${userId}`, {
            headers: { Authorization: token },
          });
          user = userRes.data;
        }

        // ✅ Fetch history from backend
        const res = await axios.get(`${BASE_URL}/history/user/${userId}`, {
          headers: { Authorization: token },
        });

        // ✅ Sort newest first for display
        const history = (res.data || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        // ✅ Walk backwards from user.points (truth)
        let running = user.points || 0;
        const withNet = history.map(item => {
          const amount = item.details?.amount || item.details?.points || item.points || 0;
          let change = 0;

          if (item.action === 'scan' || item.action === 'point_add') {
            change = amount; // deposit
          } else if (
            item.action === 'point_redeem' ||
            item.action === 'redemption' ||
            item.action === 'cash_reward'
          ) {
            change = -Math.abs(amount); // withdrawal
          }

          const record = {
            ...item,
            transactionPoint: change,
            netPoint: running, // ✅ snapshot of current balance
          };

          running -= change; // walk backwards
          return record;
        });

        setShowHistory({
          _id: userId, // This was already correctly added
          name: user.name,
          mobile: user.mobile,
          totalPoints: user.points, // ✅ always truth from DB
          history: withNet, // ✅ now netPoint matches user tab
        });

        if (!withNet.length) {
          Toast.show({ type: 'info', text1: 'No History' });
        }
      } catch (err) {
        const errorMessage =
          err.response?.status === 404 ? 'User history not found' : 'Failed to load history';
        Toast.show({ type: 'error', text1: 'Error', text2: errorMessage });
        console.error('Error fetching user history:', err);
      }
    },
    [users]
  );

  const handleChangePasswords = async () => {
    if (!oldPassword || !newPasswords) {
      alert('Please enter both old and new passwords');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        alert('No token found. Please log in again.');
        return;
      }

      const url = `${BASE_URL}/admins/${adminUser.id}/password`;
      console.log('🔹 API URL:', url);

      const bodyData = {
        oldPassword,
        newPassword: newPasswords,
      };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Password updated successfully');
        alert('Password updated successfully!');
        setOldPassword('');
        setNewPasswords('');
        setShowPasswordModal(false);
      } else {
        console.log('❌ Failed to update password:', data.message);
        alert(data.message || 'Failed to update password');
      }
    } catch (error) {
      console.error('🚨 Error changing password:', error);
      alert('Something went wrong while changing password');
    }
  };

  // ✅ New handler function to manage opening and closing the history view.
  const handleHistoryToggle = useCallback(
    userId => {
      if (showHistory && showHistory._id === userId) {
        setShowHistory(null);
      } else {
        fetchUserHistory(userId);
        setCurrentPage(1); // ✅ Reset to the first page when opening history.
      }
    },
    [showHistory, fetchUserHistory]
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      const response = await axios.get(`${BASE_URL}/notifications`, {
        headers: { Authorization: token },
      });

      // ✅ SORT by date descending (newest first)
      const sortedNotifications = response.data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setNotifications(sortedNotifications);
    } catch (error) {
      console.error('❌ Error fetching notifications:', error?.response?.data || error.message);
      Toast.show({ type: 'error', text1: 'Fetch Notifications Failed' });
    }
  }, []);

  useEffect(() => {
    try {
      const unread = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;
      setUnreadAdmin(unread);
    } catch (e) {
      setUnreadAdmin(0);
    }
  }, [notifications]); // new

  const fetchRedemptions = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/redemptions`, {
        headers: { Authorization: token },
      });
      setRedemptions(response.data);
    } catch (error) {
      console.error('Error fetching redemptions:', error);
      Toast.show({ type: 'error', text1: 'Fetch Redemptions Failed' });
    }
  }, []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);

  useEffect(() => {
    const refreshToken = async () => {
      try {
        const credentials = await AsyncStorage.getItem('credentials');
        if (!credentials) return;
        const { mobile, password } = JSON.parse(credentials);
        const response = await axios.post(`${BASE_URL}/login`, { mobile, password });
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
        Toast.show({ type: 'success', text1: 'Session Refreshed' });
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Session Refresh Failed' });
        await AsyncStorage.clear();
        navigation.replace('Home');
      }
    };
    const interval = setInterval(refreshToken, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [navigation]);

  useEffect(() => {
    const fetchAdminUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) setAdminUser(JSON.parse(storedUser));
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Admin Data Fetch Failed' });
      }
    };
    fetchAdminUser();
    fetchData();
    fetchRewards();
    fetchNotifications();
    fetchRedemptions();
  }, [fetchData, fetchRewards, fetchNotifications, fetchRedemptions]);

  // ✅ Added useEffect to scroll to selected user (Lines 345-357)
  useEffect(() => {
    if (shouldScrollToUser && selectedUser && userListRef.current) {
      const index = filteredUsers.findIndex(user => user._id === selectedUser._id);
      if (index !== -1) {
        userListRef.current.scrollToIndex({ index, animated: true });
      }
      setShouldScrollToUser(false); // Reset after scrolling
    }
  }, [shouldScrollToUser, selectedUser, filteredUsers]);

  // ---------------- Socket.IO (real-time sync for admin) ----------------
  useEffect(() => {
    let socket = null;
    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const socketUrl = BASE_URL.replace(/^http/, 'ws');
        socket = ioClient(socketUrl, {
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });
        socket.on('connect_error', err => {
          console.warn('Socket connection error:', err.message);
        });
        socket.on('disconnect', () => {
          console.log('Socket disconnected, will attempt reconnect…');
        });

        const stored = await AsyncStorage.getItem('user');
        const parsed = stored ? JSON.parse(stored) : null;
        const adminId = parsed?._id || parsed?.id;
        if (adminId) {
          socket.emit('register', { role: 'admin', userId: adminId.toString() });
        }

        socket.on('user:updated', data => {
          setUsers(prev => prev.map(u => (u.id === data.id ? { ...u, ...data } : u)));
          // CHANGE: Added toast and unread count for user update
          Toast.show({ type: 'info', text1: 'User updated' });
          setUnreadAdmin(prev => prev + 1);
        });

        socket.on('user:pendingApproval', payload => {
          Toast.show({ type: 'info', text1: 'New User Pending', text2: `Approve ${payload.name}` });
          setUnreadAdmin(prev => prev + 1); // ✅ Increment bell count
          fetchNotifications(); // ✅ Refresh notifications list
          fetchData(); // ✅ Refresh users list to show pending
        });

        // ✅ Listen for real-time range updates
        socket.on('range:updated', payload => {
          Toast.show({ type: 'info', text1: 'Barcode Ranges Updated!' });
          fetchData(); // Refetch data to get the latest ranges
        });

        // ✅ Listen for real-time reward updates
        socket.on('reward:updated', payload => {
          Toast.show({ type: 'info', text1: 'Rewards Updated!' });
          fetchRewards(); // Refetch rewards
        });

        // ✅ Listen for real-time redemption updates
        socket.on('redemption:updated', payload => {
          fetchRedemptions(); // Refetch redemption requests
          fetchNotifications(); // Also refresh notifications
        });

        socket.on('user:deleted', data => {
          setUsers(prev => prev.filter(u => u.id !== data.id));
          // CHANGE: Added toast and unread count for user deletion
          Toast.show({ type: 'warning', text1: 'User deleted' });
          setUnreadAdmin(prev => prev + 1);
        });
        socket.on('barcode:updated', data => {
          setBarcodes(prev => prev.map(b => (b.id === data.id ? { ...b, ...data } : b)));
          // CHANGE: Added toast and unread count for barcode update
          Toast.show({ type: 'info', text1: 'Barcode updated' });
          setUnreadAdmin(prev => prev + 1);
        });
        socket.on('barcode:deleted', data => {
          setBarcodes(prev => prev.filter(b => b.id !== data.id));
          // CHANGE: Added toast and unread count for barcode deletion
          Toast.show({ type: 'warning', text1: 'Barcode deleted' });
          setUnreadAdmin(prev => prev + 1);
        });
        socket.on('reward:updated', data => {
          setRewards(prev => prev.map(r => (r.id === data.id ? { ...r, ...data } : r)));
          // CHANGE: Added toast and unread count for reward update
          Toast.show({ type: 'info', text1: 'Reward updated' });
          setUnreadAdmin(prev => prev + 1);
        });

        socket.on('redemption:updated', data => {
          setRedemptions(prev => prev.map(rd => (rd.id === data.id ? { ...rd, ...data } : rd)));
          // CHANGE: Added toast and unread count for redemption update
          Toast.show({ type: 'info', text1: 'Redemption updated' });
          setUnreadAdmin(prev => prev + 1);
        });
        socket.on('notification:updated', data => {
          setNotifications(prev => [data, ...prev]);
          // CHANGE: Added toast and unread count for notification update
          Toast.show({ type: 'info', text1: 'New notification' });
          setUnreadAdmin(prev => prev + 1);
        });
        socket.on('metrics:updated', () => {
          fetchData();
          fetchRewards();
          fetchRedemptions();
          fetchNotifications();
          // CHANGE: Added toast and unread count for metrics update
          Toast.show({ type: 'info', text1: 'Metrics updated' });
          setUnreadAdmin(prev => prev + 1);
        });

        // CHANGE: Added history listener with notification
        socket.on('history:updated', data => {
          Toast.show({ type: 'info', text1: 'New history event' });
          setUnreadAdmin(prev => prev + 1);

          // Call the function via the ref.
          fetchAdminHistoryRef.current();

          // Check against the state via the ref.
          if (showHistoryRef.current && data.userId && showHistoryRef.current._id === data.userId) {
            fetchUserHistoryRef.current(data.userId);
          }
        });

        socket.on('barcodeRangeCreated', data => {
          setNotifications(prev => [
            {
              _id: data._id || `barcodeRange-${Date.now()}`,
              message: `New barcode range created: ${data.start} to ${data.end}`,
              createdAt: new Date(),
              read: false,
            },
            ...prev,
          ]);
          Toast.show({
            type: 'info',
            text1: 'New Barcode Range',
            text2: `Range created: ${data.start} to ${data.end}`,
          });
          setUnreadAdmin(prev => prev + 1);
          fetchData(); // This will refresh the ranges list
        });

        // This listener for general updates will also catch the new range
        socket.on('range:updated', payload => {
          Toast.show({ type: 'info', text1: 'Barcode Ranges Updated!' });
          fetchData(); // Refetch data to get the latest ranges
        });
      } catch (err) {
        console.warn('Socket error (admin):', err);
      }
    };
    setupSocket();

    return () => {
      try {
        if (socket) socket.disconnect();
      } catch (e) {}
    };
  }, [fetchData, fetchRewards, fetchRedemptions, fetchNotifications, fetchAdminHistory, fetchData]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.navigate('AdminDashboard');
        return true;
      };
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [navigation])
  );

  useEffect(() => {
    showHistoryRef.current = showHistory;
    fetchUserHistoryRef.current = fetchUserHistory;
    fetchAdminHistoryRef.current = fetchAdminHistory;
  }, [showHistory, fetchUserHistory, fetchAdminHistory]);

  const searchByUniqueCode = useCallback(async () => {
    if (!searchUniqueCode) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a unique code' });
      return;
    }
    setSearchUniqueCodeLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No token found');
      const response = await axios.get(`${BASE_URL}/users/search?uniqueCode=${searchUniqueCode}`, {
        headers: { Authorization: token },
      });
      setSearchUniqueCodeResult(response.data);
      Toast.show({ type: 'success', text1: 'Success', text2: 'User found' });
    } catch (error) {
      setSearchUniqueCodeResult(null);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'User not found',
      });
    } finally {
      setSearchUniqueCodeLoading(false);
    }
  }, [searchUniqueCode]);

  const handleStatusUpdate = useCallback(
    async (userId, status) => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        await axios.put(
          `${BASE_URL}/users/${userId}/status`,
          { status },
          { headers: { Authorization: token } }
        );
        Toast.show({ type: 'success', text1: 'Status Updated' });
        await fetchData();
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        Toast.show({ type: 'error', text1: 'Update Failed' });
      } finally {
        setLoading(false);
      }
    },
    [fetchData, handleUnauthorized]
  );

  const handleDeleteUser = useCallback(
    userId => {
      showConfirmDialog(
        'Confirm Delete',
        'Are you sure you want to delete this user?',
        async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${BASE_URL}/users/${userId}`, {
              headers: { Authorization: token },
            });
            Toast.show({ type: 'success', text1: 'User Deleted' });
            await fetchData();
            if (selectedUserId === userId) setSelectedUserId(null);
          } catch (error) {
            if (await handleUnauthorized(error)) return;
            Toast.show({ type: 'error', text1: 'Delete Failed' });
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [fetchData, handleUnauthorized, selectedUserId, showConfirmDialog]
  );

  const handleEditUser = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/users/${editUser._id}`,
        { ...editUser },
        { headers: { Authorization: token } }
      );
      Toast.show({ type: 'success', text1: 'Profile Updated' });
      setEditUser(null);
      await fetchData();
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      Toast.show({ type: 'error', text1: 'Update Failed' });
    } finally {
      setLoading(false);
    }
  }, [editUser, fetchData, handleUnauthorized]);

  // Function to handle user points reset
  const handleResetPoints = useCallback(
    userId => {
      showConfirmDialog(
        'Confirm Reset',
        'Are you sure you want to reset this user’s points?',
        async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            await axios.put(
              `${BASE_URL}/users/${userId}/reset-points`,
              {},
              { headers: { Authorization: token } }
            );
            Toast.show({ type: 'success', text1: 'Points Reset' });
            await fetchData();
          } catch (error) {
            if (await handleUnauthorized(error)) return;
            Toast.show({ type: 'error', text1: 'Reset Failed' });
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [fetchData, handleUnauthorized, showConfirmDialog]
  );

  const fetchUserBarcodes = useCallback(
    async userId => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await axios.get(`${BASE_URL}/barcodes/user/${userId}`, {
          headers: { Authorization: token },
        });
        // The server sends back { barcodes: [...] } where each barcode has "scannedAt"
        const barcodes = response.data.barcodes || [];

        // ✅ CORRECTED: The mapping is simplified. We now correctly assign the `scannedAt`
        // value from the server to the `createdAt` field that the UI expects.
        setUserBarcodes(
          barcodes.map(barcode => ({
            ...barcode,
            createdAt: barcode.scannedAt, // Use the correct field name from the server
            pointsAwarded: barcode.points, // The server sends this as 'points'
          }))
        );

        setSelectedUserId(userId);
        if (!barcodes.length) Toast.show({ type: 'info', text1: 'No Barcodes' });
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        Toast.show({ type: 'error', text1: 'Fetch Failed', text2: error.message });
        setUserBarcodes([]);
      } finally {
        setLoading(false);
      }
    },
    [handleUnauthorized]
  );

  const handleDeleteBarcode = useCallback(
    barcodeId => {
      showConfirmDialog(
        'Confirm Delete',
        'Are you sure you want to delete this barcode?',
        async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${BASE_URL}/barcodes/${barcodeId}`, {
              headers: { Authorization: token },
            });
            Toast.show({ type: 'success', text1: 'Barcode Deleted' });
            if (selectedUserId) await fetchUserBarcodes(selectedUserId);
            else await fetchData();
          } catch (error) {
            if (await handleUnauthorized(error)) return;
            Toast.show({ type: 'error', text1: 'Delete Failed' });
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [fetchData, fetchUserBarcodes, handleUnauthorized, selectedUserId, showConfirmDialog]
  );

  const handleDeleteAllBarcodes = useCallback(() => {
    showConfirmDialog(
      'Confirm Delete',
      'Are you sure you want to delete all barcodes?',
      async () => {
        setLoading(true);
        try {
          const token = await AsyncStorage.getItem('token');
          await axios.delete(`${BASE_URL}/barcodes`, { headers: { Authorization: token } });
          Toast.show({ type: 'success', text1: 'Barcodes Deleted' });
          await fetchData();
          setUserBarcodes([]);
        } catch (error) {
          if (await handleUnauthorized(error)) return;
          Toast.show({ type: 'error', text1: 'Delete Failed' });
        } finally {
          setLoading(false);
        }
      }
    );
  }, [fetchData, handleUnauthorized, showConfirmDialog]);

  const handleDeleteUserBarcodes = useCallback(
    userId => {
      showConfirmDialog(
        'Confirm Delete',
        'Are you sure you want to delete all barcodes for this user?',
        async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.delete(`${BASE_URL}/barcodes/user/${userId}`, {
              headers: { Authorization: token },
            });
            Toast.show({
              type: 'success',
              text1: 'Barcodes Deleted',
              text2: response.data.message,
            });
            await fetchData();
            if (selectedUserId === userId) setUserBarcodes([]);
          } catch (error) {
            if (await handleUnauthorized(error)) return;
            if (error.response?.status === 404) {
              Toast.show({ type: 'info', text1: 'No Barcodes' });
            } else {
              Toast.show({ type: 'error', text1: 'Delete Failed' });
            }
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [fetchData, handleUnauthorized, selectedUserId, showConfirmDialog]
  );

  const handleCreateBarcodeRange = useCallback(async () => {
    const { startBarcode, endBarcode, pointsPerScan } = barcodeSettings;
    if (!startBarcode || !endBarcode || !pointsPerScan) {
      Toast.show({ type: 'error', text1: 'All fields are required' });
      return;
    }
    if (!/^[A-Za-z0-9]+$/.test(startBarcode) || !/^[A-Za-z0-9]+$/.test(endBarcode)) {
      Toast.show({ type: 'error', text1: 'Barcodes must be alphanumeric' });
      return;
    }
    if (isNaN(pointsPerScan) || parseInt(pointsPerScan) <= 0) {
      Toast.show({ type: 'error', text1: 'Points must be a positive number' });
      return;
    }
    if (startBarcode > endBarcode) {
      Toast.show({
        type: 'error',
        text1: 'End barcode must be greater than or equal to start barcode',
      });
      return;
    }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const prefixMatch = startBarcode.match(/^[A-Za-z0-9]+/);
      const prefix = prefixMatch ? prefixMatch[0].slice(0, 4) : 'OPT';
      await axios.post(
        `${BASE_URL}/barcode-ranges`,
        {
          start: startBarcode.toUpperCase(),
          end: endBarcode.toUpperCase(),
          points: parseInt(pointsPerScan),
          prefix,
          generateRandomSuffix,
        },
        { headers: { Authorization: token } }
      );
      Toast.show({ type: 'success', text1: 'Barcode Range Created' });
      setBarcodeSettings({ startBarcode: '', endBarcode: '', pointsPerScan: '10' });
      setGenerateRandomSuffix(false);
      await fetchData();
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      Toast.show({ type: 'error', text1: 'Create Failed', text2: error.response?.data?.message });
    } finally {
      setLoading(false);
    }
  }, [barcodeSettings, generateRandomSuffix, fetchData, handleUnauthorized]);

  // 1. This function PREPARES the form for editing a reward.
  const prepareRewardForEdit = reward => {
    setNewReward({
      _id: reward._id,
      name: reward.name,
      // Safely convert numbers to strings, handling cases where they might be missing.
      price: reward.price?.toString() || '',
      bundalValue: reward.bundalValue?.toString() || '',
      pointsRequired: reward.pointsRequired?.toString() || '',
      image: reward.image,
    });
  };

  // 2. This new function SUBMITS the updated reward data to the server.
  const handleUpdateReward = async () => {
    if (!newReward._id) return;
    setIsUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.put(`${BASE_URL}/rewards/${newReward._id}`, newReward, {
        headers: { Authorization: token },
      });

      // Update the rewards list in the UI with the new data from the server.
      setRewards(rewards.map(r => (r._id === newReward._id ? response.data.reward : r)));
      setNewReward({ name: '', price: '', bundalValue: '', pointsRequired: '', image: null }); // Reset the form.
      Toast.show({ type: 'success', text1: 'Reward updated successfully' });
    } catch (error) {
      console.error('Error updating reward:', error);
      if (await handleUnauthorized(error)) return;
      Toast.show({ type: 'error', text1: 'Error updating reward' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRedemptionStatus = async (id, status) => {
    console.log('🟡 handleRedemptionStatus called with:', { id, status });

    try {
      const token = await AsyncStorage.getItem('token');
      // console.log('✅ Token fetched:', token);

      const apiUrl = `${BASE_URL}/redemptions/${id}/status`;
      console.log('📤 Sending PUT request to:', apiUrl);

      const response = await axios.put(
        apiUrl,
        { status },
        {
          headers: { Authorization: token },
        }
      );

      // console.log('✅ Redemption status updated successfully:', response.data);

      Toast.show({ type: 'success', text1: `Redemption ${status}` });

      console.log('🔄 Fetching updated redemptions...');
      await fetchRedemptions();
      console.log('✅ Redemptions fetched successfully');

      console.log('🔄 Fetching notifications (to verify history creation)...');
      await fetchNotifications();
      console.log('✅ Notifications fetched successfully');
    } catch (error) {
      console.error('❌ Redemption status update failed:', error?.response?.data || error.message);
      Toast.show({ type: 'error', text1: 'Failed to update redemption' });
    }
  };

  const handleDeleteReward = async rewardId => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.delete(`${BASE_URL}/rewards/${rewardId}`, {
        headers: { Authorization: token },
      });
      Toast.show({ type: 'success', text1: 'Reward deleted successfully' });
      fetchRewards(); // refresh reward list
    } catch (error) {
      console.error('Delete Reward Failed:', error);
      Toast.show({ type: 'error', text1: 'Failed to delete reward' });
    }
  };

  const handleCreateReward = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(`${BASE_URL}/rewards`, newReward, {
        headers: { Authorization: token },
      });
      setRewards([...rewards, response.data]);
      setNewReward({ name: '', price: '', bundalValue: '', pointsRequired: '', image: '' });
      Toast.show({ type: 'success', text1: 'Reward created' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Error creating reward' });
    }
  };

  const handleEditRange = useCallback(
    async rangeId => {
      if (!editRange || parseInt(editRange.points) < 0) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Range or Points',
          text2: 'Ensure all fields are valid and points are non-negative.',
        });
        return;
      }
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        await axios.put(
          `${BASE_URL}/barcode-ranges/${rangeId}`,
          {
            start: editRange.start,
            end: editRange.end,
            points: parseInt(editRange.points),
          },
          { headers: { Authorization: token } }
        );
        setBarcodeRanges(
          barcodeRanges.map(range =>
            range._id === rangeId
              ? {
                  ...range,
                  start: editRange.start,
                  end: editRange.end,
                  points: parseInt(editRange.points),
                }
              : range
          )
        );
        setEditRange(null);
        Toast.show({ type: 'success', text1: 'Range Updated' });
        await fetchData();
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        Toast.show({
          type: 'error',
          text1: 'Update Range Failed',
          text2: error.response?.data?.message,
        });
      } finally {
        setLoading(false);
      }
    },
    [barcodeRanges, editRange, handleUnauthorized, fetchData]
  );

  const handleDeleteRange = useCallback(
    rangeId => {
      showConfirmDialog('Delete Range', 'Are you sure you want to delete this range?', async () => {
        setLoading(true);
        try {
          const token = await AsyncStorage.getItem('token');
          await axios.delete(`${BASE_URL}/barcode-ranges/${rangeId}`, {
            headers: { Authorization: token },
          });
          setBarcodeRanges(barcodeRanges.filter(range => range._id !== rangeId));
          Toast.show({ type: 'success', text1: 'Range Deleted' });
          await fetchData();
        } catch (error) {
          if (await handleUnauthorized(error)) return;
          Toast.show({
            type: 'error',
            text1: 'Delete Range Failed',
            text2: error.response?.data?.message,
          });
        } finally {
          setLoading(false);
        }
      });
    },
    [barcodeRanges, handleUnauthorized, showConfirmDialog, fetchData]
  );

  const handleViewPassword = useCallback(
    userId => {
      showConfirmDialog(
        'View Password',
        "Are you sure you want to view this user's password? This is a sensitive operation.",
        async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${BASE_URL}/users/${userId}/password`, {
              headers: { Authorization: token },
            });
            setShowPassword(response.data.password);
            setPasswordUserId(userId);
            Toast.show({ type: 'success', text1: 'Password Retrieved' });
          } catch (error) {
            if (await handleUnauthorized(error)) return;
            Toast.show({
              type: 'error',
              text1: 'Fetch Password Failed',
              text2: error.response?.data?.message,
            });
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [handleUnauthorized, showConfirmDialog]
  );

  const handleExportBarcodes = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/export-barcodes`, {
        headers: { Authorization: token },
        responseType: isWeb ? 'blob' : 'blob',
      });
      if (isWeb) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'barcodes_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.documentDirectory}barcodes_export.csv`;
        await FileSystem.writeAsStringAsync(fileUri, await response.data.text(), {
          encoding: FileSystem.EncodingType.UTF8,
        });
        Toast.show({ type: 'success', text1: 'Export Successful', text2: `Saved to ${fileUri}` });
      }
      Toast.show({ type: 'success', text1: 'Export Successful' });
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      Toast.show({ type: 'error', text1: 'Export Failed' });
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized, isWeb]);

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      navigation.replace('Home');
      Toast.show({ type: 'success', text1: 'Logged Out' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Logout Failed' });
    }
  }, [navigation]);

  const handleClearNotification = useCallback(
    async notificationId => {
      showConfirmDialog(
        'Clear Notification',
        'Are you sure you want to clear this notification?',
        async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${BASE_URL}/notifications/${notificationId}`, {
              headers: { Authorization: token },
            });
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
            Toast.show({ type: 'success', text1: 'Notification Cleared' });
          } catch (error) {
            if (await handleUnauthorized(error)) return;
            Toast.show({
              type: 'error',
              text1: 'Clear Failed',
              text2: error.response?.data?.message || 'Could not clear notification.',
            });
          }
        }
      );
    },
    [handleUnauthorized, showConfirmDialog]
  );

  const filteredBarcodes = useMemo(() => {
    return barcodes.filter(barcode =>
      (barcode.value || '').toLowerCase().includes(searchBarcode.toLowerCase())
    );
  }, [barcodes, searchBarcode]);

  const getItemLayout = useCallback(
    (data, index) => ({ length: 250, offset: 250 * index, index }),
    []
  );

  const openChangePasswordModal = targetId => {
    setPwTargetUserId(targetId);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwModalVisible(true);
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'New password and confirm password do not match' });
      return;
    }
    if (newPassword.length < 6) {
      Toast.show({ type: 'error', text1: 'Password must be at least 6 characters' });
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      const payload = { newPassword };

      // If logged-in user is changing their own password, include currentPassword
      const me = await AsyncStorage.getItem('user'); // if you store user object
      const meObj = me ? JSON.parse(me) : null;
      if (meObj && meObj._id === pwTargetUserId) {
        payload.currentPassword = currentPassword;
      }

      const res = await axios.put(`${BASE_URL}/users/${pwTargetUserId}/password`, payload, {
        headers: { Authorization: token },
      });

      Toast.show({ type: 'success', text1: res.data.message || 'Password changed' });
      setPwModalVisible(false);
    } catch (error) {
      console.error('Change password error', error?.response?.data || error.message);
      const msg = error?.response?.data?.message || 'Failed to change password';
      Toast.show({ type: 'error', text1: msg });
    }
  };

  const renderUserItem = useCallback(
    ({ item }) => (
      <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
        <Card.Content>
          {selectedUserId !== item._id ? (
            editUser && editUser._id === item._id ? (
              <View style={styles.editContainer}>
                {/* Edit Fields */}
                <TextInput
                  label="Package"
                  value={editUser.name}
                  onChangeText={text => setEditUser({ ...editUser, name: text })}
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <TextInput
                  label="Mobile Number"
                  value={editUser.mobile}
                  onChangeText={text => setEditUser({ ...editUser, mobile: text })}
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                  keyboardType="phone-pad"
                />
                <TextInput
                  label="Location"
                  value={editUser.location}
                  onChangeText={text => setEditUser({ ...editUser, location: text })}
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <TextInput
                  label="Points"
                  value={editUser.points.toString()}
                  onChangeText={text => setEditUser({ ...editUser, points: parseInt(text) || 0 })}
                  keyboardType="numeric"
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <View style={styles.buttonRow}>
                  <Button
                    mode="contained"
                    onPress={handleEditUser}
                    style={styles.actionButton}
                    buttonColor={colors.primary}
                    textColor={isDarkMode ? '#FFFFFF' : '#212121'}
                  >
                    <ButtonText>Save</ButtonText>
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => setEditUser(null)}
                    style={styles.actionButton}
                    buttonColor={colors.secondary}
                    textColor={isDarkMode ? '#FFFFFF' : '#212121'}
                  >
                    <ButtonText>Cancel</ButtonText>
                  </Button>
                </View>
              </View>
            ) : (
              <View>
                {/* User Details */}
                <Text
                  style={[
                    styles.cardText,
                    { color: isDarkMode ? '#FFD700' : colors.text, fontWeight: 'bold' },
                  ]}
                >
                  Name: {item.name}
                </Text>
                <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                  Mobile: {item.mobile}
                </Text>
                {/* <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                Status: {item.status === 'approved' ? 'Active' : item.status}
              </Text> */}
                <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                  Points: {item.points}
                </Text>
                <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                  Location: {item.location || 'N/A'}
                </Text>

                {/* Show Password if applicable */}
                {passwordUserId === item._id && showPassword && (
                  <View style={styles.passwordContainer}>
                    <Text style={[styles.cardText, { color: colors.error, fontWeight: 'bold' }]}>
                      Warning: Passwords are sensitive!
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Password: {showPassword}
                    </Text>
                    <Button
                      mode="text"
                      onPress={() => {
                        setShowPassword(null);
                        setPasswordUserId(null);
                      }}
                      textColor={isDarkMode ? '#FF5555' : colors.error}
                    >
                      Hide
                    </Button>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                  {/* Conditional Buttons */}
                  {item.status === 'pending' ? (
                    <>
                      <Button
                        mode="contained"
                        onPress={() => handleStatusUpdate(item._id, 'approved')}
                        style={styles.actionButton}
                        buttonColor={colors.primary}
                        textColor={isDarkMode ? '#FFF' : '#212121'}
                        labelStyle={styles.buttonLabel}
                      >
                        <ButtonText>Approve</ButtonText>
                      </Button>
                      <Button
                        mode="contained"
                        onPress={() => handleStatusUpdate(item._id, 'disapproved')}
                        style={styles.actionButton}
                        buttonColor={colors.error}
                        textColor="#FFF"
                        labelStyle={styles.buttonLabel}
                      >
                        <ButtonText>Disapprove</ButtonText>
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => handleDeleteUser(item._id)}
                        style={styles.actionButton}
                        textColor={isDarkMode ? '#FF5555' : colors.error}
                        labelStyle={styles.buttonLabel}
                      >
                        <ButtonText>Delete</ButtonText>
                      </Button>
                    </>
                  ) : item.status === 'disapproved' ? (
                    <Button
                      mode="outlined"
                      onPress={() => handleDeleteUser(item._id)}
                      style={styles.actionButton}
                      textColor={isDarkMode ? '#FF5555' : colors.error}
                      labelStyle={styles.buttonLabel}
                    >
                      <ButtonText>Delete</ButtonText>
                    </Button>
                  ) : (
                    <>
                      {/* Add Points */}
                      <Button
                        mode="contained"
                        onPress={async () => {
                          const amount = await promptAmount('Enter points to add:');
                          if (!amount) return;
                          const num = parseInt(amount, 10);
                          if (isNaN(num) || num < 50 || num > 10000 || num % 50 !== 0) {
                            Toast.show({
                              type: 'error',
                              text1: 'Enter a number between 50-10000, multiple of 50',
                            });
                            return;
                          }
                          try {
                            const token = await AsyncStorage.getItem('token');
                            const res = await axios.post(
                              `${BASE_URL}/manual-point`,
                              { userId: item._id, amount: num, type: 'add' },
                              { headers: { Authorization: token } }
                            );
                            Toast.show({ type: 'success', text1: 'Points Added' });
                            const newHistoryItem = {
                              _id: res.data._id || Date.now().toString(),
                              action: 'point_add',
                              details: { amount: num },
                              createdAt: new Date().toISOString(),
                            };
                            historyRef.current?.addNewHistoryItem(newHistoryItem);
                            fetchData();
                          } catch (error) {
                            Toast.show({ type: 'error', text1: 'Add Failed' });
                          }
                        }}
                        style={styles.actionButton}
                        buttonColor="green"
                        textColor="#FFFFFF"
                      >
                        <ButtonText>Add Points</ButtonText>
                      </Button>

                      {/* Redeem Points */}
                      <Button
                        mode="contained"
                        onPress={async () => {
                          const amount = await promptAmount('Enter points to redeem:');
                          if (!amount) return;
                          const num = parseInt(amount, 10);
                          const userPoint = item.points || 0;
                          if (isNaN(num) || num < 50 || num > 10000 || num % 50 !== 0) {
                            Toast.show({
                              type: 'error',
                              text1: 'Enter a number between 50-10000, multiple of 50',
                            });
                            return;
                          }
                          if (num > userPoint) {
                            Toast.show({
                              type: 'error',
                              text1: 'Cannot redeem more than available points',
                            });
                            return;
                          }
                          try {
                            const token = await AsyncStorage.getItem('token');
                            const res = await axios.post(
                              `${BASE_URL}/manual-point`,
                              { userId: item._id, amount: num, type: 'redeem' },
                              { headers: { Authorization: token } }
                            );
                            Toast.show({ type: 'success', text1: 'Points Redeemed' });
                            const newHistoryItem = {
                              _id: res.data._id || Date.now().toString(),
                              action: 'point_redeem',
                              details: { amount: num },
                              createdAt: new Date().toISOString(),
                            };
                            historyRef.current?.addNewHistoryItem(newHistoryItem);
                            fetchData();
                          } catch (error) {
                            Toast.show({ type: 'error', text1: 'Redeem Failed' });
                          }
                        }}
                        style={styles.actionButton}
                        buttonColor="red"
                        textColor="#FFFFFF"
                      >
                        <ButtonText>Redeem Points</ButtonText>
                      </Button>

                      {/* Change Password Button ✅ */}
                      {(loggedInUser?.role === 'superadmin' ||
                        loggedInUser?.role === 'admin' ||
                        loggedInUser?._id === item._id) && (
                        <Button
                          mode="outlined"
                          onPress={() => openChangePasswordModal(item._id)}
                          style={styles.actionButton}
                          textColor={isDarkMode ? '#FFD700' : colors.accent}
                        >
                          <ButtonText>Change Password</ButtonText>
                        </Button>
                      )}

                      <Button
                        mode="outlined"
                        onPress={() => {
                          setPasswordUserId(item._id);
                          handleViewPassword(item._id);
                        }}
                        style={styles.actionButton}
                        textColor={isDarkMode ? '#FFD700' : colors.accent}
                        labelStyle={styles.buttonLabel}
                      >
                        <ButtonText>View Password</ButtonText>
                      </Button>
                    </>
                  )}
                </View>
              </View>
            )
          ) : (
            /* Barcode Scanned View */
            <View>
              <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                Scanned Barcodes of {item.name}
              </Text>
              {/* ... Barcode FlatList etc ... */}
            </View>
          )}
        </Card.Content>
      </Card>
    ),
    [
      isDarkMode,
      colors,
      selectedUserId,
      userBarcodes,
      editUser,
      handleEditUser,
      handleStatusUpdate,
      handleDeleteUser,
      handleViewPassword,
      showPassword,
      passwordUserId,
    ]
  );

  // ✅ UPDATED: Unused pickImage() – now consistent with base64 (for future use)
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      // mediaTypes: ImagePicker.MediaTypeOptions.Images,
      mediaTypes: [ImagePicker.MediaType.Images], // Instead of .MediaTypeOptions.Images
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7, // ✅ Standardized quality
      base64: true, // ✅ Enable base64
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      // ✅ Construct full data URI
      const base64Data = res.assets[0].base64;
      setNewReward(prev => ({
        ...prev,
        image: `data:image/jpeg;base64,${base64Data}`,
      }));
    }
  };
  // ✅ FIXED: captureImage() – now uses base64 like the upload button
  const captureImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Camera permission not granted' });
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: undefined,
      quality: 0.7, // ✅ Match upload quality for consistency
      base64: true, // ✅ CRITICAL: Enable base64 to avoid file://
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      // ✅ Construct full data URI (same as upload)
      const base64Data = res.assets[0].base64;
      setNewReward(prev => ({
        ...prev,
        image: `data:image/jpeg;base64,${base64Data}`,
      }));
      Toast.show({ type: 'success', text1: 'Photo captured!' }); // ✅ Optional: User feedback
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <>
            <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
              <Card.Title
                title="Admin Details"
                titleStyle={[styles.cardTitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
              />
              <Card.Content>
                {/* ✅ Admin Name with Icon BEFORE text */}
                <View style={styles.iconContainer}>
                  <MaterialIcons
                    name="person"
                    size={20}
                    color={isDarkMode ? '#FFD700' : colors.accent}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.cardText,
                      { color: isDarkMode ? '#FFD700' : colors.text, fontWeight: 'bold' },
                    ]}
                  >
                    Admin Name: {adminUser?.name || 'Unknown'}
                  </Text>
                </View>

                {/* ✅ Mobile with Icon BEFORE text */}
                <View style={styles.iconContainer}>
                  {adminUser?.mobile && (
                    <MaterialIcons
                      name="smartphone"
                      size={20}
                      color={isDarkMode ? '#FFD700' : colors.accent}
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                    Mobile: {adminUser?.mobile || 'N/A'}
                  </Text>
                </View>

                {/* ✅ Total Users with Icon BEFORE text */}
                <View style={styles.iconContainer}>
                  <MaterialIcons
                    name="group"
                    size={20}
                    color={isDarkMode ? '#FFD700' : colors.accent}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                    Total Users: {users.length}
                  </Text>
                </View>

                {/* ✅ Total Ranges with Icon BEFORE text */}
                <View style={styles.iconContainer}>
                  <MaterialIcons
                    name="qr-code"
                    size={20}
                    color={isDarkMode ? '#FFD700' : colors.accent}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                    Total Ranges Set: {barcodeRanges.length}
                  </Text>
                </View>

                <Button
                  mode="contained"
                  onPress={() => setShowPasswordModal(true)} // optional if you want modal, or handleChangePassword directly
                  style={{
                    marginTop: 16,
                    backgroundColor: isDarkMode ? '#FFD700' : colors.primary,
                    alignSelf: 'center',
                    width: '60%',
                    borderRadius: 8,
                  }}
                  labelStyle={{
                    color: isDarkMode ? '#000' : '#fff',
                    fontWeight: 'bold',
                  }}
                >
                  Change Password
                </Button>
              </Card.Content>
            </Card>

            {/* Top 3 users */}
            <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
              <Card.Title
                title="Top 3 Users"
                titleStyle={[styles.cardTitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
              />
              <Card.Content>
                <TopUsers />
              </Card.Content>
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{
                    alignItems: 'center',
                    marginTop: 10,
                    padding: 10,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                  }}
                  onPress={() => setCurrentTab('users')} // Direct to users tab
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>View More Users</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Set barcode range */}
            <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
              <Card.Title
                title="Set Barcode Range"
                titleStyle={[styles.cardTitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
              />
              <Card.Content>
                {/* Start Barcode */}
                <TextInput
                  label="Start Barcode"
                  value={barcodeSettings.startBarcode}
                  onChangeText={text => {
                    const upperText = text.toUpperCase();

                    // Update startBarcode
                    setBarcodeSettings(prev => ({ ...prev, startBarcode: upperText }));

                    // Extract letters prefix
                    const match = upperText.match(/^([A-Z]*)(\d*)$/); // letters + digits
                    if (match) {
                      const prefix = match[1]; // e.g., "ADITYA"

                      // Extract existing number part from endBarcode if any
                      const endNumberMatch = barcodeSettings.endBarcode.match(/\d*$/);
                      const endNumber = endNumberMatch ? endNumberMatch[0] : '';

                      // Set endBarcode automatically with same prefix
                      setBarcodeSettings(prev => ({ ...prev, endBarcode: prefix + endNumber }));
                    }
                  }}
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <Text style={[styles.hintText, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                  Alphanumeric start barcode (e.g., ADITYA0001)
                </Text>

                {/* End Barcode */}
                <TextInput
                  label="End Barcode"
                  value={barcodeSettings.endBarcode}
                  onChangeText={text =>
                    setBarcodeSettings({ ...barcodeSettings, endBarcode: text.toUpperCase() })
                  }
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <Text style={[styles.hintText, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                  Alphanumeric end barcode (prefix auto-filled, edit number if needed)
                </Text>

                {/* Points Per Scan */}
                <TextInput
                  label="Points Per Scan"
                  value={barcodeSettings.pointsPerScan}
                  onChangeText={text =>
                    setBarcodeSettings({ ...barcodeSettings, pointsPerScan: text })
                  }
                  keyboardType="numeric"
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <Text style={[styles.hintText, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                  Points awarded per barcode scan
                </Text>

                {/* Random Suffix Switch */}
                <View style={styles.switchContainer}>
                  <Text style={[styles.hintText, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                    Generate Random Suffix
                  </Text>
                  <Switch
                    value={generateRandomSuffix}
                    onValueChange={setGenerateRandomSuffix}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={generateRandomSuffix ? '#f4f3f4' : '#f4f3f4'}
                  />
                </View>
                <Text style={[styles.hintText, { color: isDarkMode ? '#AAAAAA' : '#666666' }]}>
                  Add random 5-character suffix to barcodes (e.g., ADITYA0001-XYZ12)
                </Text>

                {/* Create Range Button */}
                <Button
                  mode="contained"
                  onPress={handleCreateBarcodeRange}
                  style={styles.button}
                  buttonColor={colors.primary}
                  textColor={isDarkMode ? '#FFFFFF' : '#212121'}
                >
                  <ButtonText>Create Range</ButtonText>
                </Button>
              </Card.Content>
            </Card>

            {/* Current Ranges */}
            <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
              <Card.Title
                title="Current Ranges"
                titleStyle={[styles.cardTitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
              />
              <Card.Content>
                {barcodeRanges.length > 0 ? (
                  <Swiper
                    height={250}
                    loop={false}
                    showsPagination
                    showsButtons
                    buttonWrapperStyle={{
                      backgroundColor: 'transparent',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      paddingHorizontal: 40,
                      paddingBottom: 10,
                    }}
                    nextButton={
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          borderRadius: 20,
                          padding: 8,
                        }}
                      >
                        <Text style={{ fontSize: 20, color: '#fff' }}>›</Text>
                      </View>
                    }
                    prevButton={
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          borderRadius: 20,
                          padding: 8,
                        }}
                      >
                        <Text style={{ fontSize: 20, color: '#fff' }}>‹</Text>
                      </View>
                    }
                  >
                    {barcodeRanges.map((item, index) => {
                      const qty = (() => {
                        const startNum = parseInt(item.start.replace(/\D/g, ''), 10);
                        const endNum = parseInt(item.end.replace(/\D/g, ''), 10);
                        return !isNaN(startNum) && !isNaN(endNum) ? endNum - startNum + 1 : 0;
                      })();
                      return (
                        // <View key={item._id} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 }}>
                        <View
                          key={item._id}
                          style={{
                            flex: 1,
                            justifyContent: 'flex-start',
                            paddingTop: 1,
                            alignItems: 'center',
                            paddingHorizontal: 10,
                          }}
                        >
                          <Text
                            style={{
                              color: isDarkMode ? '#FFD700' : colors.text,
                              fontWeight: 'bold',
                              marginBottom: 8,
                            }}
                          >
                            Range {index + 1}
                          </Text>
                          {editRange && editRange._id === item._id ? (
                            <>
                              <View style={styles.swiperInputRow}>
                                <TextInput
                                  label="Barcode Start"
                                  value={editRange.start}
                                  onChangeText={text => setEditRange({ ...editRange, start: text })}
                                  style={styles.swiperInputHalf}
                                  mode="outlined"
                                />
                                <TextInput
                                  label="Barcode End"
                                  value={editRange.end}
                                  onChangeText={text => setEditRange({ ...editRange, end: text })}
                                  style={styles.swiperInputHalf}
                                  mode="outlined"
                                />
                              </View>

                              {/* ✅ Line 2: Full-width Points input */}
                              <TextInput
                                label="Points per Scan"
                                value={editRange.points}
                                onChangeText={text => setEditRange({ ...editRange, points: text })}
                                keyboardType="numeric"
                                style={styles.swiperInput}
                                mode="outlined"
                              />

                              {/* ✅ Line 3: Action Buttons */}
                              <View style={styles.buttonRow}>
                                <Button
                                  mode="contained"
                                  onPress={() => handleEditRange(item._id)}
                                  style={styles.actionButton}
                                >
                                  Save
                                </Button>
                                <Button
                                  mode="contained"
                                  onPress={() => setEditRange(null)}
                                  style={styles.actionButton}
                                >
                                  Cancel
                                </Button>
                              </View>
                            </>
                          ) : (
                            <>
                              <Text
                                style={{
                                  color: isDarkMode ? '#FFFFFF' : colors.text,
                                  fontSize: 16,
                                  marginVertical: 4,
                                }}
                              >
                                BarCode Start: {item.start}
                              </Text>
                              <Text
                                style={{
                                  color: isDarkMode ? '#FFFFFF' : colors.text,
                                  fontSize: 16,
                                  marginVertical: 4,
                                }}
                              >
                                BarCode End: {item.end}
                              </Text>
                              <Text
                                style={{
                                  color: isDarkMode ? '#FFFFFF' : colors.text,
                                  fontSize: 16,
                                  marginVertical: 4,
                                }}
                              >
                                Points: {item.points} | Qty: {qty}
                              </Text>
                              <View style={styles.buttonRow}>
                                <Pressable
                                  onPress={() =>
                                    setEditRange({
                                      _id: item._id,
                                      start: item.start.toString(),
                                      end: item.end.toString(),
                                      points: item.points.toString(),
                                    })
                                  }
                                  style={({ pressed }) => [
                                    styles.iconActionButton,
                                    {
                                      backgroundColor: colors.primary,
                                      elevation: pressed ? 0 : 2,
                                    },
                                  ]}
                                >
                                  {({ pressed }) => (
                                    <Animated.View
                                      style={{ transform: [{ scale: pressed ? 0.7 : 1 }] }}
                                    >
                                      <MaterialIcons
                                        name="edit"
                                        size={30}
                                        color={isDarkMode ? '#212121' : '#FFFFFF'}
                                      />
                                    </Animated.View>
                                  )}
                                </Pressable>
                                <Pressable
                                  onPress={() => handleDeleteRange(item._id)}
                                  style={({ pressed }) => [
                                    styles.iconActionButton,
                                    {
                                      backgroundColor: colors.error,
                                      elevation: pressed ? 0 : 2,
                                    },
                                  ]}
                                >
                                  {({ pressed }) => (
                                    <Animated.View
                                      style={{ transform: [{ scale: pressed ? 0.6 : 1 }] }}
                                    >
                                      <MaterialIcons name="delete" size={35} color="#FFFFFF" />
                                    </Animated.View>
                                  )}
                                </Pressable>
                              </View>
                            </>
                          )}
                        </View>
                      );
                    })}
                  </Swiper>
                ) : (
                  <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                    No ranges set.
                  </Text>
                )}
              </Card.Content>
            </Card>
          </>
        );

      case 'users':
        return (
          <>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
              Users
            </Text>

            <TextInput
              placeholder="Search Users by Name or Mobile"
              value={searchUser}
              onChangeText={setSearchUser}
              style={[
                styles.searchBar,
                {
                  backgroundColor: isDarkMode ? '#555' : colors.surface,
                  color: isDarkMode ? '#FFFFFF' : colors.text,
                },
              ]}
              placeholderTextColor={isDarkMode ? '#AAAAAA' : '#666666'}
              mode="outlined"
              theme={{
                colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
              }}
            />

            <FlatList
              ref={userListRef}
              data={filteredUsers}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <Card
                  style={[
                    styles.card,
                    { backgroundColor: isDarkMode ? '#333' : colors.surface },
                    item._id === selectedUserId ? styles.highlightedCard : null,
                  ]}
                >
                  {renderUserItem({ item })}
                </Card>
              )}
              ListEmptyComponent={() => (
                <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                  No users found.
                </Text>
              )}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={getItemLayout}
              removeClippedSubviews={true}
              onScrollToIndexFailed={info => {
                console.warn('Scroll to index failed:', info);
                userListRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
            />

            {showHistory && (
              <Card style={{ borderRadius: 8, padding: 10, marginVertical: 10 }}>
                {/* ✅ History component */}
                <HistoryComponent
                  ref={historyRef}
                  isDarkMode={isDarkMode}
                  colors={colors}
                  initialHistory={showHistory.history}
                  initialUser={{
                    _id: showHistory._id,
                    name: showHistory.name,
                    points: showHistory.totalPoints,
                    mobile: showHistory.mobile,
                  }}
                />

                {/* ✅ Close Button yahi pe */}
                <Button
                  mode="contained"
                  onPress={() => setShowHistory(null)}
                  style={{ marginTop: 10 }}
                  buttonColor={colors.primary}
                  textColor={isDarkMode ? '#FFFFFF' : '#212121'}
                >
                  <ButtonText>Close</ButtonText>
                </Button>
              </Card>
            )}

            {/* ✅ Prompt Modal for Add/Deduct Points */}
            {showPromptModal && (
              <Modal
                visible={showPromptModal}
                transparent={true}
                animationType="fade"
                onRequestClose={handlePromptCancel}
              >
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}
                >
                  <View
                    style={{
                      backgroundColor: 'white',
                      padding: 20,
                      borderRadius: 10,
                      width: '80%',
                    }}
                  >
                    <Text>{promptMessage}</Text>
                    <TextInput
                      value={promptInput}
                      onChangeText={setPromptInput}
                      keyboardType="numeric"
                      maxLength={5}
                      style={{ borderBottomWidth: 1, marginVertical: 10 }}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <Button onPress={handlePromptCancel}>Cancel</Button>
                      <Button onPress={handlePromptSubmit}>OK</Button>
                    </View>
                  </View>
                </View>
              </Modal>
            )}
          </>
        );
      case 'rewards':
        return (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
            showsVerticalScrollIndicator={true} // ✅ CHANGED: Show indicator for clarity
            nestedScrollEnabled={true} // ✅ NEW: Enable nesting for outer
            keyboardShouldPersistTaps="handled" // ✅ NEW: Better touch handling
            scrollEventThrottle={16} // ✅ NEW: 60fps throttle
            onScroll={event =>
              console.log('🔽 Outer ScrollView at Y:', event.nativeEvent.contentOffset.y)
            } // ✅ DEBUG: Log outer scrolls
          >
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
              Rewards
            </Text>

            {/* 🎁 All Rewards Swiper (Unchanged) */}
            <Text style={styles.sectionTitle}>All Rewards</Text>
            {rewards.length > 0 ? (
              <Swiper
                height={480}
                showsPagination
                loop
                dotStyle={{ backgroundColor: isDarkMode ? '#555' : '#ccc' }}
                activeDotStyle={{ backgroundColor: colors.primary }}
              >
                {rewards.map(reward => (
                  <View key={reward._id} style={styles.slide}>
                    {reward.image && (
                      <Image
                        source={{ uri: reward.image }}
                        style={{ width: '100%', height: 250, resizeMode: 'contain' }}
                      />
                    )}
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFD700' : colors.text }]}
                    >
                      Package name: {reward.name}
                    </Text>
                    <Text
                      style={[
                        styles.cardText,
                        {
                          color: isDarkMode ? '#fff' : colors.text,
                          fontSize: 14,
                          fontWeight: '500',
                          letterSpacing: 0.4,
                        },
                      ]}
                    >
                      <Text style={{ fontWeight: '700', color: '#4CAF50' }}>GetPoint:</Text>{' '}
                      {reward.price}
                      {'   '}•{'   '}
                      <Text style={{ fontWeight: '700', color: '#2196F3' }}>Redeem:</Text>{' '}
                      {reward.bundalValue}
                      {'   '}•{'   '}
                      <Text style={{ fontWeight: '700', color: '#FF9800' }}>Payout:</Text>{' '}
                      {reward.pointsRequired}
                    </Text>

                    <View style={styles.buttonRow}>
                      <Button
                        mode="outlined"
                        onPress={() => prepareRewardForEdit(reward)}
                        textColor={isDarkMode ? '#FFD700' : colors.accent}
                      >
                        Edit
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => {
                          showConfirmDialog(
                            'Confirm Delete',
                            `Are you sure you want to delete the reward "${reward.name}"?`,
                            () => handleDeleteReward(reward._id)
                          );
                        }}
                        textColor="#FF4444"
                      >
                        Delete
                      </Button>
                    </View>
                  </View>
                ))}
              </Swiper>
            ) : (
              <Text style={styles.emptyText}>No rewards available</Text>
            )}

            {/* ⚙️ Manage Rewards Form (Unchanged) */}
            <Text style={styles.sectionTitle}>Manage Rewards</Text>
            <Card
              style={[
                styles.card,
                { backgroundColor: isDarkMode ? '#333' : colors.surface, overflow: 'visible' },
              ]}
            >
              <Card.Content>
                <TextInput
                  label="Package Name"
                  value={newReward.name}
                  onChangeText={text => setNewReward({ ...newReward, name: text })}
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <TextInput
                  label="Total Points to Get Rewards"
                  value={newReward.price}
                  onChangeText={text => setNewReward({ ...newReward, price: text })}
                  keyboardType="numeric"
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <TextInput
                  label="Reedem Point"
                  value={newReward.bundalValue}
                  onChangeText={text => setNewReward({ ...newReward, bundalValue: text })}
                  keyboardType="numeric"
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                <TextInput
                  label="₹ Payout "
                  value={newReward.pointsRequired}
                  onChangeText={text => setNewReward({ ...newReward, pointsRequired: text })}
                  keyboardType="numeric"
                  style={styles.input}
                  theme={{
                    colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
                  }}
                  mode="outlined"
                />
                {newReward.image && (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: newReward.image }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeIcon}
                      onPress={() => setNewReward({ ...newReward, image: null })}
                    >
                      <Text style={styles.removeText}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginVertical: 8,
                  }}
                >
                  <Button
                    mode="contained"
                    onPress={async () => {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        base64: true,
                        allowsEditing: true,
                        quality: 0.5,
                      });

                      if (!result.canceled && result.assets?.length > 0) {
                        setNewReward({
                          ...newReward,
                          image: `data:image/jpeg;base64,${result.assets[0].base64}`,
                        });
                      }
                    }}
                    style={{ flex: 1, marginRight: 5 }}
                    buttonColor="#2196F3"
                    textColor="#FFFFFF"
                  >
                    Upload Image
                  </Button>

                  <Button
                    mode="contained"
                    onPress={captureImage}
                    style={{
                      flex: 1,
                      marginLeft: 5,
                      borderRadius: 8,
                      elevation: 2,
                    }}
                    buttonColor="#4CAF50"
                    textColor="#FFFFFF"
                  >
                    📸 Capture Photo
                  </Button>
                </View>
                {newReward._id ? (
                  <View style={styles.buttonRow}>
                    <Button
                      mode="contained"
                      onPress={handleUpdateReward}
                      loading={isUploading}
                      disabled={isUploading}
                      style={styles.actionButton}
                      buttonColor={colors.primary}
                    >
                      Update Reward
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() =>
                        setNewReward({
                          name: '',
                          price: '',
                          bundalValue: '',
                          pointsRequired: '',
                          image: null,
                        })
                      }
                      style={styles.actionButton}
                    >
                      Cancel Edit
                    </Button>
                  </View>
                ) : (
                  <Button
                    mode="contained"
                    loading={isUploading}
                    disabled={isUploading}
                    onPress={handleCreateReward}
                  >
                    {isUploading ? 'Uploading...' : 'Add Reward'}
                  </Button>
                )}
              </Card.Content>
            </Card>

            {/* Notifications Card (Minor Enhancements) */}
            {/* <Card
              style={[
                styles.card,
                { backgroundColor: isDarkMode ? '#333' : colors.surface, overflow: 'visible' },
              ]}
            >
              <Card.Title
                title="Notifications"
                titleStyle={[styles.cardTitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
              />
              <Card.Content>
                <FlatList
                  style={{ maxHeight: 300 }} // ✅ INCREASED: More room to scroll
                  data={notifications}
                  keyExtractor={item => item._id}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true} // ✅ NEW: Visual cue
                  scrollEventThrottle={16} // ✅ NEW: Smooth FPS
                  onScroll={event =>
                    console.log(
                      '📱 Notifications FlatList scroll at Y:',
                      event.nativeEvent.contentOffset.y
                    )
                  } // ✅ DEBUG
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.notificationItem,
                        item.read ? styles.read : styles.unread,
                        {
                          backgroundColor: item.read
                            ? isDarkMode
                              ? '#444'
                              : '#e0e0e0'
                            : isDarkMode
                            ? '#333'
                            : '#fff',
                        },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            const token = await AsyncStorage.getItem('token');
                            await axios.put(
                              `${BASE_URL}/notifications/${item._id}/read`,
                              {},
                              { headers: { Authorization: token } }
                            );
                            setNotifications(prev =>
                              prev.map(n => (n._id === item._id ? { ...n, read: true } : n))
                            );
                          } catch (error) {
                            console.error('Error marking notification:', error);
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.notificationText,
                            { color: isDarkMode ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {item.message}
                        </Text>
                        <Text
                          style={[styles.notificationDate, { color: isDarkMode ? '#999' : '#666' }]}
                        >
                          {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                      <Button
                        mode="outlined"
                        onPress={() => handleClearNotification(item._id)}
                        style={{ marginTop: 6 }}
                        textColor="#FF0000"
                      >
                        Clear
                      </Button>
                    </View>
                  )}
                  ListEmptyComponent={() => <Text style={styles.emptyText}>No notifications.</Text>}
                />
              </Card.Content>
            </Card> */}

            {/* 📝 Redemption Requests Card (Minor Enhancements) */}
            <Card
              style={[
                styles.card,
                { backgroundColor: isDarkMode ? '#333' : colors.surface, overflow: 'visible' },
              ]}
            >
              <Card.Title
                title="Redemption Requests"
                titleStyle={[styles.cardTitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
              />
              <Card.Content>
                <FlatList
                  style={{ maxHeight: 300 }} // ✅ INCREASED: More room
                  data={redemptions.filter(r => r.status === 'pending')}
                  keyExtractor={item => item._id}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true} // ✅ NEW: Scroll bar
                  scrollEventThrottle={16} // ✅ NEW: Smooth
                  onScroll={event =>
                    console.log(
                      '💳 Redemptions FlatList scroll at Y:',
                      event.nativeEvent.contentOffset.y
                    )
                  } // ✅ DEBUG
                  renderItem={({ item }) => (
                    <View style={styles.redemptionItem}>
                      <Text style={styles.cardText}>User: {item.userId?.name}</Text>
                      <Text style={styles.cardText}>Reward: {item.rewardId?.name}</Text>
                      <View style={styles.buttonRow}>
                        <Button
                          mode="contained"
                          onPress={() => handleRedemptionStatus(item._id, 'approved')}
                          style={styles.actionButton}
                          buttonColor={colors.primary}
                          textColor="#FFFFFF"
                        >
                          Approve
                        </Button>
                        <Button
                          mode="contained"
                          onPress={() => handleRedemptionStatus(item._id, 'rejected')}
                          style={styles.actionButton}
                          buttonColor={colors.error}
                          textColor="#FFFFFF"
                        >
                          Reject
                        </Button>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={() => (
                    <Text style={styles.emptyText}>No pending requests.</Text>
                  )}
                />
              </Card.Content>
            </Card>

            {/* 📊 Rewards + User Progress Swiper (Main Fix) */}
            {/* <Text style={styles.sectionTitle}>Rewards with User Progress</Text>
            <View onStartShouldSetResponder={() => false}>
              {' '}
              // ✅ NEW: Yield vertical gestures to children
              <Swiper
                height={450}
                showsPagination
                loop={false}
                vertical={false} // ✅ NEW: Explicit horizontal only
                directionalLockEnabled={true} // ✅ NEW: Lock to horizontal if drag starts horizontal
                dotStyle={{ backgroundColor: isDarkMode ? '#555' : '#ccc' }}
                activeDotStyle={{ backgroundColor: colors.primary }}
                onScrollBeginDrag={event =>
                  console.log('↔️ Swiper drag started, dy=', event.nativeEvent.contentOffset.y)
                } // ✅ DEBUG: Detect vertical intent
              >
                {rewards.map(reward => (
                  <ScrollView
                    key={reward._id}
                    style={{ padding: 10, flex: 1 }} // ✅ MODIFIED: Ensure flex for full height
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true} // ✅ NEW: Scroll bar
                    decelerationRate="normal" // ✅ NEW: Natural momentum
                    scrollEventThrottle={16} // ✅ NEW: Smooth
                    onScroll={event =>
                      console.log(
                        `📊 Swiper Slide (${reward.name}) scroll at Y:`,
                        event.nativeEvent.contentOffset.y
                      )
                    } // ✅ DEBUG
                  >
                    <View style={styles.rewardItem}>
                      {reward.image && (
                        <Image source={{ uri: reward.image }} style={styles.rewardImage} />
                      )}
                      <Text style={styles.rewardText}>Name: {reward.name}</Text>
                      <Text style={styles.rewardText}>Price: ₹{reward.price}</Text>
                      <Text style={styles.rewardText}>
                        Points Required: {reward.pointsRequired}
                      </Text>
                      <Text style={styles.sectionTitle}>User Progress</Text>

                      <FlatList
                        data={users}
                        keyExtractor={user => user._id}
                        nestedScrollEnabled={true} // ✅ NEW: For deeper nesting
                        showsVerticalScrollIndicator={false} // ✅ NEW: Hide inner bar to avoid double bars
                        scrollEventThrottle={16} // ✅ NEW: Smooth
                        onScroll={event =>
                          console.log(
                            `👤 User Progress FlatList scroll at Y:`,
                            event.nativeEvent.contentOffset.y
                          )
                        } // ✅ DEBUG
                        renderItem={({ item: user }) => {
                          const pointsEarned = user.points || 0;
                          const pointsRequired = reward.pointsRequired || 100;
                          const percentage = Math.min((pointsEarned / pointsRequired) * 100, 100);
                          const isCompleted = percentage >= 100;
                          return (
                            <View key={user._id} style={styles.progressContainer}>
                              <Text style={styles.userText}>{user.name}</Text>
                              <View style={styles.progressBar}>
                                <View
                                  style={[
                                    styles.progressFill,
                                    {
                                      width: `${percentage}%`,
                                      backgroundColor: isCompleted ? '#2196F3' : '#4CAF50',
                                    },
                                  ]}
                                />
                              </View>
                              <Text style={styles.progressText}>
                                {pointsEarned}/{pointsRequired} points ({percentage.toFixed(2)}%)
                              </Text>
                            </View>
                          );
                        }}
                      />
                    </View>
                  </ScrollView>
                ))}
              </Swiper>
            </View> */}
          </ScrollView>
        );
      case 'history':
        return (
          <>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
              Notifications & History
            </Text>
            <FlatList
              data={notifications}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const token = await AsyncStorage.getItem('token');
                      await axios.put(
                        `${BASE_URL}/notifications/${item._id}/read`,
                        {},
                        { headers: { Authorization: token } }
                      );
                      setNotifications(prev =>
                        prev.map(n => (n._id === item._id ? { ...n, read: true } : n))
                      );
                      setUnreadAdmin(prev => Math.max(0, prev - 1));
                    } catch (err) {
                      console.error('Failed to mark as read');
                    }

                    if (item.userId && item.type === 'user_registration') {
                      const userToFind = users.find(u => u._id === item.userId._id);
                      if (userToFind) {
                        setCurrentTab('users');
                        setSearchUser(userToFind.name);
                        setSelectedUser(userToFind);
                        setShouldScrollToUser(true);
                      } else {
                        Toast.show({
                          type: 'info',
                          text1: 'User not found',
                          text2: 'They may have been approved or deleted.',
                        });
                        setCurrentTab('users');
                      }
                    }
                  }}
                >
                  <Card style={[styles.notificationItem, item.read ? styles.read : styles.unread]}>
                    <Card.Content>
                      {/* ✅ Correctly applying theme-aware colors */}
                      <Text style={{ color: isDarkMode ? '#FFFFFF' : colors.text }}>
                        {item.message}
                      </Text>
                      <Text style={{ fontSize: 12, color: isDarkMode ? '#AAAAAA' : '#666666' }}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                  No notifications.
                </Text>
              )}
              // ✅ Added a footer to show the other history items
              ListFooterComponent={
                <>
                  <Text
                    style={[
                      styles.subtitle,
                      { color: isDarkMode ? '#FFFFFF' : colors.text, marginTop: 20 },
                    ]}
                  >
                    Activity History
                  </Text>
                  {adminHistory.length > 0 ? (
                    adminHistory.map((item, idx) => (
                      <Card
                        key={item._id || `${item.action}-${idx}`}
                        style={[
                          styles.card,
                          { backgroundColor: isDarkMode ? '#333' : colors.surface },
                        ]}
                      >
                        <Card.Content>
                          <Text
                            style={[
                              styles.cardText,
                              { fontWeight: 'bold', color: isDarkMode ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {item.action.toUpperCase()}
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#AAAAAA' : '#666666' }}>
                            {item.details ? JSON.stringify(item.details) : ''}
                          </Text>
                          <Text style={{ fontSize: 12, color: isDarkMode ? '#AAAAAA' : '#666666' }}>
                            {new Date(item.createdAt).toLocaleString()}
                          </Text>
                        </Card.Content>
                      </Card>
                    ))
                  ) : (
                    <Text
                      style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      No history available.
                    </Text>
                  )}
                </>
              }
            />
          </>
        );
      case 'barcode':
        return (
          <>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
              Barcode Management
            </Text>
            <TextInput
              placeholder="Search Barcodes by Value"
              value={searchBarcode}
              onChangeText={setSearchBarcode}
              style={[
                styles.searchBar,
                {
                  backgroundColor: isDarkMode ? '#555' : colors.surface,
                  color: isDarkMode ? '#FFFFFF' : colors.text,
                },
              ]}
              placeholderTextColor={isDarkMode ? '#AAAAAA' : '#666666'}
              mode="outlined"
              theme={{
                colors: {
                  text: isDarkMode ? '#FFFFFF' : colors.text,
                  primary: colors.primary,
                },
              }}
            />

            <FlatList
              data={filteredBarcodes}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <Card
                  style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
                >
                  <Card.Content>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Value: {item.value}
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      User: {item?.userId?.name || 'Unknown'} ({item?.userId?.mobile || 'N/A'})
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Points Awarded: {item.pointsAwarded}
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Timestamp: {new Date(item.createdAt).toLocaleString()}
                    </Text>
                    <Text
                      style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                    >
                      Location: {item.location || 'N/A'}
                    </Text>
                    <View style={styles.buttonRow}>
                      <Button
                        mode="outlined"
                        onPress={() => {
                          setSelectedBarcodeUser(users.find(u => u._id === item.userId?._id));
                          setSelectedBarcodeId(item._id);
                        }}
                        style={styles.actionButton}
                        buttonColor={colors.primary}
                        textColor={isDarkMode ? '#FFFFFF' : '#212121'}
                      >
                        <ButtonText>View User</ButtonText>
                      </Button>
                      <Button
                        mode="contained"
                        onPress={() => handleDeleteBarcode(item._id)}
                        style={styles.actionButton}
                        buttonColor={colors.error}
                        textColor="#FFFFFF"
                      >
                        <ButtonText>Delete</ButtonText>
                      </Button>
                    </View>
                    {selectedBarcodeId === item._id && selectedBarcodeUser && (
                      <View
                        style={[
                          styles.userDetailsContainer,
                          {
                            backgroundColor: isDarkMode ? '#444' : colors.background,
                            padding: 10,
                            marginTop: 10,
                            borderRadius: '#333',
                            borderWidth: 1,
                            borderColor: '#ccc',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cardText,
                            { color: isDarkMode ? '#FFD700' : colors.text, fontWeight: 'bold' },
                          ]}
                        >
                          User Details
                        </Text>
                        <Text
                          style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                        >
                          Name: {selectedBarcodeUser.name}
                        </Text>
                        <Text
                          style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                        >
                          Mobile: {selectedBarcodeUser.mobile}
                        </Text>
                        <Text
                          style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                        >
                          Status:{' '}
                          {selectedBarcodeUser.status === 'approved'
                            ? 'Active'
                            : selectedBarcodeUser.status}
                        </Text>
                        <Text
                          style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                        >
                          Points: {selectedBarcodeUser.points}
                        </Text>
                        <Text
                          style={[styles.cardText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                        >
                          Location: {selectedBarcodeUser.location || 'N/A'}
                        </Text>
                        <Button
                          mode="contained"
                          onPress={() => {
                            setSelectedBarcodeUser(null);
                            setSelectedBarcodeId(null);
                          }}
                          style={styles.actionButton}
                          buttonColor={colors.secondary}
                          textColor={isDarkMode ? '#FFFFFF' : '#212121'}
                        >
                          <ButtonText>Close</ButtonText>
                        </Button>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={() => (
                <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
                  No barcodes scanned.
                </Text>
              )}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={getItemLayout}
              removeClippedSubviews={true}
            />
            <Button
              mode="contained"
              onPress={handleExportBarcodes}
              style={styles.button}
              buttonColor={colors.accent}
              textColor={isDarkMode ? '#FFFFFF' : '#212121'}
            >
              <ButtonText>Export Barcodes (CSV)</ButtonText>
            </Button>
            <Button
              mode="contained"
              onPress={handleDeleteAllBarcodes}
              style={styles.button}
              buttonColor={colors.error}
              textColor="#FFFFFF"
            >
              <ButtonText>Delete All Barcodes</ButtonText>
            </Button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* ✅ CHANGE: Removed nested ScrollView, now renderContent handles its own scroll */}
      <ScrollView contentContainerStyle={styles.scrollContent}>{renderContent()}</ScrollView>

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: isDarkMode ? '#222' : colors.surface }]}>
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
          style={[styles.tabItem, currentTab === 'users' && styles.activeTab]}
          onPress={() => setCurrentTab('users')}
        >
          <MaterialIcons
            name="people"
            size={24}
            color={
              currentTab === 'users'
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
                  currentTab === 'users'
                    ? isDarkMode
                      ? '#FFD700'
                      : colors.primary
                    : isDarkMode
                    ? '#FFF'
                    : colors.text,
              },
            ]}
          >
            Users
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
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
        </TouchableOpacity>

        {/* <TouchableOpacity
          style={[styles.tabItem, currentTab === 'history' && styles.activeTab]}
          onPress={() => {
            setCurrentTab('history');
            setUnreadAdmin(0);
          }}
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
            Barcode
          </Text>
        </TouchableOpacity>

        <Modal visible={pwModalVisible} onDismiss={() => setPwModalVisible(false)}>
          <View style={{ padding: 16 }}>
            {/* Show current password only if user is changing own password */}
            {loggedInUser && loggedInUser._id === pwTargetUserId && (
              <TextInput
                label="Current Password"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
            )}
            <TextInput
              label="New Password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              label="Confirm New Password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <Button mode="contained" onPress={handleChangePassword}>
              Change Password
            </Button>
            <Button mode="text" onPress={() => setPwModalVisible(false)}>
              Cancel
            </Button>
          </View>
        </Modal>

        <Modal
          visible={showPasswordModal}
          onDismiss={() => setShowPasswordModal(false)}
          contentContainerStyle={{
            backgroundColor: isDarkMode ? '#1e1e1e' : '#f9f9f9',
            padding: 25,
            marginHorizontal: 20,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 6,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: '600',
              color: isDarkMode ? '#fff' : '#222',
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            Change Password
          </Text>

          <TextInput
            label="Old Password"
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry
            mode="outlined"
            style={{ marginBottom: 15 }}
            theme={{
              colors: {
                text: isDarkMode ? '#fff' : '#000',
                background: isDarkMode ? '#333' : '#fff',
                primary: isDarkMode ? '#FFD700' : '#6200ee',
              },
            }}
          />

          <TextInput
            label="New Password"
            value={newPasswords}
            onChangeText={setNewPasswords}
            secureTextEntry
            mode="outlined"
            style={{ marginBottom: 25 }}
            theme={{
              colors: {
                text: isDarkMode ? '#fff' : '#000',
                background: isDarkMode ? '#333' : '#fff',
                primary: isDarkMode ? '#FFD700' : '#6200ee',
              },
            }}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Button
              mode="contained"
              onPress={handleChangePasswords}
              style={{
                flex: 1,
                marginRight: 10,
                backgroundColor: isDarkMode ? '#FFD700' : colors.primary,
                borderRadius: 8,
              }}
              textColor={isDarkMode ? '#000' : '#fff'}
            >
              Update
            </Button>

            <Button
              mode="outlined"
              onPress={() => setShowPasswordModal(false)}
              style={{
                flex: 1,
                marginLeft: 10,
                borderColor: isDarkMode ? '#FFD700' : colors.primary,
                borderRadius: 8,
              }}
              textColor={isDarkMode ? '#FFD700' : colors.primary}
            >
              Cancel
            </Button>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // scrollContent: {
  //   padding: 16,
  //   paddingBottom: 80,
  // },
  scrollContent: { padding: 12, paddingBottom: 100, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modal: {
    padding: 20,
    margin: 20,
    borderRadius: 12,
    elevation: 4,
  },
  userDetailsContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  card: {
    marginVertical: 10,
    borderRadius: 12,
    elevation: 4,
  },
  rangeCard: {
    marginVertical: 5,
    borderRadius: 8,
    elevation: 2,
  },
  editContainer: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  searchBar: {
    marginBottom: 16,
    borderRadius: 25,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    marginVertical: 10,
  },
  button: {
    marginVertical: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  actionButton: {
    marginHorizontal: 4,
    marginVertical: 4,
    borderRadius: 8,
    minWidth: 80,
  },
  iconActionButton: {
    marginHorizontal: 4,
    marginVertical: 4,
    borderRadius: 20, // Half of width/height to make a perfect circle
    width: 40, // Fixed width
    height: 40, // Fixed height
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '600',
    marginVertical: 20,
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardText: {
    fontSize: 16,
    marginVertical: 4,
    fontWeight: '500',
  },
  tabText: {
    fontSize: 12,
    marginTop: 5,
  },
  hintText: {
    fontSize: 12,
    marginBottom: 10,
    color: '#666666',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 10,
  },
  barcodeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    paddingRight: 10,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  passwordContainer: {
    marginTop: 10,
  },
  toggle: {
    marginRight: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sliderContainer: {
    // height: 400,
    height: 'auto',
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  sliderImage: {
    width: '100%',
    height: '350px',
    // resizeMode: 'cover',
    resizeMode: 'contain', // ✅ no cropping in swiper
    alignSelf: 'center',
  },
  sliderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  rewardItem: {
    flexDirection: 'column',
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  rewardImage: {
    width: '100%',
    height: 330,
    borderRadius: 8,
    marginBottom: 10,
    // resizeMode: 'cover',
    alignSelf: 'center',
    resizeMode: 'contain',
  },
  notificationItem: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  read: {
    backgroundColor: '#E0E0E0',
  },
  unread: {
    backgroundColor: '#FFF3E0',
  },
  redemptionItem: {
    marginVertical: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  uploadButton: {
    marginVertical: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  submitButton: {
    marginVertical: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  rewardDetails: {
    fontSize: 14,
    marginBottom: 10,
  },
  cardImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
    marginVertical: 10,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  // Added for progress bar
  // progressContainer: {
  //   marginVertical: 10,
  // },
  progressBarContainer: {
    position: 'relative',
    marginVertical: 5,
  },
  // progressBar: {
  //   height: 20,
  //   borderRadius: 10,
  // },
  // progressText: {
  //   position: 'absolute',
  //   top: '50%',
  //   left: '50%',
  //   transform: [{ translateX: -30 }, { translateY: -10 }],
  //   fontSize: 14,
  //   fontWeight: 'bold',
  // },
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#4CAF50', // ✅ Green border for highlighted user
  },
  progressContainer: { marginVertical: 10 },
  progressBar: { height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50' },
  userText: { fontSize: 14, fontWeight: 'bold' },
  progressText: { fontSize: 12, color: '#666' },
  rewardAchieved: {
    color: 'green',
    fontWeight: 'bold',
    fontSize: 13,
    marginTop: 4,
  },
  remainingPoints: {
    color: '#ff9800',
    fontSize: 12,
    marginTop: 2,
  },

  // Added for image preview

  imagePreviewContainer: {
    position: 'relative',
    marginTop: 10,
    width: '50%',
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  removeIcon: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#FF0000',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  historyTableContainer: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden', // Ensures inner rows adhere to the border radius
  },
  historyTableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 2,
    borderColor: '#ccc',
  },
  historyTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center', // Vertically center content in the row
  },
  historyTableHeaderText: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 12,
  },
  historyTableCell: {
    textAlign: 'center',
    fontSize: 11,
  },
  historyCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    margin: 12,
    elevation: 4,
    paddingBottom: 50,
  },

  historyButton: { backgroundColor: '#007bff', padding: 6, borderRadius: 6, marginTop: 8 },
  historyButtonText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  closeButton: { marginTop: 12, backgroundColor: 'red', padding: 8, borderRadius: 6 },
  closeButtonText: { color: '#fff', textAlign: 'center' },
  historyCloseButton: {
    position: 'absolute',
    top: 3,
    right: 5,
    zIndex: 1, // Ensures it appears above the title
    backgroundColor: 'rgba(255,0,0,0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ✅ New styles for the pagination controls.
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  pageButton: {
    marginHorizontal: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  activePageButton: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  pageButtonText: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  activePageButtonText: {
    color: '#fff',
  },
  paginationNavButton: {
    marginHorizontal: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },

  mobileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  mobileIcon: {
    marginLeft: 8,
  },

  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  icon: {
    marginLeft: 8,
  },

  swiperInput: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    marginVertical: 5,
    width: '90%',
  },
  swiperInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
  },
  swiperInputHalf: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    marginVertical: 5,
    width: '48%',
  },
});
