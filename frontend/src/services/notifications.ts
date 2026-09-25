import { api } from '@/services/api';
import { Notification } from '@/types/notification';

// Lista as notificações do utilizador atual (mais recentes primeiro, ordenado no backend).
export function getNotifications(): Promise<Notification[]> {
  return api.get<Notification[]>('/api/notifications');
}

// Marca uma notificação como lida.
export function markNotificationAsRead(notificationId: string): Promise<Notification> {
  return api.patch<Notification>(`/api/notifications/${notificationId}/read`);
}

// Marca todas as notificações do utilizador como lidas.
export function markAllNotificationsAsRead(): Promise<void> {
  return api.patch<void>('/api/notifications/read-all');
}

// Marca como lidas as notificações de mensagens de uma atividade (ao abrir o chat).
export function markActivityMessagesAsRead(activityId: string): Promise<void> {
  return api.patch<void>(`/api/notifications/activity/${activityId}/read`);
}
