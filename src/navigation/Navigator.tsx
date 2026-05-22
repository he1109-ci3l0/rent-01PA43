import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { cartasBosque } from '@/constants/colors';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import AppNavigator from './AppNavigator';
import WebAdminNavigator from './WebAdminNavigator';

function LoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={cartasBosque.bosque} />
    </View>
  );
}

export default function RootNavigator() {
  const { user, loading, role } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        {loading ? (
          <LoadingView />
        ) : user ? (
          Platform.OS === 'web' && role === 'admin'
            ? <WebAdminNavigator />
            : <AppNavigator />
        ) : showRegister ? (
          <RegisterScreen onBack={() => setShowRegister(false)} />
        ) : (
          <LoginScreen onRegister={() => setShowRegister(true)} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: cartasBosque.pergamino,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
