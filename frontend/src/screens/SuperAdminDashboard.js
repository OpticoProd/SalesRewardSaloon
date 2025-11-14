import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Badge, Button, Card, TextInput, useTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { io as ioClient } from 'socket.io-client';
import ThemeToggle from '../components/ThemeToggle';
import { BASE_URL } from '../config/baseURL';
import { ThemeContext } from '../ThemeContext';
const isWeb = Platform.OS === 'web';
export default function SuperAdminDashboard({ navigation }) {
  const { colors } = useTheme();
  const { isDarkMode } = useContext(ThemeContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadSuperAdmin, setUnreadSuperAdmin] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  // New states for Set Limit Modal
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedAdminForLimit, setSelectedAdminForLimit] = useState(null);
  const [userLimitInput, setUserLimitInput] = useState('');
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowNotificationsModal(true)}
          style={{ marginRight: 16, position: 'relative' }}
        >
          <MaterialIcons
            name="notifications"
            size={24}
            color={isDarkMode ? '#FFD700' : colors.primary}
          />
          {unreadSuperAdmin > 0 && (
            <Badge style={{ position: 'absolute', top: -6, right: -6 }} size={18}>
              {unreadSuperAdmin}
            </Badge>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, unreadSuperAdmin, isDarkMode, colors.primary]); // new
  // State Declarations
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [barcodes, setBarcodes] = useState([]);
  const [searchAdmin, setSearchAdmin] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [showPassword, setShowPassword] = useState(null);
  const [passwordAdminId, setPasswordAdminId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState('home');
  const [superAdmin, setSuperAdmin] = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState(null);
  const [userBarcodes, setUserBarcodes] = useState([]);
  const [barcodeSettings, setBarcodeSettings] = useState({
    prefix: 'OPT',
    startNumber: '1',
    count: '50',
    companyName: '',
    digitCount: '7',
    mode: 'with-outline',
  });
  const [selectedAdminForUser, setSelectedAdminForUser] = useState('');
  const [useAdminRanges, setUseAdminRanges] = useState(false);
  const [selectedRangeId, setSelectedRangeId] = useState('');
  const [adminRanges, setAdminRanges] = useState([]);
  const [pointsPerScan, setPointsPerScan] = useState('50');
  // useCallback Functions (in Dependency Order)
  const showConfirmDialog = useCallback(
    (title, message, onConfirm) => {
      if (isWeb) {
        if (window.confirm(`${title}\n${message}`)) onConfirm();
      } else {
        Alert.alert(title, message, [
          { text: 'Cancel', style: 'cancel' },
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
      const [usersRes, barcodesRes, adminsRes] = await Promise.all([
        axios.get(`${BASE_URL}/users`, { headers: { Authorization: token } }),
        axios.get(`${BASE_URL}/barcodes`, { headers: { Authorization: token } }),
        axios.get(`${BASE_URL}/admins`, { headers: { Authorization: token } }),
      ]);
      const validUsers = usersRes.data.filter(user => user.name && user.mobile);
      const sortedUsers = validUsers.sort((a, b) => {
        // Pending requests first
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        // Then approved by points desc
        if (a.status === 'approved' && b.status === 'approved') return b.points - a.points;
        if (a.status === 'approved') return -1;
        if (b.status === 'approved') return 1;
        return 0;
      });
      setUsers(sortedUsers.filter(user => user.role === 'user'));
      setAdmins(
        adminsRes.data.map(admin => ({
          id: admin._id,
          name: admin.name,
          mobile: admin.mobile,
          status: admin.status,
          uniqueCode: admin.uniqueCode,
        }))
      );
      setBarcodes(barcodesRes.data);
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      Toast.show({
        type: 'error',
        text1: 'Fetch Failed',
        text2: error.response?.data?.message || 'Could not load data.',
      });
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);
  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const response = await axios.get(`${BASE_URL}/notifications`, {
        headers: { Authorization: token },
      });
      // Sort by date to ensure newest is first
      const sorted = response.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNotifications(sorted);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);
  const fetchAdminRanges = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No token found');
      const response = await axios.get(`${BASE_URL}/barcode-ranges`, {
        headers: { Authorization: token },
      });
      setAdminRanges(response.data);
    } catch (error) {
      if (await handleUnauthorized(error)) return;
      Toast.show({
        type: 'error',
        text1: 'Fetch Failed',
        text2: error.response?.data?.message || 'Could not fetch admin ranges.',
      });
    } finally {
      setLoading(false);
    }
  }, [handleUnauthorized]);
  const handleViewAdminPassword = useCallback(
    adminId => {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(adminId);
      if (!isValidObjectId) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Admin ID',
          text2: `Admin ID ${adminId} is not in a valid format`,
        });
        return;
      }
      showConfirmDialog(
        'View Password',
        "Are you sure you want to view this admin's password? This is a sensitive operation.",
        async () => {
          setLoading(true);
          try {
            const token = await AsyncStorage.getItem('token');
            if (!token) throw new Error('No token found');
            const response = await axios.get(`${BASE_URL}/admins/${adminId}/password`, {
              headers: { Authorization: token },
            });
            setShowPassword(response.data.password);
            setPasswordAdminId(adminId);
            Toast.show({ type: 'success', text1: 'Password Retrieved' });
          } catch (error) {
            if (await handleUnauthorized(error)) return;
            const errorMessage =
              error.response?.data?.message || `Failed to fetch password for admin ${adminId}`;
            Toast.show({
              type: 'error',
              text1: 'Fetch Password Failed',
              text2: errorMessage,
            });
          } finally {
            setLoading(false);
          }
        }
      );
    },
    [handleUnauthorized, showConfirmDialog]
  );
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const url = selectedAdminForUser
        ? `${BASE_URL}/users?adminId=${selectedAdminForUser}`
        : `${BASE_URL}/users`;
      const res = await axios.get(url, { headers: { Authorization: token } });
      const validUsers = res.data.filter(user => user.name && user.mobile);
      const sortedUsers = validUsers.sort((a, b) => {
        // Pending requests first
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        // Then approved by points desc
        if (a.status === 'approved' && b.status === 'approved') return b.points - a.points;
        if (a.status === 'approved') return -1;
        if (b.status === 'approved') return 1;
        return 0;
      });
      setUsers(sortedUsers.filter(user => user.role === 'user'));
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAdminForUser]);
  useEffect(() => {
    fetchUsers();
  }, [selectedAdminForUser]);
  const handleStatusUpdate = useCallback(
    async (userId, status) => {
      if (status === 'approved' && !selectedAdminForUser) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Please select an admin before approving.',
        });
        return;
      }
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        await axios.put(
          `${BASE_URL}/users/${userId}/status`,
          { status, adminId: status === 'approved' ? selectedAdminForUser : undefined },
          { headers: { Authorization: token } }
        );
        Toast.show({ type: 'success', text1: 'Status Updated' });
        setSelectedAdminForUser('');
        await fetchData();
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        Toast.show({
          type: 'error',
          text1: 'Update Failed',
          text2: error.response?.data?.message || 'Could not update status.',
        });
      } finally {
        setLoading(false);
      }
    },
    [fetchData, handleUnauthorized, selectedAdminForUser]
  );
  const handleStatusUpdateAdmin = useCallback(
    async (adminId, status) => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) throw new Error('No token found');
        const response = await axios.put(
          `${BASE_URL}/admins/${adminId}/status`,
          { status },
          { headers: { Authorization: token } }
        );
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: `Admin ${status} successfully`,
        });
        await fetchData();
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: error.response?.data?.message || 'Failed to update admin status',
        });
      } finally {
        setLoading(false);
      }
    },
    [fetchData, handleUnauthorized]
  );
  const handleDeleteAdmin = useCallback(
    adminId => {
      showConfirmDialog('Confirm Delete', 'Delete this admin?', async () => {
        setLoading(true);
        try {
          const token = await AsyncStorage.getItem('token');
          await axios.delete(`${BASE_URL}/users/${adminId}`, { headers: { Authorization: token } });
          Toast.show({ type: 'success', text1: 'Admin Deleted' });
          await fetchData();
        } catch (error) {
          if (await handleUnauthorized(error)) return;
          Toast.show({
            type: 'error',
            text1: 'Delete Failed',
            text2: error.response?.data?.message || 'Could not delete admin.',
          });
        } finally {
          setLoading(false);
        }
      });
    },
    [fetchData, handleUnauthorized, showConfirmDialog]
  );
  const handleSetAdminUserLimit = useCallback(
    async (adminId, limit) => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        await axios.put(
          `${BASE_URL}/admins/${adminId}/user-limit`,
          { userLimit: parseInt(limit) },
          { headers: { Authorization: token } }
        );
        Toast.show({ type: 'success', text1: 'User Limit Updated' });
        await fetchData();
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        Toast.show({
          type: 'error',
          text1: 'Update Failed',
          text2: error.response?.data?.message || 'Could not update user limit.',
        });
      } finally {
        setLoading(false);
      }
    },
    [fetchData, handleUnauthorized]
  );
  // New handler for Set Limit Modal confirm
  const confirmSetLimit = useCallback(() => {
    if (!userLimitInput || isNaN(userLimitInput) || parseInt(userLimitInput) < 0) {
      Toast.show({ type: 'error', text1: 'Invalid Limit', text2: 'Please enter a valid number.' });
      return;
    }
    if (selectedAdminForLimit) {
      handleSetAdminUserLimit(selectedAdminForLimit, userLimitInput);
    }
    setShowLimitModal(false);
    setUserLimitInput('');
    setSelectedAdminForLimit(null);
  }, [userLimitInput, selectedAdminForLimit, handleSetAdminUserLimit]);
  const fetchUserBarcodes = useCallback(
    async userId => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        const response = await axios.get(`${BASE_URL}/barcodes/user/${userId}`, {
          headers: { Authorization: token },
        });
        setUserBarcodes(response.data);
        setSelectedAdminId(userId);
        if (!response.data.length) Toast.show({ type: 'info', text1: 'No Barcodes' });
      } catch (error) {
        if (await handleUnauthorized(error)) return;
        Toast.show({
          type: 'error',
          text1: 'Fetch Failed',
          text2: error.response?.data?.message || 'Could not fetch barcodes.',
        });
        setUserBarcodes([]);
      } finally {
        setLoading(false);
      }
    },
    [handleUnauthorized]
  );
  const handleDeleteUser = useCallback(
    userId => {
      showConfirmDialog('Confirm Delete', 'Delete this user?', async () => {
        setLoading(true);
        try {
          const token = await AsyncStorage.getItem('token');
          await axios.delete(`${BASE_URL}/users/${userId}`, { headers: { Authorization: token } });
          Toast.show({ type: 'success', text1: 'User Deleted' });
          await fetchData();
        } catch (error) {
          if (await handleUnauthorized(error)) return;
          Toast.show({
            type: 'error',
            text1: 'Delete Failed',
            text2: error.response?.data?.message || 'Could not delete user.',
          });
        } finally {
          setLoading(false);
        }
      });
    },
    [fetchData, handleUnauthorized, showConfirmDialog]
  );
  const handleDeleteBarcode = useCallback(
    barcodeId => {
      showConfirmDialog('Confirm Delete', 'Delete this barcode?', async () => {
        setLoading(true);
        try {
          const token = await AsyncStorage.getItem('token');
          await axios.delete(`${BASE_URL}/barcodes/${barcodeId}`, {
            headers: { Authorization: token },
          });
          Toast.show({ type: 'success', text1: 'Barcode Deleted' });
          if (selectedAdminId) await fetchUserBarcodes(selectedAdminId);
          else await fetchData();
        } catch (error) {
          if (await handleUnauthorized(error)) return;
          Toast.show({
            type: 'error',
            text1: 'Delete Failed',
            text2: error.response?.data?.message || 'Could not delete barcode.',
          });
        } finally {
          setLoading(false);
        }
      });
    },
    [fetchData, fetchUserBarcodes, handleUnauthorized, selectedAdminId, showConfirmDialog]
  );
  const handleResetPoints = useCallback(
    userId => {
      showConfirmDialog('Confirm Reset Points', 'Reset user points?', async () => {
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
          Toast.show({
            type: 'error',
            text1: 'Reset Failed',
            text2: error.response?.data?.message || 'Could not reset points.',
          });
        } finally {
          setLoading(false);
        }
      });
    },
    [fetchData, handleUnauthorized, showConfirmDialog]
  );
  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      navigation.replace('Home');
      Toast.show({ type: 'success', text1: 'Logged Out' });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Logout Failed', text2: error.message });
    }
  }, [navigation]);
  const generateBarcodePDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('No token found');
      const response = await axios.post(
        `${BASE_URL}/generate-pdf`,
        {
          barcodeSettings: {
            ...barcodeSettings,
            companyName:
              barcodeSettings.companyName?.trim() === '' ? ' ' : barcodeSettings.companyName, // ✅ green tick
            pointsPerScan,
          },
          useAdminRanges,
          selectedRangeId: useAdminRanges ? selectedRangeId : undefined,
          selectedAdminForUser: useAdminRanges ? selectedAdminForUser : undefined,
          adminRanges,
        },
        { headers: { Authorization: token } }
      );
      const { pdf } = response.data;
      if (Platform.OS === 'web') {
        const downloadPDF = () => {
          try {
            const byteCharacters = atob(pdf);
            const byteArray = new Uint8Array([...byteCharacters].map(c => c.charCodeAt(0)));
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'barcodes.pdf';
            link.click();
            URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Web PDF Download Error:', err);
            throw new Error('Failed to download PDF on web');
          }
        };
        downloadPDF();
      } else {
        const fileUri = `${FileSystem.documentDirectory}barcodes.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, pdf, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
      Toast.show({ type: 'success', text1: 'PDF Generated' });
    } catch (error) {
      console.error('PDF Generation Error:', error);
      Toast.show({
        type: 'error',
        text1: 'PDF Generation Failed',
        text2: error.response?.data?.message || error.message,
      });
    } finally {
      setPdfLoading(false);
    }
  }, [
    barcodeSettings,
    useAdminRanges,
    selectedRangeId,
    selectedAdminForUser,
    pointsPerScan,
    adminRanges,
  ]);
  // useMemo Hooks
  const filteredAdmins = useMemo(
    () =>
      admins.filter(
        admin =>
          (admin.name || '').toLowerCase().includes(searchAdmin.toLowerCase()) ||
          (admin.mobile || '').toLowerCase().includes(searchAdmin.toLowerCase()) ||
          (admin.uniqueCode || '').toLowerCase().includes(searchAdmin.toLowerCase())
      ),
    [admins, searchAdmin]
  );
  const filteredUsers = useMemo(() => {
    // Agar admin select nahi → saare users
    let tempUsers = selectedAdminForUser
      ? users.filter(user => user.adminId === selectedAdminForUser)
      : [...users]; // selectedAdminForUser empty → saare users
    // Search filter
    return tempUsers.filter(
      user =>
        (user.name || '').toLowerCase().includes(searchUser.toLowerCase()) ||
        (user.mobile || '').toLowerCase().includes(searchUser.toLowerCase())
    );
  }, [users, searchUser, selectedAdminForUser]);
  const filteredBarcodes = useMemo(
    () =>
      barcodes.filter(barcode =>
        (barcode.value || '').toLowerCase().includes(searchBarcode.toLowerCase())
      ),
    [barcodes, searchBarcode]
  );
  const getItemLayout = useCallback(
    (data, index) => ({ length: 250, offset: 250 * index, index }),
    []
  );
  // useEffect and Other Hooks
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);
  // Refresh token periodically
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
  // Load superadmin from storage + initial data
  useEffect(() => {
    const fetchSuperAdmin = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) setSuperAdmin(JSON.parse(storedUser));
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Super Admin Data Fetch Failed' });
      }
    };
    fetchSuperAdmin();
    fetchData();
    fetchNotifications();
  }, [fetchData, fetchNotifications]);
  // Clear password on tab change
  useEffect(() => {
    setShowPassword(null);
    setPasswordAdminId(null);
  }, [currentTab]);
  // ---------------- Socket.IO (real-time sync for superadmin) ----------------
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
        if (parsed?._id || parsed?.id) {
          socket.emit('register', {
            role: 'superadmin',
            userId: (parsed._id || parsed.id).toString(),
          });
        }
        socket.on('barcode:updated', data => {
          setBarcodes(prev => prev.map(b => (b.id === data.id ? { ...b, ...data } : b)));
          Toast.show({ type: 'info', text1: 'Barcode updated' });
          // CHANGE: Increment unread count
        });
        socket.on('barcode:deleted', data => {
          setBarcodes(prev => prev.filter(b => b.id !== data.id));
          Toast.show({ type: 'warning', text1: 'Barcode deleted' });
          // CHANGE: Increment unread count
        });
        socket.on('reward:updated', () => {
          fetchData();
          Toast.show({ type: 'info', text1: 'Reward updated' });
          // CHANGE: Increment unread count
        });
        socket.on('user:updated', data => {
          setUsers(prev => prev.map(u => (u.id === data.id ? { ...u, ...data } : u)));
          Toast.show({ type: 'info', text1: 'User updated' });
          // CHANGE: Increment unread count
        });
        socket.on('user:deleted', data => {
          setUsers(prev => prev.filter(u => u.id !== data.id));
          Toast.show({ type: 'warning', text1: 'User deleted' });
          // CHANGE: Increment unread count
        });
        socket.on('notification:updated', data => {
          setNotifications(prev =>
            [data, ...prev.filter(n => n._id !== data._id)].sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            )
          );
          Toast.show({ type: 'info', text1: 'New notification received' });
        });
        socket.on('redemption:updated', () => {
          fetchData();
          Toast.show({ type: 'info', text1: 'Redemption updated' });
          // CHANGE: Increment unread count
        });
        socket.on('metrics:updated', () => {
          fetchData();
          fetchAdminRanges();
          Toast.show({ type: 'info', text1: 'Metrics updated' });
          // CHANGE: Increment unread count
          // setUnreadSuperAdmin((prev) => prev + 1);
        });
        socket.on('barcodeRange:created', data => {
          setNotifications(prev => [
            {
              _id: data._id || `barcodeRange-${Date.now()}`,
              message: `New barcode range created: ${data.start} to ${data.end} by Admin ${data.adminId}`,
              createdAt: new Date(),
              read: false,
            },
            ...prev,
          ]);
          Toast.show({
            type: 'info',
            text1: 'New Barcode Range',
            text2: `Admin ${data.adminId} created range: ${data.start} to ${data.end}`,
          });
          // setUnreadSuperAdmin((prev) => prev + 1);
          fetchAdminRanges();
        });
        // ✅ Listen for new admins needing approval
        socket.on('admin:needsApproval', newAdmin => {
          fetchData(); // Refreshes the admin list
          fetchNotifications(); // Refreshes the notification list
          Toast.show({
            type: 'info',
            text1: 'New Admin Registered',
            text2: `${newAdmin.name} requires approval.`,
            visibilityTime: 5000,
          });
        });
        // NEW: Listen for new user registrations needing approval
        socket.on('user:needsApproval', newUser => {
          fetchData(); // Refreshes the user list
          fetchNotifications(); // Refreshes the notification list
          setNotifications(prev => [
            {
              _id: `user-approval-${Date.now()}`,
              message: `New User: ${newUser.name} requires approval.`,
              createdAt: new Date(),
              read: false,
            },
            ...prev,
          ]);
          setUnreadSuperAdmin(prev => prev + 1);
          Toast.show({
            type: 'info',
            text1: 'New User Registered',
            text2: `${newUser.name} requires approval.`,
            visibilityTime: 5000,
          });
        });
      } catch (err) {
        console.warn('Socket error (superadmin):', err);
      }
    };
    setupSocket();
    return () => {
      try {
        if (socket) socket.disconnect();
      } catch (e) {}
    };
  }, [fetchData, fetchAdminRanges]);
  // ---------------- end socket ----------------
  // Background refresh
  useEffect(() => {
    if (currentTab === 'barcode') {
      fetchAdminRanges({ silent: false });
    }
    const refreshInterval = setInterval(() => {
      fetchData();
      if (currentTab === 'barcode') {
        fetchAdminRanges({ silent: true });
      }
    }, 30000);
    return () => clearInterval(refreshInterval);
  }, [currentTab, fetchData, fetchAdminRanges]);
  // Reset selectedRangeId when switching admin
  useEffect(() => {
    if (useAdminRanges) {
      setSelectedRangeId('');
    }
  }, [selectedAdminForUser, useAdminRanges]);
  // Handle back button (Android)
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        const onBackPress = () => {
          navigation.navigate('SuperAdminDashboard');
          return true;
        };
        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }
    }, [navigation])
  );
  useEffect(() => {
    try {
      const unreadCount = Array.isArray(notifications)
        ? notifications.filter(n => !n.read).length
        : 0;
      setUnreadSuperAdmin(unreadCount);
    } catch (e) {
      console.error('Failed to calculate unread notifications:', e);
      setUnreadSuperAdmin(0); // Default to 0 in case of an error
    }
  }, [notifications]); // This hook runs every time the 'notifications' state updates
  const renderContent = () => {
    let content;
    switch (currentTab) {
      case 'home':
        content = (
          <>
            <View style={styles.header}>
              <ThemeToggle style={styles.toggle} />
              <Button
                mode="contained"
                onPress={handleLogout}
                style={styles.button}
                buttonColor={colors.error}
                textColor="#FFF"
                labelStyle={styles.buttonLabel}
                icon="logout"
              >
                Logout
              </Button>
            </View>
            <View style={styles.header}>
              <Text style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
                Super Admin Home
              </Text>
            </View>
            <Card
              style={[
                styles.welcomeCard,
                { backgroundColor: isDarkMode ? '#4A5568' : colors.primaryContainer },
              ]}
            >
              <Card.Content>
                <View style={styles.welcomeRow}>
                  <MaterialIcons
                    name="verified-user"
                    size={40}
                    color={isDarkMode ? '#FFD700' : colors.primary}
                  />
                  <View style={styles.welcomeText}>
                    <Text
                      style={[
                        styles.welcomeTitle,
                        { color: isDarkMode ? '#FFF' : colors.onPrimaryContainer },
                      ]}
                    >
                      Welcome, {superAdmin?.name || 'Super Admin'}!
                    </Text>
                    <Text
                      style={[
                        styles.welcomeSubtitle,
                        { color: isDarkMode ? '#E2E8F0' : colors.onSurfaceVariant },
                      ]}
                    >
                      Manage your dashboard with ease
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
            <Card
              style={[styles.statsCard, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
            >
              <Card.Content>
                <Text style={[styles.statsTitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
                  Quick Stats
                </Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <MaterialIcons
                      name="supervisor-account"
                      size={24}
                      color={isDarkMode ? '#FFD700' : colors.primary}
                    />
                    <Text
                      style={[styles.statNumber, { color: isDarkMode ? '#FFF' : colors.primary }]}
                    >
                      {admins.length}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDarkMode ? '#AAA' : colors.onSurfaceVariant },
                      ]}
                    >
                      Admins
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialIcons
                      name="group"
                      size={24}
                      color={isDarkMode ? '#FFD700' : colors.primary}
                    />
                    <Text
                      style={[styles.statNumber, { color: isDarkMode ? '#FFF' : colors.primary }]}
                    >
                      {users.length}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDarkMode ? '#AAA' : colors.onSurfaceVariant },
                      ]}
                    >
                      Users
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialIcons
                      name="qr-code"
                      size={24}
                      color={isDarkMode ? '#FFD700' : colors.primary}
                    />
                    <Text
                      style={[styles.statNumber, { color: isDarkMode ? '#FFF' : colors.primary }]}
                    >
                      {barcodes.length}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: isDarkMode ? '#AAA' : colors.onSurfaceVariant },
                      ]}
                    >
                      Barcodes
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </>
        );
        break;
      case 'admins':
        content = (
          <>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
              Admins (Pending Requests on Top)
            </Text>
            <View
              style={[styles.searchBar, { backgroundColor: isDarkMode ? '#555' : colors.surface }]}
            >
              <TextInput
                placeholder="Search Admins"
                value={searchAdmin}
                onChangeText={setSearchAdmin}
                style={[styles.searchInput, { color: isDarkMode ? '#FFF' : colors.text }]}
                placeholderTextColor={isDarkMode ? '#AAA' : '#666'}
                autoCapitalize="none"
                left={
                  <MaterialIcons
                    name="search"
                    size={20}
                    color={isDarkMode ? '#AAA' : '#666'}
                    style={styles.inputIcon}
                  />
                }
              />
            </View>
            <FlatList
              data={filteredAdmins}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 120 }}
              renderItem={({ item }) => (
                <Card
                  style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
                >
                  <Card.Content>
                    {selectedAdminId !== item.id ? (
                      <View style={styles.listItemRow}>
                        <View style={styles.infoHeaderRow}>
                          <MaterialIcons
                            name="person-outline"
                            size={24}
                            color={isDarkMode ? '#FFD700' : colors.primary}
                          />
                          <View style={styles.infoTextHeader}>
                            <Text
                              style={[
                                styles.rowTextBold,
                                { color: isDarkMode ? '#FFD700' : colors.primary },
                              ]}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor:
                                    item.status === 'approved'
                                      ? colors.primary + '20'
                                      : item.status === 'pending'
                                      ? '#FFD70020'
                                      : colors.error + '20',
                                  color:
                                    item.status === 'approved'
                                      ? colors.primary
                                      : item.status === 'pending'
                                      ? '#FFD700'
                                      : colors.error,
                                },
                              ]}
                            >
                              {item.status === 'approved'
                                ? 'Active'
                                : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                          </View>
                        </View>
                        <View>
                          <View style={styles.detailItem}>
                            <MaterialIcons
                              name="phone"
                              size={16}
                              color={isDarkMode ? '#AAA' : '#666'}
                            />
                            <Text
                              style={[
                                styles.detailText,
                                { color: isDarkMode ? '#FFF' : colors.text },
                              ]}
                            >
                              {item.mobile}
                            </Text>
                          </View>
                          <View style={styles.detailItem}>
                            <MaterialIcons
                              name="code"
                              size={16}
                              color={isDarkMode ? '#AAA' : '#666'}
                            />
                            <Text
                              style={[
                                styles.detailText,
                                { color: isDarkMode ? '#FFF' : colors.text },
                              ]}
                            >
                              {item.uniqueCode}
                            </Text>
                          </View>
                        </View>
                        {passwordAdminId === item.id && showPassword && (
                          <View
                            style={[
                              styles.passwordContainer,
                              { backgroundColor: isDarkMode ? '#4A4A4A' : '#fff3cd' },
                            ]}
                          >
                            <Text
                              style={[styles.cardText, { color: colors.error, fontWeight: 'bold' }]}
                            >
                              ⚠️ Password: {showPassword}
                            </Text>
                            <Button
                              mode="text"
                              onPress={() => {
                                setShowPassword(null);
                                setPasswordAdminId(null);
                              }}
                              textColor={isDarkMode ? '#FF5555' : colors.error}
                              compact
                            >
                              Hide
                            </Button>
                          </View>
                        )}
                        <View style={styles.buttonRow}>
                          {item.status === 'pending' ? (
                            <>
                              <Button
                                mode="contained"
                                onPress={() => handleStatusUpdateAdmin(item.id, 'approved')}
                                style={styles.actionButton}
                                buttonColor={colors.primary}
                                textColor={isDarkMode ? '#FFF' : '#212121'}
                                labelStyle={styles.buttonLabel}
                                icon="check"
                              >
                                Approve
                              </Button>
                              <Button
                                mode="contained"
                                onPress={() => handleStatusUpdateAdmin(item.id, 'disapproved')}
                                style={styles.actionButton}
                                buttonColor={colors.error}
                                textColor="#FFF"
                                labelStyle={styles.buttonLabel}
                                icon="close"
                              >
                                Disapprove
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => handleDeleteAdmin(item.id)}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#FF5555' : colors.error}
                                labelStyle={styles.buttonLabel}
                                icon="delete"
                              >
                                Delete
                              </Button>
                            </>
                          ) : item.status === 'disapproved' ? (
                            <Button
                              mode="outlined"
                              onPress={() => handleDeleteAdmin(item.id)}
                              style={styles.actionButton}
                              textColor={isDarkMode ? '#FF5555' : colors.error}
                              labelStyle={styles.buttonLabel}
                              icon="delete"
                            >
                              Delete
                            </Button>
                          ) : (
                            <>
                              <Button
                                mode="outlined"
                                onPress={() =>
                                  Toast.show({
                                    type: 'info',
                                    text1: 'Not Available',
                                    text2: 'Barcodes are not applicable for admins.',
                                  })
                                }
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#00FF00' : colors.accent}
                                labelStyle={styles.buttonLabel}
                              >
                                View Barcodes
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => handleDeleteAdmin(item.id)}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#FF5555' : colors.error}
                                labelStyle={styles.buttonLabel}
                                icon="delete"
                              >
                                Delete
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => {
                                  setSelectedAdminForLimit(item.id);
                                  setUserLimitInput('');
                                  setShowLimitModal(true);
                                }}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#FFD700' : colors.accent}
                                labelStyle={styles.buttonLabel}
                                icon="tune"
                              >
                                Set Limit
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => handleViewAdminPassword(item.id)}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#FFD700' : colors.accent}
                                labelStyle={styles.buttonLabel}
                              >
                                View Password
                              </Button>
                            </>
                          )}
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.barcodeHeader}>
                          <MaterialIcons
                            name="qr-code"
                            size={28}
                            color={isDarkMode ? '#FFD700' : colors.primary}
                          />
                          <Text
                            style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}
                          >
                            Barcodes of {item.name}
                          </Text>
                        </View>
                        <Text
                          style={[styles.cardText, { color: isDarkMode ? '#FFF' : colors.text }]}
                        >
                          Total: {userBarcodes.length}
                        </Text>
                        <FlatList
                          data={userBarcodes}
                          keyExtractor={barcode => barcode._id}
                          contentContainerStyle={{ paddingBottom: 20 }}
                          renderItem={({ item: barcode }) => (
                            <View style={styles.barcodeItem}>
                              <View style={styles.barcodeText}>
                                <MaterialIcons name="barcode" size={20} color={colors.primary} />
                                <Text
                                  style={[
                                    styles.cardText,
                                    { color: isDarkMode ? '#FFF' : colors.text },
                                  ]}
                                >
                                  {barcode.value}
                                </Text>
                              </View>
                              <Text
                                style={[styles.smallText, { color: isDarkMode ? '#AAA' : '#666' }]}
                              >
                                {new Date(barcode.createdAt).toLocaleString()} | Points:{' '}
                                {barcode.pointsAwarded}
                              </Text>
                              <Button
                                mode="outlined"
                                onPress={() => handleDeleteBarcode(barcode._id)}
                                style={[styles.actionButtonSmall, { minWidth: 80 }]}
                                textColor={isDarkMode ? '#FF5555' : colors.error}
                                labelStyle={styles.buttonLabel}
                                icon="delete"
                              >
                                Delete
                              </Button>
                            </View>
                          )}
                          ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                              <MaterialIcons
                                name="qr-code-scanner"
                                size={48}
                                color={isDarkMode ? '#AAA' : '#999'}
                              />
                              <Text
                                style={[
                                  styles.emptyText,
                                  { color: isDarkMode ? '#FFF' : colors.text },
                                ]}
                              >
                                No barcodes found.
                              </Text>
                            </View>
                          )}
                          initialNumToRender={10}
                          maxToRenderPerBatch={10}
                          windowSize={5}
                          getItemLayout={getItemLayout}
                        />
                        <Button
                          mode="contained"
                          onPress={() => setSelectedAdminId(null)}
                          style={styles.button}
                          buttonColor={colors.primary}
                          textColor={isDarkMode ? '#FFF' : '#212121'}
                          labelStyle={styles.buttonLabel}
                          icon="arrow-back"
                        >
                          Back
                        </Button>
                      </>
                    )}
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <MaterialIcons
                    name="supervisor-account"
                    size={48}
                    color={isDarkMode ? '#AAA' : '#999'}
                  />
                  <Text style={[styles.emptyText, { color: isDarkMode ? '#FFF' : colors.text }]}>
                    No admins found.
                  </Text>
                </View>
              )}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={getItemLayout}
            />
          </>
        );
        break;
      case 'users':
        content = (
          <>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
              Users
            </Text>
            <View
              style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#444' : '#fff' }]}
            >
              <Picker
                selectedValue={selectedAdminForUser}
                onValueChange={itemValue => {
                  console.log('Selected Admin ID:', itemValue); // check karo console me
                  setSelectedAdminForUser(itemValue); // ye state update karega
                }}
                style={[styles.picker, { color: isDarkMode ? '#FFF' : colors.text }]}
                dropdownIconColor={isDarkMode ? '#FFF' : colors.text}
                itemStyle={{ backgroundColor: isDarkMode ? '#333' : colors.surface }}
              >
                <Picker.Item label="Select Admin (Filter Users)" value="" />
                {admins.map(admin => (
                  <Picker.Item key={admin.id} label={admin.name} value={admin.id} />
                ))}
              </Picker>
            </View>
            <View
              style={[styles.searchBar, { backgroundColor: isDarkMode ? '#555' : colors.surface }]}
            >
              <TextInput
                placeholder="Search Users"
                value={searchUser}
                onChangeText={setSearchUser}
                style={[styles.searchInput, { color: isDarkMode ? '#FFF' : colors.text }]}
                placeholderTextColor={isDarkMode ? '#AAA' : '#666'}
                autoCapitalize="none"
                left={
                  <MaterialIcons
                    name="search"
                    size={20}
                    color={isDarkMode ? '#AAA' : '#666'}
                    style={styles.inputIcon}
                  />
                }
              />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item._id}
              contentContainerStyle={{ paddingBottom: 120 }}
              renderItem={({ item }) => (
                <Card
                  style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}
                >
                  <Card.Content>
                    {selectedAdminId !== item._id ? (
                      <View style={styles.listItemRow}>
                        <View style={styles.infoHeaderRow}>
                          <MaterialIcons
                            name="person"
                            size={24}
                            color={item.status === 'approved' ? colors.primary : colors.error}
                          />
                          <View style={styles.infoTextHeader}>
                            <Text
                              style={[
                                styles.rowTextBold,
                                { color: isDarkMode ? '#FFD700' : colors.primary },
                              ]}
                            >
                              {item.name}
                            </Text>
                            <Text
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor:
                                    item.status === 'approved'
                                      ? colors.primary + '20'
                                      : item.status === 'pending'
                                      ? '#FFD70020'
                                      : colors.error + '20',
                                  color:
                                    item.status === 'approved'
                                      ? colors.primary
                                      : item.status === 'pending'
                                      ? '#FFD700'
                                      : colors.error,
                                },
                              ]}
                            >
                              {item.status === 'approved'
                                ? 'Active'
                                : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.detailText}>
                          <View style={styles.detailItem}>
                            <MaterialIcons name="call" size={16} color="#000000ff" />
                            <Text
                              style={[
                                styles.detailText,
                                { color: isDarkMode ? '#FFF' : colors.text },
                              ]}
                            >
                              {item.mobile}
                            </Text>
                          </View>
                          <View style={styles.detailItem}>
                            <MaterialIcons name="star" size={16} color="#FFD700" />
                            <Text
                              style={[
                                styles.detailText,
                                { color: isDarkMode ? '#FFF' : colors.text },
                              ]}
                            >
                              {item.points} pts
                            </Text>
                          </View>
                          <View style={styles.detailItem}>
                            <MaterialIcons
                              name="supervisor-account"
                              size={16}
                              color={isDarkMode ? '#AAA' : '#666'}
                            />
                            <Text
                              style={[
                                styles.detailText,
                                { color: isDarkMode ? '#FFF' : colors.text },
                              ]}
                            >
                              {admins.find(admin => admin.id === item.adminId)?.name || 'None'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.buttonRow}>
                          {item.status === 'pending' ? (
                            <>
                              <Button
                                mode="contained"
                                onPress={() => handleStatusUpdate(item._id, 'approved')}
                                style={styles.actionButton}
                                buttonColor={colors.primary}
                                textColor={isDarkMode ? '#FFF' : '#212121'}
                                labelStyle={styles.buttonLabel}
                                disabled={!selectedAdminForUser}
                                icon="check"
                              >
                                Approve
                              </Button>
                              <Button
                                mode="contained"
                                onPress={() => handleStatusUpdate(item._id, 'disapproved')}
                                style={styles.actionButton}
                                buttonColor={colors.error}
                                textColor="#FFF"
                                labelStyle={styles.buttonLabel}
                                icon="close"
                              >
                                Disapprove
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => handleDeleteUser(item._id)}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#FF5555' : colors.error}
                                labelStyle={styles.buttonLabel}
                                icon="delete"
                              >
                                Delete
                              </Button>
                            </>
                          ) : item.status === 'disapproved' ? (
                            <Button
                              mode="outlined"
                              onPress={() => handleDeleteUser(item._id)}
                              style={styles.actionButton}
                              textColor={isDarkMode ? '#FF5555' : colors.error}
                              labelStyle={styles.buttonLabel}
                              icon="delete"
                            >
                              Delete
                            </Button>
                          ) : (
                            <>
                              <Button
                                mode="outlined"
                                onPress={() => fetchUserBarcodes(item._id)}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#00FF00' : colors.accent}
                                labelStyle={styles.buttonLabel}
                              >
                                View Barcodes
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => handleDeleteUser(item._id)}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#FF5555' : colors.error}
                                labelStyle={styles.buttonLabel}
                                icon="delete"
                              >
                                Delete
                              </Button>
                              <Button
                                mode="outlined"
                                onPress={() => handleResetPoints(item._id)}
                                style={styles.actionButton}
                                textColor={isDarkMode ? '#FFD700' : colors.accent}
                                labelStyle={styles.buttonLabel}
                                icon="refresh"
                              >
                                Reset Points
                              </Button>
                            </>
                          )}
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.barcodeHeader}>
                          <MaterialIcons
                            name="qr-code"
                            size={28}
                            color={isDarkMode ? '#FFD700' : colors.primary}
                          />
                          <Text
                            style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}
                          >
                            Barcodes of {item.name}
                          </Text>
                        </View>
                        <Text
                          style={[styles.cardText, { color: isDarkMode ? '#FFF' : colors.text }]}
                        >
                          Total: {userBarcodes.length}
                        </Text>
                        <FlatList
                          data={userBarcodes}
                          keyExtractor={barcode => barcode._id}
                          contentContainerStyle={{ paddingBottom: 20 }}
                          renderItem={({ item: barcode }) => (
                            <View style={styles.barcodeItem}>
                              <View style={styles.barcodeText}>
                                <MaterialIcons name="barcode" size={20} color={colors.primary} />
                                <Text
                                  style={[
                                    styles.cardText,
                                    { color: isDarkMode ? '#FFF' : colors.text },
                                  ]}
                                >
                                  {barcode.value}
                                </Text>
                              </View>
                              <Text
                                style={[styles.smallText, { color: isDarkMode ? '#AAA' : '#666' }]}
                              >
                                {barcode.createdAt
                                  ? new Date(barcode.createdAt).toLocaleString()
                                  : 'N/A'}{' '}
                                | Points: {barcode.pointsAwarded ?? 0}
                              </Text>
                              <Button
                                mode="outlined"
                                onPress={() => handleDeleteBarcode(barcode._id)}
                                style={[styles.actionButtonSmall, { minWidth: 80 }]}
                                textColor={isDarkMode ? '#FF5555' : colors.error}
                                labelStyle={styles.buttonLabel}
                                icon="delete"
                              >
                                Delete
                              </Button>
                            </View>
                          )}
                          ListEmptyComponent={() => (
                            <View style={styles.emptyContainer}>
                              <MaterialIcons
                                name="qr-code-scanner"
                                size={48}
                                color={isDarkMode ? '#AAA' : '#999'}
                              />
                              <Text
                                style={[
                                  styles.emptyText,
                                  { color: isDarkMode ? '#FFF' : colors.text },
                                ]}
                              >
                                No barcodes found.
                              </Text>
                            </View>
                          )}
                          initialNumToRender={10}
                          maxToRenderPerBatch={10}
                          windowSize={5}
                          getItemLayout={getItemLayout}
                        />
                        <Button
                          mode="contained"
                          onPress={() => setSelectedAdminId(null)}
                          style={styles.button}
                          buttonColor={colors.primary}
                          textColor={isDarkMode ? '#FFF' : '#212121'}
                          labelStyle={styles.buttonLabel}
                          icon="arrow-back"
                        >
                          Back
                        </Button>
                      </>
                    )}
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="group" size={48} color={isDarkMode ? '#AAA' : '#999'} />
                  <Text style={[styles.emptyText, { color: isDarkMode ? '#FFF' : colors.text }]}>
                    No users found.
                  </Text>
                </View>
              )}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              getItemLayout={getItemLayout}
            />
          </>
        );
        break;
      case 'barcode':
        content = (
          <>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
              Barcode Generator
            </Text>
            <Card style={[styles.card, { backgroundColor: isDarkMode ? '#333' : colors.surface }]}>
              <Card.Title
                title="Settings"
                subtitle={
                  useAdminRanges
                    ? 'Using admin-defined ranges for easy access'
                    : 'Custom barcode generation'
                }
                titleStyle={[styles.cardTitle, { color: isDarkMode ? '#FFF' : colors.text }]}
                subtitleStyle={{ color: isDarkMode ? '#AAA' : colors.onSurfaceVariant }}
              />
              <Card.Content>
                <View style={styles.switchContainer}>
                  <View>
                    <Text
                      style={[styles.hintTextBold, { color: isDarkMode ? '#FFF' : colors.text }]}
                    >
                      Use Admin-Defined Ranges?
                    </Text>
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      Toggle to select pre-defined ranges from admins (easier & faster)
                    </Text>
                  </View>
                  <Switch
                    value={useAdminRanges}
                    onValueChange={value => {
                      setUseAdminRanges(value);
                      if (!value) {
                        setSelectedAdminForUser('');
                        setSelectedRangeId('');
                      }
                    }}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={useAdminRanges ? '#f4f3f4' : '#f4f3f4'}
                  />
                </View>
                {useAdminRanges ? (
                  <View style={styles.section}>
                    <Text
                      style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : colors.text }]}
                    >
                      1. Select Admin
                    </Text>
                    <View
                      style={[
                        styles.pickerContainer,
                        { backgroundColor: isDarkMode ? '#444' : '#fff' },
                      ]}
                    >
                      <Picker
                        selectedValue={selectedAdminForUser}
                        onValueChange={itemValue => {
                          setSelectedAdminForUser(itemValue);
                          setSelectedRangeId(''); // Reset range when admin changes
                        }}
                        style={[styles.picker, { color: isDarkMode ? '#FFF' : colors.text }]}
                        dropdownIconColor={isDarkMode ? '#FFF' : colors.text}
                        itemStyle={{ backgroundColor: isDarkMode ? '#333' : colors.surface }}
                      >
                        <Picker.Item label="Choose an Admin" value="" />
                        {admins.map(admin => (
                          <Picker.Item
                            key={admin.id}
                            label={`Admin: ${admin.name}`}
                            value={admin.id}
                          />
                        ))}
                      </Picker>
                    </View>
                    {selectedAdminForUser ? (
                      <>
                        <Text
                          style={[
                            styles.sectionTitle,
                            { color: isDarkMode ? '#FFF' : colors.text },
                          ]}
                        >
                          2. Select Range
                        </Text>
                        <View
                          style={[
                            styles.pickerContainer,
                            { backgroundColor: isDarkMode ? '#444' : '#fff' },
                          ]}
                        >
                          <Picker
                            selectedValue={selectedRangeId}
                            onValueChange={itemValue => setSelectedRangeId(itemValue)}
                            style={[styles.picker, { color: isDarkMode ? '#FFF' : colors.text }]}
                            dropdownIconColor={isDarkMode ? '#FFF' : colors.text}
                            enabled={!!selectedAdminForUser}
                            itemStyle={{ backgroundColor: isDarkMode ? '#333' : colors.surface }}
                          >
                            <Picker.Item label="Available Ranges" value="" />
                            {adminRanges
                              .filter(
                                range =>
                                  String(range.adminId?._id || range.adminId) ===
                                  String(selectedAdminForUser)
                              )
                              .map(range => (
                                <Picker.Item
                                  key={range._id}
                                  label={`${range.start} → ${range.end} | Points: ${
                                    range.points
                                  } | Qty: ${(() => {
                                    const startNum = parseInt(range.start.replace(/\D/g, ''), 10);
                                    const endNum = parseInt(range.end.replace(/\D/g, ''), 10);
                                    return !isNaN(startNum) && !isNaN(endNum)
                                      ? endNum - startNum + 1
                                      : 0;
                                  })()}`}
                                  value={range._id}
                                />
                              ))}
                          </Picker>
                        </View>
                      </>
                    ) : null}
                    <Text
                      style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : colors.text }]}
                    >
                      3. Company Name (Optional)
                    </Text>
                    <TextInput
                      label="Company Name"
                      value={barcodeSettings.companyName}
                      onChangeText={text =>
                        setBarcodeSettings({ ...barcodeSettings, companyName: text.toUpperCase() })
                      }
                      style={styles.input}
                      theme={{ colors: { text: colors.text, primary: colors.primary } }}
                      mode="outlined"
                    />
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      Appears above each barcode
                    </Text>
                  </View>
                ) : (
                  <View style={styles.section}>
                    <Text
                      style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : colors.text }]}
                    >
                      Custom Settings
                    </Text>
                    <TextInput
                      label="Prefix"
                      value={barcodeSettings.prefix}
                      onChangeText={text =>
                        setBarcodeSettings({ ...barcodeSettings, prefix: text.toUpperCase() })
                      }
                      style={styles.input}
                      theme={{ colors: { text: colors.text, primary: colors.primary } }}
                      mode="outlined"
                    />
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      e.g., OPT
                    </Text>
                    <TextInput
                      label="Start Number"
                      value={barcodeSettings.startNumber}
                      onChangeText={text =>
                        setBarcodeSettings({ ...barcodeSettings, startNumber: text })
                      }
                      keyboardType="numeric"
                      style={styles.input}
                      theme={{ colors: { text: colors.text, primary: colors.primary } }}
                      mode="outlined"
                    />
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      Starting number
                    </Text>
                    <TextInput
                      label="Count"
                      value={barcodeSettings.count}
                      onChangeText={text => setBarcodeSettings({ ...barcodeSettings, count: text })}
                      keyboardType="numeric"
                      style={styles.input}
                      theme={{ colors: { text: colors.text, primary: colors.primary } }}
                      mode="outlined"
                    />
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      How many barcodes?
                    </Text>
                    <TextInput
                      label="Digit Count"
                      value={barcodeSettings.digitCount}
                      onChangeText={text =>
                        setBarcodeSettings({ ...barcodeSettings, digitCount: text })
                      }
                      keyboardType="numeric"
                      style={styles.input}
                      theme={{ colors: { text: colors.text, primary: colors.primary } }}
                      mode="outlined"
                    />
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      Digits in number (e.g., 7 for OPT0000001)
                    </Text>
                    <TextInput
                      label="Company Name"
                      value={barcodeSettings.companyName}
                      onChangeText={text =>
                        setBarcodeSettings({ ...barcodeSettings, companyName: text.toUpperCase() })
                      }
                      style={styles.input}
                      theme={{ colors: { text: colors.text, primary: colors.primary } }}
                      mode="outlined"
                    />
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      Appears above each barcode
                    </Text>
                    <TextInput
                      label="Points per Scan"
                      value={pointsPerScan}
                      onChangeText={setPointsPerScan}
                      keyboardType="numeric"
                      style={styles.input}
                      theme={{ colors: { text: colors.text, primary: colors.primary } }}
                      mode="outlined"
                    />
                    <Text style={[styles.hintText, { color: isDarkMode ? '#AAA' : '#666' }]}>
                      Points awarded per scan
                    </Text>
                  </View>
                )}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
                    PDF Style
                  </Text>
                  <View
                    style={[
                      styles.pickerContainer,
                      { backgroundColor: isDarkMode ? '#444' : '#fff' },
                    ]}
                  >
                    <Picker
                      selectedValue={barcodeSettings.mode}
                      onValueChange={value =>
                        setBarcodeSettings({ ...barcodeSettings, mode: value })
                      }
                      style={[styles.picker, { color: isDarkMode ? '#FFF' : colors.text }]}
                      dropdownIconColor={isDarkMode ? '#FFF' : colors.text}
                      itemStyle={{ backgroundColor: isDarkMode ? '#333' : colors.surface }}
                    >
                      <Picker.Item label="With Outline (Recommended)" value="with-outline" />
                      <Picker.Item label="Without Outline" value="without-outline" />
                      <Picker.Item label="Only Outline" value="only-outline" />
                    </Picker>
                  </View>
                </View>

                <View style={{ marginTop: 2, width: '100%' }}>
                  <Button
                    mode="contained"
                    onPress={generateBarcodePDF}
                    style={styles.button}
                    buttonColor={colors.primary}
                    textColor="#FFF"
                    labelStyle={styles.buttonLabel}
                    loading={pdfLoading}
                  >
                    {pdfLoading ? 'Generating PDF...' : 'Generate PDF'}
                  </Button>
                </View>
              </Card.Content>
            </Card>
          </>
        );
        break;
      default:
        content = null;
    }
    if (currentTab === 'barcode') {
      return <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>{content}</ScrollView>;
    }
    return content;
  };
  return (
    <View
      style={[styles.container, { backgroundColor: isDarkMode ? '#212121' : colors.background }]}
    >
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
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
          style={[styles.tabItem, currentTab === 'admins' && styles.activeTab]}
          onPress={() => setCurrentTab('admins')}
        >
          <MaterialIcons
            name="supervisor-account"
            size={24}
            color={
              currentTab === 'admins'
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
                  currentTab === 'admins'
                    ? isDarkMode
                      ? '#FFD700'
                      : colors.primary
                    : isDarkMode
                    ? '#FFF'
                    : colors.text,
              },
            ]}
          >
            Admins
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
      </View>
      {/* Set Limit Modal */}
      <Modal
        visible={showLimitModal}
        onRequestClose={() => {
          setShowLimitModal(false);
          setUserLimitInput('');
          setSelectedAdminForLimit(null);
        }}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: isDarkMode ? '#212121' : colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
              Set User Limit for {admins.find(a => a.id === selectedAdminForLimit)?.name}
            </Text>
            <Button
              mode="text"
              onPress={() => {
                setShowLimitModal(false);
                setUserLimitInput('');
                setSelectedAdminForLimit(null);
              }}
              textColor={isDarkMode ? '#FFF' : colors.text}
            >
              Close
            </Button>
          </View>
          <TextInput
            label="User Limit"
            value={userLimitInput}
            onChangeText={setUserLimitInput}
            keyboardType="numeric"
            style={styles.input}
            theme={{ colors: { text: colors.text, primary: colors.primary } }}
            mode="outlined"
            placeholder="e.g., 100"
          />
          <View style={styles.modalButtonRow}>
            <Button
              mode="outlined"
              onPress={() => {
                setShowLimitModal(false);
                setUserLimitInput('');
                setSelectedAdminForLimit(null);
              }}
              style={styles.modalButton}
              textColor={isDarkMode ? '#FF5555' : colors.error}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmSetLimit}
              style={styles.modalButton}
              buttonColor={colors.primary}
              textColor="#FFF"
            >
              Confirm
            </Button>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showNotificationsModal}
        onRequestClose={() => setShowNotificationsModal(false)}
        animationType="slide"
      >
        <View
          style={[
            styles.container,
            { backgroundColor: isDarkMode ? '#212121' : colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.subtitle, { color: isDarkMode ? '#FFF' : colors.text }]}>
              Notifications ({unreadSuperAdmin} unread)
            </Text>
            <Button
              mode="text"
              onPress={() => setShowNotificationsModal(false)}
              textColor={isDarkMode ? '#FFF' : colors.text}
            >
              Close
            </Button>
          </View>
          <FlatList
            data={notifications}
            keyExtractor={item => item._id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={async () => {
                  if (!item.read) {
                    try {
                      const token = await AsyncStorage.getItem('token');
                      await axios.put(
                        `${BASE_URL}/notifications/${item._id}/read`,
                        {},
                        {
                          headers: { Authorization: token },
                        }
                      );
                      setNotifications(prev =>
                        prev.map(n => (n._id === item._id ? { ...n, read: true } : n))
                      );
                      setUnreadSuperAdmin(prev => Math.max(0, prev - 1));
                    } catch (err) {
                      console.warn('Error marking as read:', err);
                    }
                  }
                  // Parse message for redirect
                  const lowerMessage = item.message.toLowerCase();
                  let targetName = '';
                  if (lowerMessage.includes('admin')) {
                    // Extract name, e.g., "New Admin: John Doe requires approval"
                    const match = item.message.match(/Admin[:\s]+([A-Za-z\s]+)/i);
                    if (match) targetName = match[1].trim();
                  } else if (lowerMessage.includes('user')) {
                    // Extract name, e.g., "New User: Jane Smith registered"
                    const match = item.message.match(/User[:\s]+([A-Za-z\s]+)/i);
                    if (match) targetName = match[1].trim();
                  }
                  if (targetName) {
                    setShowNotificationsModal(false);
                    if (lowerMessage.includes('admin')) {
                      setCurrentTab('admins');
                      setSearchAdmin(targetName);
                    } else {
                      setCurrentTab('users');
                      setSearchUser(targetName);
                    }
                    Toast.show({
                      type: 'info',
                      text1: `Redirecting to ${targetName}`,
                    });
                  } else {
                    setShowNotificationsModal(false);
                  }
                }}
              >
                <View style={[styles.historyItem, item.read ? styles.read : styles.unread]}>
                  <Text style={[styles.cardText, { fontWeight: 'bold' }]}>{item.message}</Text>
                  <Text style={styles.smallText}>{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={[styles.emptyText, { color: isDarkMode ? '#FFF' : colors.text }]}>
                No notifications available.
              </Text>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  modalContainer: { flex: 1, padding: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 50, // For status bar
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: { flex: 1, marginHorizontal: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtitle: { fontSize: 24, fontWeight: 'bold', marginHorizontal: 16, marginBottom: 10 },
  toggle: { marginLeft: 10 },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    padding: 12,
  },
  cardText: { fontSize: 16, marginBottom: 4, color: '#333' },
  rowText: { fontSize: 14, marginBottom: 2 },
  rowTextBold: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  smallText: { fontSize: 12, color: '#555' },
  hintText: { fontSize: 12, marginBottom: 12 },
  hintTextBold: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  historyItem: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  read: {
    backgroundColor: '#e0e0e0',
  },
  unread: {
    backgroundColor: '#d1e7ff',
  },
  searchBar: {
    marginBottom: 16,
    borderRadius: 25,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#CCC',
  },
  searchInput: { height: 40, fontSize: 16, paddingHorizontal: 10, borderRadius: 20 },
  inputIcon: { marginRight: 8 },
  pickerContainer: {
    width: '100%',
    borderRadius: 12,
    elevation: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: { height: 48, width: '100%' },
  button: {
    borderRadius: 8,
    paddingVertical: 8,
    elevation: 2,
    shadowOpacity: 0.2,
  },
  actionButton: { marginHorizontal: 4, marginVertical: 4, borderRadius: 8, minWidth: 80 },
  actionButtonSmall: { marginHorizontal: 4, marginVertical: 2, borderRadius: 6, minWidth: 60 },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  buttonLabel: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 16, textAlign: 'center', marginVertical: 20 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  barcodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginBottom: 8,
  },
  barcodeText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  barcodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listItemRow: {
    flexDirection: 'column',
    padding: 12,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  infoTextHeader: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 8,
    borderRadius: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  listItemRow: {
    flexDirection: 'column',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTextRow: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'column',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
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
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  tabText: { fontSize: 12, marginTop: 4 },
  input: { marginBottom: 8, backgroundColor: 'transparent' },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  passwordContainer: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  welcomeCard: {
    marginBottom: 16,
    borderRadius: 16,
    elevation: 6,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeText: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  welcomeSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  statsCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
});
