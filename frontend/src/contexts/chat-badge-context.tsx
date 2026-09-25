import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/auth-context';

const STORAGE_KEY_PREFIX = '@chat_last_seen_v2_';

type ConversationMeta = {
  id: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
};

type ChatBadgeContextValue = {
  unreadCount: number;
  unreadIds: string[];
  unreadConversationIds: string[];
  markRead: (chatId: string, asOfServerTime?: number) => Promise<void>;
  checkUnread: (activities: ConversationMeta[], currentUserId?: string) => Promise<void>;
  checkUnreadConversations: (conversations: ConversationMeta[], currentUserId?: string) => Promise<void>;
};

const ChatBadgeContext = createContext<ChatBadgeContextValue | undefined>(undefined);

// Deriva o estado de "não lido" a partir dos metadados já carregados na
// listagem de atividades/conversas (lastMessageAt/lastMessageSenderId), em
// vez de ir buscar as mensagens de cada chat uma a uma — isso multiplicava
// os pedidos ao servidor por cada atividade e esgotava o rate limit.
function findUnread(
  items: ConversationMeta[],
  lastSeenMap: Record<string, number>,
  currentUserId?: string
): Set<string> {
  const unread = new Set<string>();
  for (const item of items) {
    if (!item.lastMessageAt) continue;
    if (item.lastMessageSenderId === currentUserId) continue;
    const lastMsgTime = new Date(item.lastMessageAt).getTime();
    if (isNaN(lastMsgTime)) continue;
    const lastSeen = lastSeenMap[item.id] ?? 0;
    if (lastMsgTime > lastSeen) unread.add(item.id);
  }
  return unread;
}

export function ChatBadgeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = STORAGE_KEY_PREFIX + (user?.uid ?? 'anon');

  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [unreadConversationIds, setUnreadConversationIds] = useState<Set<string>>(new Set());

  const markRead = useCallback(async (chatId: string, asOfServerTime?: number) => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[chatId] = asOfServerTime ?? Date.now();
      await AsyncStorage.setItem(storageKey, JSON.stringify(map));
    } catch {}
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
    setUnreadConversationIds((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  }, [storageKey]);

  const checkUnread = useCallback(async (activities: ConversationMeta[], currentUserId?: string) => {
    if (activities.length === 0) { setUnreadIds(new Set()); return; }
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const lastSeenMap: Record<string, number> = raw ? JSON.parse(raw) : {};
      setUnreadIds(findUnread(activities, lastSeenMap, currentUserId));
    } catch {}
  }, [storageKey]);

  const checkUnreadConversations = useCallback(
    async (conversations: ConversationMeta[], currentUserId?: string) => {
      if (conversations.length === 0) { setUnreadConversationIds(new Set()); return; }
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const lastSeenMap: Record<string, number> = raw ? JSON.parse(raw) : {};
        setUnreadConversationIds(findUnread(conversations, lastSeenMap, currentUserId));
      } catch {}
    },
    [storageKey]
  );

  return (
    <ChatBadgeContext.Provider
      value={{
        unreadCount: unreadIds.size + unreadConversationIds.size,
        unreadIds: [...unreadIds],
        unreadConversationIds: [...unreadConversationIds],
        markRead,
        checkUnread,
        checkUnreadConversations,
      }}>
      {children}
    </ChatBadgeContext.Provider>
  );
}

export function useChatBadge() {
  const ctx = useContext(ChatBadgeContext);
  if (!ctx) throw new Error('useChatBadge must be used within ChatBadgeProvider');
  return ctx;
}
