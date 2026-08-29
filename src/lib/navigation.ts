import type { Href } from 'expo-router';

type AuthMode = 'login' | 'register';
type DynamicReturnSegment = 'compare' | 'dish' | 'map' | 'restaurant' | 'review' | 'version';

const STATIC_RETURN_PATHS = new Set([
  '/',
  '/add',
  '/catalog',
  '/profile',
  '/profile/account',
  '/profile/contributions',
  '/profile/notifications',
  '/profile/photos',
  '/profile/reviews',
  '/profile/versions',
  '/saved',
]);

const DYNAMIC_RETURN_PATH = /^\/(?:compare|dish|map|restaurant|review|version)\/[^/?#]+$/;

export function authHref(mode: AuthMode, returnTo?: string): Href {
  const pathname = mode === 'login' ? '/auth/login' : '/auth/register';
  return returnTo ? { pathname, params: { returnTo } } : pathname;
}

export function returnPath(segment: DynamicReturnSegment, value: string) {
  return `/${segment}/${encodeURIComponent(value)}`;
}

export function safeReturnHref(value: string | string[] | undefined, fallback: Href = '/profile'): Href {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  if (STATIC_RETURN_PATHS.has(candidate) || DYNAMIC_RETURN_PATH.test(candidate)) {
    return candidate as Href;
  }
  return fallback;
}
