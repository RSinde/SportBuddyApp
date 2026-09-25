import { api } from '@/services/api';
import { AdminUser, PublicUser, UserProfile,UserRole  } from '@/types/user';
import { FriendUser } from '@/types/friend';


export function getMyProfile(): Promise<UserProfile> {
  return api.get<UserProfile>('/api/users/me');
}

// Procurar utilizadores pelo nome (para adicionar amigos).
// NOTA: endpoint do plano combinado — falta implementar no backend:
// GET /api/users/search?q=... → [{ id, name, avatarUrl? }]
export function searchUsers(query: string): Promise<FriendUser[]> {
  return api.get<FriendUser[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
}

export function getUserProfile(userId: string): Promise<PublicUser> {
  return api.get<PublicUser>(`/api/users/${userId}`);
}

export function getMutualFriends(userId: string): Promise<{ id: string; name: string; avatarUrl?: string }[]> {
  return api.get(`/api/users/${userId}/mutual-friends`);
}

export function updateMyProfile(data: { name?: string; bio?: string; website?: string }): Promise<UserProfile> {
  return api.patch<UserProfile>('/api/users/me', data);
}

export function followUser(userId: string): Promise<{ message: string }> {
  return api.post<{ message: string }>(`/api/users/${userId}/follow`);
}

export function unfollowUser(userId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/api/users/${userId}/follow`);
}

export function uploadMyAvatar(imageData: string): Promise<UserProfile> {
  return api.post<UserProfile>('/api/users/me/avatar', { imageData });
}

export function listAdminUsers(): Promise<AdminUser[]> {
  return api.get<AdminUser[]>('/api/users');
}

export function banUser(userId: string): Promise<AdminUser> {
  return api.patch<AdminUser>(`/api/users/${userId}/ban`);
}

export function reactivateUser(userId: string): Promise<AdminUser> {
  return api.patch<AdminUser>(`/api/users/${userId}/reactivate`);
}

// Suspensão temporária: a conta reativa-se sozinha ao fim de `days` dias.
export function suspendUser(userId: string, days: number): Promise<AdminUser> {
  return api.patch<AdminUser>(`/api/users/${userId}/suspend`, { days });
}

export function deleteUser(userId: string): Promise<{ message: string }> {
  return api.delete<{ message: string }>(`/api/users/${userId}`);
}

export function updateUserRole(userId: string, role: string): Promise<AdminUser> {
  return api.patch<AdminUser>(`/api/users/${userId}/role`, { role });
}

export function getFollowers(userId: string): Promise<{ id: string; name: string; avatarUrl?: string }[]> {
  return api.get(`/api/users/${userId}/followers`);
}
