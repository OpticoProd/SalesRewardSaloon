if (typeof setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message'; 
import { DarkModeTheme, LightTheme, ThemeContext } from './src/ThemeContext';
import AdminDashboard from './src/screens/AdminDashboard';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SuperAdminDashboard from './src/screens/SuperAdminDashboard';
import UserDashboard from './src/screens/UserDashboard';

const Stack = createStackNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? DarkModeTheme : LightTheme;

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });
    return () => subscription.remove();
  }, []);

  return (
    <PaperProvider theme={theme}>
      <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme }}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              animationEnabled: true,
              animationTypeForReplace: 'push',
              cardStyleInterpolator: ({ current }) => ({
                cardStyle: {
                  transform: [
                    {
                      translateY: current.progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [300, 0], // Slide up animation
                      }),
                    },
                  ],
                },
              }),
            }}
          >
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="UserDashboard" component={UserDashboard} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            <Stack.Screen name="SuperAdminDashboard" component={SuperAdminDashboard} />
          </Stack.Navigator>
        </NavigationContainer>
        <Toast />
      </ThemeContext.Provider>
    </PaperProvider>
  );
}
