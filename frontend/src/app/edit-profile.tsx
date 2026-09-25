import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getMyProfile, updateMyProfile } from '@/services/users';
import { UserProfile } from '@/types/user';
import { useTranslation } from '@/i18n';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyProfile()
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setBio(data.bio ?? '');
        setWebsite(data.website ?? '');
      })
      .catch(() => setProfile(null));
  }, []);

  if (profile === undefined) {
    return (
      <View style={styles.centered}>
        <ThemedText style={styles.loadingText}>{t('profile.loading')}</ThemedText>
      </View>
    );
  }

  if (profile === null) {
    return (
      <View style={styles.centered}>
        <ThemedText style={styles.loadingText}>{t('profile.edit.loadError')}</ThemedText>
      </View>
    );
  }

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError(t('profile.edit.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await updateMyProfile({
        name: name.trim(),
        bio: bio.trim() || undefined,
        website: profile?.role === 'partner' ? website.trim() || undefined : undefined,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('profile.edit.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        
        <ThemedText style={styles.sectionLabel}>{t('profile.edit.nameLabel')}</ThemedText>
        <TextInput
          style={styles.input}
          placeholder={t('profile.edit.namePlaceholder')}
          placeholderTextColor="#8f8b85"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <ThemedText style={styles.sectionLabel}>{t('profile.edit.bioLabel')}</ThemedText>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder={t('profile.edit.bioPlaceholder')}
          placeholderTextColor="#8f8b85"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
        />

        {profile.role === 'partner' && (
          <>
            <ThemedText style={styles.sectionLabel}>{t('profile.edit.websiteLabel')}</ThemedText>
            <TextInput
              style={styles.input}
              placeholder={t('profile.edit.websitePlaceholder')}
              placeholderTextColor="#8f8b85"
              autoCapitalize="none"
              keyboardType="url"
              value={website}
              onChangeText={setWebsite}
            />
          </>
        )}

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed
          ]}
          disabled={submitting}
          onPress={handleSubmit}>
          <ThemedText style={styles.buttonText} type="smallBold">
            {submitting ? t('profile.edit.saving') : t('profile.edit.save')}
          </ThemedText>
        </Pressable>
        
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: '#0a0a0b', // Fundo escuro principal
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0b',
  },
  loadingText: {
    color: '#8f8b85',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: 8,
  },
  sectionLabel: {
    color: '#f4f2ef',
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: Spacing.two,
  },
  input: {
    minHeight: 52, // Mais alto para toque confortável
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, // Cantos redondos Premium
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#f4f2ef',
  },
  multiline: {
    height: 120,
    paddingTop: 16, // Para o texto não ficar colado ao topo
    textAlignVertical: 'top',
  },
  button: {
    height: 52,
    backgroundColor: '#e8823f', // Laranja de destaque
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  buttonText: {
    color: '#f4f2ef',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    textAlign: 'center',
    color: '#eb8f84', // Vermelho para erros
    marginTop: Spacing.two,
  },
});