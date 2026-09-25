import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { AvatarCircle } from '@/components/avatar-circle';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useChatBadge } from '@/contexts/chat-badge-context';
import { getActivity, voteMvp } from '@/services/activities';
import { getMessages, sendMessage } from '@/services/messages';
import { getSport } from '@/services/sports';
import { getUserProfile } from '@/services/users';
import { markActivityMessagesAsRead } from '@/services/notifications';
import { Activity } from '@/types/activity';
import { Message } from '@/types/message';
import { PublicUser } from '@/types/user';
import { relativeDate } from '@/utils/date';
import { SportIcon } from '@/utils/sport-icon';
import { useNow } from '@/hooks/use-now';
import { useTranslation } from '@/i18n';

const POLL_INTERVAL_MS = 4000;

type ListItem =
  | { type: 'message'; data: Message; showSenderInfo: boolean }
  | { type: 'system'; id: string; text: string; iconName?: string };

function avatarColor(userId: string): string {
  const colors = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const uid = user?.uid;

  const { markRead } = useChatBadge();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [sportName, setSportName] = useState('');
  const [profiles, setProfiles] = useState<Map<string, PublicUser>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [voting, setVoting] = useState(false);
  const listRef = useRef<FlatList<ListItem>>(null);
  const latestCountRef = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const handleSendRef = useRef<() => void>(() => {});

  const now = useNow(60000);
  const isCompleted = activity?.status === 'completed';
  const isCreator = !!uid && activity?.createdBy === uid;
  const hasVoted = !!(uid && activity?.mvpVotes && uid in activity.mvpVotes);
  const votedForId = uid && activity?.mvpVotes ? activity.mvpVotes[uid] : null;
  const votingClosed = !!activity?.votingClosedAt ||
    (isCompleted && !!activity?.updatedAt && now - new Date(activity.updatedAt).getTime() > 24 * 60 * 60 * 1000);

  useEffect(() => {
    if (!id) return;
    markRead(id);
    markActivityMessagesAsRead(id).catch(() => {});
  }, [id, markRead]);

  useEffect(() => {
    if (!id) return;
    getActivity(id)
      .then((a) => {
        setActivity(a);
        if (a.sportId) {
          getSport(a.sportId)
            .then((s) => setSportName(s.name))
            .catch(() => {});
        }
        const allIds = [...new Set([...a.participantsList, a.createdBy])];
        Promise.allSettled(allIds.map((pid) => getUserProfile(pid))).then((results) => {
          const map = new Map<string, PublicUser>();
          results.forEach((r, i) => {
            if (r.status === 'fulfilled') map.set(allIds[i], r.value);
          });
          setProfiles(map);
        });
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id) return;

    function fetchMessages() {
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      getMessages(id!)
        .then((data) => {
          setMessages((prev) => {
            const temps = prev.filter((m) => m.id.startsWith('temp-'));
            return [...data, ...temps];
          });
          if (data.length > latestCountRef.current) {
            latestCountRef.current = data.length;
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
            const lastMsg = data[data.length - 1];
            markRead(id!, lastMsg ? new Date(lastMsg.createdAt).getTime() : undefined);
          }
        })
        .catch(() => {});
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [id, markRead]);

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const ref = inputRef.current as any;
    const node: HTMLTextAreaElement | null = ref?._node ?? ref?._inputRef?.current ?? ref;
    if (!node?.addEventListener) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendRef.current();
      }
    };
    node.addEventListener('keydown', handler);
    return () => node.removeEventListener('keydown', handler);
  }, []);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending || !id || !uid) return;

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      activityId: id,
      senderId: uid,
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    setText('');
    latestCountRef.current += 1;
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(id, trimmed);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id).map((m) => m.id === tempId ? msg : m));
      markRead(id);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      latestCountRef.current -= 1;
      setError(e instanceof Error ? e.message : t('chat.room.sendError'));
    } finally {
      setSending(false);
    }
  }

  async function handleVote(votedFor: string) {
    if (!id || voting) return;
    setVoting(true);
    try {
      await voteMvp(id, votedFor);
      const updated = await getActivity(id);
      setActivity(updated);
      setVoteModalVisible(false);
    } catch {
      // silently ignore
    } finally {
      setVoting(false);
    }
  }

  // Build flat list items with system events injected
  const items: ListItem[] = [];
  if (activity) {
    const creator = profiles.get(activity.createdBy);
    items.push({
      type: 'system',
      id: 'created',
      text: t('chat.room.createdActivity', {
        name: creator?.name ?? t('chat.room.someone'),
        date: relativeDate(activity.createdAt, t, language),
      }),
    });
  }
  let prevSenderId: string | null = null;
  messages.forEach((m) => {
    items.push({ type: 'message', data: m, showSenderInfo: m.senderId !== prevSenderId });
    prevSenderId = m.senderId;
  });
  if (isCompleted) {
    items.push({ type: 'system', id: 'terminated', text: t('chat.room.activityEnded'), iconName: 'flag-outline' });
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'system') {
      return (
        <View style={styles.systemRow}>
          {item.iconName ? (
            <Ionicons name={item.iconName as any} size={13} color="#8f8b85" style={{ marginRight: 5 }} />
          ) : null}
          <ThemedText style={styles.systemText}>{item.text}</ThemedText>
        </View>
      );
    }

    const msg = item.data;
    const isOwn = msg.senderId === uid;
    const profile = profiles.get(msg.senderId);
    const color = avatarColor(msg.senderId);

    return (
      <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
        {!isOwn && (
          <Pressable
            style={styles.avatarSlot}
            onPress={() =>
              item.showSenderInfo &&
              router.push({ pathname: '/user/[id]', params: { id: msg.senderId } })
            }>
            {item.showSenderInfo && (
              <AvatarCircle
                name={profile?.name ?? '?'}
                avatarUrl={profile?.avatarUrl}
                size={36}
                backgroundColor={color}
              />
            )}
          </Pressable>
        )}

        <View style={[styles.bubbleCol, isOwn && { alignItems: 'flex-end' }]}>
          {item.showSenderInfo && (
            <ThemedText
              style={[
                styles.senderName,
                isOwn && { marginLeft: 0, marginRight: 4, textAlign: 'right' as const },
              ]}>
              {isOwn ? t('chat.room.you') : (profile?.name ?? '...')}
            </ThemedText>
          )}
          <View style={[styles.bubbleInner, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
            <ThemedText style={styles.bubbleText}>{msg.text}</ThemedText>
            <View style={styles.bubbleMeta}>
              <ThemedText
                style={[styles.bubbleTime, { color: isOwn ? 'rgba(255,255,255,0.6)' : '#8f8b85' }]}>
                {new Date(msg.createdAt).toLocaleTimeString('pt-PT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </ThemedText>
              {isOwn && (
                <Ionicons name="checkmark-done-outline" size={14} color="rgba(255,255,255,0.5)" />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }

  const count = activity?.participantsList.length ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () =>
            activity ? (
              <Pressable
                onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
                style={({ pressed }) => [styles.headerTitle, pressed && { opacity: 0.7 }]}>
                <View style={styles.headerIconWrap}>
                  <SportIcon sportName={sportName} size={20} color="#e8823f" />
                </View>
                <View>
                  <ThemedText style={styles.headerName} numberOfLines={1}>
                    {activity.title}
                  </ThemedText>
                  <ThemedText style={styles.headerSub} numberOfLines={1}>
                    {t(count === 1 ? 'chat.participants.one' : 'chat.participants.other', { count })} · {activity.location.name}
                  </ThemedText>
                </View>
              </Pressable>
            ) : null,
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[styles.flex, styles.centered]}>
          <View style={[styles.flex, { width: '100%', maxWidth: MaxContentWidth }]}>

            <FlatList
              ref={listRef}
              data={items}
              keyExtractor={(item) => (item.type === 'system' ? item.id : item.data.id)}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <ThemedText style={styles.empty}>{t('chat.room.emptyMessages')}</ThemedText>
              }
              onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            />

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            {isCompleted && isCreator ? (
              <View style={[styles.readOnlyRow, { paddingBottom: insets.bottom + 16, paddingTop: 12, justifyContent: 'center' }]}>
                <Ionicons name="lock-closed-outline" size={14} color="#8f8b85" />
                <ThemedText style={styles.readOnlyText}>Já não é possível enviar mensagens</ThemedText>
              </View>
            ) : isCompleted ? (
              <View style={[styles.votingSection, { paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.votingHeader}>
                  <View style={styles.trophyWrap}>
                    <Ionicons
                      name="trophy-outline"
                      size={20}
                      color={hasVoted || votingClosed ? '#8f8b85' : '#e8823f'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.votingTitle}>
                      {hasVoted
                        ? t('chat.room.voteRegistered')
                        : votingClosed
                          ? t('chat.room.votingClosedTitle')
                          : t('chat.room.voteCta')}
                    </ThemedText>
                    <ThemedText style={styles.votingSubtitle}>
                      {hasVoted
                        ? t('chat.room.votedFor', { name: profiles.get(votedForId!)?.name ?? t('chat.room.someoneInline') })
                        : votingClosed
                          ? t('chat.room.votingExpired')
                          : t('chat.room.votingOpen')}
                    </ThemedText>
                  </View>
                </View>
                {hasVoted ? (
                  <View style={styles.voteBtnDone}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#8f8b85" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.voteBtnDoneText}>{t('chat.room.alreadyVoted')}</ThemedText>
                  </View>
                ) : votingClosed ? (
                  <View style={styles.voteBtnDone}>
                    <ThemedText style={styles.voteBtnDoneText}>{t('chat.room.voteUnavailable')}</ThemedText>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.voteBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => setVoteModalVisible(true)}>
                    <ThemedText style={styles.voteBtnText}>{t('chat.room.voteNow')}</ThemedText>
                  </Pressable>
                )}
                <View style={styles.readOnlyRow}>
                  <Ionicons name="lock-closed-outline" size={12} color="#8f8b85" />
                  <ThemedText style={styles.readOnlyText}>
                    {t('chat.room.readOnlyMode')}
                  </ThemedText>
                </View>
              </View>
            ) : activity?.createdByVerified && !isCreator ? (
              <View style={[styles.readOnlyRow, { paddingBottom: insets.bottom + 16, paddingTop: 12, justifyContent: 'center' }]}>
                <Ionicons name="lock-closed-outline" size={14} color="#8f8b85" />
                <ThemedText style={styles.readOnlyText}>Só o organizador pode enviar mensagens</ThemedText>
              </View>
            ) : (
              <View style={[styles.inputRow, { paddingBottom: insets.bottom + Spacing.two }]}>
                <TextInput
                  style={styles.input}
                  placeholder={t('chat.room.messagePlaceholder')}
                  placeholderTextColor="#8f8b85"
                  value={text}
                  onChangeText={setText}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  ref={inputRef}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.sendBtn,
                    { opacity: !text.trim() || sending ? 0.4 : pressed ? 0.75 : 1 },
                  ]}
                  onPress={handleSend}
                  disabled={!text.trim() || sending}>
                  <Ionicons name="send" size={20} color="#f4f2ef" style={{ marginLeft: 4 }} />
                </Pressable>
              </View>
            )}

          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={voteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVoteModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVoteModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ThemedText style={styles.modalTitle}>{t('chat.room.voteModalTitle')}</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              {t('chat.room.voteModalSubtitle')}
            </ThemedText>
            {activity?.participantsList
              .filter((pid) => pid !== uid)
              .map((pid) => {
                const profile = profiles.get(pid);
                return (
                  <Pressable
                    key={pid}
                    style={({ pressed }) => [styles.modalRow, pressed && { opacity: 0.7 }]}
                    onPress={() => handleVote(pid)}
                    disabled={voting}>
                    <AvatarCircle
                      name={profile?.name ?? '?'}
                      avatarUrl={profile?.avatarUrl}
                      size={40}
                      backgroundColor={avatarColor(pid)}
                    />
                    <ThemedText style={styles.modalName}>{profile?.name ?? '...'}</ThemedText>
                    <Ionicons name="chevron-forward" size={16} color="#8f8b85" />
                  </Pressable>
                );
              })}
            <Pressable
              style={styles.modalCancel}
              onPress={() => setVoteModalVisible(false)}>
              <ThemedText style={styles.modalCancelText}>{t('chat.room.cancel')}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0b' },
  centered: { alignItems: 'center' },

  // Header
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(232,130,63,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: { fontSize: 15, fontWeight: '600', color: '#f4f2ef' },
  headerSub: { fontSize: 12, color: '#8f8b85', marginTop: 1 },

  // List
  listContent: { padding: Spacing.three, gap: 2, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#8f8b85', marginTop: 40 },

  // System messages
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  systemText: {
    fontSize: 12,
    color: '#8f8b85',
    textAlign: 'center',
  },

  // Message rows
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, marginVertical: 2 },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatarSlot: { width: 36, height: 36, borderRadius: 18, flexShrink: 0 },
  bubbleCol: { maxWidth: '75%', gap: 3 },
  senderName: { fontSize: 12, color: '#c9c5bf', marginLeft: 4 },
  bubbleInner: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, gap: 4 },
  bubbleOwn: { backgroundColor: '#e8823f', borderBottomRightRadius: 4 },
  bubbleOther: {
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { color: '#f4f2ef', fontSize: 15 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  bubbleTime: { fontSize: 11 },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
    backgroundColor: '#0a0a0b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: '#111012',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    color: '#f4f2ef',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8823f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#eb8f84', textAlign: 'center', paddingHorizontal: Spacing.three, paddingBottom: 6 },

  // Voting section
  votingSection: {
    backgroundColor: '#0c0c0d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: Spacing.three,
    paddingTop: 16,
    gap: 12,
  },
  votingHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trophyWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(232,130,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  votingTitle: { fontSize: 15, fontWeight: '600', color: '#f4f2ef' },
  votingSubtitle: { fontSize: 13, color: '#8f8b85', marginTop: 2 },
  voteBtn: {
    backgroundColor: '#e8823f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  voteBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  voteBtnDone: {
    backgroundColor: '#1e1e20',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  voteBtnDoneText: { color: '#8f8b85', fontSize: 16, fontWeight: '700' },
  readOnlyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center', paddingBottom: 4 },
  readOnlyText: { fontSize: 12, color: '#8f8b85' },

  // MVP voting modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111012',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 4,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f4f2ef', textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: '#8f8b85', textAlign: 'center', marginBottom: 12 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalName: { flex: 1, fontSize: 15, color: '#f4f2ef', fontWeight: '500' },
  modalCancel: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#8f8b85' },
});
