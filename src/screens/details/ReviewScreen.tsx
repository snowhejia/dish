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

import { Dishy } from '@/components/brand';
import { CheckIcon, PencilIcon, PlusIcon, XIcon } from '@/components/icons';
import {
  ActionButton,
  CatalogEntityState,
  DetailHeader,
  DetailScreen,
  FoodImage,
  PixelEyebrow,
  StickyFooter,
} from '@/components/details';
import { fallbackFoodImage, foodImages } from '@/data/images';
import { versionById, versionMenuName } from '@/data/mockData';
import { apiErrorMessage } from '@/lib/api';
import { useCatalog } from '@/providers/CatalogProvider';
import { colors, radii, sizes } from '@/theme/tokens';

export type ReviewVerdict = 'YES' | 'NO';

export type ReviewSubmission = {
  versionId: string;
  verdict: ReviewVerdict;
  text?: string;
  photo?: { uri: string; name?: string; type?: string } | File;
  pricePaid?: number;
};

export type ReviewScreenProps = {
  versionId?: string;
  onBack?: () => void;
  onPostReview?: (submission: ReviewSubmission) => void | Promise<void>;
};

export function ReviewScreen({
  versionId,
  onBack,
  onPostReview,
}: ReviewScreenProps) {
  const { error: catalogError, loading, refreshCatalog } = useCatalog();
  const version = versionById(versionId);
  const [verdict, setVerdict] = useState<ReviewVerdict>();
  const [reviewText, setReviewText] = useState('');
  const [pricePaid, setPricePaid] = useState(() => version?.price.toFixed(2) ?? '');
  const [photoUri, setPhotoUri] = useState<string>();
  const [photo, setPhoto] = useState<{ uri: string; name?: string; type?: string } | File>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

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
    if (!version || !verdict || submitting) return;
    const normalizedPrice = pricePaid.trim();
    const parsedPrice = normalizedPrice ? Number(normalizedPrice) : undefined;
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 10_000)) {
      setError('Enter a price between $0 and $10,000, or leave it blank.');
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      if (!onPostReview) throw new Error('Review submission is not available.');
      await onPostReview({
        versionId: version.id,
        verdict,
        text: reviewText.trim() || undefined,
        photo,
        pricePaid: parsedPrice,
      });
    } catch (submitError) {
      setError(apiErrorMessage(submitError, 'Could not post your review.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!version) {
    return (
      <CatalogEntityState
        entity="dish version"
        error={catalogError}
        loading={loading}
        onBack={onBack}
        onRetry={() => void refreshCatalog()}
      />
    );
  }

  return (
    <DetailScreen>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <DetailHeader title="Review this version" close onBack={onBack} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.versionSummary}>
            <View style={styles.summaryPhoto}>
              <FoodImage source={foodImages[version.id] ?? fallbackFoodImage} style={StyleSheet.absoluteFill} accessibilityLabel={versionMenuName(version)} />
            </View>
            <View style={styles.summaryCopy}>
              <Text numberOfLines={1} style={styles.dishName}>{versionMenuName(version)}</Text>
              <Text numberOfLines={1} style={styles.restaurant}>{version.restaurant}</Text>
            </View>
          </View>

          <View style={styles.verdictSection}>
            <View style={styles.mascot}><Dishy variant="review" size={54} /></View>
            <Text style={styles.question}>Would you eat it again?</Text>
            <View style={styles.choices}>
              <VerdictChoice
                label="Yes"
                selected={verdict === 'YES'}
                onPress={() => setVerdict('YES')}
                icon={<CheckIcon size={26} color={verdict === 'YES' ? colors.purpleDark : colors.inactive} strokeWidth={2} />}
                yes
              />
              <VerdictChoice
                label="No"
                selected={verdict === 'NO'}
                onPress={() => setVerdict('NO')}
                icon={<XIcon size={26} color={verdict === 'NO' ? colors.body : colors.inactive} strokeWidth={2} />}
              />
            </View>
          </View>

          <View style={styles.optionalSection}>
            <View style={styles.optionalHeading}>
              <PixelEyebrow>EVERYTHING ELSE</PixelEyebrow>
              <Text style={styles.optional}>optional</Text>
            </View>
            <TextInput
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              textAlignVertical="top"
              placeholder="Say a little about it..."
              placeholderTextColor={colors.disabled}
              style={styles.reviewInput}
            />
            <View style={styles.extraRow}>
              <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
                {photoUri ? (
                  <FoodImage source={{ uri: photoUri }} style={StyleSheet.absoluteFill} accessibilityLabel="Selected review photo" />
                ) : (
                  <>
                    <PlusIcon size={18} color={colors.purple} strokeWidth={1.8} />
                    <Text style={styles.photoLabel}>Photo</Text>
                  </>
                )}
              </Pressable>
              <View style={styles.priceCard}>
                <View style={styles.priceCopy}>
                  <Text style={styles.priceLabel}>Price you paid</Text>
                  <View style={styles.priceInputRow}>
                    <Text style={styles.dollar}>$</Text>
                    <TextInput
                      value={pricePaid}
                      onChangeText={setPricePaid}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      style={styles.priceInput}
                      accessibilityLabel="Price you paid"
                    />
                  </View>
                </View>
                <PencilIcon size={16} color={colors.iconMuted} strokeWidth={1.8} />
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
          <ActionButton
            disabled={!verdict || submitting}
            style={[styles.submit, !verdict && styles.submitDisabled]}
            textStyle={!verdict && styles.submitTextDisabled}
            onPress={() => void submit()}
          >
            {submitting ? 'Posting…' : verdict ? 'Post review' : 'Answer to continue'}
          </ActionButton>
        </StickyFooter>
      </KeyboardAvoidingView>
    </DetailScreen>
  );
}

function VerdictChoice({
  label,
  selected,
  onPress,
  icon,
  yes = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  yes?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && (yes ? styles.choiceYes : styles.choiceNo),
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.choiceLabel, selected && (yes ? styles.choiceLabelYes : styles.choiceLabelNo)]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 130,
  },
  versionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 20,
  },
  summaryPhoto: {
    width: 56,
    height: 56,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: radii.control,
    backgroundColor: colors.imageSurface,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  dishName: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  restaurant: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  verdictSection: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 26,
  },
  mascot: {
    alignItems: 'center',
    height: 49,
    overflow: 'hidden',
    marginBottom: 7,
  },
  question: {
    color: colors.ink,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  choices: {
    flexDirection: 'row',
    gap: 11,
    marginTop: 18,
  },
  choice: {
    flex: 1,
    minHeight: 103,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.choice,
    backgroundColor: colors.surface,
  },
  choiceYes: {
    borderColor: colors.purple,
    backgroundColor: '#EFECFC',
  },
  choiceNo: {
    borderColor: colors.disabled,
    backgroundColor: '#F3F2F7',
  },
  choiceLabel: {
    color: colors.ink,
    fontSize: 15.5,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 6,
  },
  choiceLabelYes: {
    color: colors.purpleDark,
  },
  choiceLabelNo: {
    color: colors.body,
  },
  optionalSection: {
    paddingHorizontal: sizes.pageGutter,
    paddingTop: 26,
  },
  optionalHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optional: {
    color: colors.disabled,
    fontSize: 11.5,
    lineHeight: 15,
  },
  reviewInput: {
    minHeight: 88,
    marginTop: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 15,
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 20,
  },
  extraRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  photoButton: {
    width: 76,
    height: 76,
    flexShrink: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radii.button,
  },
  photoLabel: {
    color: colors.purple,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '600',
  },
  priceCard: {
    flex: 1,
    minWidth: 0,
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.button,
  },
  priceCopy: {
    flex: 1,
    minWidth: 0,
  },
  priceLabel: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 15,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  dollar: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  priceInput: {
    flex: 1,
    minWidth: 30,
    padding: 0,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  submit: {
    flex: 1,
  },
  errorCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: radii.control,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  errorText: {
    color: '#A33232',
    fontSize: 12.5,
    lineHeight: 18,
  },
  submitDisabled: {
    backgroundColor: colors.disabledSurface,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitTextDisabled: {
    color: colors.disabled,
  },
  pressed: {
    opacity: 0.72,
  },
});
