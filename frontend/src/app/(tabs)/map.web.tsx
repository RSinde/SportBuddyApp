import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AdvancedMarker,
  APIProvider,
  Map,
  MapCameraChangedEvent,
  useMap,
} from '@vis.gl/react-google-maps';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { joinActivity, listNearbyActivities } from '@/services/activities';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/i18n';
import { listSports } from '@/services/sports';
import { getCurrentUserLocation } from '@/services/user-location';
import { Activity } from '@/types/activity';
import { SportIcon } from '@/utils/sport-icon';

const DEFAULT_CENTER = { lat: 38.7223, lng: -9.1393 };
const mapId = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_MAP_ID;
const DEFAULT_RADIUS_KM = 20;
// Admins veem tudo, em qualquer sítio. Usamos um raio maior do que a maior
// distância possível entre dois pontos na Terra (~20 015 km) para que a
// localização do browser (por vezes imprecisa) nunca deixe atividades de
// fora — não interessa onde o mapa acha que estamos.
const ADMIN_RADIUS_KM = 21000;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  open: { label: 'map.status.open', color: '#9ccd6b' },
  full: { label: 'map.status.full', color: '#e8823f' },
  cancelled: { label: 'map.status.cancelled', color: '#eb8f84' },
  completed: { label: 'map.status.completed', color: '#8f8b85' },
};

function UserLocationController({
  location,
  snapTick,
}: {
  location: { lat: number; lng: number } | null;
  snapTick: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !location || snapTick === 0) return;
    map.panTo(location);
  }, [location, map, snapTick]);
  return null;
}

function UserLocationDot({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  const { t } = useTranslation();
  useEffect(() => {
    const AdvancedMarkerElement = (window as any).google?.maps?.marker?.AdvancedMarkerElement;
    if (!map || !position || !AdvancedMarkerElement) return;
    const dot = document.createElement('div');
    dot.style.cssText = [
      'width:18px', 'height:18px', 'border-radius:50%',
      'background:#2563EB', 'border:3px solid #fff',
      'box-shadow:0 0 0 3px rgba(37,99,235,0.25)',
      'pointer-events:none',
    ].join(';');
    const marker = new AdvancedMarkerElement({
      map,
      position,
      content: dot,
      title: t('map.myLocationTitle'),
      zIndex: 100,
    });
    return () => { marker.map = null; };
  // rerun only when position actually changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, position?.lat, position?.lng]);
  return null;
}

function ActivityPinMarker({
  activity,
  sportName,
  selected,
}: {
  activity: Activity;
  sportName: string;
  selected: boolean;
}) {
  const count = `${activity.participantsList.length}/${activity.maxParticipants}`;
  const bg = selected ? '#e8823f' : '#0e0d0f';
  const iconColor = selected ? '#1a1005' : '#8f8b85';

  return (
    <View style={{ alignItems: 'center', cursor: 'pointer' } as any}>
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
          fontFamily: 'Archivo, sans-serif',
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

export default function MapWebScreen() {
  const { t } = useTranslation();
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY;

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [snapTick, setSnapTick] = useState(0);
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [radiusKm, setRadiusKm] = useState(isAdmin ? ADMIN_RADIUS_KM : DEFAULT_RADIUS_KM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sportsMap, setSportsMap] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Hanken+Grotesk:wght@400;500;700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    listSports()
      .then((list) => {
        const m: Record<string, string> = {};
        list.forEach((s) => { m[s.id] = s.name; });
        setSportsMap(m);
      })
      .catch(() => {});
  }, []);

  const validActivities = useMemo(
    () => activities.filter((a) => Number.isFinite(a.location?.lat) && Number.isFinite(a.location?.lng)),
    [activities]
  );

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

  async function refreshUserLocation(shouldSnap = false) {
    try {
      const loc = await getCurrentUserLocation();
      setUserLocation(loc);
      if (shouldSnap) {
        setCenter(loc);
        setSnapTick((t) => t + 1);
      }
      return loc;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setError(null);
        let nextCenter = DEFAULT_CENTER;
        const loc = await refreshUserLocation(true);
        if (loc) nextCenter = loc;
        const data = await listNearbyActivities({ lat: nextCenter.lat, lng: nextCenter.lng, radiusKm });
        if (cancelled) return;
        setCenter(nextCenter);
        setActivities(data);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t('map.error.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const id = setInterval(() => void refreshUserLocation(false), 60_000);
    return () => clearInterval(id);
  }, []);

  // Perfil de admin carrega de forma assíncrona; assim que soubermos que é
  // admin, alarga logo o raio de pesquisa para veres todas as atividades.
  useEffect(() => {
    if (!isAdmin || radiusKm === ADMIN_RADIUS_KM) return;
    queueMicrotask(() => {
      setRadiusKm(ADMIN_RADIUS_KM);
      void loadActivities(center.lat, center.lng, ADMIN_RADIUS_KM);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);


  async function handleJoin(activity: Activity) {
    if (joining) return;
    setJoining(true);
    try {
      const updated = await joinActivity(activity.id);
      setActivities((prev) => prev.map((a) => a.id === updated.id ? updated : a));
      setSelectedActivity(updated);
    } catch {}
    setJoining(false);
    router.push({ pathname: '/activity/[id]', params: { id: activity.id } });
  }

  if (!apiKey) {
    return (
      <View style={styles.emptyContainer}>
        <ThemedText style={styles.title}>{t('map.missingApiKey')}</ThemedText>
      </View>
    );
  }

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
      <APIProvider apiKey={apiKey} libraries={['marker']}>
        <Map
          style={styles.map}
          defaultCenter={center}
          defaultZoom={13}
          mapId={mapId}
          gestureHandling="greedy"
          disableDefaultUI
          streetViewControl={false}
          fullscreenControl={false}
          mapTypeControl={false}
          scaleControl={false}
          rotateControl={false}
          keyboardShortcuts={false}
          onCameraChanged={(event: MapCameraChangedEvent) => setCenter(event.detail.center)}
          onClick={() => setSelectedActivity(null)}
        >
          <UserLocationController location={userLocation} snapTick={snapTick} />

          <UserLocationDot position={userLocation} />

          {validActivities.map((activity) => {
            const selected = activity.id === selectedActivity?.id;
            return (
              <AdvancedMarker
                key={activity.id}
                position={{ lat: activity.location.lat, lng: activity.location.lng }}
                title={activity.title}
                zIndex={selected ? 10 : 1}
                onClick={() => setSelectedActivity(activity)}
              >
                <ActivityPinMarker
                  activity={activity}
                  sportName={sportsMap[activity.sportId] ?? ''}
                  selected={selected}
                />
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>

      <View style={styles.topOverlay}>
        {!isAdmin && (
          <View style={styles.radiusRow}>
            {([5, 10, 20, 50] as const).map((option, i, arr) => {
              const active = radiusKm === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => { setRadiusKm(option); void loadActivities(center.lat, center.lng, option); }}
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
            onPress={() => void loadActivities(center.lat, center.lng, radiusKm)}
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
        onPress={() => void refreshUserLocation(true)}
        style={[styles.locationButton, selectedActivity ? styles.locationButtonAboveCard : undefined]}
      >
        <Ionicons name="locate" size={20} color="#e8823f" />
      </Pressable>

      {selectedActivity && status && (
        <Pressable
          style={styles.bottomCard}
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
            onJoin={() => void handleJoin(selectedActivity)}
            onNavigate={() => router.push({ pathname: '/activity/[id]', params: { id: selectedActivity.id } })}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 600 },
  map: { width: '100%', height: '100%' },
  emptyContainer: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },

  topOverlay: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
    pointerEvents: 'box-none',
  } as any,

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
    fontFamily: 'Hanken Grotesk, sans-serif',
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
    fontFamily: 'Hanken Grotesk, sans-serif',
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
  locationButtonAboveCard: {
    bottom: 128,
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
    fontFamily: 'Archivo, sans-serif',
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
    fontFamily: 'Hanken Grotesk, sans-serif',
  },
  cardMeta: {
    color: '#8f8b85',
    fontSize: 13,
    fontFamily: 'Hanken Grotesk, sans-serif',
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
    fontFamily: 'Hanken Grotesk, sans-serif',
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
    fontFamily: 'Hanken Grotesk, sans-serif',
  },
});
