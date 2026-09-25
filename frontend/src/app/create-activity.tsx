import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { DateTimeField } from '@/components/date-time-field';
import LocationPicker, { PickedLocation } from '@/components/location-picker';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n';
import { createActivity } from '@/services/activities';
import { listSports } from '@/services/sports';
import { SkillLevel } from '@/types/activity';
import { Sport, SportCategory } from '@/types/sport';
import { SportIcon } from '@/utils/sport-icon';
import { translateSportName } from '@/utils/translate-sport';

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

const CATEGORY_ORDER: SportCategory[] = ['team', 'individual'];

const CATEGORY_KEYS: Record<SportCategory, string> = {
  team: 'activity.create.category.team',
  individual: 'activity.create.category.individual',
};

const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 200;

function initialDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(18, 0, 0, 0);
  return date;
}

export default function CreateActivityScreen() {
  const { t, language } = useTranslation();
  const [sports, setSports] = useState<Sport[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SportCategory>('team');
  const [sportId, setSportId] = useState<string | null>(null);
  const [maxParticipants, setMaxParticipants] = useState(10);

  const [location, setLocation] = useState<PickedLocation>({
    name: '',
    address: '',
    lat: 38.7223,
    lng: -9.1393,
  });

  const [date, setDate] = useState<Date>(initialDate);
  const [difficultyLevel, setDifficultyLevel] = useState<SkillLevel>('beginner');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listSports()
      .then(setSports)
      .catch(() => setSports([]));
  }, []);

  function handleSelectCategory(next: SportCategory) {
    if (next !== category) setSportId(null);
    setCategory(next);
  }

  async function handleSubmit() {
    setError(null);

    if (
      !title.trim() ||
      !description.trim() ||
      !sportId ||
      !location.name.trim() ||
      !location.address.trim()
    ) {
      setError(t('activity.create.error.missingFields'));
      return;
    }

    if (date.getTime() <= Date.now()) {
      setError(t('activity.create.error.pastDate'));
      return;
    }

    if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      setError(t('activity.create.error.invalidLocation'));
      return;
    }

    setSubmitting(true);

    try {
      const activity = await createActivity({
        title: title.trim(),
        description: description.trim(),
        sportId,
        maxParticipants,
        location: {
          name: location.name.trim(),
          address: location.address.trim(),
          lat: location.lat,
          lng: location.lng,
        },
        date: date.toISOString(),
        difficultyLevel,
        requiresApproval,
      });

      router.replace({
        pathname: '/activity/[id]',
        params: { id: activity.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('activity.create.error.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  const categorySports = sports.filter((sport) => sport.category === category);

  return (
    <ScrollView
      style={{ backgroundColor: '#0a0a0b' }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>

        <View style={styles.field}>
          <ThemedText style={styles.microLabel}>{t('activity.create.titleLabel')}</ThemedText>
          <TextInput
            style={styles.input}
            placeholder={t('activity.create.titlePlaceholder')}
            placeholderTextColor="#8f8b85"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.microLabel}>{t('activity.create.descriptionLabel')}</ThemedText>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder={t('activity.create.descriptionPlaceholder')}
            placeholderTextColor="#8f8b85"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.microLabel}>{t('activity.create.sportLabel')}</ThemedText>

          <View style={styles.segmented}>
            {CATEGORY_ORDER.map((cat) => {
              const isActive = category === cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.segment, isActive && styles.segmentActive]}
                  onPress={() => handleSelectCategory(cat)}
                >
                  <ThemedText style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                    {t(CATEGORY_KEYS[cat])}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.chipRow}>
            {categorySports.map((sport) => {
              const isActive = sportId === sport.id;
              return (
                <Pressable key={sport.id} onPress={() => setSportId(sport.id)}>
                  <View style={[styles.chip, isActive && styles.chipActive]}>
                    <SportIcon
                      sportName={sport.name}
                      size={16}
                      color={isActive ? '#0a0a0b' : '#c9c5bf'}
                      style={{ marginRight: 6 }}
                    />
                    <ThemedText style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {translateSportName(sport.name, language)}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}

            {categorySports.length === 0 && (
              <ThemedText style={styles.emptyText}>
                {t('activity.create.noSports')}
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.microLabel}>{t('activity.create.difficultyLabel')}</ThemedText>
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
          <ThemedText style={styles.microLabel}>{t('activity.create.locationLabel')}</ThemedText>
          <LocationPicker value={location} onChange={setLocation} />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.flex1]}>
            <ThemedText style={styles.microLabel}>{t('activity.create.dateTimeLabel')}</ThemedText>
            <DateTimeField value={date} onChange={setDate} />
          </View>

          <View style={[styles.field, styles.flex1]}>
            <ThemedText style={styles.microLabel}>{t('activity.create.capacityLabel')}</ThemedText>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperBtn}
                disabled={maxParticipants <= MIN_PARTICIPANTS}
                onPress={() => setMaxParticipants((n) => Math.max(MIN_PARTICIPANTS, n - 1))}
              >
                <Ionicons name="remove" size={16} color="#c9c5bf" />
              </Pressable>
              <ThemedText style={styles.stepperValue}>{maxParticipants}</ThemedText>
              <Pressable
                style={[styles.stepperBtn, styles.stepperBtnActive]}
                disabled={maxParticipants >= MAX_PARTICIPANTS}
                onPress={() => setMaxParticipants((n) => Math.min(MAX_PARTICIPANTS, n + 1))}
              >
                <Ionicons name="add" size={16} color="#0a0a0b" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.switchRow}>
          <View>
            <ThemedText style={{ color: '#f4f2ef', fontWeight: 'bold' }}>{t('activity.create.approvalLabel')}</ThemedText>
            <ThemedText style={{ color: '#c9c5bf', fontSize: 12 }}>{t('activity.create.approvalHint')}</ThemedText>
          </View>
          <Switch
            value={requiresApproval}
            onValueChange={setRequiresApproval}
            trackColor={{ false: '#141315', true: '#e8823f' }}
            thumbColor={requiresApproval ? '#f4f2ef' : '#c9c5bf'}
          />
        </View>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
          ]}
          disabled={submitting}
          onPress={handleSubmit}
        >
          <ThemedText style={styles.buttonText} type="smallBold">
            {submitting ? t('activity.create.submitting') : t('activity.create.submit')}
          </ThemedText>
        </Pressable>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  flex1: {
    flex: 1,
    minWidth: 160,
  },
  microLabel: {
    color: '#8f8b85',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: '#e8823f',
  },
  segmentText: {
    color: '#c9c5bf',
    fontWeight: '600',
    userSelect: 'none' as any,
  },
  segmentTextActive: {
    color: '#1a1005',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnActive: {
    backgroundColor: '#e8823f',
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
    marginTop: Spacing.two,
  },
  button: {
    height: 52,
    backgroundColor: '#e8823f',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
    marginBottom: Spacing.six,
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
    color: '#eb8f84',
    marginTop: Spacing.two,
  },
  emptyText: {
    color: '#8f8b85',
    fontSize: 14,
  },
});
