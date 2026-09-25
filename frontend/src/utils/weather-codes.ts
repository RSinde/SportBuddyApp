import { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;
export type WeatherCategory =
  | 'clear'
  | 'partly-cloud'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

type WeatherInfo = { icon: IconName; labelKey: string; category: WeatherCategory };

// Tipos de tempo do IPMA (idWeatherType): https://api.ipma.pt/open-data/weather-type-classe.json
// labelKey aponta para uma entrada em i18n/dictionaries/weather.ts — usar t(labelKey) para mostrar.
const IPMA_WEATHER_TYPES: Record<number, WeatherInfo> = {
  1: { icon: 'sunny', labelKey: 'weather.type.1', category: 'clear' },
  2: { icon: 'partly-sunny', labelKey: 'weather.type.2', category: 'partly-cloud' },
  3: { icon: 'partly-sunny', labelKey: 'weather.type.3', category: 'partly-cloud' },
  4: { icon: 'cloudy', labelKey: 'weather.type.4', category: 'cloud' },
  5: { icon: 'cloudy', labelKey: 'weather.type.5', category: 'cloud' },
  6: { icon: 'rainy', labelKey: 'weather.type.6', category: 'rain' },
  7: { icon: 'rainy', labelKey: 'weather.type.7', category: 'rain' },
  8: { icon: 'rainy', labelKey: 'weather.type.8', category: 'rain' },
  9: { icon: 'rainy', labelKey: 'weather.type.9', category: 'rain' },
  10: { icon: 'rainy-outline', labelKey: 'weather.type.10', category: 'drizzle' },
  11: { icon: 'rainy', labelKey: 'weather.type.11', category: 'rain' },
  12: { icon: 'rainy', labelKey: 'weather.type.12', category: 'rain' },
  13: { icon: 'rainy-outline', labelKey: 'weather.type.13', category: 'drizzle' },
  14: { icon: 'rainy', labelKey: 'weather.type.14', category: 'rain' },
  15: { icon: 'rainy-outline', labelKey: 'weather.type.15', category: 'drizzle' },
  16: { icon: 'cloud-outline', labelKey: 'weather.type.16', category: 'fog' },
  17: { icon: 'cloud-outline', labelKey: 'weather.type.17', category: 'fog' },
  18: { icon: 'snow', labelKey: 'weather.type.18', category: 'snow' },
  19: { icon: 'thunderstorm', labelKey: 'weather.type.19', category: 'storm' },
  20: { icon: 'thunderstorm', labelKey: 'weather.type.20', category: 'storm' },
  21: { icon: 'thunderstorm', labelKey: 'weather.type.21', category: 'storm' },
  22: { icon: 'snow', labelKey: 'weather.type.22', category: 'snow' },
  23: { icon: 'thunderstorm', labelKey: 'weather.type.23', category: 'storm' },
  24: { icon: 'cloudy', labelKey: 'weather.type.24', category: 'cloud' },
  25: { icon: 'cloudy', labelKey: 'weather.type.25', category: 'cloud' },
  26: { icon: 'cloud-outline', labelKey: 'weather.type.26', category: 'fog' },
  27: { icon: 'cloudy', labelKey: 'weather.type.27', category: 'cloud' },
  28: { icon: 'snow', labelKey: 'weather.type.28', category: 'snow' },
  29: { icon: 'snow', labelKey: 'weather.type.29', category: 'snow' },
  30: { icon: 'snow', labelKey: 'weather.type.30', category: 'snow' },
};

const FALLBACK: WeatherInfo = { icon: 'partly-sunny', labelKey: 'weather.type.fallback', category: 'partly-cloud' };

export function getWeatherInfo(idWeatherType: number): WeatherInfo {
  return IPMA_WEATHER_TYPES[idWeatherType] ?? FALLBACK;
}

export const WEATHER_CATEGORY_COLORS: Record<WeatherCategory, string> = {
  clear: '#FACC15',
  'partly-cloud': '#FACC15',
  cloud: '#f4f2ef',
  fog: '#c9c5bf',
  drizzle: '#93C5FD',
  rain: '#60A5FA',
  snow: '#f4f2ef',
  storm: '#FDE68A',
};

// O IPMA devolve a direção do vento já em inglês (N, NE, E, SE, S, SW, W, NW).
export function getWindDirectionLabel(direction: string): string {
  return direction;
}

export function getUvColor(uv: number): string {
  if (uv < 3) return '#22C55E';
  if (uv < 6) return '#EAB308';
  if (uv < 8) return '#F97316';
  if (uv < 11) return '#EF4444';
  return '#A855F7';
}

// Devolve uma chave de tradução — usar t(getUvLabel(uv)) para mostrar.
export function getUvLabel(uv: number): string {
  if (uv < 3) return 'weather.uv.low';
  if (uv < 6) return 'weather.uv.moderate';
  if (uv < 8) return 'weather.uv.high';
  if (uv < 11) return 'weather.uv.veryHigh';
  return 'weather.uv.extreme';
}

// https://api.ipma.pt/open-data/wind-speed-daily-classe.json
// Chaves de tradução — usar t(WIND_SPEED_KEYS[classWindSpeed]) para mostrar.
export const WIND_SPEED_KEYS: Record<number, string> = {
  1: 'weather.wind.light',
  2: 'weather.wind.moderate',
  3: 'weather.wind.strong',
  4: 'weather.wind.veryStrong',
};

export const WARNING_LEVEL_KEYS: Record<'yellow' | 'orange' | 'red', string> = {
  yellow: 'weather.warningLevel.yellow',
  orange: 'weather.warningLevel.orange',
  red: 'weather.warningLevel.red',
};

export const WARNING_LEVEL_COLORS: Record<'yellow' | 'orange' | 'red', string> = {
  yellow: '#EAB308',
  orange: '#F97316',
  red: '#EF4444',
};
