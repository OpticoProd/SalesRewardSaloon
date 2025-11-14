
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useContext, useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import ThemeToggle from '../components/ThemeToggle';
import { ThemeContext } from '../ThemeContext';
import { BASE_URL } from '../config/baseURL';

const { width } = Dimensions.get('window');

export default function Register({ navigation }) {
  const { colors } = useTheme();
  const { isDarkMode } = useContext(ThemeContext);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [location, setLocation] = useState('');
  const [admins, setAdmins] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nameError, setNameError] = useState('');
  const [mobileError, setMobileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [adminError, setAdminError] = useState('');

  // Fetch admins when role is 'user'
  useEffect(() => {
    if (role === 'user') {
      const fetchAdmins = async () => {
        setLoading(true);
        try {
          const response = await axios.get(`${BASE_URL}/admins`);
          setAdmins(response.data);
        } catch (error) {
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to fetch admins',
          });
        } finally {
          setLoading(false);
        }
      };
      fetchAdmins();
    } else {
      setAdmins([]);
      setSelectedAdmin('');
    }
  }, [role]);

  const validateFields = () => {
    let isValid = true;
    // Name validation
    if (!name.trim()) {
      setNameError('Name is required.');
      isValid = false;
    } else {
      setNameError('');
    }

    // Mobile number validation
    if (!mobile) {
      setMobileError('Mobile number is required.');
      isValid = false;
    } else if (mobile.length !== 10) {
      setMobileError('Mobile number must be 10 digits.');
      isValid = false;
    } else {
      setMobileError('');
    }

    // Password validation
    if (!password) {
      setPasswordError('Password is required.');
      isValid = false;
    } else if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters long.');
      isValid = false;
    } else {
      setPasswordError('');
    }

    // Confirm password validation
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    // Location validation
    if (!location.trim()) {
      setLocationError('Location is required.');
      isValid = false;
    } else {
      setLocationError('');
    }

    // Admin validation
    if (role === 'user' && !selectedAdmin) {
      setAdminError('Please select an admin.');
      isValid = false;
    } else {
      setAdminError('');
    }

    return isValid;
  };

  const handleRegister = async () => {
    if (!validateFields()) {
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        mobile,
        password,
        role,
        location,
        ...(role === 'user' && { adminId: selectedAdmin }),
      };
      const response = await axios.post(`${BASE_URL}/register`, payload);
      Toast.show({
        type: 'success',
        text1: 'Registeration request sent',
        text2: response.data.message,
      });
      navigation.navigate('Home');
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: error.response?.data?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginRedirect = () => {
    navigation.navigate('Home');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <ThemeToggle style={styles.toggle} />
          </View>
          <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : colors.text }]}>
            Register
          </Text>

          <TextInput
            label="Name"
            value={name}
            onChangeText={text => {
              setName(text);
              if (nameError) setNameError('');
            }}
            style={styles.input}
            theme={{
              colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
            }}
            mode="outlined"
            error={!!nameError}
          />
          {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

          <TextInput
            label="Mobile Number"
            value={mobile}
            onChangeText={text => {
              setMobile(text.replace(/[^0-9]/g, ''));
              if (mobileError) setMobileError('');
            }}
            keyboardType="phone-pad"
            style={styles.input}
            theme={{
              colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
            }}
            mode="outlined"
            maxLength={10}
            error={!!mobileError}
          />
          {mobileError ? <Text style={styles.errorText}>{mobileError}</Text> : null}

          <View style={styles.passwordContainer}>
            <TextInput
              label="Password"
              value={password}
              onChangeText={text => {
                setPassword(text);
                if (passwordError) setPasswordError('');
              }}
              secureTextEntry={!showPassword}
              style={[styles.input, { flex: 1 }]}
              theme={{
                colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
              }}
              mode="outlined"
              error={!!passwordError}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={24}
                color={isDarkMode ? '#FFFFFF' : colors.text}
              />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          <View style={styles.passwordContainer}>
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={text => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              secureTextEntry={!showConfirmPassword}
              style={[styles.input, { flex: 1 }]}
              theme={{
                colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
              }}
              mode="outlined"
              error={!!confirmPasswordError}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off' : 'eye'}
                size={24}
                color={isDarkMode ? '#FFFFFF' : colors.text}
              />
            </TouchableOpacity>
          </View>
          {confirmPasswordError ? (
            <Text style={styles.errorText}>{confirmPasswordError}</Text>
          ) : null}

          <TextInput
            label="Location"
            value={location}
            onChangeText={text => {
              setLocation(text);
              if (locationError) setLocationError('');
            }}
            style={styles.input}
            theme={{
              colors: { text: isDarkMode ? '#FFFFFF' : colors.text, primary: colors.primary },
            }}
            mode="outlined"
            error={!!locationError}
          />
          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

          <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#444' : '#fff' }]}>
            <Picker
              selectedValue={role}
              onValueChange={itemValue => setRole(itemValue)}
              style={[styles.picker, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
              dropdownIconColor={isDarkMode ? '#FFFFFF' : colors.text}
            >
              <Picker.Item label="User" value="user" />
              <Picker.Item label="Admin" value="admin" />
            </Picker>
          </View>
          {role === 'user' && (
            <>
              <View
                style={[
                  styles.pickerContainer,
                  {
                    backgroundColor: isDarkMode ? '#444' : '#fff',
                    borderColor: adminError ? 'red' : 'transparent',
                    borderWidth: 1,
                  },
                ]}
              >
                <Picker
                  selectedValue={selectedAdmin}
                  onValueChange={itemValue => {
                    setSelectedAdmin(itemValue);
                    if (adminError) setAdminError('');
                  }}
                  style={[styles.picker, { color: isDarkMode ? '#FFFFFF' : colors.text }]}
                  dropdownIconColor={isDarkMode ? '#FFFFFF' : colors.text}
                >
                  <Picker.Item label="Select Admin" value="" />
                  {admins.map(admin => (
                    <Picker.Item
                      key={admin._id}
                      label={`${admin.name} (${admin.uniqueCode || 'N/A'})`}
                      value={admin._id}
                    />
                  ))}
                </Picker>
              </View>
              {adminError ? <Text style={styles.errorText}>{adminError}</Text> : null}
            </>
          )}
          <Button
            mode="contained"
            onPress={handleRegister}
            style={styles.button}
            buttonColor={colors.primary}
            textColor={isDarkMode ? '#FFFFFF' : '#212121'}
            loading={loading}
            disabled={loading}
            elevation={5}
          >
            Register
          </Button>
          <Button
            mode="outlined"
            onPress={handleLoginRedirect}
            style={styles.button}
            textColor={isDarkMode ? '#FFFFFF' : colors.text}
            elevation={5}
          >
            Already have an account? Login
          </Button>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  toggle: {
    marginRight: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  input: {
    marginVertical: 10,
    borderRadius: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  eyeIcon: {
    padding: 10,
  },
  pickerContainer: {
    width: '100%',
    borderRadius: 12,
    elevation: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  button: {
    marginVertical: 10,
    borderRadius: 12,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    marginBottom: 40,
    width: width > 600 ? '40%' : '100%',
  },
  errorText: {
    color: 'red',
    marginLeft: 10,
    marginBottom: 10,
  },
});
