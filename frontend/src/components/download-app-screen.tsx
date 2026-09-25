import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { PortugalFlag, UnitedKingdomFlag } from '@/components/flags';

const APK_DOWNLOAD_URL = 'https://expo.dev/artifacts/eas/po9raLRjAGYSW5TVKOVcgR5lfsfcZvWXtcfa56-c5Co.apk';

type PageLanguage = 'pt' | 'en';

const TEXT: Record<PageLanguage, {
  subtitle: string;
  bullets: [string, string, string];
  button: string;
  footnote: string;
}> = {
  pt: {
    subtitle: 'Bem-vindo! Encontra companheiros de jogo perto de ti e organiza a tua próxima atividade.',
    bullets: [
      'Descobre atividades desportivas na tua zona',
      'Cria os teus próprios jogos e convida amigos',
      'Conversa com a equipa antes de jogar',
    ],
    button: 'Descarregar a app',
    footnote: 'Grátis · Android',
  },
  en: {
    subtitle: 'Welcome! Find playmates near you and organize your next activity.',
    bullets: [
      'Discover sports activities in your area',
      'Create your own games and invite friends',
      'Chat with the team before playing',
    ],
    button: 'Download the app',
    footnote: 'Free · Android',
  },
};

export function DownloadAppScreen() {
  const [language, setLanguage] = useState<PageLanguage>('pt');
  const t = TEXT[language];

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.langSwitcher}
        onPress={() => setLanguage((l) => (l === 'pt' ? 'en' : 'pt'))}>
        {language === 'pt' ? <PortugalFlag size={18} /> : <UnitedKingdomFlag size={18} />}
        <Text style={styles.langSwitcherText}>{language.toUpperCase()}</Text>
      </Pressable>

      <View style={[styles.glowOuter, { filter: 'blur(60px)' } as any]} />
      <View style={[styles.glowMid, { filter: 'blur(50px)' } as any]} />
      <View style={[styles.glowInner, { filter: 'blur(40px)' } as any]} />
      <Image source={require('../../assets/images/sportbuddyIcon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>SportBuddy</Text>
      <Text style={styles.subtitle}>{t.subtitle}</Text>
      <View style={styles.bullets}>
        {t.bullets.map((bullet) => (
          <View key={bullet} style={styles.bulletRow}>
            <View style={styles.dot} />
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.button} onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}>
        <Text style={styles.buttonText}>{t.button}</Text>
      </Pressable>
      <Text style={styles.footnote}>{t.footnote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0b', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  langSwitcher: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17,16,18,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  langSwitcherText: { fontSize: 12, fontWeight: '700', color: '#f4f2ef' },
  glowOuter: { position: 'absolute', top: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: '#e8823f', opacity: 0.05, alignSelf: 'center' },
  glowMid: { position: 'absolute', top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#e8823f', opacity: 0.08, alignSelf: 'center' },
  glowInner: { position: 'absolute', top: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: '#e8823f', opacity: 0.14, alignSelf: 'center' },
  logo: { width: 112, height: 112, borderRadius: 56, marginBottom: 8 },
  title: { color: '#f4f2ef', fontSize: 28, fontFamily: 'Archivo_900Black' },
  subtitle: { color: '#c9c5bf', fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  bullets: { gap: 10, marginTop: 4, alignSelf: 'stretch', maxWidth: 300 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e8823f' },
  bulletText: { color: '#f4f2ef', fontSize: 14 },
  button: { marginTop: 8, backgroundColor: '#e8823f', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14 },
  buttonText: { color: '#0a0a0b', fontSize: 16, fontFamily: 'HankenGrotesk_700Bold' },
  footnote: { color: '#6b6862', fontSize: 13 },
});