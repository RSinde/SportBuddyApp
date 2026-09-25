export type SkillLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "competitive";

export type ActivityStatus =
  | "open"
  | "full"
  | "cancelled"
  | "completed";

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

  date: Date;

  difficultyLevel: SkillLevel;

  requiresApproval: boolean;

  status: ActivityStatus;

  joinedAt: Record<string, string>;

  mvpVotes: Record<string, string>;
  mvpWinners: string[];
  // null enquanto a votação está aberta — tem de existir no documento
  // para a query do cron (where votingClosedAt == null) o encontrar.
  votingClosedAt?: Date | null;

  // Avaliação (1-5) que cada participante deu à atividade, só depois de "completed".
  ratings: Record<string, number>;
  ratingAverage: number;
  ratingCount: number;

  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSender?: string;
  lastMessageSenderId?: string;

  createdAt: Date;
  updatedAt: Date;
};

export type CreateActivityDto = {
  title: string;
  description: string;

  sportId: string;

  maxParticipants: number;

  location: ActivityLocation;

  date: Date;

  difficultyLevel: SkillLevel;

  requiresApproval: boolean;
};
export function createActivityObject(
  id: string,
  createdBy: string,
  data: CreateActivityDto,
  createdByName: string,
  createdByVerified: boolean
): Activity {
  const now = new Date();

  // Contas de empresa (verified) só disponibilizam o espaço — não entram
  // como participante da própria atividade.
  const participantsList = createdByVerified ? [] : [createdBy];

  return {
    id,

    title: data.title,
    description: data.description,

    sportId: data.sportId,

    createdBy,
    createdByName,
    createdByVerified,

    participantsList,
    waitlist: [],

    maxParticipants: data.maxParticipants,

    location: data.location,

    date: data.date,

    difficultyLevel: data.difficultyLevel,

    requiresApproval: data.requiresApproval,

    status: participantsList.length >= data.maxParticipants ? "full" : "open",

    joinedAt: { [createdBy]: now.toISOString() },

    mvpVotes: {},
    mvpWinners: [],
    votingClosedAt: null,

    ratings: {},
    ratingAverage: 0,
    ratingCount: 0,

    createdAt: now,
    updatedAt: now,
  };
}


export type FeedItemType = 'joined' | 'created' | 'mvp';

export type FeedItem = {
  type: FeedItemType;
  userId: string;
  userName: string;
  activityId: string;
  activityTitle: string;
  timestamp: string;
};
