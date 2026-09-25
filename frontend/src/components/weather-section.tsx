import { useEffect, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedWeatherIcon } from '@/components/animated-weather-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTranslation } from '@/i18n';
import { getWeeklyForecast, DailyForecast } from '@/services/weather';
import {
  getWeatherInfo,
  getWindDirectionLabel,
  getUvColor,
  getUvLabel,
  WIND_SPEED_KEYS,
  WARNING_LEVEL_KEYS,
  WARNING_LEVEL_COLORS,
} from '@/utils/weather-codes';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Lisboa — usado quando a permissão de localização é negada ou falha.
const DEFAULT_COORDS = { latitude: 38.7223, longitude: -9.1393 };

function formatDayLabel(dateStr: string, index: number, todayLabel: string, t: (key: string) => string) {
  if (index === 0) return todayLabel;

  return t(`weather.weekday.${new Date(dateStr).getDay()}`);
}

export function WeatherSection() {
  const { t } = useTranslation();
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let coords = DEFAULT_COORDS;

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({});
          coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        }
      } catch {
        // segue com a localização por omissão
      }

      try {
        const data = await getWeeklyForecast(coords.latitude, coords.longitude);
        if (!cancelled) {
          setForecast(data.forecast);
          setLocationName(data.location);
        }
      } catch {
        if (!cancelled) setForecast(null);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSelected(date: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDate((current) => (current === date ? null : date));
  }

  function setHovered(date: string | null) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHoveredDate(date);
  }

  if (!forecast) return null;

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {t('activity.weather.title')}{locationName ? ` · ${locationName}` : ''}
      </ThemedText>

      <View style={styles.row}>
        {forecast.map((day, index) => {
          const { icon, category, labelKey } = getWeatherInfo(day.weatherCode);
          const precipitation = Math.round(day.precipitationProbability);
          const fillHeight = `${Math.min(100, Math.max(0, precipitation))}%` as const;
          const isToday = index === 0;
          const isSelected = selectedDate === day.date;
          const isOpen = isSelected || hoveredDate === day.date;
          const windLabel = getWindDirectionLabel(day.windDirection);
          const windSpeedKey = WIND_SPEED_KEYS[day.windSpeedClass];
          const windSpeedLabel = windSpeedKey ? t(windSpeedKey) : t('activity.weather.unknownWind');

          return (
            <Pressable
              key={day.date}
              onPress={() => toggleSelected(day.date)}
              onHoverIn={() => setHovered(day.date)}
              onHoverOut={() => setHovered(null)}
              style={({ pressed }) => [
                styles.card,
                isToday && styles.cardToday,
                pressed && styles.cardPressed,
              ]}>
              <ThemedText style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {formatDayLabel(day.date, index, t('activity.weather.today'), t)}
              </ThemedText>

              <View style={styles.circle}>
                <View style={[styles.fill, { height: fillHeight }]} />
                <AnimatedWeatherIcon icon={icon} category={category} size={20} />
              </View>

              <View style={styles.precipRow}>
                <Ionicons name="water" size={11} color="#60A5FA" />
                <ThemedText style={styles.precipText}>{precipitation}%</ThemedText>
              </View>

              <View style={styles.tempRow}>
                <View style={[styles.tempBox, styles.tempBoxMin]}>
                  <ThemedText style={styles.tempBoxText}>{Math.round(day.tempMin)}°</ThemedText>
                </View>
                <View style={[styles.tempBox, styles.tempBoxMax]}>
                  <ThemedText style={styles.tempBoxText}>{Math.round(day.tempMax)}°</ThemedText>
                </View>
              </View>

              {isOpen && (
                <View style={styles.details}>
                  <View style={styles.detailsDivider} />

                  <ThemedText style={styles.detailsLabel}>{t(labelKey)}</ThemedText>

                  <View style={styles.detailRow}>
                    <Ionicons name="navigate" size={12} color="#22C55E" />
                    <ThemedText style={styles.detailText}>
                      {windLabel} · {windSpeedLabel}
                    </ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons
                      name="sunny"
                      size={12}
                      color={day.uvIndex !== null ? getUvColor(day.uvIndex) : '#8f8b85'}
                    />
                    <ThemedText style={styles.detailText}>
                      {day.uvIndex !== null
                        ? t('activity.weather.uvFormat', { value: Math.round(day.uvIndex), label: t(getUvLabel(day.uvIndex)) })
                        : t('activity.weather.uvUnavailable')}
                    </ThemedText>
                  </View>

                  {day.warning && (
                    <View style={styles.warningBox}>
                      <View style={styles.warningHeader}>
                        <View
                          style={[styles.warningDot, { backgroundColor: WARNING_LEVEL_COLORS[day.warning.level] }]}
                        />
                        <ThemedText style={styles.warningTitle}>
                          {t(WARNING_LEVEL_KEYS[day.warning.level])} · {day.warning.type}
                        </ThemedText>
                      </View>
                      {day.warning.text ? (
                        <ThemedText style={styles.warningText}>{day.warning.text}</ThemedText>
                      ) : null}
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  title: {
    color: '#f4f2ef',
    fontSize: 20,
    paddingHorizontal: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.four,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111012',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 10,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  cardToday: {
    borderWidth: 2,
    borderColor: '#e8823f',
  },
  cardPressed: {
    opacity: 0.7,
  },
  dayLabel: {
    color: '#c9c5bf',
    fontSize: 12,
    fontWeight: '600',
  },
  dayLabelToday: {
    color: '#e8823f',
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#141315',
    borderWidth: 1,
    borderColor: '#475569',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(59, 130, 246, 0.6)',
  },
  precipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  precipText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '600',
  },
  tempRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tempBox: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 30,
    alignItems: 'center',
  },
  tempBoxMin: {
    backgroundColor: '#3B82F6',
  },
  tempBoxMax: {
    backgroundColor: '#F97316',
  },
  tempBoxText: {
    color: '#f4f2ef',
    fontSize: 12,
    fontWeight: 'bold',
  },
  details: {
    width: '100%',
    gap: 6,
    marginTop: 2,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: '#141315',
    marginBottom: 2,
  },
  detailsLabel: {
    color: '#f4f2ef',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  detailText: {
    color: '#c9c5bf',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  warningBox: {
    marginTop: 2,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#0a0a0b',
    gap: 3,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  warningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  warningTitle: {
    color: '#f4f2ef',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  warningText: {
    color: '#8f8b85',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
});
