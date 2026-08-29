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

import { PlusIcon } from '@/components/icons';
import {
  ActionButton,
  DetailHeader,
  DetailScreen,
  FoodImage,
  PixelEyebrow,
  StickyFooter,
} from '@/components/details';
import { SegmentedControl } from '@/components/tabs';
import { dishes, versions } from '@/data/mockData';
import { apiErrorMessage } from '@/lib/api';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

type SourceMode = 'existing' | 'new';

const SOURCE_OPTIONS = [
  { label: 'Choose existing', value: 'existing' },
  { label: 'Add new', value: 'new' },
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
  const firstDishId = dishes.find((dish) => dish.id === initialDishId)?.id ?? dishes[0]?.id ?? '';
  const firstRestaurant = restaurantOptions.find((restaurant) => restaurant.name === initialRestaurantName)
    ?? restaurantOptions[0];

  const [dishMode, setDishMode] = useState<SourceMode>('existing');
  const [dishId, setDishId] = useState(firstDishId);
  const [newDishName, setNewDishName] = useState('');
  const [restaurantMode, setRestaurantMode] = useState<SourceMode>(firstRestaurant ? 'existing' : 'new');
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
    if (!dishes.some((dish) => dish.id === dishId)) setDishId(dishes[0]?.id ?? '');
  }, [catalogRevision, dishId]);

  useEffect(() => {
    if (restaurantOptions.some((restaurant) => restaurant.id === restaurantId)) return;
    setRestaurantId(restaurantOptions[0]?.id ?? '');
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
            <Text style={styles.intro}>
              A version is one dish at one restaurant. Choose what already exists, or clearly add something new.
            </Text>

            <FormSection label="DISH">
              <SegmentedControl onChange={setDishMode} options={SOURCE_OPTIONS} value={dishMode} />
              {dishMode === 'existing' ? (
                <ChoiceList
                  emptyMessage="No dishes are available yet. Choose Add new."
                  items={dishes.map((dish) => ({ id: dish.id, label: dish.name, meta: dish.cuisine }))}
                  onChange={setDishId}
                  value={dishId}
                />
              ) : (
                <LabeledInput
                  label="New dish name"
                  onChangeText={setNewDishName}
                  placeholder="For example, Beef Noodle Soup"
                  value={newDishName}
                />
              )}
            </FormSection>

            <FormSection label="RESTAURANT">
              <SegmentedControl onChange={setRestaurantMode} options={SOURCE_OPTIONS} value={restaurantMode} />
              {restaurantMode === 'existing' ? (
                <ChoiceList
                  emptyMessage="The live restaurant list is unavailable. Choose Add new."
                  items={restaurantOptions.map((restaurant) => ({
                    id: restaurant.id,
                    label: restaurant.name,
                    meta: restaurant.address,
                  }))}
                  onChange={setRestaurantId}
                  value={restaurantId}
                />
              ) : (
                <View style={styles.inputGroup}>
                  <LabeledInput
                    label="New restaurant name"
                    onChangeText={setNewRestaurantName}
                    placeholder="Restaurant name"
                    value={newRestaurantName}
                  />
                  <LabeledInput
                    label="Address"
                    onChangeText={setNewRestaurantAddress}
                    placeholder="Optional, but helps us verify it"
                    value={newRestaurantAddress}
                  />
                </View>
              )}
            </FormSection>

            <FormSection label="VERSION DETAILS">
              <View style={styles.inputGroup}>
                <LabeledInput
                  label="Menu name"
                  onChangeText={setMenuName}
                  placeholder="Optional — the exact name on the menu"
                  value={menuName}
                />
                <LabeledInput
                  keyboardType="decimal-pad"
                  label="Price you paid"
                  onChangeText={setPricePaid}
                  placeholder="Optional"
                  prefix="$"
                  value={pricePaid}
                />
                <LabeledInput
                  label="Anything else?"
                  multiline
                  onChangeText={setNote}
                  placeholder="Optional note for the reviewer"
                  value={note}
                />
              </View>
            </FormSection>

            <PixelEyebrow style={styles.photoHeading}>PHOTO OF THE DISH</PixelEyebrow>
            <View style={styles.photoRow}>
              <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
                {photoUri ? (
                  <FoodImage accessibilityLabel="Selected dish photo" source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
                ) : (
                  <>
                    <PlusIcon color={colors.purple} size={20} strokeWidth={1.8} />
                    <Text style={styles.photoLabel}>Add photo</Text>
                  </>
                )}
              </Pressable>
              <View style={styles.moderationCard}>
                <Text style={styles.moderationText}>
                  Contributions are reviewed before they appear on Dish. You can follow the status in My contributions.
                </Text>
              </View>
            </View>

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

function FormSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.section}>
      <PixelEyebrow>{label}</PixelEyebrow>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function ChoiceList({
  emptyMessage,
  items,
  onChange,
  value,
}: {
  emptyMessage: string;
  items: Array<{ id: string; label: string; meta?: string }>;
  onChange: (id: string) => void;
  value: string;
}) {
  if (!items.length) return <Text style={styles.emptyChoice}>{emptyMessage}</Text>;
  return (
    <View style={styles.choiceList}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={item.id}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => [
              styles.choice,
              selected && styles.choiceSelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{item.label}</Text>
            {item.meta ? <Text numberOfLines={1} style={[styles.choiceMeta, selected && styles.choiceMetaSelected]}>{item.meta}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function LabeledInput({
  keyboardType,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  prefix,
  value,
}: {
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  prefix?: string;
  value: string;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputFrame, multiline && styles.inputFrameMultiline]}>
        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
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
    if (!version.restaurantId || byId.has(version.restaurantId)) return;
    byId.set(version.restaurantId, {
      id: version.restaurantId,
      name: version.restaurant,
      address: version.address,
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
    paddingTop: spacing[18],
  },
  intro: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19.5,
  },
  section: {
    paddingTop: spacing[22],
  },
  sectionContent: {
    gap: spacing[12],
    paddingTop: spacing[10],
  },
  choiceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  choice: {
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    maxWidth: '100%',
    minWidth: 104,
    paddingHorizontal: spacing[11],
    paddingVertical: spacing[9],
  },
  choiceSelected: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  choiceLabel: {
    color: colors.body,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  choiceLabelSelected: {
    color: colors.white,
  },
  choiceMeta: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: spacing[3],
    maxWidth: 230,
  },
  choiceMetaSelected: {
    color: 'rgba(255,255,255,0.76)',
  },
  emptyChoice: {
    backgroundColor: colors.softSurface,
    borderRadius: radii.control,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    paddingHorizontal: spacing[13],
    paddingVertical: spacing[11],
  },
  inputGroup: {
    gap: spacing[12],
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: spacing[7],
  },
  inputFrame: {
    alignItems: 'center',
    borderColor: colors.borderSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: spacing[14],
  },
  inputFrameMultiline: {
    alignItems: 'flex-start',
    minHeight: 86,
    paddingVertical: spacing[12],
  },
  inputPrefix: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 19,
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
    minHeight: 60,
  },
  photoHeading: {
    marginTop: spacing[22],
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing[10],
    marginTop: spacing[9],
  },
  photoButton: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexShrink: 0,
    gap: spacing[6],
    height: sizes.addPhoto,
    justifyContent: 'center',
    overflow: 'hidden',
    width: sizes.addPhoto,
  },
  photoLabel: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  moderationCard: {
    backgroundColor: colors.softSurface,
    borderRadius: radii.button,
    flex: 1,
    justifyContent: 'center',
    minHeight: sizes.addPhoto,
    minWidth: 0,
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[13],
  },
  moderationText: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18.75,
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
