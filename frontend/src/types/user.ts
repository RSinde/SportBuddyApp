export type UserRole = 'participant' | 'partner' | 'admin';
export type UserStatus = 'active' | 'banned' | 'deleted';

export type UserStats = {
  activitiesJoined: number;
  activitiesCreated: number;
  mvpVotesReceived: number;
  badges: string[];
};

export type UserRating = {
  average: number;
  count: number;
};

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  // Só definido durante uma suspensão temporária (ver admin.tsx).
  bannedUntil?: string | null;
  bio?: string;
  avatarUrl?: string;
  website?: string;
  nif?: string;
  responsibleName?: string;
  sports?: string[];
  location?: string | { name?: string };
  createdAt?: string;
  stats: UserStats;
  following: string[];
  followers: string[];
  rating: UserRating;
};

// Perfil público de outro utilizador. Não inclui email, NIF, responsável nem a
// lista de amigos; o backend devolve apenas isFriend/isFollowing (se EU sigo/sou amigo dele).
export type PublicUser = Omit<UserProfile, 'email' | 'nif' | 'responsibleName'> & {
  isFriend?: boolean;
  friendCount?: number;
  hasSentRequest?: boolean;
  incomingRequestId?: string | null;
  isFollowing?: boolean;
  followersCount?: number;
};
export type AdminUser = UserProfile & { firebaseUid?: string };
