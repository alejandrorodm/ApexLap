import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';

import { colors } from './src/theme';
import { isFirebaseConfigured } from './src/firebase/config';
import { AppProvider, useApp } from './src/context/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import { ShareCardHost } from './src/utils/nativeShare';
import SetupScreen from './src/screens/SetupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import WebFrame from './src/components/WebFrame';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    // Transparente en web: deja ver el fondo inmersivo del marco en toda la
    // pantalla. En nativo cae a un color sólido.
    background: colors.bgScreen,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
    border: colors.border,
  },
};

function Splash({ message }: { message?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.logo}>🏁</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      {message ? <Text style={styles.msg}>{message}</Text> : null}
    </View>
  );
}

function Gate() {
  const { ready, userId, profile, league, error } = useApp();

  if (!ready) return <Splash />;
  if (error) return <Splash message={error} />;

  // Sin sesión (ni cuenta ni invitado): pantalla de login.
  if (!userId) return <AuthScreen />;

  const hasName = (profile?.driverName ?? '').trim().length > 0;
  if (!hasName || !league) return <OnboardingScreen />;

  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <WebFrame>
        <NavigationContainer
          theme={navTheme}
          documentTitle={{
            formatter: (options, route) =>
              `ApexLap${route?.name ? ` · ${route.name}` : ''}`,
          }}
        >
          {isFirebaseConfigured ? (
            <AppProvider>
              <Gate />
            </AppProvider>
          ) : (
            <SetupScreen />
          )}
        </NavigationContainer>
      </WebFrame>
      {/* Host invisible para capturar la share card en nativo (null en web). */}
      <ShareCardHost />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: { fontSize: 56 },
  msg: {
    color: colors.textDim,
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
  },
});
