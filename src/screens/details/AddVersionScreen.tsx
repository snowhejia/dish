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
import * as ImagePicker from 'expo-image-picker';

import { ChevronDownIcon, PlusIcon } from '@/components/icons';
import {
  ActionButton,
  DetailHeader,
  DetailScreen,
  FoodImage,
  StickyFooter,
} from '@/components/details';
import { dishes, dishById, restaurants } from '@/data/mockData';
import { colors, radii, sizes } from '@/theme/tokens';

export type DishVersionContributionDraft = {
  dishId: string;
  restaurantName?: string;
  pricePaid?: number;
  wouldEatAgain: 'YES' | 'NO';
  photoUri?: string;
};

export type AddVersionScreenProps = {
  initialDishId?: string;
  initialRestaurantName?: string;
  onBack?: () => void;
  onDishChange?: (dishId: string) => void;
  onRestaurantChange?: (restaurantName: string) => void;
  onSubmit?: (draft: DishVersionContributionDraft) => void | Promise<void>;
  onSuccess?: (draft: DishVersionContributionDraft) => void;
};

export function AddVersionScreen({
  initialDishId = 'beef',
  initialRestaurantName,
  onBack,
  onDishChange,
  onRestaurantChange,
  onSubmit,
  onSuccess,
}: AddVersionScreenProps) {
  const initialDish = dishById(initialDishId);
  const [dishId, setDishId] = useState(initialDish.id);
  const [restaurantName, setRestaurantName] = useState(initialRestaurantName);
  const [pricePaid, setPricePaid] = useState('');
  const [wouldEatAgain, setWouldEatAgain] = useState<'YES' | 'NO'>('YES');
  const [photoUri, setPhotoUri] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const dish = dishById(dishId);

  const cycleDish = () => {
    const current = dishes.findIndex((item) => item.id === dishId);
    const next = dishes[(current + 1) % dishes.length] ?? dishes[0];
    if (!next) return;
    setDishId(next.id);
    onDishChange?.(next.id);
  };

  const cycleRestaurant = () => {
    const current = restaurantName ? restaurants.indexOf(restaurantName) : -1;
    const next = restaurants[(current + 1) % restaurants.length];
    if (!next) return;
    setRestaurantName(next);
    onRestaurantChange?.(next);
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri);
  };

  const submit = async () => {
    if (submitting) return;
    const parsedPrice = Number.parseFloat(pricePaid);
    const draft: DishVersionContributionDraft = {
      dishId: dish.id,
      restaurantName,
      pricePaid: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
      wouldEatAgain,
      photoUri,
    };
    setSubmitting(true);
    try {
      await onSubmit?.(draft);
      onSuccess?.(draft);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DetailScreen>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <DetailHeader title="Add a dish version" close onBack={onBack} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.content}>
            <Text style={styles.intro}>
              A version is one dish at one restaurant. Pick the dish, tell us where you had it.
            </Text>

            <View style={styles.fields}>
              <SelectField label="Dish" value={dish.name} onPress={cycleDish} />
              <SelectField
                label="Restaurant"
                value={restaurantName ?? 'Search for a place...'}
                placeholder={!restaurantName}
                onPress={cycleRestaurant}
              />
              <View>
                <Text style={styles.fieldLabel}>Price you paid</Text>
                <View style={styles.fieldControl}>
                  <View style={styles.priceRow}>
                    {pricePaid ? <Text style={styles.dollar}>$</Text> : null}
                    <TextInput
                      value={pricePaid}
                      onChangeText={setPricePaid}
                      keyboardType="decimal-pad"
                      placeholder="Optional"
                      placeholderTextColor={colors.disabled}
                      style={styles.fieldInput}
                      accessibilityLabel="Price you paid"
                    />
                  </View>
                  <ChevronDownIcon size={12} color={colors.iconMuted} strokeWidth={1.8} />
                </View>
              </View>
              <SelectField
                label="Would you eat it again?"
                value={wouldEatAgain === 'YES' ? 'Yes' : 'No'}
                onPress={() => setWouldEatAgain((current) => current === 'YES' ? 'NO' : 'YES')}
              />
            </View>

            <Text style={styles.photoHeading}>Photo of the dish</Text>
            <View style={styles.photoRow}>
              <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
                {photoUri ? (
                  <FoodImage source={{ uri: photoUri }} style={StyleSheet.absoluteFill} accessibilityLabel="Selected dish photo" />
                ) : (
                  <>
                    <PlusIcon size={20} color={colors.purple} strokeWidth={1.8} />
                    <Text style={styles.photoLabel}>Add photo</Text>
                  </>
                )}
              </Pressable>
              <View style={styles.moderationCard}>
                <Text style={styles.moderationText}>
                  Contributions are reviewed before they appear on Dish. You will see the status in your profile.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <StickyFooter>
          <ActionButton disabled={submitting} style={styles.submit} onPress={() => void submit()}>
            {submitting ? 'Submitting…' : 'Submit version'}
          </ActionButton>
        </StickyFooter>
      </KeyboardAvoidingView>
    </DetailScreen>
  );
}

function SelectField({
  label,
  value,
  placeholder = false,
  onPress,
}: {
  label: string;
  value: string;
  placeholder?: boolean;
  onPress: () => void;
}) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.fieldControl, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={[styles.fieldValue, placeholder && styles.placeholder]}>{value}</Text>
        <ChevronDownIcon size={12} color={colors.iconMuted} strokeWidth={1.8} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 130,
  },
  content: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 20,
  },
  intro: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19.5,
  },
  fields: {
    gap: 12,
    marginTop: 18,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    marginBottom: 7,
  },
  fieldControl: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  fieldValue: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  placeholder: {
    color: colors.disabled,
  },
  priceRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollar: {
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '500',
  },
  photoHeading: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 7,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    width: sizes.addPhoto,
    height: sizes.addPhoto,
    flexShrink: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
  },
  photoLabel: {
    color: colors.purple,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  moderationCard: {
    flex: 1,
    minWidth: 0,
    minHeight: sizes.addPhoto,
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: radii.button,
    backgroundColor: colors.softSurface,
  },
  moderationText: {
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18.75,
  },
  submit: {
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
