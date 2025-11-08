import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, Button } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { API_BASE_URL } from '../config/baseURL';

const HistoryComponent = forwardRef(({ isDarkMode, colors, initialHistory = null, initialUser = null }, ref) => {
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 🔹 Process history with running total (netPoint)
  const processHistory = (data, user) => {
    data.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let cumulative = 0;

    const withNet = data.map(item => {
      const amount = Number(item.details?.amount ?? item.details?.points ?? item.points ?? 0);
      const isDeposit = item.action === 'scan' || item.action === 'point_add';
      const change = isDeposit ? amount : -Math.abs(amount);
      cumulative += change;
      return { ...item, transactionPoint: change, netPoint: cumulative };
    });

    const lastNet = withNet.length ? withNet[withNet.length - 1].netPoint : 0;
    const userPoints =
      typeof user?.points === 'number'
        ? user.points
        : typeof user?.totalPoints === 'number'
        ? user.totalPoints
        : lastNet;
    const offset = userPoints - lastNet;
    const adjusted =
      offset !== 0 ? withNet.map(it => ({ ...it, netPoint: it.netPoint + offset })) : withNet;

    const reversed = adjusted.reverse();
    setHistory(reversed);
    setFilteredHistory(reversed);
  };

  // 🔹 Add new history item dynamically (instant update)
  const addNewHistoryItem = (item) => {
    const amount = Number(item.details?.amount ?? item.details?.points ?? item.points ?? 0);
    const isDeposit = item.action === 'scan' || item.action === 'point_add';
    const change = isDeposit ? amount : -Math.abs(amount);

    const lastNet = history.length ? history[0].netPoint : 0; // history is reversed
    const netPoint = lastNet + change;

    const newItem = { ...item, transactionPoint: change, netPoint };

    setHistory(prev => [newItem, ...prev]);
    setFilteredHistory(prev => [newItem, ...prev]);
  };

  // 🔹 Expose addNewHistoryItem to parent via ref
  useImperativeHandle(ref, () => ({
    addNewHistoryItem,
  }));

  // 🔹 Fetch history from API
  const fetchHistory = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (!storedUser) throw new Error('User not found');
      const user = JSON.parse(storedUser);

      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('Token not found');

      const res = await axios.get(`${API_BASE_URL}/history/user/${user.id}`, {
        headers: { Authorization: token },
      });

      const data = Array.isArray(res.data) ? res.data : [];
      processHistory(data, user);
    } catch (err) {
      console.error('Error fetching history:', err);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.message || 'Failed to load history',
      });
    }
  };

  // 🔹 Run on mount or whenever initialUser.points change
  useEffect(() => {
    if (!history.length) { // sirf initial mount par process karo
      if (initialHistory && initialUser) {
        processHistory(initialHistory, initialUser);
      } else {
        fetchHistory();
      }
    }
  }, [initialHistory, initialUser?.points]);

  // 🔹 Filter by date range
  const filterByDate = () => {
    if (!fromDate || !toDate) {
      Toast.show({ type: 'info', text1: 'Please enter both From and To dates' });
      return;
    }

    const filtered = history.filter(item => {
      const d = new Date(item.createdAt);
      return d >= new Date(fromDate) && d <= new Date(toDate);
    });
    setFilteredHistory(filtered);
  };

  const resetFilter = () => {
    setFilteredHistory(history);
    setFromDate('');
    setToDate('');
  };

  return (
    <View style={styles.historyContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? '#FFD700' : colors.text,
            marginBottom: 16,
            fontSize: 20,
            fontWeight: 'bold',
            textAlign: 'center',
          },
        ]}
      >
        Your History
      </Text>

      {/* 🔍 Date Filter */}
      <View style={styles.filterContainer}>
        <View style={styles.dateInputRow}>
          <TextInput
            placeholder="From (YYYY-MM-DD)"
            placeholderTextColor="#999"
            value={fromDate}
            onChangeText={setFromDate}
            style={[
              styles.input,
              { color: isDarkMode ? '#fff' : '#000', borderColor: isDarkMode ? '#666' : '#ccc' },
            ]}
          />
          <TextInput
            placeholder="To (YYYY-MM-DD)"
            placeholderTextColor="#999"
            value={toDate}
            onChangeText={setToDate}
            style={[
              styles.input,
              { color: isDarkMode ? '#fff' : '#000', borderColor: isDarkMode ? '#666' : '#ccc' },
            ]}
          />
        </View>

        <View style={styles.buttonRow}>
          <View style={{ width: 100, marginRight: 10 }}>
            <Button title="Search" onPress={filterByDate} />
          </View>
          <View style={{ width: 100 }}>
            <Button title="Reset" color="#FF9800" onPress={resetFilter} />
          </View>
        </View>
      </View>

      {/* 🔹 History List */}
      <FlatList
        data={filteredHistory}
        keyExtractor={(item, index) => item._id || index.toString()}
        renderItem={({ item, index }) => {
          const displayType =
            item.action === 'scan'
              ? 'A'
              : ['manual', 'point_add', 'point_redeem', 'cash_reward', 'redemption'].includes(item.action)
              ? 'M'
              : 'N/A';

          let displayDetails = '';
          if (item.action === 'scan') displayDetails = item.details?.barcode || item.details?.value || item.barcode || 'N/A';
          else if (item.action === 'manual') displayDetails = 'Manual Entry';
          else if (item.action === 'point_add') displayDetails = 'Add Point';
          else if (item.action === 'point_redeem' || item.action === 'redemption') displayDetails = 'Redeem';
          else if (item.action === 'cash_reward') displayDetails = 'Cash Reward';
          else displayDetails = 'N/A';

          const mergedDisplay = `${displayType}-${displayDetails}`;
          const transPointStyle = { color: item.transactionPoint > 0 ? '#4CAF50' : '#F44336', fontWeight: 'bold' };
          const rowBg = index % 2 === 0 ? (isDarkMode ? '#2c2c2c' : '#fafafa') : isDarkMode ? '#3c3c3c' : '#f0f0f0';

          return (
            <View style={[styles.historyTableRow, { backgroundColor: rowBg }]}>
              <Text style={[styles.historyTableCell, { color: isDarkMode ? '#fff' : colors.text, flex: 2 }]}>
                {mergedDisplay}
              </Text>
              <Text
                style={[styles.historyTableCell, { color: isDarkMode ? '#fff' : colors.text, flex: 1.5, marginLeft: 10 }]}
              >
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}
              </Text>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {item.transactionPoint > 0 ? (
                  <MaterialIcons name="arrow-upward" size={16} color="#4CAF50" />
                ) : (
                  <MaterialIcons name="arrow-downward" size={16} color="#F44336" />
                )}
              </View>
              <Text style={[styles.historyTableCell, { flex: 0.8 }, transPointStyle]}>
                {item.transactionPoint > 0 ? `+${item.transactionPoint}` : item.transactionPoint}
              </Text>
              <Text style={[styles.historyTableCell, { color: isDarkMode ? '#fff' : colors.text, flex: 0.8, fontWeight: 'bold' }]}>
                {item.netPoint}
              </Text>
            </View>
          );
        }}
        ListHeaderComponent={() => (
          <View style={[styles.historyTableHeader, { backgroundColor: isDarkMode ? '#555' : colors.primary }]}>
            <Text style={[styles.historyTableHeaderText, { color: '#fff', flex: 2 }]}>
              Transactions{'\n'}Details
            </Text>
            <Text style={[styles.historyTableHeaderText, { color: '#fff', flex: 1.5, marginLeft: 10 }]}>
              Date & Time
            </Text>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="swap-horiz" size={18} color="#fff" />
            </View>
            <Text style={[styles.historyTableHeaderText, { color: '#fff', flex: 0.8 }]}>Points</Text>
            <Text style={[styles.historyTableHeaderText, { color: '#fff', flex: 0.8 }]}>Total</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : colors.text, marginTop: 20 }]}>
            No history available.
          </Text>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  historyContainer: { flex: 1, padding: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  filterContainer: { marginBottom: 15, alignItems: 'center' },
  dateInputRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 8, padding: 6, fontSize: 14, width: 150, marginHorizontal: 5 },
  buttonRow: { flexDirection: 'row', justifyContent: 'center' },
  historyTableRow: { borderRadius: 4, marginVertical: 2, flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  historyTableCell: { fontSize: 14 },
  historyTableHeader: { borderRadius: 4, flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 4 },
  historyTableHeaderText: { fontSize: 14, fontWeight: 'bold' },
  emptyText: { fontSize: 16, textAlign: 'center' },
});

export default HistoryComponent;
