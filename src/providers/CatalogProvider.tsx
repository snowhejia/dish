import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';

import { foodImages } from '@/data/images';
import {
  dishes as bundledDishes,
  installCatalogSnapshot,
  reviewsByVersion as bundledReviewsByVersion,
  versions as bundledVersions,
  type CatalogSnapshot,
} from '@/data/mockData';
import { API_BASE_URL, api, apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';

type SavedResponse = {
  dishes?: string[];
  versions?: string[];
  savedDishes?: string[];
  savedVersions?: string[];
};

type UploadPhoto = { uri: string; name?: string; type?: string } | File | null;

export type ReviewSubmission = {
  versionId: string;
  yes: boolean;
  text?: string;
  pricePaid?: number;
  photo?: UploadPhoto;
};

export type ContributionSubmission = {
  dishId?: string;
  newDishName?: string;
  restaurantId?: string;
  newRestaurantName?: string;
  newRestaurantAddress?: string;
  menuName?: string;
  price?: number;
  note?: string;
  photo?: UploadPhoto;
};

type CatalogContextValue = {
  snapshot: CatalogSnapshot;
  revision: number;
  loading: boolean;
  error: string | null;
  savedLoading: boolean;
  savedError: string | null;
  savedDishIds: ReadonlySet<string>;
  savedVersionIds: ReadonlySet<string>;
  refreshCatalog: () => Promise<void>;
  refreshSaved: () => Promise<void>;
  isSaved: (kind: 'dish' | 'version', id: string) => boolean;
  toggleSaved: (kind: 'dish' | 'version', id: string) => Promise<boolean>;
  submitReview: (input: ReviewSubmission) => Promise<void>;
  submitContribution: (input: ContributionSubmission) => Promise<{ id?: string; status?: string }>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, refreshUser, user } = useAuth();
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(() => ({
    dishes: [...bundledDishes],
    versions: [...bundledVersions],
    reviewsByVersion: { ...bundledReviewsByVersion },
  }));
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(Boolean(API_BASE_URL));
  const [error, setError] = useState<string | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [savedDishIds, setSavedDishIds] = useState<ReadonlySet<string>>(new Set());
  const [savedVersionIds, setSavedVersionIds] = useState<ReadonlySet<string>>(new Set());
  const savedRequestRevision = useRef(0);

  const refreshCatalog = useCallback(async () => {
    if (!API_BASE_URL) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = unwrap<unknown>(await api.get<unknown>('/api/v1/catalog', { authenticated: false }));
      const nextSnapshot = normalizeCatalogSnapshot(response);
      installCatalogSnapshot(nextSnapshot);
      nextSnapshot.versions.forEach((version) => {
        if (version.imageUrl) foodImages[version.id] = { uri: version.imageUrl };
      });
      setSnapshot(nextSnapshot);
      setRevision((value) => value + 1);
      setError(null);
    } catch (requestError) {
      // The bundled dataset deliberately remains usable when Railway is offline.
      setError(apiErrorMessage(requestError, 'Live data is temporarily unavailable.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSaved = useCallback(async () => {
    const requestRevision = savedRequestRevision.current + 1;
    savedRequestRevision.current = requestRevision;
    if (!isAuthenticated) {
      setSavedDishIds(new Set());
      setSavedVersionIds(new Set());
      setSavedError(null);
      setSavedLoading(false);
      return;
    }
    setSavedLoading(true);
    setSavedError(null);
    try {
      const response = unwrap<SavedResponse>(await api.get<unknown>('/api/v1/me/saved'));
      if (savedRequestRevision.current !== requestRevision) return;
      setSavedDishIds(new Set(stringArray(response.dishes ?? response.savedDishes)));
      setSavedVersionIds(new Set(stringArray(response.versions ?? response.savedVersions)));
    } catch (requestError) {
      if (savedRequestRevision.current === requestRevision) {
        setSavedError(apiErrorMessage(requestError, 'Saved items are temporarily unavailable.'));
      }
      throw requestError;
    } finally {
      if (savedRequestRevision.current === requestRevision) setSavedLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    // Do not show one account's saves while another account is loading.
    setSavedDishIds(new Set());
    setSavedVersionIds(new Set());
    void refreshSaved().catch(() => undefined);
  }, [refreshSaved, user?.id]);

  const isSaved = useCallback((kind: 'dish' | 'version', id: string) => (
    kind === 'dish' ? savedDishIds.has(id) : savedVersionIds.has(id)
  ), [savedDishIds, savedVersionIds]);

  const toggleSaved = useCallback(async (kind: 'dish' | 'version', id: string) => {
    if (!isAuthenticated) throw new Error('Sign in to save dishes and versions.');
    const current = kind === 'dish' ? savedDishIds : savedVersionIds;
    const setCurrent = kind === 'dish' ? setSavedDishIds : setSavedVersionIds;
    const nextSaved = !current.has(id);
    const next = new Set(current);
    if (nextSaved) next.add(id); else next.delete(id);
    setCurrent(next);

    const plural = kind === 'dish' ? 'dishes' : 'versions';
    try {
      setSavedError(null);
      if (nextSaved) await api.put(`/api/v1/me/saved/${plural}/${encodeURIComponent(id)}`);
      else await api.delete(`/api/v1/me/saved/${plural}/${encodeURIComponent(id)}`);
      return nextSaved;
    } catch (requestError) {
      setCurrent(current);
      throw requestError;
    }
  }, [isAuthenticated, savedDishIds, savedVersionIds]);

  const submitReview = useCallback(async (input: ReviewSubmission) => {
    if (!isAuthenticated) throw new Error('Sign in to post a review.');
    const form = new FormData();
    form.append('wouldEatAgain', String(input.yes));
    if (input.text?.trim()) form.append('text', input.text.trim());
    if (input.pricePaid !== undefined) form.append('pricePaid', String(input.pricePaid));
    await appendPhoto(form, input.photo);
    await api.post(`/api/v1/versions/${encodeURIComponent(input.versionId)}/reviews`, form);
    await Promise.all([refreshCatalog(), refreshUser()]);
  }, [isAuthenticated, refreshCatalog, refreshUser]);

  const submitContribution = useCallback(async (input: ContributionSubmission) => {
    if (!isAuthenticated) throw new Error('Sign in to add a dish version.');
    const form = new FormData();
    appendOptional(form, 'dishId', input.dishId);
    appendOptional(form, 'newDishName', input.newDishName);
    appendOptional(form, 'restaurantId', input.restaurantId);
    appendOptional(form, 'newRestaurantName', input.newRestaurantName);
    appendOptional(form, 'newRestaurantAddress', input.newRestaurantAddress);
    appendOptional(form, 'menuName', input.menuName);
    appendOptional(form, 'price', input.price);
    appendOptional(form, 'note', input.note);
    await appendPhoto(form, input.photo);
    const result = unwrap<{ id?: string; status?: string }>(await api.post('/api/v1/contributions', form));
    await refreshUser();
    return result;
  }, [isAuthenticated, refreshUser]);

  const value = useMemo<CatalogContextValue>(() => ({
    snapshot,
    revision,
    loading,
    error,
    savedLoading,
    savedError,
    savedDishIds,
    savedVersionIds,
    refreshCatalog,
    refreshSaved,
    isSaved,
    toggleSaved,
    submitReview,
    submitContribution,
  }), [
    error,
    isSaved,
    loading,
    refreshCatalog,
    refreshSaved,
    revision,
    savedDishIds,
    savedError,
    savedLoading,
    savedVersionIds,
    snapshot,
    submitContribution,
    submitReview,
    toggleSaved,
  ]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog must be used inside CatalogProvider.');
  return value;
}

function unwrap<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

function appendOptional(form: FormData, key: string, value: string | number | undefined) {
  if (value !== undefined && String(value).trim()) form.append(key, String(value));
}

async function appendPhoto(form: FormData, photo: UploadPhoto | undefined) {
  if (!photo) return;
  if (typeof File !== 'undefined' && photo instanceof File) {
    form.append('photo', photo);
    return;
  }
  const upload = photo as Exclude<UploadPhoto, File | null>;
  const name = upload.name ?? `dish-${Date.now()}.jpg`;
  const type = upload.type;

  if (Platform.OS === 'web') {
    const response = await fetch(upload.uri);
    if (!response.ok) throw new Error('Could not prepare the selected photo for upload.');
    form.append('photo', await response.blob(), name);
    return;
  }

  const file = new ExpoFile(upload.uri);
  form.append('photo', {
    name,
    type: type || file.type || 'image/jpeg',
    bytes: () => file.bytes(),
  } as unknown as Blob);
}

function normalizeCatalogSnapshot(value: unknown): CatalogSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('The live catalog returned an invalid response.');
  }
  const candidate = value as Partial<CatalogSnapshot>;
  if (!Array.isArray(candidate.dishes) || !Array.isArray(candidate.versions)) {
    throw new Error('The live catalog returned an invalid response.');
  }
  return {
    dishes: candidate.dishes,
    versions: candidate.versions,
    reviewsByVersion: isRecord(candidate.reviewsByVersion) ? candidate.reviewsByVersion : {},
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function isRecord(value: unknown): value is NonNullable<CatalogSnapshot['reviewsByVersion']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(Array.isArray);
}
