import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { PlusIcon, SearchIcon, XIcon } from '@/components/icons';
import {
  ActionButton,
  DetailHeader,
  DetailScreen,
  FoodImage,
  PixelEyebrow,
  StickyFooter,
} from '@/components/details';
import { dishes, versions } from '@/data/mockData';
import { apiErrorMessage } from '@/lib/api';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

type SourceMode = 'existing' | 'new';

const SOURCE_OPTIONS = [
  { label: 'Existing', value: 'existing' },
  { label: 'New', value: 'new' },
] as const;

export type DishVersionContributionDraft = {
  dishId?: string;
  newDishName?: string;
  restaurantId?: string;
  newRestaurantName?: string;
  newRestaurantAddress?: string;
  menuName?: string;
  price?: number;
  note?: string;
  photo?: { uri: string; name?: string; type?: string } | File;
};

export type AddVersionScreenProps = {
  initialDishId?: string;
  initialRestaurantName?: string;
  catalogRevision?: number;
  onBack?: () => void;
  onSubmit: (draft: DishVersionContributionDraft) => Promise<void>;
  onSuccess: (draft: DishVersionContributionDraft) => void;
};

type RestaurantOption = {
  id: string;
  name: string;
  address?: string;
  cuisines: string[];
};

type SearchChoice = {
  id: string;
  label: string;
  meta?: string;
  searchText: string;
};

export function AddVersionScreen({
  initialDishId,
  initialRestaurantName,
  catalogRevision = 0,
  onBack,
  onSubmit,
  onSuccess,
}: AddVersionScreenProps) {
  const restaurantOptions = useMemo(() => collectRestaurants(), [catalogRevision]);
  const firstDishId = dishes.find((dish) => dish.id === initialDishId)?.id ?? '';
  const firstRestaurant = restaurantOptions.find((restaurant) => restaurant.name === initialRestaurantName)
    ?? undefined;

  const [dishMode, setDishMode] = useState<SourceMode>('existing');
  const [dishId, setDishId] = useState(firstDishId);
  const [newDishName, setNewDishName] = useState('');
  const [restaurantMode, setRestaurantMode] = useState<SourceMode>(restaurantOptions.length ? 'existing' : 'new');
  const [restaurantId, setRestaurantId] = useState(firstRestaurant?.id ?? '');
  const [newRestaurantName, setNewRestaurantName] = useState(firstRestaurant ? '' : initialRestaurantName ?? '');
  const [newRestaurantAddress, setNewRestaurantAddress] = useState('');
  const [menuName, setMenuName] = useState('');
  const [pricePaid, setPricePaid] = useState('');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [photo, setPhoto] = useState<{ uri: string; name?: string; type?: string } | File>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (dishId && !dishes.some((dish) => dish.id === dishId)) setDishId('');
  }, [catalogRevision, dishId]);

  useEffect(() => {
    if (!restaurantId || restaurantOptions.some((restaurant) => restaurant.id === restaurantId)) return;
    setRestaurantId('');
    if (!restaurantOptions.length) setRestaurantMode('new');
  }, [restaurantId, restaurantOptions]);

  const pickPhoto = async () => {
    setError(undefined);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        if (asset) {
          setPhotoUri(asset.uri);
          setPhoto(asset.file ?? {
            uri: asset.uri,
            name: asset.fileName ?? undefined,
            type: asset.mimeType,
          });
        }
      }
    } catch (pickError) {
      setError(apiErrorMessage(pickError, 'Could not open your photo library.'));
    }
  };

  const submit = async () => {
    if (submitting) return;
    const validation = validateDraft({
      dishId,
      dishMode,
      newDishName,
      newRestaurantName,
      pricePaid,
      restaurantId,
      restaurantMode,
    });
    if (validation.error) {
      setError(validation.error);
      return;
    }

    const draft: DishVersionContributionDraft = {
      dishId: dishMode === 'existing' ? dishId : undefined,
      newDishName: dishMode === 'new' ? newDishName.trim() : undefined,
      restaurantId: restaurantMode === 'existing' ? restaurantId : undefined,
      newRestaurantName: restaurantMode === 'new' ? newRestaurantName.trim() : undefined,
      newRestaurantAddress: restaurantMode === 'new' ? newRestaurantAddress.trim() || undefined : undefined,
      menuName: menuName.trim() || undefined,
      price: validation.price,
      note: note.trim() || undefined,
      photo,
    };

    setSubmitting(true);
    setError(undefined);
    try {
      await onSubmit(draft);
      onSuccess(draft);
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'Could not submit this dish version.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DetailScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <DetailHeader close onBack={onBack} title="Add a dish version" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <FormSection label="PHOTO">
              <Pressable
                accessibilityLabel={photoUri ? 'Change dish photo' : 'Add dish photo'}
                accessibilityRole="button"
                onPress={pickPhoto}
                style={({ pressed }) => [
                  styles.photoButton,
                  photoUri && styles.photoButtonFilled,
                  pressed && styles.pressed,
                ]}
              >
                {photoUri ? (
                  <>
                    <FoodImage
                      accessibilityLabel="Selected dish photo"
                      source={{ uri: photoUri }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.changePhotoBadge}>
                      <Text style={styles.changePhotoLabel}>Change photo</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.photoEmptyContent}>
                    <View style={styles.photoIcon}>
                      <PlusIcon color={colors.purple} size={20} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.photoLabel}>Add a dish photo</Text>
                  </View>
                )}
              </Pressable>
            </FormSection>

            <FormSection
              accessory={(
                <SourceToggle
                  onChange={(value) => {
                    setDishMode(value);
                    setError(undefined);
                  }}
                  value={dishMode}
                />
              )}
              label="DISH"
            >
              {dishMode === 'existing' ? (
                <SearchChoicePicker
                  emptyMessage="No dishes yet. Choose New."
                  items={dishes.map((dish) => ({
                    id: dish.id,
                    label: dish.name,
                    meta: [dish.cuisine, dish.dishType].filter(Boolean).join(' · '),
                    searchText: [dish.name, dish.cuisine, dish.dishType].filter(Boolean).join(' '),
                  }))}
                  noMatchesMessage="No matches. Try New."
                  onChange={setDishId}
                  placeholder="Search dishes"
                  searchLabel="Search existing dishes"
                  value={dishId}
                />
              ) : (
                <LabeledInput
                  hideLabel
                  label="Dish name"
                  onChangeText={setNewDishName}
                  placeholder="New dish name"
                  value={newDishName}
                />
              )}
            </FormSection>

            <FormSection
              accessory={(
                <SourceToggle
                  onChange={(value) => {
                    setRestaurantMode(value);
                    setError(undefined);
                  }}
                  value={restaurantMode}
                />
              )}
              label="RESTAURANT"
            >
              {restaurantMode === 'existing' ? (
                <SearchChoicePicker
                  emptyMessage="No restaurants yet. Choose New."
                  items={restaurantOptions.map((restaurant) => ({
                    id: restaurant.id,
                    label: restaurant.name,
                    meta: restaurant.address ?? restaurant.cuisines.join(' · '),
                    searchText: [restaurant.name, restaurant.address, ...restaurant.cuisines]
                      .filter(Boolean)
                      .join(' '),
                  }))}
                  noMatchesMessage="No matches. Try New."
                  onChange={setRestaurantId}
                  placeholder="Search restaurants"
                  searchLabel="Search existing restaurants"
                  value={restaurantId}
                />
              ) : (
                <View style={styles.inputGroup}>
                  <LabeledInput
                    hideLabel
                    label="Restaurant name"
                    onChangeText={setNewRestaurantName}
                    placeholder="New restaurant name"
                    value={newRestaurantName}
                  />
                  <LabeledInput
                    hideLabel
                    label="Address"
                    onChangeText={setNewRestaurantAddress}
                    placeholder="Address (optional)"
                    value={newRestaurantAddress}
                  />
                </View>
              )}
            </FormSection>

            <FormSection label="DETAILS">
              <View style={styles.inputGroup}>
                <View style={styles.detailsPair}>
                  <View style={styles.detailField}>
                    <LabeledInput
                      label="Menu name"
                      onChangeText={setMenuName}
                      placeholder="Optional"
                      value={menuName}
                    />
                  </View>
                  <View style={styles.detailField}>
                    <LabeledInput
                      keyboardType="decimal-pad"
                      label="Price ($)"
                      onChangeText={setPricePaid}
                      placeholder="0.00"
                      value={pricePaid}
                    />
                  </View>
                </View>
                <LabeledInput
                  label="Note"
                  multiline
                  onChangeText={setNote}
                  placeholder="Optional"
                  value={note}
                />
              </View>
            </FormSection>

            {error ? (
              <View accessibilityRole="alert" style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <StickyFooter>
          <ActionButton disabled={submitting} onPress={() => void submit()} style={styles.submit}>
            {submitting ? 'Submitting…' : 'Submit version'}
          </ActionButton>
        </StickyFooter>
      </KeyboardAvoidingView>
    </DetailScreen>
  );
}

function FormSection({
  accessory,
  children,
  label,
}: {
  accessory?: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, accessory ? styles.sectionHeaderWithAccessory : undefined]}>
        <PixelEyebrow>{label}</PixelEyebrow>
        {accessory}
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function SourceToggle({ onChange, value }: { onChange: (value: SourceMode) => void; value: SourceMode }) {
  return (
    <View style={styles.sourceToggle}>
      {SOURCE_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ bottom: 6, top: 6 }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.sourceOption, selected && styles.sourceOptionSelected]}
          >
            <Text style={[styles.sourceOptionLabel, !selected && styles.sourceOptionLabelInactive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SearchChoicePicker({
  emptyMessage,
  items,
  noMatchesMessage,
  onChange,
  placeholder,
  searchLabel,
  value,
}: {
  emptyMessage: string;
  items: SearchChoice[];
  noMatchesMessage: string;
  onChange: (id: string) => void;
  placeholder: string;
  searchLabel: string;
  value: string;
}) {
  const [query, setQuery] = useState('');
  const [choosing, setChoosing] = useState(!value);

  useEffect(() => {
    if (!value) setChoosing(true);
  }, [value]);

  if (!items.length) return <Text style={styles.emptyChoice}>{emptyMessage}</Text>;

  const selected = items.find((item) => item.id === value);
  if (selected && !choosing) {
    return (
      <View style={styles.selectedChoice}>
        <Text numberOfLines={1} style={styles.selectedChoiceLine}>
          <Text style={styles.selectedChoiceLabel}>{selected.label}</Text>
          {selected.meta ? <Text style={styles.selectedChoiceMeta}>  ·  {selected.meta}</Text> : null}
        </Text>
        <Pressable
          accessibilityLabel={`Change ${selected.label}`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => {
            setQuery('');
            setChoosing(true);
          }}
          style={({ pressed }) => [styles.changeChoiceButton, pressed && styles.pressed]}
        >
          <Text style={styles.changeChoiceLabel}>Change</Text>
        </Pressable>
      </View>
    );
  }

  const queryTerms = normalizeSearch(query).split(' ').filter(Boolean);
  const matches = queryTerms.length
    ? items
      .filter((item) => {
        const haystack = normalizeSearch(`${item.label} ${item.meta ?? ''} ${item.searchText}`);
        return queryTerms.every((term) => haystack.includes(term));
      })
      .slice(0, 6)
    : [];

  return (
    <View style={styles.searchChoicePicker}>
      <View style={styles.searchChoiceFrame}>
        <SearchIcon color={colors.muted} size={17} strokeWidth={1.8} />
        <TextInput
          accessibilityLabel={searchLabel}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.disabled}
          returnKeyType="search"
          style={styles.searchChoiceInput}
          value={query}
        />
        {query || selected ? (
          <Pressable
            accessibilityLabel={query ? 'Clear search' : 'Cancel change'}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              if (query) setQuery('');
              else setChoosing(false);
            }}
            style={({ pressed }) => [styles.clearSearchButton, pressed && styles.pressed]}
          >
            <XIcon color={colors.muted} size={15} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>

      {!queryTerms.length ? null : matches.length ? (
        <View accessibilityRole="radiogroup" style={styles.searchResults}>
          {matches.map((item) => {
            const isSelected = item.id === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                key={item.id}
                onPress={() => {
                  onChange(item.id);
                  setQuery('');
                  setChoosing(false);
                }}
                style={({ pressed }) => [
                  styles.searchResult,
                  isSelected && styles.searchResultSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text numberOfLines={1} style={styles.searchResultLine}>
                  <Text style={[styles.searchResultLabel, isSelected && styles.searchResultLabelSelected]}>
                    {item.label}
                  </Text>
                  {item.meta ? (
                    <Text style={[styles.searchResultMeta, isSelected && styles.searchResultMetaSelected]}>
                      {'  ·  '}{item.meta}
                    </Text>
                  ) : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyChoice}>{noMatchesMessage}</Text>
      )}

    </View>
  );
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function LabeledInput({
  hideLabel = false,
  keyboardType,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}: {
  hideLabel?: boolean;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View>
      {hideLabel ? null : <Text style={styles.fieldLabel}>{label}</Text>}
      <View style={[styles.inputFrame, multiline && styles.inputFrameMultiline]}>
        <TextInput
          accessibilityLabel={label}
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.disabled}
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
          textAlignVertical={multiline ? 'top' : 'center'}
          value={value}
        />
      </View>
    </View>
  );
}

function collectRestaurants(): RestaurantOption[] {
  const byId = new Map<string, RestaurantOption>();
  versions.forEach((version) => {
    if (!version.restaurantId) return;
    const current = byId.get(version.restaurantId);
    if (current) {
      if (!current.address && version.address) current.address = version.address;
      if (version.cuisine && !current.cuisines.includes(version.cuisine)) current.cuisines.push(version.cuisine);
      return;
    }
    byId.set(version.restaurantId, {
      id: version.restaurantId,
      name: version.restaurant,
      address: version.address,
      cuisines: version.cuisine ? [version.cuisine] : [],
    });
  });
  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function validateDraft({
  dishId,
  dishMode,
  newDishName,
  newRestaurantName,
  pricePaid,
  restaurantId,
  restaurantMode,
}: {
  dishId: string;
  dishMode: SourceMode;
  newDishName: string;
  newRestaurantName: string;
  pricePaid: string;
  restaurantId: string;
  restaurantMode: SourceMode;
}): { error?: string; price?: number } {
  if (dishMode === 'existing' && !dishId) return { error: 'Choose an existing dish.' };
  if (dishMode === 'new' && newDishName.trim().length < 2) return { error: 'Enter the new dish name.' };
  if (restaurantMode === 'existing' && !restaurantId) return { error: 'Choose an existing restaurant.' };
  if (restaurantMode === 'new' && newRestaurantName.trim().length < 2) return { error: 'Enter the new restaurant name.' };

  const normalizedPrice = pricePaid.trim();
  if (!normalizedPrice) return {};
  const price = Number(normalizedPrice);
  if (!Number.isFinite(price) || price < 0 || price > 10_000) {
    return { error: 'Enter a price between $0 and $10,000, or leave it blank.' };
  }
  return { price };
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 132,
  },
  content: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: spacing[4],
  },
  section: {
    paddingTop: spacing[14],
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderWithAccessory: {
    minHeight: 32,
  },
  sectionContent: {
    gap: spacing[10],
    paddingTop: spacing[7],
  },
  sourceToggle: {
    backgroundColor: colors.controlSurface,
    borderRadius: radii.compact,
    flexDirection: 'row',
    padding: spacing[2],
    width: 176,
  },
  sourceOption: {
    alignItems: 'center',
    borderRadius: radii.badge,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing[5],
  },
  sourceOptionSelected: {
    backgroundColor: colors.surface,
  },
  sourceOptionLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  sourceOptionLabelInactive: {
    color: colors.muted,
  },
  searchChoicePicker: {
    gap: spacing[8],
  },
  searchChoiceFrame: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[9],
    minHeight: 44,
    paddingHorizontal: spacing[12],
  },
  searchChoiceInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    minWidth: 0,
    padding: 0,
  },
  clearSearchButton: {
    alignItems: 'center',
    backgroundColor: colors.controlSurface,
    borderRadius: radii.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  searchResults: {
    borderColor: colors.borderSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchResult: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 40,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  searchResultSelected: {
    backgroundColor: colors.lavender,
  },
  searchResultLine: {
    color: colors.body,
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  searchResultLabel: {
    color: colors.body,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  searchResultLabelSelected: {
    color: colors.purpleDark,
  },
  searchResultMeta: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 17,
  },
  searchResultMetaSelected: {
    color: colors.bodySoft,
  },
  selectedChoice: {
    alignItems: 'center',
    backgroundColor: colors.lavender,
    borderColor: colors.purple,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[10],
    minHeight: 44,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  selectedChoiceLine: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  selectedChoiceLabel: {
    color: colors.titleInk,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
  },
  selectedChoiceMeta: {
    color: colors.bodySoft,
    fontSize: 11.5,
    lineHeight: 17,
  },
  changeChoiceButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
  },
  changeChoiceLabel: {
    color: colors.purple,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 15,
  },
  emptyChoice: {
    backgroundColor: colors.softSurface,
    borderRadius: radii.control,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    paddingHorizontal: spacing[13],
    paddingVertical: spacing[9],
  },
  inputGroup: {
    gap: spacing[10],
  },
  detailsPair: {
    flexDirection: 'row',
    gap: spacing[10],
  },
  detailField: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: spacing[5],
  },
  inputFrame: {
    alignItems: 'center',
    borderColor: colors.borderSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: spacing[12],
  },
  inputFrameMultiline: {
    alignItems: 'flex-start',
    minHeight: 66,
    paddingVertical: spacing[10],
  },
  fieldInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    minWidth: 0,
    padding: 0,
  },
  fieldInputMultiline: {
    minHeight: 44,
  },
  photoButton: {
    alignItems: 'center',
    aspectRatio: 16 / 9,
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  photoButtonFilled: {
    borderColor: colors.borderSoft,
    borderStyle: 'solid',
  },
  photoEmptyContent: {
    alignItems: 'center',
    gap: spacing[8],
  },
  photoIcon: {
    alignItems: 'center',
    backgroundColor: colors.controlSurface,
    borderRadius: radii.compact,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  photoLabel: {
    color: colors.purple,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  changePhotoBadge: {
    backgroundColor: 'rgba(26,26,46,0.76)',
    borderRadius: radii.pill,
    bottom: spacing[10],
    paddingHorizontal: spacing[11],
    paddingVertical: spacing[6],
    position: 'absolute',
    right: spacing[10],
  },
  changePhotoLabel: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 15,
  },
  errorCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: radii.control,
    marginTop: spacing[16],
    paddingHorizontal: spacing[13],
    paddingVertical: spacing[10],
  },
  errorText: {
    color: '#A33232',
    fontSize: 12.5,
    lineHeight: 18,
  },
  submit: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
