import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { badgeImages } from '@/constants/badge-images';

type Props = {
  badgeId: string;
  icon: string;
  size?: number;
};

// participation_bronze.png has a wider canvas (4608 vs 3508px) — compensate so it appears the same size
const CANVAS_SCALE: Record<string, number> = {
  participation_bronze: 2.63,
};

export function BadgeIcon({ badgeId, icon, size = 56 }: Props) {
  const image = badgeImages[icon] ?? badgeImages[badgeId];

  const scale = CANVAS_SCALE[icon] ?? CANVAS_SCALE[badgeId] ?? 2.0;
  const imgSize = size * scale;
  const imgOffset = -(imgSize - size) / 2;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {image ? (
        <Image
          source={image}
          style={[styles.image, { width: imgSize, height: imgSize, top: imgOffset, left: imgOffset }]}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.iconWrapper, { borderRadius: size / 2 }]}>
          <Ionicons name={icon as any} size={size * 0.75} color="#e8823f" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
});
