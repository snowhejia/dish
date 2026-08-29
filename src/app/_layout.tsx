import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme/tokens';
import { AuthProvider } from '@/providers/AuthProvider';
import { CatalogProvider } from '@/providers/CatalogProvider';
import { LocationProvider } from '@/providers/LocationProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <LocationProvider>
        <CatalogProvider>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
                animation: 'slide_from_right',
              }}
            />
          </GestureHandlerRootView>
        </CatalogProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
