import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

export type AuthFormScreenProps = {
  mode: 'login' | 'register';
  onBack: () => void;
  onAuthenticated: () => void;
  onSwitchMode: () => void;
};

export function AuthFormScreen({ mode, onAuthenticated, onBack, onSwitchMode }: AuthFormScreenProps) {
  const { login, register } = useAuth();
  const registering = mode === 'register';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    const validationError = validate({ confirmation, displayName, email: normalizedEmail, password, registering });
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(undefined);
    setSubmitting(true);
    try {
      if (registering) {
        await register({ displayName: displayName.trim(), email: normalizedEmail, password });
      } else {
        await login({ email: normalizedEmail, password });
      }
      onAuthenticated();
    } catch (submitError) {
      setError(apiErrorMessage(submitError, registering ? 'Could not create your account.' : 'Could not sign you in.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DetailScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <DetailHeader close onBack={onBack} title={registering ? 'Create account' : 'Sign in'} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Dishy size={82} variant={registering ? 'happy' : 'neutral'} />
            <PixelEyebrow purple style={styles.eyebrow}>{registering ? 'JOIN DISH.' : 'WELCOME BACK'}</PixelEyebrow>
            <Text style={styles.title}>{registering ? 'Keep every good dish in one place' : 'Pick up your food trail'}</Text>
            <Text style={styles.body}>
              {registering
                ? 'Create an account to save versions, post reviews and follow your contributions.'
                : 'Sign in to see your saved food, reviews and contribution status.'}
            </Text>
          </View>

          <View style={styles.form}>
            {registering ? (
              <AuthField
                autoCapitalize="words"
                label="Display name"
                onChangeText={setDisplayName}
                placeholder="What should we call you?"
                textContentType="name"
                value={displayName}
              />
            ) : null}
            <AuthField
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              placeholder="you@example.com"
              textContentType="emailAddress"
              value={email}
            />
            <AuthField
              autoCapitalize="none"
              label="Password"
              onChangeText={setPassword}
              onSubmitEditing={registering ? undefined : () => void submit()}
              placeholder="At least 8 characters"
              secureTextEntry
              textContentType={registering ? 'newPassword' : 'password'}
              value={password}
            />
            {registering ? (
              <AuthField
                autoCapitalize="none"
                label="Confirm password"
                onChangeText={setConfirmation}
                onSubmitEditing={() => void submit()}
                placeholder="Type it again"
                secureTextEntry
                textContentType="newPassword"
                value={confirmation}
              />
            ) : null}

            {error ? (
              <View accessibilityRole="alert" style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <ActionButton disabled={submitting} onPress={() => void submit()} style={styles.submit}>
              {submitting ? (registering ? 'Creating account…' : 'Signing in…') : (registering ? 'Create account' : 'Sign in')}
            </ActionButton>

            <Pressable accessibilityRole="button" disabled={submitting} onPress={onSwitchMode} style={styles.switchButton}>
              <Text style={styles.switchText}>
                {registering ? 'Already have an account? ' : 'New to Dish.? '}
                <Text style={styles.switchLink}>{registering ? 'Sign in' : 'Create one'}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </DetailScreen>
  );
}

type AuthFieldProps = Pick<React.ComponentProps<typeof TextInput>,
  | 'autoCapitalize'
  | 'keyboardType'
  | 'onChangeText'
  | 'onSubmitEditing'
  | 'placeholder'
  | 'secureTextEntry'
  | 'textContentType'
  | 'value'
> & {
  label: string;
};

function AuthField({ label, ...props }: AuthFieldProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.disabled}
        returnKeyType={props.onSubmitEditing ? 'done' : 'next'}
        style={styles.input}
      />
    </View>
  );
}

function validate({
  confirmation,
  displayName,
  email,
  password,
  registering,
}: {
  confirmation: string;
  displayName: string;
  email: string;
  password: string;
  registering: boolean;
}) {
  if (registering && displayName.trim().length < 2) return 'Enter a display name with at least 2 characters.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return 'Enter a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (registering && password !== confirmation) return 'Passwords do not match.';
  return undefined;
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 38,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: spacing[20],
  },
  eyebrow: {
    marginTop: spacing[14],
  },
  title: {
    ...type.title,
    color: colors.ink,
    marginTop: spacing[8],
    textAlign: 'center',
  },
  body: {
    ...type.body,
    color: colors.muted,
    marginTop: spacing[7],
    maxWidth: 340,
    textAlign: 'center',
  },
  form: {
    gap: spacing[14],
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[24],
  },
  label: {
    color: colors.body,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: spacing[7],
  },
  input: {
    backgroundColor: colors.surface,
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
  errorCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: radii.control,
    paddingHorizontal: spacing[13],
    paddingVertical: spacing[11],
  },
  errorText: {
    color: '#A33232',
    fontSize: 12.5,
    lineHeight: 18,
  },
  submit: {
    marginTop: spacing[4],
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: spacing[8],
  },
  switchText: {
    color: colors.muted,
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: 'center',
  },
  switchLink: {
    color: colors.purple,
    fontWeight: '700',
  },
});
