import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AvatarCircle } from '@/components/avatar-circle';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing, TopTabInset } from '@/constants/theme';
import { getFollowers } from '@/services/users';

type Follower = { id: string; name: string; avatarUrl?: string };

export default function FollowersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [followers, setFollowers] = useState<Follower[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getFollowers(id)
        .then(setFollowers)
        .catch(() => setFollowers([]));
    }, [id])
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: TopTabInset + insets.top + Spacing.four, paddingBottom: BottomTabInset + insets.bottom + Spacing.four },
      ]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={22} color="#f4f2ef" />
        </Pressable>
        <ThemedText type="title" style={styles.title}>Seguidores</ThemedText>
      </View>

      {followers === null && (
        <ThemedText style={styles.empty}>A carregar...</ThemedText>
      )}
      {followers !== null && followers.length === 0 && (
        <ThemedText style={styles.empty}>Ainda não tens seguidores.</ThemedText>
      )}
      {followers !== null && followers.length > 0 && (
        <View style={styles.list}>
          {followers.map((f) => (
            <Pressable
              key={f.id}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: f.id } })}>
              <AvatarCircle name={f.name} avatarUrl={f.avatarUrl} size={44} />
              <ThemedText style={styles.name} numberOfLines={1}>{f.name}</ThemedText>
              <Ionicons name="chevron-forward" size={16} color="#8f8b85" style={{ marginLeft: 'auto' as any }} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: '#0c0c0d', flex: 1 },
  content: { paddingHorizontal: Spacing.four },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.four,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#141315',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#f4f2ef', fontSize: 26 },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#111012',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  name: { color: '#f4f2ef', fontSize: 15, fontWeight: '600', flex: 1 },
  empty: { color: '#8f8b85', textAlign: 'center', marginTop: 40 },
  pressed: { opacity: 0.7 },
});
