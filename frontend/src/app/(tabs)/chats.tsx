import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AvatarCircle } from '@/components/avatar-circle';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useChatBadge } from '@/contexts/chat-badge-context';
import { getMyActivities, listActivities } from '@/services/activities';
import { getConversations, openConversation } from '@/services/conversations';
import { getFriends } from '@/services/friends';
import { getLastActivityMessage } from '@/services/messages';
import { listSports } from '@/services/sports';
import { Activity } from '@/types/activity';
import { Friend } from '@/types/friend';
import { Conversation } from '@/types/message';
import { relativeDate } from '@/utils/date';
import { SportIcon } from '@/utils/sport-icon';
import { useTranslation } from '@/i18n';

type ChatTab = 'friends' | 'activities';

type MessagePreview = { text: string; senderName: string; createdAt: string } | null;

const messagePreviewCache = new Map<string, MessagePreview>();

function avatarColor(userId: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

export default function ChatsScreen() {
  const { user, profile } = useAuth();
  const isPartner = profile?.role === 'partner';
  const { t, language } = useTranslation();
  const safeAreaInsets = useSafeAreaInsets();
  const { checkUnread, checkUnreadConversations, unreadIds = [], unreadConversationIds = [] } = useChatBadge();
  const [tab, setTab] = useState<ChatTab>('activities');
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sportsMap, setSportsMap] = useState<Map<string, string>>(new Map());

  const [newChatMode, setNewChatMode] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [newChatError, setNewChatError] = useState<string | null>(null);

  useEffect(() => {
    listSports()
      .then((sports) => setSportsMap(new Map(sports.map((s) => [s.id, s.name]))))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const uid = user?.uid ?? '';
    const fetch = isPartner
      ? Promise.all([listActivities({ createdBy: uid }), listActivities({ createdBy: uid, status: 'completed' })]).then(([a, b]) => [...a, ...b])
      : getMyActivities();
    fetch.then(async (data) => {
      setActivities(data);
      const chattable = data
        .filter((a) => a.status !== 'cancelled' && (isPartner || (a.participantsList || []).includes(uid)))
        .map((a) => ({ id: a.id, lastMessageAt: a.lastMessageAt, lastMessageSenderId: a.lastMessageSenderId }));
      checkUnread(chattable, uid);

      const needsPreview = data.filter(
        (a) => (a.status === 'open' || a.status === 'full') && !a.lastMessage && (isPartner || (a.participantsList || []).includes(uid))
      );
      const toFetch = needsPreview.filter((a) => !messagePreviewCache.has(a.id));
      if (toFetch.length > 0) {
        const results = await Promise.allSettled(toFetch.map((a) => getLastActivityMessage(a.id)));
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') messagePreviewCache.set(toFetch[idx].id, r.value);
        });
      }
      if (needsPreview.length > 0) {
        setActivities((prev) =>
          (prev ?? []).map((a) => {
            const preview = messagePreviewCache.get(a.id);
            if (a.lastMessage || !preview) return a;
            return { ...a, lastMessage: preview.text, lastMessageSender: preview.senderName, lastMessageAt: preview.createdAt };
          })
        );
      }
    }).catch(() => setActivities([]));

    getConversations().then((data) => {
      setConversations(data);
      checkUnreadConversations(data, user?.uid);
    }).catch(() => setConversations([]));
  }, [checkUnread, checkUnreadConversations, isPartner, user?.uid]);

  useFocusEffect(load);

  async function onRefresh() {
    setRefreshing(true);
    try { load(); } finally { setRefreshing(false); }
  }

  async function enterNewChat() {
    setNewChatMode(true);
    setNewChatError(null);
    if (friends === null) {
      getFriends().then(setFriends).catch(() => setFriends([]));
    }
  }

  async function startChatWith(friendId: string, friendName: string, friendAvatarUrl?: string) {
    if (opening) return;
    setOpening(friendId);
    setNewChatError(null);
    try {
      const { conversationId } = await openConversation(friendId);
      setNewChatMode(false);
      router.push({ pathname: '/direct-chat/[id]', params: { id: conversationId, name: friendName, avatarUrl: friendAvatarUrl, userId: friendId } });
    } catch (e) {
      setNewChatError(e instanceof Error ? e.message : t('chat.list.openConversationError'));
    } finally {
      setOpening(null);
    }
  }

  const uid = user?.uid ?? '';
  const allChats = (activities ?? []).filter(
    (a) => a.status !== 'cancelled' && (isPartner || (a.participantsList || []).includes(uid))
  );
  const activeChats = allChats.filter((a) => a.status === 'open' || a.status === 'full');
  const pastChats = allChats.filter((a) => a.status === 'completed');

  const q = searchQuery.trim().toLowerCase();
  const filteredConversations = q
    ? (conversations ?? []).filter((c) => c.otherUser.name.toLowerCase().includes(q))
    : (conversations ?? []);
  const filteredActiveChats = q ? activeChats.filter((a) => a.title.toLowerCase().includes(q)) : activeChats;
  const filteredPastChats = q ? pastChats.filter((a) => a.title.toLowerCase().includes(q)) : pastChats;

  function renderActivityRow(activity: Activity) {
    const isUnread = unreadIds.includes(activity.id);
    const sportName = sportsMap.get(activity.sportId) ?? '';
    const isPast = activity.status === 'completed';
    const timeStr = activity.lastMessageAt ? relativeDate(activity.lastMessageAt, t, language) : '';
    const count = activity.participantsList.length;
    const participantsLabel = t(count === 1 ? 'chat.participants.one' : 'chat.participants.other', { count });
    const subtitle = activity.lastMessage
      ? `${activity.lastMessageSender ?? ''}: ${activity.lastMessage}`
      : isPast
        ? `${activity.location.name} · ${participantsLabel}`
        : participantsLabel;

    return (
      <Link key={activity.id} href={{ pathname: '/chat/[id]', params: { id: activity.id } }} asChild>
        <Pressable style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}>
          <View style={[styles.rowInner, isPast && styles.rowPast, isUnread && styles.rowInnerUnread]}>
            <View style={[styles.sportIconWrap, isPast && styles.sportIconWrapPast]}>
              <SportIcon sportName={sportName} size={22} color={isPast ? '#6b6862' : '#e8823f'} />
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <View style={styles.rowTitleWrap}>
                  <ThemedText style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={1}>{activity.title}</ThemedText>
                  {isPast && (
                    <View style={styles.terminadaChip}>
                      <ThemedText style={styles.terminadaText}>{t('chat.list.endedBadge')}</ThemedText>
                    </View>
                  )}
                </View>
                {!!timeStr && <ThemedText style={styles.rowTime}>{timeStr}</ThemedText>}
              </View>
              <View style={styles.rowBottom}>
                <ThemedText style={styles.rowSub} numberOfLines={1}>{subtitle}</ThemedText>
                {isUnread && <View style={styles.unreadDot} />}
              </View>
            </View>
          </View>
        </Pressable>
      </Link>
    );
  }

  function renderConversationRow(conversation: Conversation) {
    const isUnread = unreadConversationIds.includes(conversation.id);
    const timeStr = conversation.lastMessageAt ? relativeDate(conversation.lastMessageAt, t, language) : '';

    return (
      <Link
        key={conversation.id}
        href={{
          pathname: '/direct-chat/[id]',
          params: { id: conversation.id, name: conversation.otherUser.name, avatarUrl: conversation.otherUser.avatarUrl, userId: conversation.otherUser.id },
        }}
        asChild>
        <Pressable style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}>
          <View style={[styles.rowInner, isUnread && styles.rowInnerUnread]}>
            <AvatarCircle
              name={conversation.otherUser.name}
              avatarUrl={conversation.otherUser.avatarUrl}
              size={44}
              backgroundColor={avatarColor(conversation.otherUser.id)}
            />
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <ThemedText style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={1}>{conversation.otherUser.name}</ThemedText>
                {!!timeStr && <ThemedText style={styles.rowTime}>{timeStr}</ThemedText>}
              </View>
              <View style={styles.rowBottom}>
                {conversation.lastMessage ? (
                  <ThemedText style={styles.rowSub} numberOfLines={1}>
                    {conversation.lastMessageSenderId === uid ? t('chat.list.youPrefix') : ''}{conversation.lastMessage}
                  </ThemedText>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                {isUnread && <View style={styles.unreadDot} />}
              </View>
            </View>
          </View>
        </Pressable>
      </Link>
    );
  }

  function renderFriendPickerRow(friend: Friend) {
    const isOpening = opening === friend.userId;
    return (
      <Pressable
        key={friend.userId}
        onPress={() => startChatWith(friend.userId, friend.user.name, friend.user.avatarUrl)}
        style={({ pressed }) => [styles.rowCard, (pressed || isOpening) && styles.pressed]}>
        <View style={styles.rowInner}>
          <AvatarCircle
            name={friend.user.name}
            avatarUrl={friend.user.avatarUrl}
            size={44}
            backgroundColor={avatarColor(friend.userId)}
          />
          <View style={styles.rowBody}>
            <ThemedText style={styles.rowTitle} numberOfLines={1}>{friend.user.name}</ThemedText>
          </View>
          <Ionicons name="chatbubble-outline" size={20} color="#e8823f" />
        </View>
      </Pressable>
    );
  }

  const topPadding = TopTabInset + Spacing.four;
  const bottomPadding = BottomTabInset + safeAreaInsets.bottom + Spacing.four;

  if (newChatMode) {
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => setNewChatMode(false)} hitSlop={12}>
              <Ionicons name="arrow-back" size={24} color="#e8823f" />
            </Pressable>
            <ThemedText type="title" style={styles.pageTitle}>{t('chat.list.newChatTitle')}</ThemedText>
          </View>
          {newChatError && <ThemedText type="small" style={styles.errorText}>{newChatError}</ThemedText>}
          {friends === null && <ThemedText style={styles.emptyText}>{t('chat.list.loadingFriends')}</ThemedText>}
          {friends !== null && friends.length === 0 && (
            <ThemedText style={styles.emptyText}>
              {t('chat.list.noFriendsYet')}
            </ThemedText>
          )}
          {(friends ?? []).map(renderFriendPickerRow)}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e8823f" />}>
      <View style={styles.container}>

        <View style={styles.headerRow}>
          <ThemedText type="title" style={styles.pageTitle}>{t('chat.list.title')}</ThemedText>
          {tab === 'friends' && (
            <Pressable onPress={enterNewChat} style={({ pressed }) => [styles.composeBtn, pressed && styles.pressed]} hitSlop={8}>
              <Ionicons name="create-outline" size={20} color="#1a1005" />
            </Pressable>
          )}
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color="#8f8b85" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('chat.list.searchPlaceholder')}
            placeholderTextColor="#8f8b85"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#8f8b85" />
            </Pressable>
          )}
        </View>

        <View style={styles.tabsRow}>
          <Pressable onPress={() => setTab('activities')} style={styles.tabBtn}>
            <ThemedText style={[styles.tabText, tab === 'activities' && styles.tabTextActive]}>
              {t('chat.list.tabActivities')}{activities !== null ? ` ${allChats.length}` : ''}
            </ThemedText>
            {tab === 'activities' && <View style={styles.tabUnderline} />}
          </Pressable>
          {!isPartner && (
            <Pressable onPress={() => setTab('friends')} style={styles.tabBtn}>
              <ThemedText style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>
                {t('chat.list.tabFriends')}{conversations !== null ? ` ${conversations.length}` : ''}
              </ThemedText>
              {tab === 'friends' && <View style={styles.tabUnderline} />}
            </Pressable>
          )}
        </View>

        {tab === 'friends' && (
          <>
            {conversations === null && <ThemedText style={styles.emptyText}>{t('chat.list.loading')}</ThemedText>}
            {conversations !== null && filteredConversations.length === 0 && (
              <ThemedText style={styles.emptyText}>
                {q ? t('chat.list.noResults') : t('chat.list.noConversationsYet')}
              </ThemedText>
            )}
            {filteredConversations.map(renderConversationRow)}
          </>
        )}

        {tab === 'activities' && (
          <>
            {activities === null && <ThemedText style={styles.emptyText}>{t('chat.list.loading')}</ThemedText>}
            {activities !== null && allChats.length === 0 && (
              <ThemedText style={styles.emptyText}>
                {isPartner
                  ? 'Ainda não criaste nenhuma atividade. Cria uma para poder comunicar com os participantes!'
                  : t('chat.list.noActivitiesYet')}
              </ThemedText>
            )}

            {filteredActiveChats.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: '#9ccd6b' }]} />
                  <ThemedText style={[styles.sectionLabel, { color: '#9ccd6b' }]}>{t('chat.list.sectionOngoing')}</ThemedText>
                </View>
                {filteredActiveChats.map(renderActivityRow)}
              </>
            )}

            {filteredPastChats.length > 0 && (
              <>
                <View style={[styles.sectionHeader, filteredActiveChats.length > 0 && { marginTop: Spacing.three }]}>
                  <View style={[styles.sectionDot, { backgroundColor: '#8f8b85' }]} />
                  <ThemedText style={styles.sectionLabel}>{t('chat.list.sectionEnded')}</ThemedText>
                </View>
                {filteredPastChats.map(renderActivityRow)}
                {!isPartner && (
                  <View style={styles.infoBanner}>
                    <Ionicons name="trophy-outline" size={18} color="#e8823f" style={{ marginTop: 1 }} />
                    <ThemedText style={styles.infoBannerText}>
                      {t('chat.list.mvpBannerBefore')} <ThemedText style={styles.infoBannerLink}>{t('chat.list.mvpLabel')}</ThemedText> {t('chat.list.mvpBannerAfter')}
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </>
        )}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: '#0c0c0d',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  pageTitle: {
    color: '#f4f2ef',
    fontSize: 32,
  },
  composeBtn: {
    width: 40,
    height: 40,
    marginRight: 64,
    borderRadius: 12,
    backgroundColor: '#e8823f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#141315',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.three,
  },
  searchInput: {
    flex: 1,
    color: '#f4f2ef',
    fontSize: 14,
    height: 20,
    padding: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: Spacing.two,
  },
  tabBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 24,
    position: 'relative',
  },
  tabText: {
    color: '#8f8b85',
    fontSize: 14,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  tabTextActive: {
    color: '#f4f2ef',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#e8823f',
    borderRadius: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  sectionLabel: {
    color: '#8f8b85',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  rowCard: {
    marginBottom: 20,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    backgroundColor: '#111012',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowInnerUnread: {
    backgroundColor: 'rgba(232,130,63,0.08)',
    borderColor: 'rgba(232,130,63,0.35)',
    borderLeftWidth: 3,
    paddingLeft: 12,
  },
  sportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sportIconWrapPast: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowPast: {
    opacity: 0.65,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  rowTitle: {
    color: '#f4f2ef',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowTitleUnread: {
    fontWeight: '800',
  },
  terminadaChip: {
    backgroundColor: '#2a2a2e',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
  },
  terminadaText: {
    color: '#8f8b85',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  rowTimeDot: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  rowTime: {
    color: '#8f8b85',
    fontSize: 12,
    flexShrink: 0,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowSub: {
    color: '#8f8b85',
    fontSize: 13,
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e8823f',
    borderWidth: 2,
    borderColor: 'rgba(232,130,63,0.35)',
    flexShrink: 0,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e8823f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(232,130,63,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,130,63,0.2)',
    padding: 12,
    marginTop: Spacing.three,
    alignItems: 'flex-start',
  },
  infoBannerText: {
    flex: 1,
    color: '#8f8b85',
    fontSize: 12,
    lineHeight: 18,
  },
  infoBannerLink: {
    color: '#e8823f',
    fontWeight: '600',
  },
  emptyText: {
    color: '#8f8b85',
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    color: '#eb8f84',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
