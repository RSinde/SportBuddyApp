import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BadgeIcon } from '@/components/badge-icon';
import { Spacing } from '@/constants/theme';
import { getMyBadges, setDisplayedBadge } from '@/services/badges';
import { UserBadge } from '@/types/badge';
import { useTranslation } from '@/i18n';
import { translateBadge } from '@/utils/translate-badge';

export function BadgesSection() {
  const { t, language } = useTranslation();
  const [badges, setBadges] = useState<UserBadge[] | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyBadges()
      .then(setBadges)
      .catch(() => setBadges(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handlePress(badge: UserBadge) {
    if (updatingId) return;
    setUpdatingId(badge.id);
    try {
      await setDisplayedBadge(badge.isDisplayed ? null : badge.id);
      load();
    } catch (error) {
      Alert.alert(t('profile.alert.errorTitle'), error instanceof Error ? error.message : t('profile.badges.updateError'));
    } finally {
      setUpdatingId(null);
    }
  }

  if (!badges || badges.length === 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>{t('profile.badges.title')}</ThemedText>
      <ThemedText type="small" style={styles.subtitle}>
        {t('profile.badges.tapHint')}
      </ThemedText>

      <View style={styles.grid}>
        {badges.map((badge) => (
          <Pressable
            key={badge.id}
            onPress={() => handlePress(badge)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={badge.isDisplayed ? styles.displayedRing : styles.ringPlaceholder}>
              <BadgeIcon badgeId={badge.id} icon={badge.icon} size={72} />
            </View>
            <ThemedText type="small" style={styles.badgeName} numberOfLines={2}>
              {translateBadge(badge, language).name}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  title: {
    color: '#f4f2ef',
  },
  subtitle: {
    color: '#8f8b85',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  item: {
    width: 80,
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  displayedRing: {
    borderWidth: 2,
    borderColor: '#e8823f',
    borderRadius: 32,
    padding: 2,
  },
  ringPlaceholder: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 32,
    padding: 2,
  },
  badgeName: {
    color: '#c9c5bf',
    textAlign: 'center',
  },
});
