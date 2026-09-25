import { api } from '@/services/api';
import { Badge, UserBadge } from '@/types/badge';
import { PublicUser } from '@/types/user';

export function getBadgeCatalog(): Promise<Badge[]> {
  return api.get<Badge[]>('/api/badges');
}

export function getMyBadges(): Promise<UserBadge[]> {
  return api.get<UserBadge[]>('/api/users/me/badges');
}

export function getUserBadges(userId: string): Promise<UserBadge[]> {
  return api.get<UserBadge[]>(`/api/users/${userId}/badges`);
}

export function setDisplayedBadge(badgeId: string | null): Promise<PublicUser> {
  return api.patch<PublicUser>('/api/users/me/displayed-badge', { badgeId });
}
