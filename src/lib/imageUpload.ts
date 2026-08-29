import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

export type ImageUpload = { uri: string; name?: string; type?: string } | File | null;

export async function appendImageUpload(
  form: FormData,
  fieldName: string,
  upload: ImageUpload | undefined,
  filePrefix: string,
) {
  if (!upload) return;
  if (typeof File !== 'undefined' && upload instanceof File) {
    form.append(fieldName, upload);
    return;
  }

  const selected = upload as Exclude<ImageUpload, File | null>;
  const name = selected.name ?? `${filePrefix}-${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    const response = await fetch(selected.uri);
    if (!response.ok) throw new Error('Could not prepare the selected photo for upload.');
    form.append(fieldName, await response.blob(), name);
    return;
  }

  const file = new ExpoFile(selected.uri);
  form.append(fieldName, {
    name,
    type: selected.type || file.type || 'image/jpeg',
    bytes: () => file.bytes(),
  } as unknown as Blob);
}
