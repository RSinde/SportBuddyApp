import type { Language } from '@/i18n/types';

type BadgeText = { name: string; description: string };

const BADGE_TRANSLATIONS: Record<string, BadgeText> = {
  joined_1: { name: 'Newcomer', description: 'Joined 1 activity' },
  joined_10: { name: 'Regular', description: 'Joined 10 activities' },
  joined_50: { name: 'Veteran', description: 'Joined 50 activities' },
  joined_100: { name: 'Legendary', description: 'Joined 100 activities' },
  mvp_1: { name: 'MVP', description: 'Voted MVP 1 time' },
  mvp_10: { name: 'Legend', description: 'Voted MVP 10 times' },
  mvp_25: { name: 'Icon', description: 'Voted MVP 25 times' },
  mvp_50: { name: 'Immortal', description: 'Voted MVP 50 times' },
};

const SPORT_TIER_PREFIX: Array<[string, string]> = [
  ['Fã de ', 'Fan of '],
  ['Adepto de ', 'Enthusiast of '],
  ['Especialista de ', 'Specialist in '],
  ['Mestre de ', 'Master of '],
];

const SPORT_TIER_DESCRIPTION = /^Participou em (\d+) atividades? de (.+)$/;

function translateSportBadge(badge: { name: string; description: string }): BadgeText {
  let name = badge.name;
  for (const [pt, en] of SPORT_TIER_PREFIX) {
    if (name.startsWith(pt)) {
      name = en + name.slice(pt.length);
      break;
    }
  }

  const match = badge.description.match(SPORT_TIER_DESCRIPTION);
  const description = match ? `Joined ${match[1]} ${match[2]} activities` : badge.description;

  return { name, description };
}

export function translateBadge(
  badge: { id: string; name: string; description: string },
  language: Language
): BadgeText {
  if (language === 'pt') return { name: badge.name, description: badge.description };

  const known = BADGE_TRANSLATIONS[badge.id];
  if (known) return known;

  if (badge.id.startsWith('sport_')) return translateSportBadge(badge);

  return { name: badge.name, description: badge.description };
}
