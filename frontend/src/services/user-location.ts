import * as Location from 'expo-location';

export type UserCoordinates = {
  lat: number;
  lng: number;
};

export async function getCurrentUserLocation(): Promise<UserCoordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error('Location permission denied');
  }

  const position = await Location.getCurrentPositionAsync({});

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}
