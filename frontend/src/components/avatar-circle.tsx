import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

type Props = {
  name: string;
  avatarUrl?: string;
  size?: number;
  backgroundColor?: string;
  square?: boolean;
};

export function AvatarCircle({ name, avatarUrl, size = 44, backgroundColor = '#141315', square = false }: Props) {
  const initial = name.trim().charAt(0).toUpperCase();
  const circleStyle = { width: size, height: size, borderRadius: square ? 16 : size / 2 };

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={circleStyle} />;
  }

  return (
    <View style={[styles.placeholder, circleStyle, { backgroundColor }]}>
      <ThemedText style={[styles.text, { fontSize: size * 0.4 }]}>{initial}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#f4f2ef',
    fontWeight: 'bold',
  },
});
