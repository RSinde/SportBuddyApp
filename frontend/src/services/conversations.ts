import { api } from '@/services/api';
import { Conversation, DirectMessage } from '@/types/message';

// As minhas conversas diretas (o backend só devolve as que já têm mensagens).
export function getConversations(): Promise<Conversation[]> {
  return api.get<Conversation[]>('/api/conversations');
}

// Abre (ou cria) a conversa com um amigo e devolve o id dela.
export function openConversation(otherUserId: string): Promise<{ conversationId: string }> {
  return api.post<{ conversationId: string }>('/api/conversations', { otherUserId });
}

export function getDirectMessages(conversationId: string): Promise<DirectMessage[]> {
  return api.get<DirectMessage[]>(`/api/conversations/${conversationId}/messages`);
}

export function sendDirectMessage(conversationId: string, text: string): Promise<DirectMessage> {
  return api.post<DirectMessage>(`/api/conversations/${conversationId}/messages`, { text });
}
