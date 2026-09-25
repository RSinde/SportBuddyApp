import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { Friend, FriendRequest, FriendUser } from '@/types/friend';
import { openConversation } from '@/services/conversations';
import { acceptFriendRequest, getFriends, getPendingRequests, rejectFriendRequest, removeFriend, sendFriendRequest } from '@/services/friends';
import { followUser, searchUsers, unfollowUser } from '@/services/users';
import { useTranslation } from '@/i18n';

const SEARCH_DEBOUNCE_MS = 400;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function AvatarCircle({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />;
  }
  return (
    <View style={styles.avatar}>
      <ThemedText style={styles.avatarText}>{initials(name)}</ThemedText>
    </View>
  );
}

export default function FriendsScreen() {
  const { user: me, profile: myProfile, patchProfile } = useAuth();
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const [friendFilter, setFriendFilter] = useState('');

  const [addMode, setAddMode] = useState(mode === 'search');
  const [friendsOnly, setFriendsOnly] = useState(mode !== 'search');
  const [addQuery, setAddQuery] = useState('');
  const [results, setResults] = useState<FriendUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followBusyIds, setFollowBusyIds] = useState<string[]>([]);

  useEffect(() => {
    if (!addMode) return;
    const trimmed = addQuery.trim();
    if (trimmed.length < 1) {
      queueMicrotask(() => {
        setResults(null);
        setSearching(false);
        setSearchError(null);
      });
      return;
    }
    queueMicrotask(() => setSearching(true));
    const timer = setTimeout(() => {
      searchUsers(trimmed)
        .then((users) => {
          const filtered = users.filter((u) => u.id !== me?.uid && (!friendsOnly || u.role !== 'partner'));
          setResults(filtered);
          setFollowingIds(filtered.filter((u) => u.isFollowing).map((u) => u.id));
          setSearchError(null);
        })
        .catch(() => {
          setResults([]);
          setSearchError(t('profile.friends.searchError'));
        })
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [addQuery, addMode, me?.uid]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        setLoading(true);
        try {
          const [reqs, frs] = await Promise.all([getPendingRequests(), getFriends()]);
          setRequests(reqs);
          setFriends(frs);
        } finally {
          setLoading(false);
        }
      }
      load();
    }, [])
  );

  function exitAddMode() {
    setAddMode(false);
    setFriendsOnly(false);
    setAddQuery('');
    setResults(null);
    setSearchError(null);
  }

  async function handleAccept(req: FriendRequest) {
    await acceptFriendRequest(req.requestId);
    setRequests((prev) => prev.filter((r) => r.requestId !== req.requestId));
    setFriends((prev) => [{ userId: req.from.id, user: req.from }, ...prev]);
  }

  async function handleReject(requestId: string) {
    await rejectFriendRequest(requestId);
    setRequests((prev) => prev.filter((r) => r.requestId !== requestId));
  }

  async function handleRemove(friendId: string) {
    await removeFriend(friendId);
    setFriends((prev) => prev.filter((f) => f.userId !== friendId));
  }

  async function handleOpenChat(friend: Friend) {
    try {
      const { conversationId } = await openConversation(friend.userId);
      router.push({
        pathname: '/direct-chat/[id]',
        params: { id: conversationId, name: friend.user.name, avatarUrl: friend.user.avatarUrl },
      });
    } catch {}
  }

  async function handleSendRequest(user: FriendUser) {
    try {
      await sendFriendRequest(user.id);
      setSentIds((prev) => [...prev, user.id]);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'Já enviaste um pedido a este utilizador' || message === 'Já são amigos') {
        setSentIds((prev) => [...prev, user.id]);
      } else {
        setSearchError(message || t('profile.addFriend.genericError'));
      }
    }
  }

  async function handleToggleFollow(orgUser: FriendUser) {
    if (followBusyIds.includes(orgUser.id)) return;
    const isFollowing = followingIds.includes(orgUser.id);
    setFollowBusyIds((prev) => [...prev, orgUser.id]);
    try {
      if (isFollowing) {
        await unfollowUser(orgUser.id);
        setFollowingIds((prev) => prev.filter((id) => id !== orgUser.id));
        patchProfile({ following: (myProfile?.following ?? []).filter(f => f !== orgUser.id) });
      } else {
        await followUser(orgUser.id);
        setFollowingIds((prev) => [...prev, orgUser.id]);
        patchProfile({ following: [...(myProfile?.following ?? []), orgUser.id] });
      }
    } finally {
      setFollowBusyIds((prev) => prev.filter((id) => id !== orgUser.id));
    }
  }

  const friendIds = friends.map((f) => f.userId);
  const filteredFriends = friendFilter.trim()
    ? friends.filter((f) => f.user.name.toLowerCase().includes(friendFilter.trim().toLowerCase()))
    : friends;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e8823f" />
      </View>
    );
  }

  if (addMode) {
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.addHeader}>
            <Pressable onPress={exitAddMode} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#f4f2ef" />
            </Pressable>
            <ThemedText style={styles.addHeaderTitle}>{friendsOnly ? t('profile.friends.addPeopleTitle') : t('profile.friends.addFriendTitle')}</ThemedText>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#8f8b85" />
            <TextInput
              style={[styles.searchInput, { outline: 'none' } as any]}
              placeholder={t('profile.friends.searchPlaceholder')}
              placeholderTextColor="#8f8b85"
              value={addQuery}
              onChangeText={setAddQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {addQuery.length > 0 && (
              <Pressable onPress={() => setAddQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#8f8b85" />
              </Pressable>
            )}
          </View>

          {searchError && <ThemedText style={styles.searchError}>{searchError}</ThemedText>}

          {results === null ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyText}>{t('profile.friends.typeToSearch')}</ThemedText>
            </View>
          ) : results.length === 0 && !searching ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyText}>{t('profile.friends.noUsersFound')}</ThemedText>
            </View>
          ) : (
            <>
              <ThemedText style={styles.sectionTitle}>
                {searching ? t('profile.friends.resultsSearching') : t('profile.friends.resultsCount', { count: results.length })}
              </ThemedText>
              {results.map((u) => {
                const isOrg = u.role === 'partner';
                const isFriend = friendIds.includes(u.id);
                const isSent = sentIds.includes(u.id);
                const isFollowing = followingIds.includes(u.id);
                const followBusy = followBusyIds.includes(u.id);
                return (
                  <Pressable
                    key={u.id}
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/user/[id]', params: { id: u.id } })}
                  >
                    <AvatarCircle name={u.name} avatarUrl={u.avatarUrl} />
                    <View style={styles.nameColumn}>
                      <ThemedText style={styles.name}>{u.name}</ThemedText>
                      {isOrg && (
                        <View style={styles.companyBadge}>
                          <Ionicons name="business-outline" size={11} color="#e8823f" />
                          <ThemedText style={styles.companyBadgeText}>{t('profile.friends.companyBadge')}</ThemedText>
                        </View>
                      )}
                    </View>
                    <View style={styles.actions}>
                      {isOrg ? (
                        <Pressable
                          style={isFollowing ? styles.chatBtn : styles.addBtn}
                          onPress={() => handleToggleFollow(u)}
                          disabled={followBusy}
                          hitSlop={4}
                        >
                          <Ionicons
                            name={isFollowing ? 'checkmark' : 'add'}
                            size={18}
                            color={isFollowing ? '#c9c5bf' : '#e8823f'}
                          />
                        </Pressable>
                      ) : isFriend ? (
                        <View style={styles.acceptBtn}>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#9ccd6b" />
                        </View>
                      ) : isSent ? (
                        <View style={styles.chatBtn}>
                          <Ionicons name="hourglass-outline" size={18} color="#475569" />
                        </View>
                      ) : (
                        <Pressable style={styles.addBtn} onPress={() => handleSendRequest(u)} hitSlop={4}>
                          <Ionicons name="person-add-outline" size={18} color="#e8823f" />
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>

        {requests.length > 0 && (
          <>
            <ThemedText style={styles.sectionTitle}>{t('profile.friends.requestsCount', { count: requests.length })}</ThemedText>
            {requests.map((req) => (
              <View key={req.requestId} style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.friendInfo, pressed && styles.pressed]}
                  onPress={() => router.push({ pathname: '/user/[id]', params: { id: req.from.id } })}>
                  <AvatarCircle name={req.from.name} avatarUrl={req.from.avatarUrl} />
                  <ThemedText style={styles.name}>{req.from.name}</ThemedText>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable style={styles.acceptBtn} onPress={() => handleAccept(req)}>
                    <Ionicons name="checkmark" size={18} color="#9ccd6b" />
                  </Pressable>
                  <Pressable style={styles.rejectBtn} onPress={() => handleReject(req.requestId)}>
                    <Ionicons name="close" size={18} color="#eb8f84" />
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={styles.friendsHeader}>
          <ThemedText style={styles.sectionTitle}>{t('profile.friends.friendsCount', { count: friends.length })}</ThemedText>
          <Pressable style={styles.addFriendBtn} onPress={() => { setAddMode(true); setFriendsOnly(true); }} hitSlop={8}>
            <Ionicons name="person-add-outline" size={18} color="#e8823f" />
          </Pressable>
        </View>

        {friends.length > 0 && (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#8f8b85" />
            <TextInput
              style={[styles.searchInput, { outline: 'none' } as any]}
              placeholder={t('profile.friends.filterPlaceholder')}
              placeholderTextColor="#8f8b85"
              value={friendFilter}
              onChangeText={setFriendFilter}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {friendFilter.length > 0 && (
              <Pressable onPress={() => setFriendFilter('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#8f8b85" />
              </Pressable>
            )}
          </View>
        )}

        {filteredFriends.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#141315" style={{ marginBottom: 8 }} />
            <ThemedText style={styles.emptyText}>
              {friends.length === 0
                ? t('profile.friends.noFriendsYet')
                : t('profile.friends.noFriendsFound')}
            </ThemedText>
          </View>
        ) : (
          filteredFriends.map((f) => (
            <View key={f.userId} style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.friendInfo, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: f.userId } })}>
                <AvatarCircle name={f.user.name} avatarUrl={f.user.avatarUrl} />
                <ThemedText style={styles.name}>{f.user.name}</ThemedText>
              </Pressable>
              <View style={styles.actions}>
                <Pressable style={styles.chatBtn} onPress={() => handleOpenChat(f)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#e8823f" />
                </Pressable>
                <Pressable style={styles.rejectBtn} onPress={() => handleRemove(f.userId)}>
                  <Ionicons name="person-remove-outline" size={18} color="#eb8f84" />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { backgroundColor: '#0a0a0b' },
  scrollContent: { flexGrow: 1, paddingVertical: Spacing.four },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0b' },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    color: '#f4f2ef',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: Spacing.two,
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addFriendBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(232,130,63,0.12)',
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addHeaderTitle: {
    color: '#f4f2ef',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111012',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: '#f4f2ef',
    fontSize: 15,
    height: '100%',
  },
  searchError: {
    color: '#eb8f84',
    fontSize: 13,
    textAlign: 'center',
  },
  addBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(232,130,63,0.12)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111012',
    borderRadius: 12,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8823f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#1a1005',
    fontSize: 15,
    fontWeight: 'bold',
  },
  name: {
    flex: 1,
    color: '#f4f2ef',
    fontSize: 15,
  },
  nameColumn: {
    flex: 1,
    gap: 3,
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(232,130,63,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  companyBadgeText: {
    color: '#e8823f',
    fontSize: 10,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  pressed: { opacity: 0.7 },
  acceptBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(156,205,107,0.15)',
  },
  rejectBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(235,143,132,0.15)',
  },
  chatBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#14131540',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  emptyText: {
    color: '#8f8b85',
    fontSize: 14,
    textAlign: 'center',
  },
});
