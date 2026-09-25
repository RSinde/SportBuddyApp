import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/themed-text';
import { BadgeIcon } from '@/components/badge-icon';
import { SportIcon } from '@/utils/sport-icon';
import { BottomTabInset, Spacing, TopTabInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { usePendingWaitlist } from '@/contexts/pending-waitlist-context';
import { getMyActivities } from '@/services/activities';
import { getBadgeCatalog, getMyBadges, setDisplayedBadge } from '@/services/badges';
import { getFriends } from '@/services/friends';
import { listSports } from '@/services/sports';
import { uploadMyAvatar } from '@/services/users';
import { Badge, UserBadge } from '@/types/badge';
import { Activity } from '@/types/activity';
import { UserStats } from '@/types/user';
import { relativeDate } from '@/utils/date';
import { compressImageDataUrl } from '@/utils/image';
import { useTranslation } from '@/i18n';
import { translateBadge } from '@/utils/translate-badge';

const STATUS_COLOR: Record<Activity['status'], string> = {
  open: '#9ccd6b',
  full: '#e8823f',
  cancelled: '#eb8f84',
  completed: '#8f8b85',
};

const MONTH_KEYS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function memberSince(ts: string | undefined, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const monthKey = MONTH_KEYS[d.getMonth()];
  return `${t(`profile.month.${monthKey}`)} ${d.getFullYear()}`;
}

function locName(loc?: string | { name?: string }): string | null {
  if (!loc) return null;
  if (typeof loc === 'string') return loc || null;
  return loc.name ?? null;
}

function badgeProgress(b: Badge, stats: UserStats): number {
  if (b.criteriaType === 'activitiesJoined') return stats.activitiesJoined;
  if (b.criteriaType === 'mvpVotesReceived') return stats.mvpVotesReceived;
  return 0;
}

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { refresh: refreshBadge } = usePendingWaitlist();
  const { t, language } = useTranslation();
  const isWide = width >= 700;

  const STATUS_LABEL: Record<Activity['status'], string> = {
    open: t('profile.status.open'),
    full: t('profile.status.full'),
    cancelled: t('profile.status.cancelled'),
    completed: t('profile.status.completed'),
  };

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [activityFilter, setActivityFilter] = useState<'active' | 'past'>('active');
  const [activityLimit, setActivityLimit] = useState(5);
  const [managedLimit, setManagedLimit] = useState(5);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[] | null>(null);
  const [catalog, setCatalog] = useState<Badge[] | null>(null);
  const [sports, setSports] = useState<{ id: string; name: string }[] | null>(null);
  const [updatingBadgeId, setUpdatingBadgeId] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyActivities().then(setActivities).catch(() => setActivities(null));
    getFriends().then(list => setFriendCount(list.length)).catch(() => {});
    getMyBadges().then(setEarnedBadges).catch(() => setEarnedBadges(null));
    getBadgeCatalog().then(setCatalog).catch(() => setCatalog(null));
    listSports().then(setSports).catch(() => setSports(null));
    refreshBadge();
  }, [refreshBadge]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (profile?.role === 'partner') {
      router.replace({ pathname: '/user/[id]', params: { id: profile.id } });
    }
  }, [profile?.role, profile?.id, router]);

  const sportMap = (sports ?? []).reduce<Record<string, string>>(
    (m, s) => { m[s.id] = s.name; return m; }, {}
  );

  const earnedIds = new Set((earnedBadges ?? []).map(b => b.id));

  const managedActivities = (activities ?? []).filter(
    a => a.createdBy === user?.uid && (a.status === 'open' || a.status === 'full')
  ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const filteredActivities = (activities ?? []).filter(a => {
    if (activityFilter === 'active') return a.status === 'open' || a.status === 'full';
    return a.status === 'completed';
  }).sort((a, b) => activityFilter === 'past'
    ? new Date(b.date).getTime() - new Date(a.date).getTime()
    : new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const visibleActivities = filteredActivities.slice(0, activityLimit);

  const earnedWithCurrentIcon = (earnedBadges ?? []).map(eb => {
    const catalogEntry = (catalog ?? []).find(c => c.id === eb.id);
    return { ...eb, icon: catalogEntry?.icon ?? eb.icon };
  });

  const earnedByFamily = new Map<string, typeof earnedWithCurrentIcon[number]>();
  for (const badge of earnedWithCurrentIcon) {
    const key = badge.criteriaType === 'activitiesJoinedBySport'
      ? `sport_${badge.sportId}`
      : badge.criteriaType;
    const existing = earnedByFamily.get(key);
    if (!existing || badge.threshold > existing.threshold) {
      earnedByFamily.set(key, badge);
    }
  }

  const displayedEarned = Array.from(earnedByFamily.values())
    .sort((a, b) => b.threshold - a.threshold)
    .slice(0, 4);

  const lockedWithProgress = (catalog ?? [])
    .filter(b => !earnedIds.has(b.id) && b.criteriaType !== 'activitiesJoinedBySport')
    .map(b => {
      const current = profile ? badgeProgress(b, profile.stats) : 0;
      return { ...b, current, pct: current / b.threshold };
    });
  const nextBadge = [...lockedWithProgress]
    .sort((a, b) => b.pct - a.pct)
    .find(b => b.pct > 0 && b.pct < 1);

  const memberSinceStr = memberSince(profile?.createdAt, t);
  const locationStr = locName(profile?.location);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setUploadingAvatar(true);
        const mime = result.assets[0].mimeType ?? 'image/jpeg';
        const raw = `data:${mime};base64,${result.assets[0].base64}`;
        await uploadMyAvatar(await compressImageDataUrl(raw));
        await refreshProfile();
      }
    } catch {
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBadgeTap = async (badge: UserBadge) => {
    if (updatingBadgeId) return;
    setUpdatingBadgeId(badge.id);
    try {
      await setDisplayedBadge(badge.isDisplayed ? null : badge.id);
      await getMyBadges().then(setEarnedBadges);
    } catch {
      Alert.alert(t('profile.alert.errorTitle'), t('profile.badges.updateError'));
    } finally {
      setUpdatingBadgeId(null);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + TopTabInset + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.three,
        },
      ]}>
      <View style={styles.center}>
        <View style={[styles.columns, isWide && styles.columnsWide]}>

          {/* ── LEFT COLUMN ──────────────────────────────── */}
          <View style={[styles.leftCol, isWide && styles.leftColWide]}>

            <Pressable onPress={handlePickImage} style={styles.avatarWrap} disabled={uploadingAvatar}>
              {profile?.avatarUrl ? (
                <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#8f8b85" />
                </View>
              )}
              <View style={styles.cameraBtn}>
                <Ionicons name="camera" size={13} color="#f4f2ef" />
              </View>
            </Pressable>

            <View style={styles.nameBlock}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {profile?.name ?? user?.displayName ?? '—'}
              </ThemedText>
              {(profile?.email ?? user?.email) ? (
                <ThemedText type="small" style={styles.metaText}>{profile?.email ?? user?.email}</ThemedText>
              ) : null}
              {memberSinceStr ? (
                <ThemedText type="small" style={styles.metaText}>{t('profile.memberSince', { date: memberSinceStr })}</ThemedText>
              ) : null}
            </View>

            {locationStr ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color="#8f8b85" />
                <ThemedText type="small" style={styles.metaText}>{locationStr}</ThemedText>
              </View>
            ) : null}

            {uploadingAvatar ? (
              <ThemedText type="small" style={styles.uploadingText}>{t('profile.avatar.saving')}</ThemedText>
            ) : null}

            {profile?.sports && profile.sports.length > 0 && (
              <View style={styles.sportChips}>
                {profile.sports.slice(0, 5).map(sid => {
                  const sName = sportMap[sid] ?? sid;
                  return (
                    <View key={sid} style={styles.sportChip}>
                      <SportIcon sportName={sName} size={12} color="#e8823f" />
                      <ThemedText type="small" style={styles.sportChipText}>{sName}</ThemedText>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.statsList}>
              {[
                { label: t('profile.stats.joined'), value: profile?.stats.activitiesJoined ?? 0, accent: false, href: null },
                { label: t('profile.stats.organized'),  value: profile?.stats.activitiesCreated ?? 0, accent: false, href: null },
                { label: t('profile.stats.mvp'),          value: profile?.stats.mvpVotesReceived ?? 0,  accent: false, href: null },
                { label: t('profile.stats.friends'),       value: friendCount,                            accent: false, href: '/friends' },
                { label: t('profile.stats.following'),     value: profile?.following?.length ?? 0,        accent: false, href: '/following' },
              ].map(({ label, value, accent, href }) => (
                <Pressable key={label} style={({ pressed }) => [styles.statRow, pressed && href && styles.pressed]} onPress={() => href && router.push(href as any)}>
                  <ThemedText type="small" style={styles.statLabel}>{label}</ThemedText>
                  <ThemedText type="smallBold" style={[styles.statValue, accent && styles.statAccent]}>
                    {value}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {nextBadge ? (
              <>
                <View style={styles.divider} />
                <View style={styles.nextBadgeBox}>
                  <View style={styles.nextBadgeRow}>
                    <ThemedText type="small" style={styles.nextBadgeLabel}>{t('profile.badge.next')}</ThemedText>
                    <ThemedText type="smallBold" style={styles.nextBadgeName} numberOfLines={1}>
                      {translateBadge(nextBadge, language).name}
                    </ThemedText>
                    <ThemedText type="small" style={styles.nextBadgeCount}>
                      {' '}{nextBadge.current}/{nextBadge.threshold}
                    </ThemedText>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(nextBadge.pct * 100, 100)}%` as any },
                      ]}
                    />
                  </View>
                </View>
              </>
            ) : null}

            <Pressable
              style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
              onPress={signOut}>
              <Ionicons name="log-out-outline" size={16} color="#eb8f84" />
              <ThemedText type="smallBold" style={styles.logoutText}>{t('profile.logout')}</ThemedText>
            </Pressable>
          </View>

          {/* ── RIGHT COLUMN ─────────────────────────────── */}
          <View style={[styles.rightCol, isWide && styles.rightColWide]}>

            {managedActivities.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>{t('profile.managing.title')}</ThemedText>
                    <ThemedText type="subtitle" style={styles.sectionCount}> {managedActivities.length}</ThemedText>
                  </View>
                </View>

                <View style={styles.actList}>
                  {managedActivities.slice(0, managedLimit).map(activity => {
                    const sportName = sportMap[activity.sportId];
                    const pendingCount = activity.requiresApproval ? (activity.waitlist?.length ?? 0) : 0;
                    const participantCount = activity.participantsList?.length ?? 0;
                    return (
                      <Link
                        key={activity.id}
                        href={{ pathname: '/activity/[id]', params: { id: activity.id } }}
                        asChild>
                        <Pressable style={({ pressed }) => pressed && styles.pressed}>
                          <View style={styles.actItem}>
                            <View style={styles.sportCircle}>
                              <SportIcon sportName={sportName} size={20} color="#f4f2ef" />
                            </View>
                            <View style={styles.actInfo}>
                              <ThemedText type="smallBold" style={styles.actTitle} numberOfLines={1}>
                                {activity.title}
                              </ThemedText>
                              <ThemedText type="small" style={styles.actMeta}>
                                {pendingCount > 0
                                  ? t(pendingCount > 1 ? 'profile.pendingRequests.plural' : 'profile.pendingRequests.singular', { count: pendingCount })
                                  : t('profile.participants', { current: participantCount, max: activity.maxParticipants })}
                              </ThemedText>
                            </View>
                            {pendingCount > 0 ? (
                              <View style={[styles.statusChip, { backgroundColor: 'rgba(232,130,63,0.15)' }]}>
                                <ThemedText style={[styles.statusText, { color: '#e8823f' }]}>
                                  {t(pendingCount > 1 ? 'profile.pendingChip.plural' : 'profile.pendingChip.singular', { count: pendingCount })}
                                </ThemedText>
                              </View>
                            ) : (
                              <View style={[styles.statusChip, { backgroundColor: 'rgba(156,205,107,0.15)' }]}>
                                <ThemedText style={[styles.statusText, { color: '#9ccd6b' }]}>{t('profile.status.open')}</ThemedText>
                              </View>
                            )}
                            <Ionicons name="settings-outline" size={18} color="#8f8b85" />
                          </View>
                        </Pressable>
                      </Link>
                    );
                  })}
                </View>

                {managedLimit < managedActivities.length && (
                  <Pressable
                    style={({ pressed }) => [styles.showAllBtn, pressed && styles.pressed]}
                    onPress={() => setManagedLimit(l => l + 5)}>
                    <ThemedText type="small" style={styles.showAllText}>{t('profile.viewMore')}</ThemedText>
                  </Pressable>
                )}
              </>
            )}

            <View style={styles.sectionHeader}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>{t('profile.badges.title')}</ThemedText>
              {Platform.OS === 'web' && (
                <Pressable
                  style={({ pressed }) => [styles.verTodasBtn, pressed && styles.pressed]}
                  onPress={() => router.push('/badges')}>
                  <ThemedText type="small" style={styles.verTodasText}>{t('profile.badges.viewAll')}</ThemedText>
                </Pressable>
              )}
            </View>

            {displayedEarned.length > 0 ? (
              <View style={styles.badgeGrid}>
                {displayedEarned.map(badge => (
                  <Pressable
                    key={badge.id}
                    style={({ pressed }) => [styles.badgeCell, pressed && styles.pressed]}
                    onPress={() => handleBadgeTap(badge)}>
                    <BadgeIcon badgeId={badge.id} icon={badge.icon} size={100} />
                    <ThemedText style={styles.badgeName} numberOfLines={2}>{translateBadge(badge, language).name}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <ThemedText type="small" style={styles.emptyText}>{t('profile.badges.empty')}</ThemedText>
            )}

            <View style={styles.historicHeader}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>{t('profile.history.title')}</ThemedText>
              <View style={styles.filterRow}>
                {(['active', 'past'] as const).map(f => (
                  <Pressable key={f} onPress={() => { setActivityFilter(f); setActivityLimit(5); }}>
                    <View style={[styles.filterChip, activityFilter === f && styles.filterChipOn]}>
                      <ThemedText
                        type="small"
                        style={[styles.filterText, activityFilter === f && styles.filterTextOn]}>
                        {f === 'active' ? t('profile.filter.active') : t('profile.filter.past')}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {activities === null && (
              <ThemedText type="small" style={styles.emptyText}>{t('profile.loading')}</ThemedText>
            )}
            {activities !== null && filteredActivities.length === 0 && (
              <ThemedText type="small" style={styles.emptyText}>{t('profile.activities.empty')}</ThemedText>
            )}

            <View style={styles.actList}>
              {visibleActivities.map(activity => {

                const sportName = sportMap[activity.sportId];
                const loc = (activity as any).location?.name as string | undefined;
                const color = STATUS_COLOR[activity.status];
                const isPrivate = activity.requiresApproval;
                return (
                  <Link
                    key={activity.id}
                    href={{ pathname: '/activity/[id]', params: { id: activity.id } }}
                    asChild>
                    <Pressable style={({ pressed }) => pressed && styles.pressed}>
                      <View style={styles.actItem}>
                        <View style={styles.sportCircle}>
                          <SportIcon sportName={sportName} size={20} color="#f4f2ef" />
                        </View>
                        <View style={styles.actInfo}>
                          <ThemedText type="smallBold" style={styles.actTitle} numberOfLines={1}>
                            {activity.title}
                          </ThemedText>
                          <ThemedText type="small" style={styles.actMeta}>
                            {relativeDate(activity.date, t, language)}{loc ? ` · ${loc}` : ''}
                          </ThemedText>
                        </View>
                        {isPrivate ? (
                          <View style={[styles.statusChip, styles.privateChip]}>
                            <Ionicons name="lock-closed" size={10} color="#8f8b85" />
                            <ThemedText style={[styles.statusText, { color: '#8f8b85' }]}>{t('explore.card.private')}</ThemedText>
                          </View>
                        ) : (
                          <View style={[styles.statusChip, { backgroundColor: `${color}20` }]}>
                            <ThemedText style={[styles.statusText, { color }]}>
                              {STATUS_LABEL[activity.status]}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  </Link>
                );
              })}
            </View>

            {activityLimit < filteredActivities.length && (
              <Pressable
                style={({ pressed }) => [styles.showAllBtn, pressed && styles.pressed]}
                onPress={() => setActivityLimit(l => l + 5)}>
                <ThemedText type="small" style={styles.showAllText}>{t('profile.viewMore')}</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexDirection: 'row', justifyContent: 'center' },
  center: { width: '100%', maxWidth: 900, paddingHorizontal: Spacing.four },

  columns: { gap: Spacing.four },
  columnsWide: { flexDirection: 'row' },

  leftCol: { gap: Spacing.four },
  leftColWide: { width: 220 },

  rightCol: { gap: Spacing.three },
  rightColWide: { flex: 1, minWidth: 0 },

  avatarWrap: { alignSelf: 'center', position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#141315',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#e8823f',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0a0a0b',
  },

  name: {
    color: '#f4f2ef',
    fontSize: 24,
    fontFamily: 'HankenGrotesk_700Bold',
    textAlign: 'center',
  },
  nameBlock: { alignItems: 'center', gap: 2 },
  metaText: { color: '#8f8b85', textAlign: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  uploadingText: { color: '#8f8b85', textAlign: 'center', fontSize: 12 },

  editBtn: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 12, height: 42,
    alignItems: 'center', justifyContent: 'center',
  },
  editBtnText: { color: '#f4f2ef' },

  pendingCard: {
    backgroundColor: 'rgba(232,130,63,0.12)',
    borderWidth: 1, borderColor: '#e8823f',
    borderRadius: 10, padding: Spacing.two,
  },
  pendingText: { color: '#e8823f', textAlign: 'center' },

  sportChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sportChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#141315',
    borderRadius: 20, paddingVertical: 4, paddingHorizontal: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sportChipText: { color: '#c9c5bf', fontSize: 12 },
  addSportChip: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#141315',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  statsList: { gap: Spacing.two },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { color: '#8f8b85' },
  statValue: { color: '#f4f2ef', fontSize: 20, fontFamily: 'HankenGrotesk_700Bold' },
  statAccent: { color: '#e8823f' },

  nextBadgeBox: { gap: 8 },
  nextBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  nextBadgeLabel: { color: '#8f8b85' },
  nextBadgeName: { color: '#f4f2ef', flexShrink: 1 },
  nextBadgeCount: { color: '#8f8b85' },
  progressTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%' as any, borderRadius: 3,
    backgroundColor: '#e8823f',
  },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(235,143,132,0.1)',
    borderWidth: 1, borderColor: '#eb8f84',
    borderRadius: 12, height: 44,
    marginTop: Spacing.one,
  },
  logoutText: { color: '#eb8f84' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  sectionTitle: { color: '#f4f2ef', fontSize: 20, fontFamily: 'HankenGrotesk_700Bold' },
  sectionCount: { color: '#8f8b85', fontSize: 20, fontFamily: 'HankenGrotesk_700Bold' },
  sectionSub: { color: '#8f8b85' },
  verTodasBtn: { paddingVertical: 2 },
  verTodasText: { color: '#e8823f' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  badgeCell: { width: 100, alignItems: 'center', paddingBottom: 4 },

  lockedWrap: {
    width: 72, height: 72,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeName: { color: '#c9c5bf', textAlign: 'center', marginTop: -8, fontSize: 12, width: 100 },
  badgeProgress: { color: '#8f8b85', fontSize: 11, textAlign: 'center' },

  historicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    backgroundColor: '#111012', paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipOn: { backgroundColor: '#e8823f', borderColor: '#e8823f' },
  filterText: { color: '#c9c5bf', userSelect: 'none' as any },
  filterTextOn: { color: '#0a0a0b' },

  emptyText: { color: '#8f8b85', textAlign: 'center', paddingVertical: Spacing.two },
  actList: { gap: Spacing.two },
  actItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111012',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  sportCircle: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(232,130,63,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actInfo: { flex: 1, gap: 2, minWidth: 0 },
  actTitle: { color: '#f4f2ef' },
  actMeta: { color: '#8f8b85' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  privateChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#8f8b8522' },
  statusText: { fontSize: 11, fontFamily: 'HankenGrotesk_600SemiBold' },

  showAllBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  showAllText: { color: '#e8823f', userSelect: 'none' as any },

  pressed: { opacity: 0.7 },
});
