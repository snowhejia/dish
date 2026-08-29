import { AuthFormScreen, type AuthFormScreenProps } from './AuthFormScreen';

export type LoginScreenProps = Omit<AuthFormScreenProps, 'mode'>;

export function LoginScreen(props: LoginScreenProps) {
  return <AuthFormScreen {...props} mode="login" />;
}
