import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/hooks/useAuth';
import { cartasBosque } from '@/constants/colors';
import LoginScreen from '@/screens/auth/LoginScreen';
import AppNavigator from './AppNavigator';

function LoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={cartasBosque.bosque} />
    </View>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        {loading ? (
          <LoadingView />
        ) : user ? (
          <AppNavigator />
        ) : (
          <LoginScreen />
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
