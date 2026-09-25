import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  APIProvider,
  Map,
  MapCameraChangedEvent,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n';

export type PickedLocation = {
  name: string;
  address: string;
  lat: number;
  lng: number;
};

type LocationPickerProps = {
  value: PickedLocation;
  onChange: (location: PickedLocation) => void;
};

const DEFAULT_CENTER = {
  lat: 38.7223,
  lng: -9.1393,
};

// Tema escuro para o mapa quando o Map ID não tiver um estilo próprio
// configurado na Cloud Console (nesse caso `styles` é ignorado a favor do
// estilo da consola, por isso mantemos as duas vias).
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#141315' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8f8b85' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3a3639' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1c1a1d' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b6862' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d120e' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#5a6b5a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1a1d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111012' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8f8b85' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2730' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1c1a1d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#08313f' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5a7a8a' }] },
];

// O primeiro address_component do Google é normalmente o número da porta
// (ex: "64"), que não serve de nome. Escolhemos algo com significado:
// nome do sítio > rua + número > freguesia > cidade.
type GeocoderAddressComponent = { long_name: string; types: string[] };

function pickLocationName(result?: {
  address_components?: GeocoderAddressComponent[];
}): string | undefined {
  const comps = result?.address_components ?? [];
  const byType = (type: string) =>
    comps.find((c: GeocoderAddressComponent) => c.types.includes(type))?.long_name;

  const route = byType('route');
  const number = byType('street_number');

  return (
    byType('establishment') ??
    byType('point_of_interest') ??
    byType('premise') ??
    (route ? (number ? `${route} ${number}` : route) : undefined) ??
    byType('sublocality') ??
    byType('locality')
  );
}

// Pin laranja igual ao usado no mini-mapa do ecrã de atividade: quadrado
// rodado 45º com o canto inferior direito reto. O ícone lá dentro é
// contra-rodado para ficar direito.
function MapPin() {
  return (
    <View style={styles.pin}>
      <View style={styles.pinIconWrap}>
        <Ionicons name="location" size={16} color="#1a1005" />
      </View>
    </View>
  );
}

function LocationPickerMap({ value, onChange }: LocationPickerProps) {
  const { t } = useTranslation();
  const map = useMap();
  const geocodingLibrary = useMapsLibrary('geocoding');
  const geocoder = geocodingLibrary ? new geocodingLibrary.Geocoder() : null;
  const [query, setQuery] = useState(value.address || '');
  const [locating, setLocating] = useState(false);
  const didAutoLocate = useRef(false);

  // Ao abrir o mapa sem nenhum local ainda escolhido, tenta centrar na
  // localização atual do utilizador em vez de ficar sempre em Lisboa.
  useEffect(() => {
    if (didAutoLocate.current || !geocoder || !map) return;
    if (value.address) {
      didAutoLocate.current = true;
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      didAutoLocate.current = true;
      return;
    }

    didAutoLocate.current = true;
    queueMicrotask(() => setLocating(true));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.panTo({ lat: latitude, lng: longitude });
        map.setZoom(15);
        reverseGeocode(latitude, longitude).finally(() => setLocating(false));
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocoder, map]);

  async function reverseGeocode(lat: number, lng: number) {
    if (!geocoder) return;

    const result = await geocoder.geocode({
      location: { lat, lng },
    });

    const firstResult = result.results[0];

    onChange({
      // Sem nome de referência (comum fora de Portugal, onde o Google tem
      // menos detalhe), mostra a morada em vez de um texto genérico.
      name: pickLocationName(firstResult) || firstResult?.formatted_address || t('activity.locationPicker.defaultName'),
      address: firstResult?.formatted_address || `${lat}, ${lng}`,
      lat,
      lng,
    });

    setQuery(firstResult?.formatted_address || '');
  }

  async function searchAddress() {
    if (!geocoder || !query.trim()) return;

    const result = await geocoder.geocode({
      address: query,
    });

    const firstResult = result.results[0];

    if (!firstResult) return;

    const lat = firstResult.geometry.location.lat();
    const lng = firstResult.geometry.location.lng();

    map?.panTo({ lat, lng });
    map?.setZoom(15);

    onChange({
      name: pickLocationName(firstResult) || query,
      address: firstResult.formatted_address,
      lat,
      lng,
    });

    setQuery(firstResult.formatted_address);
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#8f8b85" style={{ marginLeft: 4 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('activity.locationPicker.searchPlaceholder')}
          placeholderTextColor="#8f8b85"
          style={styles.input}
          onSubmitEditing={searchAddress}
        />
        <Pressable onPress={searchAddress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <ThemedText style={styles.buttonText}>{t('activity.locationPicker.searchButton')}</ThemedText>
        </Pressable>
      </View>

      <View style={styles.mapCard}>
        <Map
          style={styles.map}
          defaultCenter={{
            lat: value.lat || DEFAULT_CENTER.lat,
            lng: value.lng || DEFAULT_CENTER.lng,
          }}
          defaultZoom={13}
          mapId={process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_MAP_ID}
          colorScheme="DARK"
          styles={DARK_MAP_STYLE}
          gestureHandling="greedy"
          disableDefaultUI
          onCameraChanged={(_event: MapCameraChangedEvent) => {}}
          onClick={(event) => {
            const lat = event.detail.latLng?.lat;
            const lng = event.detail.latLng?.lng;

            if (typeof lat === 'number' && typeof lng === 'number') {
              reverseGeocode(lat, lng);
            }
          }}>
          <AdvancedMarker
            position={{
              lat: value.lat || DEFAULT_CENTER.lat,
              lng: value.lng || DEFAULT_CENTER.lng,
            }}>
            <MapPin />
          </AdvancedMarker>
        </Map>
      </View>

      <View style={styles.selectedBox}>
        <Ionicons name="location-outline" size={18} color="#e8823f" />
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.selectedTitle}>{t('activity.locationPicker.defaultName')}</ThemedText>
          <ThemedText style={styles.selectedAddress}>
            {locating
              ? t('activity.locationPicker.locating')
              : value.address || t('activity.locationPicker.noSelection')}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

export default function LocationPicker(props: LocationPickerProps) {
  const { t } = useTranslation();
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;

  if (!apiKey) {
    return (
      <View style={styles.selectedBox}>
        <ThemedText style={styles.selectedAddress}>
          {t('activity.locationPicker.missingApiKey')}
        </ThemedText>
      </View>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <LocationPickerMap {...props} />
    </APIProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    height: 40,
    color: '#f4f2ef',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#e8823f',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#1a1005',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
  mapCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  map: {
    width: '100%',
    height: 320,
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderBottomRightRadius: 4,
    backgroundColor: '#e8823f',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  pinIconWrap: {
    transform: [{ rotate: '-45deg' }],
  },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: Spacing.three,
    borderRadius: 12,
  },
  selectedTitle: {
    fontWeight: '700',
    color: '#f4f2ef',
    fontSize: 13,
  },
  selectedAddress: {
    color: '#8f8b85',
    fontSize: 13,
    marginTop: 2,
  },
});
