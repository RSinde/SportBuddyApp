import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/i18n';
import { joinActivity, listNearbyActivities } from '@/services/activities';
import { listSports } from '@/services/sports';
import { getCurrentUserLocation } from '@/services/user-location';
import { Activity } from '@/types/activity';
import { SportIcon } from '@/utils/sport-icon';
import { haversineKm } from '@/utils/distance';

const DEFAULT_REGION: Region = {
  latitude: 38.7223,
  longitude: -9.1393,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const DEFAULT_RADIUS_KM = 20;
// Admins veem tudo, em qualquer sítio — raio maior que a maior distância
// possível entre dois pontos na Terra, para a localização nunca deixar
// atividades de fora.
const ADMIN_RADIUS_KM = 21000;

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  open: { label: 'map.status.open', color: '#9ccd6b' },
  full: { label: 'map.status.full', color: '#e8823f' },
  cancelled: { label: 'map.status.cancelled', color: '#eb8f84' },
  completed: { label: 'map.status.completed', color: '#8f8b85' },
};

function formatActivityDate(date: Date | string, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const d = new Date(date);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes();
  const time = m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, '0')}`;
  return isToday
    ? t('map.date.today', { time })
    : d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }) + ` ${time}`;
}

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

function ActivityPinMarker({
  sportName,
  participantsList,
  maxParticipants,
  selected,
}: {
  sportName: string;
  participantsList: string[];
  maxParticipants: number;
  selected: boolean;
}) {
  const count = `${participantsList.length}/${maxParticipants}`;
  const bg = selected ? '#e8823f' : '#0e0d0f';
  const iconColor = selected ? '#1a1005' : '#8f8b85';

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{
        backgroundColor: selected ? '#e8823f' : '#0e0d0f',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        marginBottom: 4,
      }}>
        <ThemedText style={{
          color: selected ? '#1a1005' : '#f4f2ef',
          fontSize: 10,
          fontWeight: '800',
          lineHeight: 14,
        }}>
          {count}
        </ThemedText>
      </View>
      <View style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: selected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
      }}>
        <SportIcon sportName={sportName} size={22} color={iconColor} />
      </View>
    </View>
  );
}

function JoinButton({
  activity,
  uid,
  joining,
  onJoin,
  onNavigate,
}: {
  activity: Activity;
  uid: string;
  joining: boolean;
  onJoin: () => void;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const isParticipant = activity.participantsList.includes(uid);
  const isInWaitlist = activity.waitlist?.includes(uid) ?? false;
  const isInactive = activity.status === 'cancelled' || activity.status === 'completed';

  if (isInactive) return null;

  if (isParticipant) {
    return (
      <Pressable style={styles.joinButton} onPress={onNavigate}>
        <ThemedText style={styles.joinText}>{t('map.join.view')}</ThemedText>
      </Pressable>
    );
  }

  if (isInWaitlist) {
    return (
      <View style={[styles.joinButton, { backgroundColor: '#2a2a2e' }]}>
        <ThemedText style={[styles.joinText, { color: '#8f8b85' }]}>{t('map.join.requestSent')}</ThemedText>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.joinButton, joining ? { opacity: 0.6 } : undefined]}
      onPress={onJoin}
      disabled={joining}
    >
      <ThemedText style={styles.joinText}>{joining ? t('map.join.joining') : t('map.join.join')}</ThemedText>
    </Pressable>
  );
}

export default function ActivitiesMapScreen() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [radiusKm, setRadiusKm] = useState(isAdmin ? ADMIN_RADIUS_KM : DEFAULT_RADIUS_KM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sportsMap, setSportsMap] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState(false);

  async function loadActivities(lat: number, lng: number, radius: number) {
    try {
      setLoading(true);
      setError(null);
      const data = await listNearbyActivities({ lat, lng, radiusKm: radius });
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('map.error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  const loadUserLocation = useCallback(async (snap: boolean) => {
    try {
      const loc = await getCurrentUserLocation();
      setUserLocation(loc);
      const nextRegion: Region = {
        latitude: loc.lat,
        longitude: loc.lng,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
      if (snap) {
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 500);
      }
      await loadActivities(loc.lat, loc.lng, radiusKm);
    } catch {
      setError(t('map.error.locationDenied'));
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusKm]);

  useFocusEffect(
    useCallback(() => {
      listSports()
        .then((list) => {
          const m: Record<string, string> = {};
          list.forEach((s) => { m[s.id] = s.name; });
          setSportsMap(m);
        })
        .catch(() => { });
      loadUserLocation(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function handleRadiusChange(nextRadius: number) {
    setRadiusKm(nextRadius);
    await loadActivities(region.latitude, region.longitude, nextRadius);
  }

  async function handleRecenter() {
    await loadUserLocation(true);
  }

  async function handleJoin(activity: Activity) {
    if (joining) return;
    setJoining(true);
    try {
      const updated = await joinActivity(activity.id);
      setActivities((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      setSelectedActivity(updated);
    } catch { }
    setJoining(false);
    router.push({ pathname: '/activity/[id]', params: { id: activity.id } });
  }

  const validActivities = activities.filter(
    (a) => Number.isFinite(a.location?.lat) && Number.isFinite(a.location?.lng)
  );

  const status = selectedActivity
    ? (STATUS_INFO[selectedActivity.status] ?? { label: selectedActivity.status, color: '#8f8b85' })
    : null;
  const selectedSportName = selectedActivity ? (sportsMap[selectedActivity.sportId] ?? '') : '';
  const distance =
    selectedActivity && userLocation
      ? formatDist(haversineKm(userLocation.lat, userLocation.lng, selectedActivity.location.lat, selectedActivity.location.lng))
      : null;

  const uid = user?.uid ?? '';

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        region={region}
        showsUserLocation
        onRegionChangeComplete={setRegion}
        onPress={() => setSelectedActivity(null)}
      >
        {validActivities.map((activity) => {
          const selected = activity.id === selectedActivity?.id;
          return (
            <Marker
              key={activity.id}
              coordinate={{ latitude: activity.location.lat, longitude: activity.location.lng }}
              title={activity.title}
              zIndex={selected ? 10 : 1}
              tracksViewChanges={selected}
              onPress={(e) => {
                e.stopPropagation();
                setSelectedActivity(activity);
              }}
            >
              <ActivityPinMarker
                sportName={sportsMap[activity.sportId] ?? ''}
                participantsList={activity.participantsList}
                maxParticipants={activity.maxParticipants}
                selected={selected}
              />
            </Marker>
          );
        })}
      </MapView>

      <View style={[styles.topOverlay, { top: insets.top + 16 }]} pointerEvents="box-none">
        {!isAdmin && (
          <View style={styles.radiusRow}>
            {([5, 10, 20, 50] as const).map((option, i, arr) => {
              const active = radiusKm === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => handleRadiusChange(option)}
                  style={[
                    styles.radiusButton,
                    active && styles.radiusButtonActive,
                    i === 0 && styles.radiusButtonFirst,
                    i === arr.length - 1 && styles.radiusButtonLast,
                  ]}
                >
                  <ThemedText style={[styles.radiusText, active && styles.radiusTextActive]}>
                    {t('map.radius.value', { value: option })}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {!isAdmin && (
          <Pressable
            onPress={() => loadActivities(region.latitude, region.longitude, radiusKm)}
            style={styles.searchButton}
          >
            {loading
              ? <Ionicons name="refresh" size={14} color="#12100e" style={{ marginRight: 6 }} />
              : <Ionicons name="refresh-outline" size={14} color="#12100e" style={{ marginRight: 6 }} />}
            <ThemedText style={styles.searchButtonText}>
              {error ? t('map.retry') : t('map.search.button')}
            </ThemedText>
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={handleRecenter}
        style={[
          styles.locationButton,
          { bottom: (selectedActivity ? 128 : 16) + insets.bottom },
        ]}
      >
        <Ionicons name="locate" size={20} color="#e8823f" />
      </Pressable>

      {selectedActivity && status && (
        <Pressable
          style={[styles.bottomCard, { bottom: 16 + insets.bottom }]}
          onPress={() => router.push({ pathname: '/activity/[id]', params: { id: selectedActivity.id } })}
        >
          <View style={styles.cardIconBox}>
            <SportIcon sportName={selectedSportName} size={24} color="#1a1005" />
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <ThemedText style={styles.cardTitle} numberOfLines={1}>
                {selectedActivity.title}
              </ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: `${status.color}22` }]}>
                <ThemedText style={[styles.statusText, { color: status.color }]}>
                  {t(status.label)}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.cardMeta} numberOfLines={1}>
              {formatActivityDate(selectedActivity.date, t)}
              {selectedActivity.location.name ? ` · ${selectedActivity.location.name}` : ''}
              {distance ? ` · ${distance}` : ''}
            </ThemedText>

            <View style={styles.cardParticipants}>
              {Array.from({ length: Math.min(3, selectedActivity.participantsList.length) }).map((_, i) => (
                <View key={i} style={[styles.participantDot, i > 0 && { marginLeft: -6 }]} />
              ))}
              <ThemedText style={styles.participantCount}>
                {t('map.card.participants', { count: selectedActivity.participantsList.length, max: selectedActivity.maxParticipants })}
              </ThemedText>
            </View>
          </View>

          <JoinButton
            activity={selectedActivity}
            uid={uid}
            joining={joining}
            onJoin={() => handleJoin(selectedActivity)}
            onNavigate={() => router.push({ pathname: '/activity/[id]', params: { id: selectedActivity.id } })}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  topOverlay: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },

  radiusRow: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
  },
  radiusButton: {
    backgroundColor: 'rgba(14,13,15,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
  },
  radiusButtonFirst: { borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  radiusButtonLast: { borderTopRightRadius: 20, borderBottomRightRadius: 20 },
  radiusButtonActive: { backgroundColor: '#e8823f' },
  radiusText: {
    color: '#8f8b85',
    fontWeight: '700',
    fontSize: 13,
  },
  radiusTextActive: { color: '#1a1005' },

  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f2ef',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  searchButtonText: {
    color: '#12100e',
    fontWeight: '700',
    fontSize: 13,
  },

  locationButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(14,13,15,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0a0a0b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#e8823f',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: 4,
    overflow: 'hidden',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#f4f2ef',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#8f8b85',
    fontSize: 13,
  },
  cardParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2a2a2e',
    borderWidth: 1.5,
    borderColor: 'rgba(14,13,15,0.9)',
  },
  participantCount: {
    color: '#8f8b85',
    fontSize: 12,
  },

  joinButton: {
    backgroundColor: '#e8823f',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    flexShrink: 0,
  },
  joinText: {
    color: '#1a1005',
    fontSize: 14,
    fontWeight: '700',
  },
});