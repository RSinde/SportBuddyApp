import { SkillLevel } from '@/types/activity';

// Verde → amarelo → laranja → vermelho, por ordem crescente de exigência.
export const DIFFICULTY_COLORS: Record<SkillLevel, string> = {
  beginner: '#9ccd6b',
  intermediate: '#eab308',
  advanced: '#e8823f',
  competitive: '#ef4444',
};
