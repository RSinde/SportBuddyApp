import { api } from '@/services/api';
import { Message } from '@/types/message';

export function getMessages(activityId: string): Promise<Message[]> {
  return api.get<Message[]>(`/api/activities/${activityId}/messages`);
}

export function sendMessage(activityId: string, text: string): Promise<Message> {
  return api.post<Message>(`/api/activities/${activityId}/messages`, { text });
}

export function getLastActivityMessage(activityId: string): Promise<{ text: string; senderName: string; createdAt: string } | null> {
  return api.get(`/api/activities/${activityId}/messages/last`);
}
