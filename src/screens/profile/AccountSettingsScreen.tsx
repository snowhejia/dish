import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Dishy } from '@/components/brand';
import { ActionButton, DetailHeader, DetailScreen, PixelEyebrow } from '@/components/details';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radii, sizes, spacing, type } from '@/theme/tokens';

export type AccountSettingsScreenProps = {
  onBack: () => void;
  onSignIn: () => void;
};

export function AccountSettingsScreen({ onBack, onSignIn }: AccountSettingsScreenProps) {
  const { status, updateProfile, user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [campus, setCampus] = useState(user?.campus ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
    setCampus(user?.campus ?? '');
  }, [user?.campus, user?.displayName]);

  const save = async () => {
    const normalizedName = displayName.trim();
    if (normalizedName.length < 2) {
      setError('Display name must be at least 2 characters.');
      setSaved(false);
      return;
    }
    const normalizedCampus = campus.trim() || null;
    if (normalizedName === user?.displayName && normalizedCampus === user?.campus) return;

    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      await updateProfile({ campus: normalizedCampus, displayName: normalizedName });
      setSaved(true);
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Could not update your account.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen>
      <DetailHeader onBack={onBack} title="Account settings" />
      {status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.purple} />
        </View>
      ) : status === 'guest' || !user ? (
        <View style={styles.centered}>
          <Dishy size={80} variant="neutral" />
          <Text style={styles.stateTitle}>Sign in to manage your account</Text>
          <Text style={styles.stateBody}>Your profile details are kept with your Dish. account.</Text>
          <ActionButton onPress={onSignIn} style={styles.signIn}>Sign in</ActionButton>
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <PixelEyebrow>PROFILE</PixelEyebrow>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              accessibilityLabel="Display name"
              autoCapitalize="words"
              onChangeText={(value) => {
                setDisplayName(value);
                setSaved(false);
              }}
              onSubmitEditing={() => void save()}
              placeholder="Display name"
              placeholderTextColor={colors.disabled}
              returnKeyType="done"
              style={styles.input}
              textContentType="name"
              value={displayName}
            />

            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyField}>
              <Text selectable style={styles.readOnlyValue}>{user.email}</Text>
            </View>
            <Text style={styles.help}>Email changes are not available in this first version.</Text>

            <Text style={styles.label}>Campus or area</Text>
            <TextInput
              accessibilityLabel="Campus or area"
              autoCapitalize="words"
              onChangeText={(value) => {
                setCampus(value);
                setSaved(false);
              }}
              placeholder="For example, USYD"
              placeholderTextColor={colors.disabled}
              style={styles.input}
              value={campus}
            />

            <View style={styles.accountCard}>
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Role</Text>
                <Text style={styles.accountValue}>{friendlyValue(user.role)}</Text>
              </View>
              {user.status ? (
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Status</Text>
                  <Text style={styles.accountValue}>{friendlyValue(user.status)}</Text>
                </View>
              ) : null}
              {user.createdAt ? (
                <View style={styles.accountRow}>
                  <Text style={styles.accountLabel}>Joined</Text>
                  <Text style={styles.accountValue}>{formatDate(user.createdAt)}</Text>
                </View>
              ) : null}
            </View>

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {saved ? <Text accessibilityRole="alert" style={styles.success}>Profile updated.</Text> : null}

            <ActionButton
              disabled={saving || (
                displayName.trim() === user.displayName
                && (campus.trim() || null) === user.campus
              )}
              onPress={() => void save()}
              style={styles.save}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </ActionButton>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </DetailScreen>
  );
}

function friendlyValue(value: string) {
  return value.toLowerCase().replace(/(^|[_-])\w/g, (match) => match.replace(/[_-]/, ' ').toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 48,
    paddingHorizontal: 34,
  },
  stateTitle: {
    ...type.sectionTitle,
    color: colors.ink,
    marginTop: spacing[16],
    textAlign: 'center',
  },
  stateBody: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing[7],
    maxWidth: 320,
    textAlign: 'center',
  },
  signIn: {
    marginTop: spacing[20],
    minWidth: 150,
  },
  content: {
    paddingBottom: 48,
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[20],
  },
  label: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: spacing[7],
    marginTop: spacing[18],
  },
  input: {
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 19,
    minHeight: 51,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[12],
  },
  readOnlyField: {
    backgroundColor: colors.controlSurface,
    borderRadius: radii.button,
    minHeight: 51,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[15],
  },
  readOnlyValue: {
    color: colors.body,
    fontSize: 14.5,
    lineHeight: 19,
  },
  help: {
    ...type.caption,
    color: colors.muted,
    marginTop: spacing[6],
  },
  accountCard: {
    backgroundColor: colors.softSurface,
    borderRadius: radii.card,
    marginTop: spacing[22],
    paddingHorizontal: spacing[14],
  },
  accountRow: {
    alignItems: 'center',
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing[12],
    justifyContent: 'space-between',
    minHeight: 47,
  },
  accountLabel: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 16,
  },
  accountValue: {
    color: colors.body,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  error: {
    color: '#A33232',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: spacing[14],
  },
  success: {
    color: colors.success,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: spacing[14],
  },
  save: {
    marginTop: spacing[18],
  },
});
