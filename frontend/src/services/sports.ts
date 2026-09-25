import { api } from '@/services/api';
import { Sport } from '@/types/sport';

export function listSports(): Promise<Sport[]> {
  return api.get<Sport[]>('/api/sports');
}

export function getSport(sportId: string): Promise<Sport> {
  return api.get<Sport>(`/api/sports/${sportId}`);
}
