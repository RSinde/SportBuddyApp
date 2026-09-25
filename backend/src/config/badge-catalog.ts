import { sportsService } from "../services/sports.service";
import { CreateBadgeDto } from "../models/badge.model";

export type SeedBadge = { id: string } & CreateBadgeDto;

// Maps Portuguese sport names to the image key prefix used in the frontend
const SPORT_IMAGE_KEY: Record<string, string> = {
  futebol: "football",
  basquetebol: "basketball",
  ciclismo: "cycling",
  corrida: "running",
  "natação": "swimming",
  natacao: "swimming",
  padel: "paddle",
  "ténis": "tennis",
  tenis: "tennis",
  voleibol: "volleyball",
};

const PARTICIPATION_BADGES: SeedBadge[] = [
  {
    id: "joined_1",
    name: "Estreante",
    description: "Participou em 1 atividade",
    icon: "participation_bronze",
    criteriaType: "activitiesJoined",
    threshold: 1,
  },
  {
    id: "joined_10",
    name: "Regular",
    description: "Participou em 10 atividades",
    icon: "participation_silver",
    criteriaType: "activitiesJoined",
    threshold: 10,
  },
  {
    id: "joined_50",
    name: "Veterano",
    description: "Participou em 50 atividades",
    icon: "participation_gold",
    criteriaType: "activitiesJoined",
    threshold: 50,
  },
  {
    id: "joined_100",
    name: "Lendário",
    description: "Participou em 100 atividades",
    icon: "participation_diamond",
    criteriaType: "activitiesJoined",
    threshold: 100,
  },
];

const MVP_BADGES: SeedBadge[] = [
  {
    id: "mvp_1",
    name: "MVP",
    description: "Foi eleito MVP 1 vez",
    icon: "mvp_bronze",
    criteriaType: "mvpVotesReceived",
    threshold: 1,
  },
  {
    id: "mvp_10",
    name: "Lenda",
    description: "Foi eleito MVP 10 vezes",
    icon: "mvp_silver",
    criteriaType: "mvpVotesReceived",
    threshold: 10,
  },
  {
    id: "mvp_25",
    name: "Ícone",
    description: "Foi eleito MVP 25 vezes",
    icon: "mvp_gold",
    criteriaType: "mvpVotesReceived",
    threshold: 25,
  },
  {
    id: "mvp_50",
    name: "Imortal",
    description: "Foi eleito MVP 50 vezes",
    icon: "mvp_diamond",
    criteriaType: "mvpVotesReceived",
    threshold: 50,
  },
];

async function buildSportBadges(): Promise<SeedBadge[]> {
  const sports = await sportsService.listSports();

  const tiers = [
    { suffix: "10",  threshold: 10,  iconTier: "bronze",  nameFn: (s: string) => `Fã de ${s}`,          descFn: (s: string) => `Participou em 10 atividades de ${s}` },
    { suffix: "25",  threshold: 25,  iconTier: "silver",  nameFn: (s: string) => `Adepto de ${s}`,      descFn: (s: string) => `Participou em 25 atividades de ${s}` },
    { suffix: "50",  threshold: 50,  iconTier: "gold",    nameFn: (s: string) => `Especialista de ${s}`,descFn: (s: string) => `Participou em 50 atividades de ${s}` },
    { suffix: "100", threshold: 100, iconTier: "diamond", nameFn: (s: string) => `Mestre de ${s}`,      descFn: (s: string) => `Participou em 100 atividades de ${s}` },
  ];

  return sports.flatMap((sport) => {
    const imageKey = SPORT_IMAGE_KEY[sport.name.trim().toLowerCase()] ?? "participation";
    return tiers.map((tier) => ({
      id: `sport_${sport.id}_${tier.suffix}`,
      name: tier.nameFn(sport.name),
      description: tier.descFn(sport.name),
      icon: `${imageKey}_${tier.iconTier}`,
      criteriaType: "activitiesJoinedBySport" as const,
      threshold: tier.threshold,
      sportId: sport.id,
    }));
  });
}

/**
 * Single source of truth for the badge catalog. To add, change or remove a
 * badge, edit this file directly — `syncBadgeCatalog` reconciles Firestore
 * with whatever this function returns on every server startup.
 */
export async function buildBadgeCatalog(): Promise<SeedBadge[]> {
  const sportBadges = await buildSportBadges();

  return [...PARTICIPATION_BADGES, ...MVP_BADGES, ...sportBadges];
}
