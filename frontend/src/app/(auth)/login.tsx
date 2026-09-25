import { Link } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/i18n';

// SDK nativo do Google (Play Services) — só existe fora do web.
if (Platform.OS !== 'web') {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}

const BG = '#0a0a0b';
const ORANGE = '#e8823f';
const TEXT = '#f4f2ef';
const TEXT_SEC = '#c9c5bf';
const ERROR = '#eb8f84';

export default function LoginScreen() {
  const { signIn, signInWithGoogle, signInWithGoogleIdToken } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t('auth.login.genericError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleSubmitting(true);

    if (Platform.OS !== 'web') {
      try {
        await GoogleSignin.hasPlayServices();
        const result = await GoogleSignin.signIn();
        if (result.type === 'success' && result.data.idToken) {
          await signInWithGoogleIdToken(result.data.idToken);
        }
      } catch (err) {
        setError(err instanceof Error ? t(err.message) : t('auth.login.googleError'));
      } finally {
        setGoogleSubmitting(false);
      }
      return;
    }

    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(err instanceof Error ? t(err.message) : t('auth.login.googleError'));
      }
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.orb, styles.orb1, { filter: 'blur(120px)' } as any]} />
        <View style={[styles.orb, styles.orb2, { filter: 'blur(140px)' } as any]} />
        <View style={[styles.orb, styles.orb3, { filter: 'blur(100px)' } as any]} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navbar}>
          <View style={styles.navBrand}>
            <Image
              source={require('../../../assets/images/sportbuddyIcon.png')}
              style={styles.navLogo}
              resizeMode="contain"
            />
            <ThemedText style={styles.navTitle}>SportBuddy</ThemedText>
          </View>
        </View>

        <View style={styles.center}>
          <View style={[styles.card, { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any]}>
            <Image
              source={require('../../../assets/images/sportbuddyIcon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText type="title" style={styles.title} numberOfLines={1} adjustsFontSizeToFit>SportBuddy</ThemedText>
            <ThemedText style={styles.subtitle}>{t('auth.login.subtitle')}</ThemedText>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { outline: 'none' } as any]}
                  placeholder={t('auth.login.emailPlaceholder')}
                  placeholderTextColor={TEXT_SEC}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { outline: 'none' } as any]}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  placeholderTextColor={TEXT_SEC}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword(v => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={TEXT_SEC} />
                </Pressable>
              </View>

              {error && <ThemedText style={styles.error}>{error}</ThemedText>}

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                disabled={submitting || googleSubmitting}
                onPress={handleSubmit}>
                <ThemedText style={styles.buttonText} type="smallBold">
                  {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
                </ThemedText>
              </Pressable>

              <View style={styles.separator}>
                <View style={styles.separatorLine} />
                <ThemedText style={styles.separatorText}>{t('auth.login.or')}</ThemedText>
                <View style={styles.separatorLine} />
              </View>

              <Pressable
                style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}
                disabled={submitting || googleSubmitting}
                onPress={handleGoogle}>
                <Ionicons name="logo-google" size={20} color={BG} style={{ marginRight: 8 }} />
                <ThemedText style={styles.googleButtonText} type="smallBold">
                  {googleSubmitting ? t('auth.login.googleSubmitting') : t('auth.login.google')}
                </ThemedText>
              </Pressable>

              <Link href="/register" asChild>
                <Pressable style={styles.linkPressable}>
                  <ThemedText style={styles.linkText}>
                    {t('auth.login.noAccount')}{' '}
                    <ThemedText style={styles.linkHighlight}>{t('auth.login.registerLink')}</ThemedText>
                  </ThemedText>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>{t('auth.footer')}</ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  safeArea: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orb1: {
    width: 500,
    height: 500,
    top: -180,
    left: -180,
    backgroundColor: ORANGE,
    opacity: 0.18,
  },
  orb2: {
    width: 600,
    height: 600,
    bottom: -220,
    right: -220,
    backgroundColor: ORANGE,
    opacity: 0.14,
  },
  orb3: {
    width: 350,
    height: 350,
    top: '35%',
    right: -120,
    backgroundColor: '#e8823f',
    opacity: 0.08,
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  navLogo: {
    width: 32,
    height: 32,
  },
  navTitle: {
    color: ORANGE,
    fontWeight: 'bold',
    fontSize: 18,
  },
  navLinks: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  navLinkPressable: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  navLink: {
    color: TEXT_SEC,
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(12, 12, 13, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: Spacing.two,
  },
  title: {
    textAlign: 'center',
    color: ORANGE,
  },
  subtitle: {
    textAlign: 'center',
    color: TEXT_SEC,
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },
  form: {
    gap: Spacing.three,
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
  inputIcon: {
    marginRight: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: TEXT,
    height: '100%',
    outlineWidth: 0,
  },
  button: {
    height: 52,
    backgroundColor: ORANGE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: BG,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.75,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  separatorText: {
    color: TEXT_SEC,
    fontSize: 13,
  },
  googleButton: {
    height: 52,
    backgroundColor: '#f4f2ef',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  googleButtonText: {
    color: BG,
  },
  error: {
    textAlign: 'center',
    color: ERROR,
  },
  linkPressable: {
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  linkText: {
    color: TEXT_SEC,
    fontSize: 14,
  },
  linkHighlight: {
    color: ORANGE,
    fontWeight: 'bold',
  },
  footer: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  footerText: {
    color: TEXT_SEC,
    fontSize: 12,
    opacity: 0.5,
  },
});
