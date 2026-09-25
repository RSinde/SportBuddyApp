import type { Language } from '@/i18n/types';

type Translator = (key: string, vars?: Record<string, string | number>) => string;

export function relativeDate(dateStr: string, t: Translator, language: Language = 'en'): string {
  const date = new Date(dateStr);
  const now = new Date();

  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    if (Math.abs(diffMinutes) < 1) return t('date.now');
    if (Math.abs(diffMinutes) < 60) {
      return diffMinutes > 0
        ? t('date.inMinutes', { count: diffMinutes })
        : t('date.minutesAgo', { count: Math.abs(diffMinutes) });
    }
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) return t('date.inHours', { count: diffHours });
    if (diffHours < 0) return t('date.hoursAgo', { count: Math.abs(diffHours) });
    return t('date.now');
  }
  if (diffDays === 1) return t('date.tomorrow');
  if (diffDays === -1) return t('date.yesterday');
  if (diffDays > 1 && diffDays <= 7) return t('date.inDays', { count: diffDays });
  if (diffDays < -1 && diffDays >= -7) return t('date.daysAgo', { count: Math.abs(diffDays) });

  const locale = language === 'pt' ? 'pt-PT' : 'en-GB';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: diffDays > 365 || diffDays < -365 ? 'numeric' : undefined });
}
