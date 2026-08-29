import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/silkscreen/useFonts';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen/400Regular';
import { Silkscreen_700Bold } from '@expo-google-fonts/silkscreen/700Bold';

import { colors } from '@/theme/tokens';
import { AuthProvider } from '@/providers/AuthProvider';
import { CatalogProvider } from '@/providers/CatalogProvider';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Silkscreen_400Regular,
    Silkscreen_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
