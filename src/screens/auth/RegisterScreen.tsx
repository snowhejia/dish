import { AuthFormScreen, type AuthFormScreenProps } from './AuthFormScreen';

export type RegisterScreenProps = Omit<AuthFormScreenProps, 'mode'>;

export function RegisterScreen(props: RegisterScreenProps) {
  return <AuthFormScreen {...props} mode="register" />;
}
