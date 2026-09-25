import { api } from '@/services/api';
import { Friend, FriendRequest } from '@/types/friend';

// NOTA: estes endpoints são os do plano combinado — confirmar os caminhos
// exatos com o backend quando existirem. A UI já está pronta para os usar.

// Lista os meus amigos (amizades aceites).
export function getFriends(): Promise<Friend[]> {
  return api.get<Friend[]>('/api/friends');
}

// Pedidos de amizade que recebi e ainda não respondi.
export function getPendingRequests(): Promise<FriendRequest[]> {
  return api.get<FriendRequest[]>('/api/friends/requests');
}

// Enviar um pedido de amizade a outro utilizador.
export function sendFriendRequest(addresseeId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>('/api/friends/request', { addresseeId });
}

// Aceitar um pedido recebido.
export function acceptFriendRequest(requestId: string): Promise<{ message: string }> {
  return api.patch<{ message: string }>(`/api/friends/${requestId}/accept`);
}

// Rejeitar um pedido recebido.
export function rejectFriendRequest(requestId: string): Promise<{ message: string }> {
  return api.patch<{ message: string }>(`/api/friends/${requestId}/reject`);
}

// Cancelar um pedido de amizade que eu enviei.
export function cancelFriendRequest(addresseeId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/api/friends/request/${addresseeId}`);
}

// Remover uma amizade existente.
export function removeFriend(friendId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/api/friends/${friendId}`);
}
