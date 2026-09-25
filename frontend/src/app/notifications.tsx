import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/notifications';
import { getFriends } from '@/services/friends';
import { Notification, NotificationType } from '@/types/notification';
import { relativeDate } from '@/utils/date';
import { useTranslation } from '@/i18n';

type FilterTab = 'all' | 'requests' | 'activities' | 'social';

type DisplayItem =
  | { kind: 'single'; notification: Notification }
  | { kind: 'group'; notifications: Notification[]; activityId: string; activityTitle: string };

const FILTER_TYPES: Record<Exclude<FilterTab, 'all'>, NotificationType[]> = {
  requests:   ['activity_join_request', 'friend_request'],
  activities: ['activity_joined', 'activity_left', 'activity_full', 'waitlist_admitted',
               'participant_removed', 'activity_cancelled', 'activity_reminder',
               'activity_auto_cancelled', 'mvp_voting_open', 'mvp_result', 'activity_rating_open'],
  social:     ['new_message', 'friend_request_accepted', 'badge_earned', 'new_activity_from_followed'],
};

const TYPE_META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  activity_joined:         { icon: 'person-add-outline',          color: '#c9c5bf' },
  activity_join_request:   { icon: 'hand-left-outline',           color: '#e8823f' },
  activity_left:           { icon: 'exit-outline',                color: '#c9c5bf' },
  activity_full:           { icon: 'people-outline',              color: '#e8823f' },
  waitlist_admitted:       { icon: 'checkmark-circle-outline',    color: '#e8823f' },
  participant_removed:     { icon: 'person-remove-outline',       color: '#eb8f84' },
  activity_cancelled:      { icon: 'close-circle-outline',        color: '#eb8f84' },
  activity_reminder:       { icon: 'alarm-outline',               color: '#e8823f' },
  activity_auto_cancelled: { icon: 'close-circle-outline',        color: '#eb8f84' },
  new_message:             { icon: 'chatbubble-ellipses-outline', color: '#c9c5bf' },
  mvp_voting_open:         { icon: 'trophy-outline',              color: '#e8823f' },
  mvp_result:              { icon: 'trophy-outline',              color: '#e8823f' },
  friend_request:          { icon: 'person-add-outline',          color: '#e8823f' },
  friend_request_accepted: { icon: 'people-outline',              color: '#c9c5bf' },
  badge_earned:            { icon: 'ribbon-outline',              color: '#e8823f' },
  new_activity_from_followed: { icon: 'calendar-outline',        color: '#e8823f' },
  activity_rating_open:       { icon: 'star-outline',            color: '#e8823f' },
};

function getTimeGroup(iso: string): 'today' | 'yesterday' | 'older' {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dDay  = new Date(d.getFullYear(),   d.getMonth(),   d.getDate()).getTime();
  if (dDay === today)               return 'today';
  if (dDay === today - 86400000)    return 'yesterday';
  return 'older';
}

function resolveNotificationText(n: Notification, t: (key: string, vars?: Record<string, string | number>) => string): string {
  return n.messageKey ? t(n.messageKey, n.messageParams) : n.message ?? '';
}

function buildDisplayItems(
  notifications: Notification[],
  t: (key: string, vars?: Record<string, string | number>) => string
): DisplayItem[] {
  const requestMap = new Map<string, Notification[]>();
  const rest: Notification[] = [];

  for (const n of notifications) {
    if (n.type === 'activity_join_request' && n.activityId) {
      const arr = requestMap.get(n.activityId) ?? [];
      arr.push(n);
      requestMap.set(n.activityId, arr);
    } else {
      rest.push(n);
    }
  }

  const items: DisplayItem[] = [];
  for (const [activityId, group] of requestMap) {
    const title = /"([^"]+)"/.exec(resolveNotificationText(group[0], t))?.[1] ?? '';
    items.push(
      group.length === 1
        ? { kind: 'single', notification: group[0] }
        : { kind: 'group', notifications: group, activityId, activityTitle: title }
    );
  }
  for (const n of rest) items.push({ kind: 'single', notification: n });

  return items.sort((a, b) => {
    const ta = a.kind === 'single' ? a.notification.createdAt : a.notifications[0].createdAt;
    const tb = b.kind === 'single' ? b.notification.createdAt : b.notifications[0].createdAt;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
}

function HighlightedText({ text, unread }: { text: string; unread: boolean }) {
  const parts = text.split(/"([^"]+)"/g);
  return (
    <Text style={[styles.notifText, unread && styles.notifTextUnread]}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <Text key={i} style={styles.notifHighlight}>{part}</Text>
          : part
      )}
    </Text>
  );
}

function getItemAction(
  n: Notification,
  t: (key: string) => string,
  friendIds: Set<string>
): { label: string; onPress: () => void; done?: boolean } | null {
  switch (n.type) {
    case 'mvp_voting_open':
      return n.activityId
        ? { label: t('notifications.voteNow'), onPress: () => router.push({ pathname: '/chat/[id]', params: { id: n.activityId! } }) }
        : null;
    case 'mvp_result':
      return n.activityId
        ? { label: t('notifications.viewResult'), onPress: () => router.push({ pathname: '/activity/[id]', params: { id: n.activityId! } }) }
        : null;
    case 'badge_earned':
      return { label: t('notifications.viewBadge'), onPress: () => router.push('/badges') };
    case 'friend_request': {
      const alreadyFriends = !!n.relatedUserId && friendIds.has(n.relatedUserId);
      const onPress = n.relatedUserId
        ? () => router.push({ pathname: '/user/[id]', params: { id: n.relatedUserId! } })
        : () => router.push('/friends');
      return alreadyFriends
        ? { label: t('notifications.friendsBadge'), onPress, done: true }
        : { label: t('notifications.viewRequest'), onPress };
    }
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const { t, language } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [submitting, setSubmitting] = useState(false);
  const [showOlder, setShowOlder] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getNotifications().then(setNotifications).catch(() => setNotifications([]));
      getFriends()
        .then(friends => setFriendIds(new Set(friends.map(f => f.userId))))
        .catch(() => setFriendIds(new Set()));
    }, [])
  );

  function markRead(ids: string[]) {
    setNotifications(prev =>
      prev ? prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n) : prev
    );
    ids.forEach(id => markNotificationAsRead(id).catch(() => {}));
  }

  async function handleMarkAll() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev ? prev.map(n => ({ ...n, read: true })) : prev);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenItem(item: DisplayItem) {
    const ids = item.kind === 'single'
      ? [item.notification.id]
      : item.notifications.map(n => n.id);
    markRead(ids);

    if (item.kind === 'group') {
      router.push({ pathname: '/activity/[id]', params: { id: item.activityId } });
      return;
    }

    const n = item.notification;
    if (n.type === 'friend_request' || n.type === 'friend_request_accepted') {
      if (n.relatedUserId) {
        router.push({ pathname: '/user/[id]', params: { id: n.relatedUserId } });
      } else {
        router.push('/friends');
      }
    } else if (n.type === 'badge_earned') {
      router.push('/badges');
    } else if ((n.type === 'new_message' || n.type === 'mvp_voting_open') && n.activityId) {
      router.push({ pathname: '/chat/[id]', params: { id: n.activityId } });
    } else if (n.activityId) {
      router.push({ pathname: '/activity/[id]', params: { id: n.activityId } });
    }
  }

  if (notifications === null) {
    return (
      <View style={styles.centered}>
        <ThemedText style={styles.muted}>{t('notifications.loading')}</ThemedText>
      </View>
    );
  }

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => FILTER_TYPES[activeFilter].includes(n.type));

  const displayItems = buildDisplayItems(filtered, t);
  const unreadTotal = notifications.filter(n => !n.read).length;

  const sections = [
    { key: 'today',     label: t('notifications.sectionToday') },
    { key: 'yesterday', label: t('notifications.sectionYesterday') },
    { key: 'older',     label: t('notifications.sectionOlder') },
  ].map(s => ({
    ...s,
    items: displayItems.filter(item => {
      const t = item.kind === 'single' ? item.notification.createdAt : item.notifications[0].createdAt;
      return getTimeGroup(t) === s.key;
    }),
  })).filter(s => s.items.length > 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>

        {/* Filter row */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
            {(['all', 'requests', 'activities', 'social'] as FilterTab[]).map(tab => {
              const active = activeFilter === tab;
              const label = tab === 'all' ? t('notifications.filterAll') : tab === 'requests' ? t('notifications.filterRequests') : tab === 'activities' ? t('notifications.filterActivities') : t('notifications.filterSocial');
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveFilter(tab)}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {unreadTotal > 0 && (
            <Pressable onPress={handleMarkAll} disabled={submitting} style={({ pressed }) => [styles.markAllBtn, pressed && styles.pressed]}>
              <Text style={styles.markAllText}>{t('notifications.markRead')}</Text>
            </Pressable>
          )}
        </View>

        {/* Empty state */}
        {displayItems.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={40} color="#1e1d22" />
            <ThemedText style={styles.muted}>{t('notifications.empty')}</ThemedText>
          </View>
        )}

        {/* Sections */}
        {sections.map(section => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionLabel}>{section.label}</ThemedText>
              {section.key === 'older' && section.items.length > 0 && (
                <Pressable onPress={() => setShowOlder(v => !v)} style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.viewAllText}>{showOlder ? t('notifications.hide') : t('notifications.viewAll', { count: section.items.length })}</Text>
                </Pressable>
              )}
            </View>

            {(section.key !== 'older' || showOlder) && section.items.map(item => {
              if (item.kind === 'group') {
                const isUnread = item.notifications.some(n => !n.read);
                return (
                  <Pressable
                    key={`group-${item.activityId}`}
                    onPress={() => handleOpenItem(item)}
                    style={({ pressed }) => [styles.row, isUnread && styles.rowUnread, pressed && styles.pressed]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: 'rgba(232,130,63,0.15)' }]}>
                      <Ionicons name="hand-left-outline" size={20} color="#e8823f" />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.notifText, isUnread && styles.notifTextUnread]}>
                        {t('notifications.joinRequestsFor')}
                        <Text style={styles.notifHighlight}>{item.activityTitle}</Text>
                      </Text>
                      <ThemedText style={styles.notifTime}>{relativeDate(item.notifications[0].createdAt, t, language)}</ThemedText>
                      <Pressable
                        onPress={() => { markRead(item.notifications.map(n => n.id)); router.push({ pathname: '/activity/[id]', params: { id: item.activityId } }); }}
                        style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                      >
                        <Text style={styles.actionBtnText}>{t('notifications.reviewRequests')}</Text>
                      </Pressable>
                    </View>
                    {isUnread && <View style={styles.unreadDot} />}
                  </Pressable>
                );
              }

              const n = item.notification;
              const meta = TYPE_META[n.type] ?? { icon: 'notifications-outline' as keyof typeof Ionicons.glyphMap, color: '#c9c5bf' };
              const action = getItemAction(n, t, friendIds);

              return (
                <Pressable
                  key={n.id}
                  onPress={() => handleOpenItem(item)}
                  style={({ pressed }) => [styles.row, !n.read && styles.rowUnread, pressed && styles.pressed]}
                >
                  <View style={[styles.iconCircle, { backgroundColor: meta.color + '18' }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={styles.rowBody}>
                    <HighlightedText text={resolveNotificationText(n, t)} unread={!n.read} />
                    <ThemedText style={styles.notifTime}>{relativeDate(n.createdAt, t, language)}</ThemedText>
                    {action && (
                      <Pressable
                        onPress={() => { markRead([n.id]); action.onPress(); }}
                        style={({ pressed }) => [styles.actionBtn, action.done && styles.actionBtnDone, pressed && styles.pressed]}
                      >
                        {action.done && <Ionicons name="checkmark" size={14} color="#9ccd6b" style={{ marginRight: 4 }} />}
                        <Text style={[styles.actionBtnText, action.done && styles.actionBtnTextDone]}>{action.label}</Text>
                      </Pressable>
                    )}
                  </View>
                  {!n.read && <View style={styles.unreadDot} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: '#0a0a0b', flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.six },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.six },
  emptyState: { alignItems: 'center', gap: 8, paddingTop: 60 },
  muted: { color: '#8f8b85' },

  container: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingTop: Spacing.three },

  // Filter row
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.four, paddingRight: Spacing.four },
  filterScrollContent: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: 'transparent',
  },
  chipActive: { backgroundColor: '#e8823f' },
  chipText: { color: '#8f8b85', fontSize: 13, userSelect: 'none' as any },
  chipTextActive: { color: '#000', fontFamily: 'HankenGrotesk_700Bold' },
  chipBadge: {
    backgroundColor: '#e8823f', borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  chipBadgeText: { color: '#0a0a0b', fontSize: 11, fontWeight: 'bold' },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, marginLeft: 4 },
  markAllText: { color: '#8f8b85', fontSize: 13, userSelect: 'none' as any },

  // Sections
  section: { marginBottom: Spacing.four },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.four, marginBottom: Spacing.one,
  },
  sectionLabel: {
    color: '#8f8b85', fontSize: 11, fontWeight: '600', letterSpacing: 0.8,
  },
  viewAllText: { color: '#e8823f', fontSize: 13, fontWeight: '600', userSelect: 'none' as any },

  // Notification row
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: Spacing.four, paddingVertical: 14,
    backgroundColor: '#111012',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowUnread: { backgroundColor: '#13111a' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowBody: { flex: 1, gap: 2 },

  notifText: { color: '#8f8b85', fontSize: 14, lineHeight: 20 },
  notifTextUnread: { color: '#f4f2ef' },
  notifHighlight: { color: '#e8823f', fontWeight: '600' },
  notifTime: { color: '#8f8b85', fontSize: 12, marginTop: 2 },

  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e8823f', marginTop: 6, flexShrink: 0 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 10, alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#e8823f', borderRadius: 10,
  },
  actionBtnText: { color: '#0a0a0b', fontSize: 13, fontWeight: 'bold' },
  actionBtnDone: {
    backgroundColor: 'rgba(156,205,107,0.12)',
    borderWidth: 1, borderColor: 'rgba(156,205,107,0.35)',
  },
  actionBtnTextDone: { color: '#9ccd6b' },

  pressed: { opacity: 0.7 },
});
