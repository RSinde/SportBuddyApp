import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { BadgeIcon } from '@/components/badge-icon';
import { Spacing } from '@/constants/theme';
import { getBadgeCatalog, getMyBadges } from '@/services/badges';
import { Badge, UserBadge } from '@/types/badge';
import { useAuth } from '@/contexts/auth-context';
import { UserStats } from '@/types/user';
import { useTranslation } from '@/i18n';
import { translateBadge } from '@/utils/translate-badge';

function badgeProgress(b: Badge, stats: UserStats): number {
  if (b.criteriaType === 'activitiesJoined') return stats.activitiesJoined;
  if (b.criteriaType === 'mvpVotesReceived') return stats.mvpVotesReceived;
  return 0;
}

export default function BadgesScreen() {
  const { profile } = useAuth();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[] | null>(null);
  const [catalog, setCatalog] = useState<Badge[] | null>(null);
  const load = useCallback(() => {
    getMyBadges().then(setEarnedBadges).catch(() => setEarnedBadges(null));
    getBadgeCatalog().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, styles.unavailable]}>
        <Ionicons name="medal-outline" size={32} color="#8f8b85" />
        <ThemedText style={styles.unavailableText}>{t('profile.badges.mobileUnavailable')}</ThemedText>
      </View>
    );
  }

  const earnedIds = new Set((earnedBadges ?? []).map(b => b.id));

  const earnedWithIcon = (earnedBadges ?? []).map(eb => {
    const catalogEntry = (catalog ?? []).find(c => c.id === eb.id);
    return { ...eb, icon: catalogEntry?.icon ?? eb.icon };
  });

  const TYPE_ORDER: Record<string, number> = {
    mvpVotesReceived: 0,
    activitiesJoined: 1,
    activitiesJoinedBySport: 2,
  };

  const lockedWithProgress = (catalog ?? [])
    .filter(b => !earnedIds.has(b.id))
    .map(b => {
      const current = profile ? badgeProgress(b, profile.stats) : 0;
      return { ...b, current, pct: current / b.threshold };
    })
    .sort((a, b) => {
      const typeOrder = (TYPE_ORDER[a.criteriaType] ?? 9) - (TYPE_ORDER[b.criteriaType] ?? 9);
      if (typeOrder !== 0) return typeOrder;
      if (a.criteriaType === 'activitiesJoinedBySport' && a.sportId !== b.sportId) {
        return (a.sportId ?? '').localeCompare(b.sportId ?? '');
      }
      return a.threshold - b.threshold;
    });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.four }]}>

      <ThemedText type="smallBold" style={styles.sectionTitle}>{t('profile.badges.earned')}</ThemedText>
      {earnedWithIcon.length === 0
        ? <ThemedText type="small" style={styles.empty}>{t('profile.badges.noneEarned')}</ThemedText>
        : (
          <View style={styles.grid}>
            {earnedWithIcon.map(badge => {
              const translated = translateBadge(badge, language);
              return (
                <View key={badge.id} style={styles.cell}>
                  <View style={styles.imageWrap}>
                    <BadgeIcon badgeId={badge.id} icon={badge.icon} size={72} />
                  </View>
                  <ThemedText style={styles.badgeName} numberOfLines={2}>{translated.name}</ThemedText>
                  <ThemedText style={styles.badgeDesc} numberOfLines={2}>{translated.description}</ThemedText>
                </View>
              );
            })}
          </View>
        )
      }

      <View style={styles.divider} />

      <ThemedText type="smallBold" style={styles.sectionTitle}>{t('profile.badges.locked')}</ThemedText>
      {lockedWithProgress.length === 0
        ? <ThemedText type="small" style={styles.empty}>{t('profile.badges.allEarned')}</ThemedText>
        : (
          <View style={styles.grid}>
            {lockedWithProgress.map(badge => {
              const translated = translateBadge(badge, language);
              return (
                <View key={badge.id} style={styles.cell}>
                  <View style={styles.imageWrap}>
                    <View style={{ opacity: 0.3 }}>
                      <BadgeIcon badgeId={badge.id} icon={badge.icon} size={72} />
                    </View>
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={20} color="#8f8b85" />
                    </View>
                  </View>
                  <ThemedText style={styles.badgeName} numberOfLines={2}>{translated.name}</ThemedText>
                  <ThemedText style={styles.badgeDesc} numberOfLines={2}>{translated.description}</ThemedText>
                  {badge.current > 0 && (
                    <View style={styles.progressWrap}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(badge.pct * 100, 100)}%` as any }]} />
                      </View>
                      <ThemedText style={styles.progressText}>{badge.current}/{badge.threshold}</ThemedText>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )
      }
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0b' },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  unavailable: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.five },
  unavailableText: { color: '#8f8b85', textAlign: 'center', fontSize: 14 },

  sectionTitle: {
    color: '#f4f2ef',
    fontSize: 16,
    fontFamily: 'HankenGrotesk_700Bold',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: Spacing.two,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  cell: {
    width: '22%',
    alignItems: 'center',
    gap: 4,
  },

  imageWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayedDot: {
    position: 'absolute',
    bottom: -2, right: -2,
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: '#e8823f',
    borderWidth: 1.5, borderColor: '#0a0a0b',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },

  badgeName: {
    color: '#f4f2ef',
    fontSize: 12,
    fontFamily: 'HankenGrotesk_700Bold',
    textAlign: 'center',
  },
  badgeDesc: {
    color: '#8f8b85',
    fontSize: 11,
    textAlign: 'center',
  },

  progressWrap: { width: '100%', gap: 3, marginTop: 2 },
  progressTrack: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%' as any,
    borderRadius: 2,
    backgroundColor: '#e8823f',
  },
  progressText: {
    color: '#8f8b85', fontSize: 10, textAlign: 'center',
  },

  empty: { color: '#8f8b85', textAlign: 'center', paddingVertical: Spacing.four },
  pressed: { opacity: 0.7 },
});
