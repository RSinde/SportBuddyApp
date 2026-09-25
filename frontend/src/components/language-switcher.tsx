import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

import { PortugalFlag, UnitedKingdomFlag } from '@/components/flags';
import { useLanguage } from '@/contexts/language-context';
import type { Language } from '@/i18n/types';

const LABELS: Record<Language, string> = {
  pt: 'PT',
  en: 'EN',
};

export function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isHome = pathname === '/' && width < 900;
  const label = LABELS[language];

  return (
    <Pressable
      onPress={toggleLanguage}
      hitSlop={8}
      style={({ pressed }) => [styles.container, { top: insets.top + (isHome ? 45 : 12) }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label === 'PT' ? 'Mudar' : 'Switch'} idioma / language: ${label}`}>
      {language === 'pt' ? <PortugalFlag size={20} /> : <UnitedKingdomFlag size={20} />}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    zIndex: 999,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17,16,18,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f4f2ef',
  },
});