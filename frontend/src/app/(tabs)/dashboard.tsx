import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TopTabInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/i18n';
import { admitFromWaitlist, listActivities, rejectFromWaitlist } from '@/services/activities';
import { getUserProfile } from '@/services/users';
import { Activity } from '@/types/activity';
import { PublicUser } from '@/types/user';
import { SportIcon } from '@/utils/sport-icon';

type PendingRequest = {
  userId: string;
  activityId: string;
  activityTitle: string;
  sportId: string;
};

const AVATAR_COLORS = ['#e8823f', '#4db8a4', '#7b6cf6', '#eb8f84', '#9ccd6b'];

function avatarColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

export default function PartnerDashboard() {
  const { profile, user } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<Record<string, PublicUser>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const data = await listActivities({ createdBy: user.uid });
      setActivities(data);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myActivities = activities;

  const activeActivities = useMemo(
    () => myActivities.filter(a => a.status === 'open' || a.status === 'full'),
    [myActivities],
  );

  const upcomingEvents = useMemo(
    () =>
      activeActivities
        .filter(a => new Date(a.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5),
    [activeActivities],
  );

  const pendingRequests = useMemo<PendingRequest[]>(() => {
    const result: PendingRequest[] = [];
    for (const act of activeActivities) {
      if (act.requiresApproval) {
        for (const uid of act.waitlist) {
          result.push({
            userId: uid,
            activityId: act.id,
            activityTitle: act.title,
            sportId: act.sportId,
          });
        }
      }
    }
    return result;
  }, [activeActivities]);

  useEffect(() => {
    const toLoad = [...new Set(pendingRequests.slice(0, 5).map(r => r.userId))].filter(
      id => !pendingUsers[id],
    );
    if (toLoad.length === 0) return;
    Promise.all(toLoad.map(id => getUserProfile(id))).then(profiles => {
      setPendingUsers(prev => {
        const next = { ...prev };
        profiles.forEach(p => { next[p.id] = p; });
        return next;
      });
    });
  }, [pendingRequests]);

  const eventsThisWeek = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return activeActivities.filter(a => {
      const d = new Date(a.date);
      return d >= now && d <= weekEnd;
    }).length;
  }, [activeActivities]);

  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'dashboard.greeting.morning' : hour < 18 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening');
  const followerCount = profile?.followers?.length ?? 0;
  const totalPending = pendingRequests.length;

  const handleAdmit = async (activityId: string, userId: string) => {
    const key = `${activityId}-${userId}`;
    setActionLoading(key);
    try {
      await admitFromWaitlist(activityId, userId);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (activityId: string, userId: string) => {
    const key = `${activityId}-${userId}`;
    setActionLoading(key);
    try {
      await rejectFromWaitlist(activityId, userId);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e8823f" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <ThemedText type="title" style={styles.greeting} numberOfLines={1}>
            {greeting}, {profile?.name} 👋
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {t('dashboard.subtitle.youHave')}
            <ThemedText style={styles.subtitleBold}>
              {t('dashboard.subtitle.requests', { count: totalPending, plural: totalPending !== 1 ? 's' : '' })}
            </ThemedText>
            {t('dashboard.subtitle.toReview')}
            {eventsThisWeek > 0
              ? t('dashboard.subtitle.andEventsThisWeek', { count: eventsThisWeek, plural: eventsThisWeek !== 1 ? 's' : '' })
              : ''}
            {'.'}
          </ThemedText>
        </View>
        <Link href="/create-activity" asChild>
          <Pressable style={({ pressed }) => pressed && { opacity: 0.75 }}>
            <View style={styles.createBtn}>
              <Ionicons name="add" size={16} color="#000" style={{ marginRight: 6 }} />
              <ThemedText style={styles.createBtnText}>{t('common.createEvent')}</ThemedText>
            </View>
          </Pressable>
        </Link>
      </View>

      {/* 3 Stat tiles */}
      <View style={[styles.statsRow, isDesktop && styles.statsRowDesktop]}>
        {/* Seguidores */}
        <View style={styles.tile}>
          <View style={styles.tileTopRow}>
            <View style={styles.tileIconWrap}>
              <Ionicons name="people-outline" size={18} color="#e8823f" />
            </View>
          </View>
          <ThemedText style={styles.tileValue}>{followerCount.toLocaleString('pt-PT')}</ThemedText>
          <ThemedText style={styles.tileLabel}>{t('dashboard.stats.followers')}</ThemedText>
        </View>

        {/* Eventos ativos */}
        <View style={styles.tile}>
          <View style={styles.tileTopRow}>
            <View style={styles.tileIconWrap}>
              <Ionicons name="calendar-outline" size={18} color="#e8823f" />
            </View>
          </View>
          <ThemedText style={styles.tileValue}>{activeActivities.length}</ThemedText>
          <ThemedText style={styles.tileLabel}>{t('dashboard.stats.activeEvents')}</ThemedText>
        </View>

        {/* Pedidos pendentes */}
        <View style={[styles.tile, totalPending > 0 && styles.tileAccent]}>
          <View style={styles.tileTopRow}>
            <View style={styles.tileIconWrap}>
              <Ionicons name="hand-left-outline" size={18} color="#e8823f" />
            </View>
            {totalPending > 0 && <View style={styles.accentDot} />}
          </View>
          <ThemedText style={styles.tileValue}>{totalPending}</ThemedText>
          <ThemedText style={styles.tileLabel}>{t('dashboard.stats.pendingRequests')}</ThemedText>
        </View>
      </View>

      {/* Two-column section */}
      <View style={[styles.columns, isDesktop && styles.columnsDesktop]}>
        {/* Próximos eventos */}
        <View style={[styles.card, isDesktop && { flex: 3 }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('dashboard.upcomingEvents')}</ThemedText>
            <Link href="/my-events" asChild>
              <Pressable style={({ pressed }) => pressed && { opacity: 0.7 }}>
                <ThemedText style={styles.seeAll}>{t('dashboard.seeAll')}</ThemedText>
              </Pressable>
            </Link>
          </View>

          {upcomingEvents.length === 0 ? (
            <ThemedText style={styles.empty}>{t('dashboard.noUpcomingEvents')}</ThemedText>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <ThemedText style={[styles.th, { flex: 4 }]}>{t('dashboard.table.event')}</ThemedText>
                <ThemedText style={[styles.th, { flex: 2 }]}>{t('dashboard.table.date')}</ThemedText>
                <ThemedText style={[styles.th, { flex: 3 }]}>{t('dashboard.table.participants')}</ThemedText>
              </View>
              {upcomingEvents.map(event => {
                const pct =
                  event.maxParticipants > 0
                    ? event.participantsList.length / event.maxParticipants
                    : 0;
                const barColor = pct >= 1 ? '#eb8f84' : pct >= 0.75 ? '#e8823f' : '#9ccd6b';
                return (
                  <Pressable
                    key={event.id}
                    style={({ pressed }) => [styles.tableRow, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push({ pathname: '/activity/[id]', params: { id: event.id } })}>
                    <View style={{ flex: 4, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <View style={styles.sportCircle}>
                        <SportIcon sportName={event.sportId} size={14} color="#e8823f" />
                      </View>
                      <ThemedText style={[styles.td, { flex: 1 }]} numberOfLines={1}>{event.title}</ThemedText>
                    </View>
                    <ThemedText style={[styles.td, { flex: 2 }]}>{formatDate(event.date)}</ThemedText>
                    <View style={{ flex: 3, gap: 4 }}>
                      <ThemedText style={styles.tdSmall}>
                        {event.participantsList.length}/{event.maxParticipants}
                      </ThemedText>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: barColor }]} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </View>

        {/* Pedidos pendentes */}
        <View style={[styles.card, isDesktop && { flex: 2 }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t('dashboard.stats.pendingRequests')}</ThemedText>
          </View>

          {pendingRequests.length === 0 ? (
            <ThemedText style={styles.empty}>{t('dashboard.noPendingRequests')}</ThemedText>
          ) : (
            pendingRequests.slice(0, 5).map(req => {
              const u = pendingUsers[req.userId];
              const key = `${req.activityId}-${req.userId}`;
              const busy = actionLoading === key;
              const color = avatarColor(req.userId);
              const nameShort = u?.name
                ? u.name.split(' ').slice(0, 2).map((p, i) => i === 1 ? p[0] + '.' : p).join(' ')
                : null;

              return (
                <View key={key} style={styles.requestRow}>
                  <Pressable
                    style={({ pressed }) => [styles.requestInfo, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push({ pathname: '/user/[id]', params: { id: req.userId } })}>
                    <View style={[styles.requestAvatar, { backgroundColor: color + '22', borderColor: color + '66' }]}>
                      <ThemedText style={[styles.requestInitial, { color }]}>
                        {initials(u?.name)}
                      </ThemedText>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <ThemedText style={styles.requestName} numberOfLines={1}>
                        {nameShort ?? '…'}
                      </ThemedText>
                      <ThemedText style={styles.requestActivity} numberOfLines={1}>
                        {req.activityTitle}
                      </ThemedText>
                    </View>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => handleAdmit(req.activityId, req.userId)}
                    style={({ pressed }) => [styles.actionBtn, styles.admitBtn, (pressed || busy) && { opacity: 0.5 }]}>
                    <Ionicons name="checkmark" size={14} color="#9ccd6b" />
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => handleReject(req.activityId, req.userId)}
                    style={({ pressed }) => [styles.actionBtn, styles.rejectBtn, (pressed || busy) && { opacity: 0.5 }]}>
                    <Ionicons name="close" size={14} color="#8f8b85" />
                  </Pressable>
                </View>
              );
            })
          )}
          {pendingRequests.length > 5 && (
            <Pressable style={{ marginTop: 12 }}>
              <ThemedText style={styles.seeAll}>
                {t('dashboard.seeAllRequests', { count: pendingRequests.length })}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0a0a0b' },
  content: { padding: 24, paddingTop: TopTabInset + Spacing.two, paddingBottom: 48 },

  header: { flexDirection: 'column', gap: 16, marginBottom: 28 },
  headerDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 26, color: '#f4f2ef', marginBottom: 4 },
  subtitle: { color: '#8f8b85', fontSize: 14 },
  subtitleBold: { color: '#f4f2ef', fontFamily: 'HankenGrotesk_700Bold', fontSize: 14 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#e8823f',
    paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  createBtnText: { color: '#000', fontSize: 14, fontFamily: 'HankenGrotesk_700Bold' },

  statsRow: { flexDirection: 'column', gap: 12, marginBottom: 24 },
  statsRowDesktop: { flexDirection: 'row' },

  tile: {
    flex: 1,
    backgroundColor: '#111012',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  tileAccent: { borderColor: 'rgba(232,130,63,0.3)' },
  tileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tileIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(232,130,63,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  tileTag: { fontSize: 12, color: '#8f8b85' },
  accentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e8823f' },
  tileValue: { fontSize: 30, color: '#f4f2ef', fontFamily: 'HankenGrotesk_700Bold' },
  tileLabel: { fontSize: 13, color: '#8f8b85' },

  columns: { flexDirection: 'column', gap: 16 },
  columnsDesktop: { flexDirection: 'row', alignItems: 'flex-start' },

  card: {
    backgroundColor: '#111012',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  cardTitle: { fontSize: 16, color: '#f4f2ef', fontFamily: 'HankenGrotesk_700Bold' },
  seeAll: { fontSize: 13, color: '#e8823f', userSelect: 'none' as any },

  tableHeader: {
    flexDirection: 'row', paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    marginBottom: 2,
  },
  th: { fontSize: 10, color: '#5a5855', fontFamily: 'HankenGrotesk_700Bold', letterSpacing: 0.5 },

  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 8,
  },
  sportCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(232,130,63,0.12)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  td: { fontSize: 14, color: '#c9c5bf', flex: 1, minWidth: 0 },
  tdSmall: { fontSize: 12, color: '#8f8b85' },
  progressBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  empty: { fontSize: 14, color: '#5a5855', fontStyle: 'italic' },

  requestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  requestInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  requestAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  requestInitial: { fontSize: 13, fontFamily: 'HankenGrotesk_700Bold' },
  requestName: { fontSize: 14, color: '#f4f2ef', fontFamily: 'HankenGrotesk_700Bold' },
  requestActivity: { fontSize: 12, color: '#8f8b85', marginTop: 1 },
  actionBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  admitBtn: { backgroundColor: 'rgba(156,205,107,0.1)', borderColor: 'rgba(156,205,107,0.3)' },
  rejectBtn: { backgroundColor: '#1a1819', borderColor: 'rgba(255,255,255,0.1)' },
});
