export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive';

export type ActivityStatus = 'open' | 'full' | 'cancelled' | 'completed';

export type ActivityLocation = {
  name: string;
  lat: number;
  lng: number;
  address: string;
};

export type Activity = {
  id: string;

  title: string;
  description: string;

  sportId: string;

  createdBy: string;
  createdByName: string;
  createdByVerified: boolean;

  participantsList: string[];
  waitlist: string[];

  maxParticipants: number;

  location: ActivityLocation;

  date: string;

  difficultyLevel: SkillLevel;

  requiresApproval: boolean;

  status: ActivityStatus;

  // Votação de MVP (só relevante quando a atividade está "completed")
  mvpVotes: Record<string, string>; // { quemVota: emQuemVotou }
  mvpWinners: string[];             // vencedor(es) — pode haver empate
  votingClosedAt?: string | null;   // null enquanto aberta; definido quando fecha

  // Avaliação (1-5) que cada participante deu à atividade, só depois de "completed"
  ratings: Record<string, number>;
  ratingAverage: number;
  ratingCount: number;

  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSender?: string;
  lastMessageSenderId?: string;

  createdAt: string;
  updatedAt: string;
};

export type FeedItem = {
  type: 'joined' | 'created' | 'mvp';
  userId: string;
  userName: string;
  activityId: string;
  activityTitle: string;
  timestamp: string;
};

export type CreateActivityInput = {
  title: string;
  description: string;
  sportId: string;
  maxParticipants: number;
  location: ActivityLocation;
  date: string;
  difficultyLevel: SkillLevel;
  requiresApproval: boolean;
};
