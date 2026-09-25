import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/i18n';

const BG = '#0a0a0b';
const ORANGE = '#e8823f';
const TEXT = '#f4f2ef';
const TEXT_SEC = '#c9c5bf';
const ERROR = '#eb8f84';

type AccountType = 'personal' | 'organization';

export default function RegisterScreen() {
  const { signUp, signUpOrganization } = useAuth();
  const { t } = useTranslation();

  const [accountType, setAccountType] = useState<AccountType>('personal');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [nif, setNif] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPassword, setOrgPassword] = useState('');
  const [showOrgPassword, setShowOrgPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (accountType === 'organization') {
      if (!orgName.trim() || !nif.trim() || !responsibleName.trim() || !orgEmail.trim() || !orgPassword) {
        setError(t('auth.register.fillAllFields'));
        return;
      }

      if (!/^\d{9}$/.test(nif.trim())) {
        setError(t('auth.register.nifInvalid'));
        return;
      }

      if (orgPassword.length < 6) {
        setError(t('auth.register.passwordTooShort'));
        return;
      }

      setSubmitting(true);
      try {
        await signUpOrganization(orgName.trim(), nif.trim(), responsibleName.trim(), orgEmail.trim(), orgPassword);
      } catch (err) {
        setError(err instanceof Error ? t(err.message) : t('auth.register.genericOrgError'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!name.trim() || !email.trim() || !password) {
      setError(t('auth.register.fillAllFields'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.register.passwordTooShort'));
      return;
    }

    setSubmitting(true);
    try {
      await signUp(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t('auth.register.genericError'));
    } finally {
      setSubmitting(false);
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
            <ThemedText type="title" style={styles.title}>SportBuddy</ThemedText>
            <ThemedText style={styles.subtitle}>{t('auth.register.subtitle')}</ThemedText>

            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, accountType === 'personal' && styles.toggleBtnActive]}
                onPress={() => setAccountType('personal')}>
                <ThemedText style={[styles.toggleText, accountType === 'personal' && styles.toggleTextActive]}>
                  {t('auth.register.personalTab')}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, accountType === 'organization' && styles.toggleBtnActive]}
                onPress={() => setAccountType('organization')}>
                <ThemedText style={[styles.toggleText, accountType === 'organization' && styles.toggleTextActive]}>
                  {t('auth.register.organizationTab')}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.form}>
              {accountType === 'personal' ? (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { outline: 'none' } as any]}
                      placeholder={t('auth.register.namePlaceholder')}
                      placeholderTextColor={TEXT_SEC}
                      autoCapitalize="words"
                      autoComplete="name"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { outline: 'none' } as any]}
                      placeholder={t('auth.register.emailPlaceholder')}
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
                      placeholder={t('auth.register.passwordPlaceholder')}
                      placeholderTextColor={TEXT_SEC}
                      secureTextEntry={!showPassword}
                      autoComplete="password-new"
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable onPress={() => setShowPassword(v => !v)}>
                      <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={TEXT_SEC} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="business-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { outline: 'none' } as any]}
                      placeholder={t('auth.register.orgNamePlaceholder')}
                      placeholderTextColor={TEXT_SEC}
                      autoCapitalize="words"
                      value={orgName}
                      onChangeText={setOrgName}
                    />
                  </View>

                  <View style={styles.halfRow}>
                    <View style={[styles.inputContainer, styles.halfInput]}>
                      <Ionicons name="card-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { outline: 'none' } as any]}
                        placeholder={t('auth.register.nifPlaceholder')}
                        placeholderTextColor={TEXT_SEC}
                        keyboardType="number-pad"
                        maxLength={9}
                        value={nif}
                        onChangeText={setNif}
                      />
                    </View>
                    <View style={[styles.inputContainer, styles.halfInput]}>
                      <Ionicons name="person-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { outline: 'none' } as any]}
                        placeholder={t('auth.register.responsiblePlaceholder')}
                        placeholderTextColor={TEXT_SEC}
                        autoCapitalize="words"
                        value={responsibleName}
                        onChangeText={setResponsibleName}
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { outline: 'none' } as any]}
                      placeholder={t('auth.register.orgEmailPlaceholder')}
                      placeholderTextColor={TEXT_SEC}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      value={orgEmail}
                      onChangeText={setOrgEmail}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color={TEXT_SEC} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { outline: 'none' } as any]}
                      placeholder={t('auth.register.passwordPlaceholder')}
                      placeholderTextColor={TEXT_SEC}
                      secureTextEntry={!showOrgPassword}
                      autoComplete="password-new"
                      value={orgPassword}
                      onChangeText={setOrgPassword}
                    />
                    <Pressable onPress={() => setShowOrgPassword(v => !v)}>
                      <Ionicons name={showOrgPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={TEXT_SEC} />
                    </Pressable>
                  </View>
                </>
              )}

              {error && <ThemedText style={styles.error}>{error}</ThemedText>}

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                disabled={submitting}
                onPress={handleSubmit}>
                <ThemedText style={styles.buttonText} type="smallBold">
                  {submitting
                    ? t('auth.register.submitting')
                    : accountType === 'organization'
                      ? t('auth.register.submitOrganization')
                      : t('auth.register.submit')}
                </ThemedText>
              </Pressable>

              <Link href="/login" asChild>
                <Pressable style={styles.linkPressable}>
                  <ThemedText style={styles.linkText}>
                    {t('auth.register.hasAccount')}{' '}
                    <ThemedText style={styles.linkHighlight}>{t('auth.register.loginLink')}</ThemedText>
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
    width: 64,
    height: 64,
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
    marginBottom: Spacing.three,
  },
  toggleRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
    marginBottom: Spacing.three,
  },
  toggleBtn: {
    flex: 1,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: ORANGE,
  },
  toggleText: {
    color: TEXT_SEC,
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  toggleTextActive: {
    color: BG,
  },
  form: {
    gap: Spacing.three,
    width: '100%',
  },
  halfRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  halfInput: {
    flex: 1,
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
