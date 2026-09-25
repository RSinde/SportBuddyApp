import { useLanguage } from '@/contexts/language-context';

import common from './dictionaries/common';
import auth from './dictionaries/auth';
import layout from './dictionaries/layout';
import home from './dictionaries/home';
import profile from './dictionaries/profile';
import activity from './dictionaries/activity';
import chat from './dictionaries/chat';
import weather from './dictionaries/weather';
import dashboard from './dictionaries/dashboard';
import type { Dictionary, Language } from './types';

const dictionaries = [common, auth, layout, home, profile, activity, chat, weather, dashboard];

const en: Dictionary = Object.assign({}, ...dictionaries.map((d) => d.en));
const pt: Dictionary = Object.assign({}, ...dictionaries.map((d) => d.pt));

const translations: Record<Language, Dictionary> = { en, pt };

export function useTranslation() {
  const { language } = useLanguage();

  function t(key: string, vars?: Record<string, string | number>) {
    let str = translations[language][key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
      }
    }
    return str;
  }

  return { t, language };
}
