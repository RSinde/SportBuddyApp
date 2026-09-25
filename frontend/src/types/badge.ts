export type BadgeCriteriaType =
  | 'activitiesJoined'
  | 'activitiesJoinedBySport'
  | 'mvpVotesReceived';

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteriaType: BadgeCriteriaType;
  threshold: number;
  sportId?: string;
};

export type UserBadge = Badge & {
  unlockedAt: string;
  isDisplayed: boolean;
};
