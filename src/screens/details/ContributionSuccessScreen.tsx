import { StyleSheet, Text, View } from 'react-native';

import { Dishy } from '@/components/brand';
import { ActionButton, DetailScreen, PixelEyebrow, StickyFooter } from '@/components/details';
import { colors } from '@/theme/tokens';

export type ContributionSuccessScreenProps = {
  onDone?: () => void;
};

export function ContributionSuccessScreen({ onDone }: ContributionSuccessScreenProps) {
  return (
    <DetailScreen>
      <View style={styles.content}>
        <Dishy variant="happy" size={98} />
        <PixelEyebrow purple style={styles.eyebrow}>VERSION SENT</PixelEyebrow>
        <Text style={styles.title}>Thanks — that is one more version on the map</Text>
        <Text style={styles.body}>
          We review contributions before they publish. You will see the status under My contributions.
        </Text>
      </View>
      <StickyFooter transparent>
        <ActionButton style={styles.done} onPress={onDone}>Done</ActionButton>
      </StickyFooter>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 52,
    paddingHorizontal: 34,
    paddingBottom: 0,
  },
  eyebrow: {
    marginTop: 22,
  },
  title: {
    maxWidth: 330,
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 10,
  },
  body: {
    maxWidth: 330,
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 20.25,
    textAlign: 'center',
    marginTop: 9,
  },
  done: {
    flex: 1,
  },
});
