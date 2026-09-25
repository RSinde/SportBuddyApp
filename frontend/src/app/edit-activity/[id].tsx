import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/i18n';
import { getActivity, updateActivity } from '@/services/activities';
import { Activity, SkillLevel } from '@/types/activity';

const DIFFICULTY_OPTIONS: SkillLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'competitive',
];

const DIFFICULTY_KEYS: Record<SkillLevel, string> = {
  beginner: 'activity.difficulty.beginner',
  intermediate: 'activity.difficulty.intermediate',
  advanced: 'activity.difficulty.advanced',
  competitive: 'activity.difficulty.competitive',
};

export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const { t } = useTranslation();

  const [activity, setActivity] = useState<Activity | null | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [difficultyLevel, setDifficultyLevel] = useState<SkillLevel>('beginner');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;

    getActivity(id)
      .then((data) => {
        setActivity(data);
        setTitle(data.title);
        setDescription(data.description);
        setMaxParticipants(data.maxParticipants);
        setDifficultyLevel(data.difficultyLevel);
        setRequiresApproval(data.requiresApproval);
      })
      .catch(() => setActivity(null));
  }, [id]);

  if (activity === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: '#0a0a0b' }]}>
        <ThemedText style={{ color: '#8f8b85' }}>{t('activity.edit.loading')}</ThemedText>
      </View>
    );
  }

  const canEdit = !!user && (activity?.createdBy === user.uid || profile?.role === 'admin');

  if (activity === null || !canEdit) {
    return (
      <View style={[styles.centered, { backgroundColor: '#0a0a0b' }]}>
        <ThemedText style={{ color: '#8f8b85' }}>
          {t('activity.edit.noPermission')}
        </ThemedText>
      </View>
    );
  }

  const currentActivity = activity;
  const minParticipants = Math.max(2, currentActivity.participantsList.length);

  function adjustMaxParticipants(delta: number) {
    setMaxParticipants((current) => Math.max(minParticipants, current + delta));
  }

  async function handleSubmit() {
    setError(null);

    if (!title.trim()) {
      setError(t('activity.edit.error.emptyTitle'));
      return;
    }

    if (maxParticipants < minParticipants) {
      setError(t('activity.edit.error.tooFewMax', { count: currentActivity.participantsList.length }));
      return;
    }

    setSubmitting(true);
    try {
      await updateActivity(currentActivity.id, {
        title: title.trim(),
        description: description.trim(),
        maxParticipants,
        difficultyLevel,
        requiresApproval,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('activity.edit.error.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('activity.edit.screenTitle') }} />

      <ScrollView
        style={{ backgroundColor: '#0a0a0b' }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('activity.edit.titleLabel')}</ThemedText>
            <TextInput
              style={styles.input}
              placeholder={t('activity.edit.titlePlaceholder')}
              placeholderTextColor="#8f8b85"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('activity.edit.descriptionLabel')}</ThemedText>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder={t('activity.edit.descriptionPlaceholder')}
              placeholderTextColor="#8f8b85"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('activity.edit.difficultyLabel')}</ThemedText>
            <View style={styles.chipRow}>
              {DIFFICULTY_OPTIONS.map((level) => {
                const isActive = difficultyLevel === level;
                return (
                  <Pressable key={level} onPress={() => setDifficultyLevel(level)}>
                    <View style={[styles.chip, isActive && styles.chipActive]}>
                      <ThemedText style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {t(DIFFICULTY_KEYS[level])}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText style={styles.label}>{t('activity.edit.maxPlayersLabel')}</ThemedText>
            <View style={styles.stepper}>
              <Pressable
                disabled={maxParticipants <= minParticipants}
                onPress={() => adjustMaxParticipants(-1)}
                style={({ pressed }) => [
                  styles.stepperButton,
                  maxParticipants <= minParticipants && styles.stepperButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="remove" size={16} color="#f4f2ef" />
              </Pressable>
              <ThemedText style={styles.stepperValue}>{maxParticipants}</ThemedText>
              <Pressable
                onPress={() => adjustMaxParticipants(1)}
                style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
                <Ionicons name="add" size={16} color="#f4f2ef" />
              </Pressable>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.switchLabel}>{t('activity.edit.approvalLabel')}</ThemedText>
              <ThemedText style={styles.switchHint}>{t('activity.edit.approvalHint')}</ThemedText>
            </View>
            <Switch
              value={requiresApproval}
              onValueChange={setRequiresApproval}
              trackColor={{ false: '#141315', true: '#e8823f' }}
              thumbColor={requiresApproval ? '#f4f2ef' : '#c9c5bf'}
            />
          </View>

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
              <ThemedText style={styles.cancelButtonText}>{t('activity.edit.cancel')}</ThemedText>
            </Pressable>
            <Pressable
              disabled={submitting}
              onPress={handleSubmit}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
              <ThemedText style={styles.saveButtonText}>
                {submitting ? t('activity.edit.saving') : t('activity.edit.save')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  field: {
    gap: 6,
  },
  label: {
    color: '#8f8b85',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  input: {
    height: 52,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#f4f2ef',
  },
  multiline: {
    height: 100,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#111012',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    backgroundColor: '#e8823f',
    borderColor: '#e8823f',
  },
  chipText: {
    color: '#c9c5bf',
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  chipTextActive: {
    color: '#1a1005',
  },
  stepper: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1a1d',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    color: '#f4f2ef',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111012',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  switchLabel: {
    color: '#f4f2ef',
    fontWeight: 'bold',
    fontSize: 14,
  },
  switchHint: {
    color: '#8f8b85',
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  cancelButtonText: {
    color: '#f4f2ef',
    fontSize: 15,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1.4,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8823f',
  },
  saveButtonText: {
    color: '#1a1005',
    fontSize: 15,
    fontWeight: 'bold',
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    textAlign: 'center',
    color: '#eb8f84',
  },
});
