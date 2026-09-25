import type { Language } from '@/i18n/types';

// Os nomes dos desportos vêm da base de dados sempre em português.
// Isto só traduz o texto mostrado — o valor original continua a ser
// usado para o SportIcon reconhecer o ícone certo.
const SPORT_NAME_EN: Record<string, string> = {
  'Basquetebol': 'Basketball',
  'Ciclismo': 'Cycling',
  'Corrida': 'Running',
  'Futebol': 'Football',
  'Natação': 'Swimming',
  'Padel': 'Padel',
  'Ténis': 'Tennis',
  'Voleibol': 'Volleyball',
};

export function translateSportName(name: string | undefined, language: Language): string {
  if (!name) return '';
  if (language === 'pt') return name;
  return SPORT_NAME_EN[name] ?? name;
}
