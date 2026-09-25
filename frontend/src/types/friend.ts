import { UserRole } from './user';

export type FriendUser = {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: UserRole;
  isFollowing?: boolean;
};

export type Friend = {
  userId: string;
  user: FriendUser;
};

export type FriendRequest = {
  requestId: string;
  from: FriendUser;
  createdAt: string;
};
