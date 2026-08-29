import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

export function RouteLoadingScreen() {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.screen}>
      <ActivityIndicator color={colors.purple} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: 'center',
  },
});
