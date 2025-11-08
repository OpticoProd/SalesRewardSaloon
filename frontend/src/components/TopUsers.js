import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@react-navigation/native';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../config/baseURL';

export default function TopUsers() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

const fetchTop = useCallback(async () => {
  console.log('fetchTop started'); // ✅ function start hua
  setLoading(true);
  setError('');

  try {
    const token = await AsyncStorage.getItem('token');
    console.log('Token fetched:', token); // ✅ token mil raha hai ya nahi
    if (!token) throw new Error('No token found');

    console.log('Making API request to:', `${API_BASE_URL}/stats/top-users`);
    const res = await axios.get(`${API_BASE_URL}/stats/top-users`, {
      headers: { Authorization: token }, // Direct token as backend expects
    });

    console.log('API response received:', res.data); // ✅ response aa raha hai ya nahi
    setItems(res.data || []);

  } catch (e) {
    console.log('Error in fetchTop:', e); // ✅ agar error aa raha hai to print hoga
    setError(e.response?.data?.message || e.message || 'Failed to load top users');
  } finally {
    console.log('fetchTop finished'); // ✅ function end
    setLoading(false);
  }
}, []);

useEffect(() => {
  console.log('useEffect called: fetching top users');
  fetchTop();
}, [fetchTop]);

  const renderItem = ({ item, index }) => (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={[styles.rank, { color: colors.text }]}>{index + 1}</Text>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {item.name || 'Unknown'}
        </Text>
        <Text style={[styles.mobile, { color: colors.text }]}>{item.mobile || '-'}</Text>
      </View>
      <View style={styles.pointsContainer}>
        <View style={styles.pointsWrap}>
          <Text style={[styles.points, { color: colors.primary }]}>{item.totalAddedPoints || 0}</Text>
          <Text style={[styles.pointsLabel, { color: colors.text }]}>added</Text>
        </View>
        <View style={styles.pointsWrap}>
          <Text style={[styles.points, { color: colors.primary }]}>{item.currentPoints || 0}</Text>
          <Text style={[styles.pointsLabel, { color: colors.text }]}>current</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.center}>
        <Text>No top users found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => String(item.userId)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  rank: { width: 24, textAlign: 'center', fontWeight: 'bold' },
  info: { flex: 1, marginLeft: 10 },
  name: { fontSize: 14, fontWeight: '600' },
  mobile: { fontSize: 12, opacity: 0.8 },
  pointsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 150, // Fixed width to avoid layout shift
  },
  pointsWrap: {
    alignItems: 'flex-end',
  },
  points: { fontSize: 16, fontWeight: 'bold' },
  pointsLabel: { fontSize: 10, opacity: 0.8 },
  center: { padding: 16, alignItems: 'center', justifyContent: 'center' },
});
