export type BadgeCriteriaType =
  | "activitiesJoined"
  | "activitiesJoinedBySport"
  | "mvpVotesReceived";

export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteriaType: BadgeCriteriaType;
  threshold: number;
  sportId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateBadgeDto = {
  name: string;
  description: string;
  icon: string;
  criteriaType: BadgeCriteriaType;
  threshold: number;
  sportId?: string;
};

export type UpdateBadgeDto = {
  name?: string;
  description?: string;
  icon?: string;
  criteriaType?: BadgeCriteriaType;
  threshold?: number;
  sportId?: string;
};

export function createBadgeObject(
  id: string,
  data: CreateBadgeDto,
  createdAt: Date = new Date()
): BadgeDefinition {
  return {
    id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    criteriaType: data.criteriaType,
    threshold: data.threshold,
    ...(data.sportId !== undefined ? { sportId: data.sportId } : {}),
    createdAt,
    updatedAt: new Date(),
  };
}
