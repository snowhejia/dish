import { StyleSheet } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import type { DishVersion } from '@/data/mockData';
import { colors } from '@/theme/tokens';

import type { DishMapCanvasProps } from './DishMapCanvas';

const USYD = { latitude: -33.8886, longitude: 151.1873 };

export function DishMapCanvas({ versions, selectedId, onSelect }: DishMapCanvasProps) {
  const selected = versions.find((version) => version.id === selectedId);
  const selectedCoordinate = selected ? coordinateFor(selected, Math.max(0, versions.indexOf(selected))) : USYD;
  const initialRegion: Region = {
    ...selectedCoordinate,
    latitudeDelta: 0.065,
    longitudeDelta: 0.065,
  };

  return (
    <MapView
      initialRegion={initialRegion}
      mapType="standard"
      pitchEnabled={false}
      rotateEnabled={false}
      style={StyleSheet.absoluteFill}
      toolbarEnabled={false}
    >
      {versions.map((version, index) => (
        <Marker
          coordinate={coordinateFor(version, index)}
          description={version.menuName}
          identifier={version.id}
          key={version.id}
          onPress={() => onSelect(version.id)}
          pinColor={version.id === selectedId ? colors.purple : '#9181E8'}
          title={version.restaurant}
          tracksViewChanges={false}
        />
      ))}
    </MapView>
  );
}

function coordinateFor(version: DishVersion, index: number) {
  if (version.latitude != null && version.longitude != null) {
    return { latitude: version.latitude, longitude: version.longitude };
  }
  // Until an admin supplies coordinates, spread legacy venues around campus
  // so markers remain individually selectable instead of overlapping.
  const angle = index * 2.399963;
  const radius = 0.004 + (index % 5) * 0.0025;
  return {
    latitude: USYD.latitude + Math.sin(angle) * radius,
    longitude: USYD.longitude + Math.cos(angle) * radius,
  };
}
