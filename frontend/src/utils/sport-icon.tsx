import type { StyleProp, TextStyle } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;
type MaterialIconName = keyof typeof MaterialCommunityIcons.glyphMap;

type SportIconSpec =
  | { family: 'ionicons'; name: IoniconName }
  | { family: 'material'; name: MaterialIconName };

const SPORT_ICONS: Record<string, SportIconSpec> = {
  futebol: { family: 'ionicons', name: 'football-outline' },
  basquetebol: { family: 'ionicons', name: 'basketball-outline' },
  ciclismo: { family: 'ionicons', name: 'bicycle-outline' },
  corrida: { family: 'ionicons', name: 'walk-outline' },
  natação: { family: 'ionicons', name: 'water-outline' },
  padel: { family: 'material', name: 'racquetball' },
  ténis: { family: 'ionicons', name: 'tennisball-outline' },
  voleibol: { family: 'material', name: 'volleyball' },
};

const DEFAULT_SPORT_ICON: SportIconSpec = { family: 'ionicons', name: 'medal-outline' };

function getSportIconSpec(sportName?: string): SportIconSpec {
  if (!sportName) return DEFAULT_SPORT_ICON;
  return SPORT_ICONS[sportName.trim().toLowerCase()] ?? DEFAULT_SPORT_ICON;
}

export function SportIcon({
  sportName,
  size,
  color,
  style,
}: {
  sportName?: string;
  size: number;
  color: string;
  style?: StyleProp<TextStyle>;
}) {
  const spec = getSportIconSpec(sportName);

  if (spec.family === 'material') {
    return <MaterialCommunityIcons name={spec.name} size={size} color={color} style={style} />;
  }

  return <Ionicons name={spec.name} size={size} color={color} style={style} />;
}
