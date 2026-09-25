import { Link, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { sportImages } from '@/constants/sport-images';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/i18n';
import { listActivities, listNearbyActivities } from '@/services/activities';
import { listSports } from '@/services/sports';
import { getCurrentUserLocation } from '@/services/user-location';
import { Activity } from '@/types/activity';
import { Sport, SportCategory } from '@/types/sport';
import { relativeDate } from '@/utils/date';
import { SportIcon } from '@/utils/sport-icon';
import { translateSportName } from '@/utils/translate-sport';

const NEARBY_RADIUS_KM = 50;
const MIN_RADIUS_KM = 1;

const STATUS_CONFIG: Partial<Record<Activity['status'], { label: string; color: string }>> = {
  open:      { label: 'explore.status.open',  color: '#9ccd6b' },
  full:      { label: 'explore.status.full',  color: '#8f8b85' },
  completed: { label: 'explore.status.completed', color: '#8f8b85' },
};

const AVATAR_COLORS = ['#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#0891B2'];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

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

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

// "Este fim de semana" = o próximo Sábado+Domingo a partir de hoje
// (se hoje já for fim de semana, é só o que resta dele).
function weekendRange(now: Date): { start: Date; end: Date } {
  const day = now.getDay();
  const startOffset = day === 0 ? 0 : (6 - day) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + startOffset, 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (day === 0 ? 0 : 1), 23, 59, 59, 999);
  return { start, end };
}

function DistanceSlider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);

  // Em web usamos o <input type="range"> nativo do browser: arrasta de forma
  // fiável (o nosso responder-based drag perdia o rasto do cursor sobre o
  // thumb/fill) e já dispara onChange em contínuo durante o arrasto.
  if (Platform.OS === 'web') {
    return (
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e: any) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: '#e8823f',
          cursor: 'pointer',
        } as any}
      />
    );
  }

  const pct = trackWidth > 0 ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  function updateFromX(x: number) {
    if (trackWidth <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / trackWidth));
    onChange(Math.round(min + ratio * (max - min)));
  }

  return (
    <View
      style={styles.sliderTrackWrap}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => updateFromX(e.nativeEvent.locationX)}
      onResponderMove={(e) => updateFromX(e.nativeEvent.locationX)}>
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${pct * 100}%` as any }]} />
      </View>
      <View style={[styles.sliderThumb, { left: `${pct * 100}%` as any }]} />
    </View>
  );
}

type ScopeFilter = 'nearby' | 'all';
type CatFilter = SportCategory | null;
type DateFilter = 'upcoming' | 'today' | 'weekend';

export default function ExploreScreen() {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const safeAreaInsets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { organizerId } = useLocalSearchParams<{ organizerId?: string }>();

  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Filtros usados no ecrã mobile (inalterados).
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('nearby');
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [sportModalOpen, setSportModalOpen] = useState(false);

  // Filtros usados no painel "Filtros" de ecrã largo.
  const [dateFilter, setDateFilter] = useState<DateFilter>('upcoming');
  // radiusKm atualiza-se logo (slider/label instantâneos); committedRadiusKm
  // segue-o com um pequeno atraso para não disparar um pedido por cada pixel arrastado.
  const [radiusKm, setRadiusKm] = useState(NEARBY_RADIUS_KM);
  const [committedRadiusKm, setCommittedRadiusKm] = useState(NEARBY_RADIUS_KM);
  const [sportFilterSet, setSportFilterSet] = useState<Set<string>>(new Set());
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Partilhado entre os dois layouts.
  const [catFilter, setCatFilter] = useState<CatFilter>(null);
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCommittedRadiusKm(radiusKm), 300);
    return () => clearTimeout(t);
  }, [radiusKm]);

  const load = useCallback(async () => {
    try {
      setError(null);
      let data: Activity[];

      if (organizerId) {
        data = await listActivities({ createdBy: organizerId });
      } else if (isWide) {
        let loc = locationRef.current;
        if (!loc) {
          loc = await getCurrentUserLocation().catch(() => null);
          if (loc) {
            locationRef.current = loc;
            setUserLocation(loc);
          }
        }
        const center = loc ?? { lat: 38.7223, lng: -9.1393 };
        data = await listNearbyActivities({ lat: center.lat, lng: center.lng, radiusKm: committedRadiusKm, verifiedOnly });
      } else if (scopeFilter === 'nearby') {
        let loc = locationRef.current;
        if (!loc) {
          loc = await getCurrentUserLocation().catch(() => null);
          if (loc) {
            locationRef.current = loc;
            setUserLocation(loc);
          }
        }
        const center = loc ?? { lat: 38.7223, lng: -9.1393 };
        data = await listNearbyActivities({ lat: center.lat, lng: center.lng, radiusKm: NEARBY_RADIUS_KM });
      } else {
        data = await listActivities();
      }
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('explore.error.loadFailed'));
    }
  }, [scopeFilter, isWide, committedRadiusKm, verifiedOnly, organizerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    listSports().then(setSports).catch(() => setSports([]));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const categoryBySportId = new Map(sports.map((s) => [s.id, s.category]));
  const visibleSports = catFilter ? sports.filter((s) => s.category === catFilter) : sports;

  const visibleActivities = (activities ?? []).filter((a) => {
    if (a.status === 'cancelled') return false;
    if (user && a.participantsList.includes(user.uid)) return false;
    if (catFilter && categoryBySportId.get(a.sportId) !== catFilter) return false;
    if (searchText.trim() && !a.title.toLowerCase().includes(searchText.toLowerCase())) return false;

    if (isWide) {
      if (sportFilterSet.size > 0 && !sportFilterSet.has(a.sportId)) return false;
      if (verifiedOnly && !a.createdByVerified) return false;
      if (dateFilter !== 'upcoming') {
        const d = new Date(a.date);
        const now = new Date();
        if (dateFilter === 'today') {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'weekend') {
          const { start, end } = weekendRange(now);
          if (d < start || d > end) return false;
        }
      }
    } else if (sportFilter && a.sportId !== sportFilter) {
      return false;
    }

    return true;
  });

  const selectedSport = sports.find((s) => s.id === sportFilter);

  function toggleSportInSet(id: string) {
    setSportFilterSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderCard(activity: Activity) {
    const status: { label: string; color: string } = STATUS_CONFIG[activity.status] ?? { label: activity.status, color: '#8f8b85' };
    const isWaitlisted = !!user && activity.waitlist.includes(user.uid);
    const fill = activity.participantsList.length / activity.maxParticipants;
    const dist = userLocation
      ? formatDist(haversineKm(userLocation.lat, userLocation.lng, activity.location.lat, activity.location.lng))
      : null;
    const sportName = sports.find((s) => s.id === activity.sportId)?.name ?? '';
    const spotsLeft = activity.maxParticipants - activity.participantsList.length;
    const isAlmostFull = spotsLeft <= 3 && spotsLeft > 0 && activity.status === 'open';
    const isPrivate = activity.requiresApproval;
    const maxAvatars = 3;
    const shown = activity.participantsList.slice(0, maxAvatars);
    const extra = activity.participantsList.length - maxAvatars;

    const image = sportImages[activity.sportId];
    const badges = (
      <>
        {isWaitlisted ? (
          <View style={[styles.statusBadge, styles.waitlistBadge]}>
            <ThemedText style={[styles.statusText, styles.waitlistText]}>{t('explore.card.waitlist')}</ThemedText>
          </View>
        ) : isPrivate ? (
          <View style={[styles.statusBadge, styles.privateBadge]}>
            <Ionicons name="lock-closed" size={10} color="#8f8b85" />
            <ThemedText style={[styles.statusText, { color: '#8f8b85' }]}>{t('explore.card.private')}</ThemedText>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: `${status.color}22` }]}>
            <ThemedText style={[styles.statusText, { color: status.color }]}>
              {t(status.label)}
            </ThemedText>
          </View>
        )}
        {isAlmostFull && (
          <View style={[styles.statusBadge, { backgroundColor: '#e8823f22' }]}>
            <ThemedText style={[styles.statusText, { color: '#e8823f' }]}>{t('explore.card.almostFull')}</ThemedText>
          </View>
        )}
      </>
    );

    return (
      <Link key={activity.id} href={{ pathname: '/activity/[id]', params: { id: activity.id } }} asChild>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <View style={styles.card}>

          {/* IMAGEM: foto do desporto como fundo; sem foto fica o ícone a solo */}
          {image ? (
            <ImageBackground source={image} resizeMode="cover" style={styles.cardImage}>
              <View style={styles.cardImageOverlay} />
              <View style={styles.cardImageTopRow}>
                <View style={styles.cardImageSportChip}>
                  <SportIcon sportName={sportName} size={13} color="#f4f2ef" />
                  <ThemedText style={styles.cardImageSportText}>{translateSportName(sportName, language)}</ThemedText>
                </View>
              </View>
            </ImageBackground>
          ) : (
            <View style={styles.cardImageFallback}>
              <SportIcon sportName={sportName} size={28} color="#e8823f" />
            </View>
          )}

          <View style={styles.cardBody}>
          {/* TOP ROW: title + badges (só quando não há imagem) */}
          <View style={styles.cardTop}>
            <ThemedText style={styles.cardTitle} numberOfLines={1}>{activity.title}</ThemedText>
            <View style={styles.badgeStack}>{badges}</View>
          </View>

          {activity.createdByName && (
            <View style={styles.organizerRow}>
              <ThemedText style={styles.organizerRowText} numberOfLines={1}>{activity.createdByName}</ThemedText>
              {activity.createdByVerified && (
                <Ionicons name="checkmark-circle" size={12} color="#e8823f" />
              )}
            </View>
          )}

          {/* META ROW: time · location · distance */}
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={13} color="#8f8b85" />
            <ThemedText style={styles.metaText}>{relativeDate(activity.date, t, language)}</ThemedText>
            <ThemedText style={styles.metaDot}>·</ThemedText>
            <Ionicons name="location-outline" size={13} color="#8f8b85" />
            <ThemedText style={styles.metaText} numberOfLines={1}>{activity.location.name}</ThemedText>
            {dist && (
              <>
                <ThemedText style={styles.metaDot}>·</ThemedText>
                <ThemedText style={styles.metaDist}>{dist}</ThemedText>
              </>
            )}
          </View>

          {/* BOTTOM ROW: avatars + progress bar */}
          <View style={styles.cardBottom}>
            <View style={styles.avatarRow}>
              {shown.map((uid, i) => (
                <View
                  key={uid}
                  style={[styles.avatar, { backgroundColor: avatarColor(uid), marginLeft: i === 0 ? 0 : -8 }]}
                />
              ))}
              {extra > 0 && (
                <View style={[styles.avatar, styles.avatarExtra, { marginLeft: -8 }]}>
                  <ThemedText style={styles.avatarExtraText}>+{extra}</ThemedText>
                </View>
              )}
              <ThemedText style={styles.participantCount}>
                {t('explore.card.participantsCount', { count: activity.participantsList.length, max: activity.maxParticipants })}
              </ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${Math.min(fill * 100, 100)}%` as any,
                backgroundColor: '#e8823f',
              }]} />
            </View>
          </View>
          </View>

        </View>
        </Pressable>
      </Link>
    );
  }

  function renderFiltersPanel() {
    return (
      <View style={styles.filtersPanel}>
        <ThemedText style={styles.filtersPanelTitle}>{t('explore.filters.title')}</ThemedText>

        <Pressable onPress={() => setVerifiedOnly((v) => !v)}>
          <View style={styles.checkboxRow}>
            <Ionicons name={verifiedOnly ? 'checkbox' : 'square-outline'} size={18} color={verifiedOnly ? '#e8823f' : '#8f8b85'} />
            <Ionicons name="checkmark-circle-outline" size={14} color={verifiedOnly ? '#e8823f' : '#8f8b85'} />
            <ThemedText style={styles.checkboxLabel}>{t('explore.filters.verifiedOnly')}</ThemedText>
          </View>
        </Pressable>
        {verifiedOnly && (
          <ThemedText style={styles.filtersHint}>
            {t('explore.filters.verifiedHint')}
          </ThemedText>
        )}

        <View style={styles.divider} />

        <ThemedText style={styles.filterSectionLabel}>{t('explore.filters.sportLabel')}</ThemedText>
        <View style={styles.filterSectionStack}>
          <Pressable onPress={() => setSportFilterSet(new Set())}>
            <View style={styles.checkboxRow}>
              <Ionicons
                name={sportFilterSet.size === 0 ? 'checkbox' : 'square-outline'}
                size={18}
                color={sportFilterSet.size === 0 ? '#e8823f' : '#8f8b85'}
              />
              <ThemedText style={styles.checkboxLabel}>{t('explore.filters.all')}</ThemedText>
            </View>
          </Pressable>
          {visibleSports.map((sport) => {
            const active = sportFilterSet.has(sport.id);
            return (
              <Pressable key={sport.id} onPress={() => toggleSportInSet(sport.id)}>
                <View style={styles.checkboxRow}>
                  <Ionicons name={active ? 'checkbox' : 'square-outline'} size={18} color={active ? '#e8823f' : '#8f8b85'} />
                  <SportIcon sportName={sport.name} size={14} color={active ? '#e8823f' : '#8f8b85'} />
                  <ThemedText style={styles.checkboxLabel}>{translateSportName(sport.name, language)}</ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={styles.filterSectionLabel}>{t('explore.filters.typeLabel')}</ThemedText>
        <View style={styles.filterRowInline}>
          {(['team', 'individual'] as SportCategory[]).map((cat) => (
            <Pressable
              key={cat}
              style={{ flex: 1 }}
              onPress={() => {
                const next = catFilter === cat ? null : cat;
                setCatFilter(next);
                if (next) {
                  setSportFilterSet((prev) => {
                    const filtered = new Set(Array.from(prev).filter((id) => categoryBySportId.get(id) === next));
                    return filtered;
                  });
                }
              }}>
              <View style={[styles.filterChipSmall, catFilter === cat && styles.filterRowChipActive]}>
                <ThemedText style={[styles.filterRowChipText, catFilter === cat && styles.filterRowChipTextActive]}>
                  {cat === 'team' ? t('explore.category.team') : t('explore.category.individual')}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.filterSectionLabel}>{t('explore.filters.whenLabel')}</ThemedText>
        <View style={styles.filterSectionStack}>
          {([
            { key: 'upcoming', label: t('explore.filters.upcoming') },
            { key: 'today', label: t('explore.filters.today') },
            { key: 'weekend', label: t('explore.filters.weekend') },
          ] as { key: DateFilter; label: string }[]).map(({ key, label }) => (
            <Pressable key={key} onPress={() => setDateFilter(key)}>
              <View style={[styles.filterRowChip, dateFilter === key && styles.filterRowChipActive]}>
                <ThemedText style={[styles.filterRowChipText, dateFilter === key && styles.filterRowChipTextActive]}>
                  {label}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.filterSectionLabel}>{t('explore.filters.distanceLabel')}</ThemedText>
        <View style={styles.distanceRow}>
          <DistanceSlider value={radiusKm} min={MIN_RADIUS_KM} max={NEARBY_RADIUS_KM} onChange={setRadiusKm} />
          <ThemedText style={styles.distanceValue}>{t('explore.filters.radiusValue', { value: radiusKm })}</ThemedText>
        </View>
      </View>
    );
  }

  const headerAndSearch = (
    <>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.pageTitle}>{t('explore.header.title')}</ThemedText>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#8f8b85" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('explore.search.placeholder')}
          placeholderTextColor="#8f8b85"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color="#8f8b85" />
          </Pressable>
        )}
      </View>
    </>
  );

  const listStates = (
    <>
      {activities !== null && !error && (
        <ThemedText style={styles.sectionLabel}>
          {visibleActivities.length} {isWide ? t('explore.list.activities') : scopeFilter === 'nearby' ? t('explore.list.activitiesNearYou') : t('explore.list.activities')}
        </ThemedText>
      )}

      {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}
      {activities === null && !error && <ThemedText style={styles.emptyText}>{t('explore.list.loading')}</ThemedText>}
      {activities !== null && visibleActivities.length === 0 && (
        <ThemedText style={styles.emptyText}>
          {activities.length === 0 ? t('explore.list.emptyNone') : t('explore.list.emptyFiltered')}
        </ThemedText>
      )}

      <View style={styles.list}>
        {visibleActivities.map(renderCard)}
      </View>
    </>
  );

  return (
    <ScrollView
      style={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8823f" />}
      contentContainerStyle={[
        styles.content,
        { paddingTop: safeAreaInsets.top + TopTabInset + Spacing.four, paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three },
      ]}>

      {isWide ? (
        <View style={styles.wideWrap}>
          <View style={styles.mainCol}>
            {headerAndSearch}
            {listStates}
          </View>
          <View style={styles.filtersCol}>
            {renderFiltersPanel()}
          </View>
        </View>
      ) : (
        <View style={styles.container}>
          {headerAndSearch}

          {/* FILTER ROW (mobile) */}
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
              {(['nearby', 'all'] as ScopeFilter[]).map((scope) => (
                <Pressable key={scope} onPress={() => setScopeFilter(scope)}>
                  <View style={[styles.chip, scopeFilter === scope && styles.chipActive]}>
                    <ThemedText style={[styles.chipText, scopeFilter === scope && styles.chipTextActive]}>
                      {scope === 'nearby' ? t('explore.scope.nearby') : t('explore.scope.all')}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
              {(['team', 'individual'] as SportCategory[]).map((cat) => (
                <Pressable key={cat} onPress={() => {
                  const next = catFilter === cat ? null : cat;
                  setCatFilter(next);
                  if (next && sportFilter && categoryBySportId.get(sportFilter) !== next) setSportFilter(null);
                }}>
                  <View style={[styles.chip, catFilter === cat && styles.chipActive]}>
                    <ThemedText style={[styles.chipText, catFilter === cat && styles.chipTextActive]}>
                      {cat === 'team' ? t('explore.category.team') : t('explore.category.individual')}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable onPress={() => setSportModalOpen(true)} style={styles.sportDropdown}>
              <Ionicons name="options-outline" size={14} color="#c9c5bf" style={{ marginRight: 5 }} />
              <ThemedText style={styles.sportDropdownText} numberOfLines={1}>
                {selectedSport ? translateSportName(selectedSport.name, language) : t('explore.sport.allSports')}
              </ThemedText>
              <Ionicons name="chevron-down" size={12} color="#8f8b85" style={{ marginLeft: 3 }} />
            </Pressable>
          </View>

          {listStates}
        </View>
      )}

      {/* SPORT PICKER MODAL (mobile) */}
      <Modal visible={sportModalOpen} transparent animationType="fade" onRequestClose={() => setSportModalOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSportModalOpen(false)}>
          <View style={styles.modalSheet}>
            <ThemedText style={styles.modalTitle}>{t('explore.sport.modalTitle')}</ThemedText>
            <Pressable
              style={[styles.modalOption, !sportFilter && styles.modalOptionActive]}
              onPress={() => { setSportFilter(null); setSportModalOpen(false); }}>
              <ThemedText style={[styles.modalOptionText, !sportFilter && styles.modalOptionTextActive]}>
                {t('explore.sport.allSports')}
              </ThemedText>
              {!sportFilter && <Ionicons name="checkmark" size={16} color="#e8823f" />}
            </Pressable>
            {visibleSports.map((sport) => (
              <Pressable
                key={sport.id}
                style={[styles.modalOption, sportFilter === sport.id && styles.modalOptionActive]}
                onPress={() => { setSportFilter(sport.id); setSportModalOpen(false); }}>
                <View style={styles.modalOptionRow}>
                  <SportIcon sportName={sport.name} size={16} color={sportFilter === sport.id ? '#e8823f' : '#8f8b85'} style={{ marginRight: 8 }} />
                  <ThemedText style={[styles.modalOptionText, sportFilter === sport.id && styles.modalOptionTextActive]}>
                    {translateSportName(sport.name, language)}
                  </ThemedText>
                </View>
                {sportFilter === sport.id && <Ionicons name="checkmark" size={16} color="#e8823f" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0a0a0b' },
  content: { flexDirection: 'row', justifyContent: 'center' },
  container: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four, gap: Spacing.three },

  wideWrap: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MaxContentWidth + 300,
    paddingHorizontal: Spacing.four,
    gap: Spacing.six,
    alignItems: 'flex-start',
  },
  mainCol: { flex: 1, minWidth: 0, gap: Spacing.three },
  filtersCol: { width: 280, flexShrink: 0 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { color: '#f4f2ef', fontSize: 32 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111012', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#f4f2ef', fontSize: 14, height: 20, padding: 0 },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterChips: { gap: 6 },
  chip: {
    backgroundColor: '#111012', paddingVertical: 7, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: { backgroundColor: '#e8823f', borderColor: '#e8823f' },
  chipText: { color: '#8f8b85', fontWeight: '600', fontSize: 13, userSelect: 'none' as any },
  chipTextActive: { color: '#1a1005' },

  sportDropdown: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111012', borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 7, paddingHorizontal: 12,
    flexShrink: 0,
  },
  sportDropdownText: { color: '#c9c5bf', fontSize: 12, fontWeight: '600', maxWidth: 90 },

  sectionLabel: { color: '#8f8b85', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  errorText: { color: '#eb8f84', textAlign: 'center' },
  emptyText: { color: '#8f8b85', textAlign: 'center', marginTop: Spacing.four },

  list: { gap: Spacing.two },

  card: {
    backgroundColor: '#0f0e12', borderRadius: 16, overflow: 'hidden',
  },

  cardImage: { height: 120, justifyContent: 'flex-start' },
  cardImageOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,10,11,0.35)',
  },
  cardImageTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 10,
  },
  cardImageSportChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(10,10,11,0.55)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  cardImageSportText: { color: '#f4f2ef', fontSize: 11, fontWeight: '700' },
  cardImageFallback: {
    height: 120, backgroundColor: 'rgba(232,130,63,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  cardBody: { padding: 16, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, color: '#f4f2ef', fontSize: 15, fontWeight: '700' },
  badgeStack: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  waitlistBadge: { backgroundColor: '#f4c95d22', borderWidth: 1, borderColor: '#f4c95d' },
  waitlistText: { color: '#f4c95d' },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#8f8b8522' },
  statusText: { fontSize: 11, fontWeight: '700' },

  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -4 },
  organizerRowText: { color: '#e8823f', fontSize: 12, fontWeight: '600' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap' },
  metaText: { color: '#8f8b85', fontSize: 12, flexShrink: 1 },
  metaDot: { color: '#4a4845', fontSize: 12 },
  metaDist: { color: '#c9c5bf', fontSize: 12, fontWeight: '600', flexShrink: 0 },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  avatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#111012' },
  avatarExtra: { backgroundColor: '#2a2a2e', alignItems: 'center', justifyContent: 'center' },
  avatarExtraText: { color: '#8f8b85', fontSize: 9, fontWeight: '700' },
  participantCount: { color: '#8f8b85', fontSize: 12, marginLeft: 8 },

  progressTrack: {
    flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111012', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, gap: 4,
  },
  modalTitle: { color: '#f4f2ef', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10,
  },
  modalOptionActive: { backgroundColor: 'rgba(232,130,63,0.1)' },
  modalOptionRow: { flexDirection: 'row', alignItems: 'center' },
  modalOptionText: { color: '#8f8b85', fontSize: 14, fontWeight: '500' },
  modalOptionTextActive: { color: '#e8823f', fontWeight: '700' },

  // Filters panel (desktop)
  filtersPanel: {
    backgroundColor: '#0f0e12', borderRadius: 16, padding: Spacing.three,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: Spacing.two,
  },
  filtersPanelTitle: { color: '#f4f2ef', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  filterSectionLabel: { color: '#8f8b85', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 8 },
  filterSectionStack: { gap: 6 },
  filterRowInline: { flexDirection: 'row', gap: 8 },
  filterRowChip: {
    backgroundColor: '#111012', paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipSmall: {
    backgroundColor: '#111012', paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center',
  },
  filterRowChipActive: { backgroundColor: '#e8823f', borderColor: '#e8823f' },
  filterRowChipText: { color: '#c9c5bf', fontSize: 13, fontWeight: '600', userSelect: 'none' as any },
  filterRowChipTextActive: { color: '#1a1005' },

  distanceRow: { gap: 6 },
  distanceValue: { color: '#c9c5bf', fontSize: 12, fontWeight: '600' },
  sliderTrackWrap: { height: 24, justifyContent: 'center' },
  sliderTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  sliderFill: { height: '100%', borderRadius: 2, backgroundColor: '#e8823f' },
  sliderThumb: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#e8823f', marginLeft: -8, top: 4,
    borderWidth: 2, borderColor: '#0a0a0b',
  },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checkboxLabel: { color: '#c9c5bf', fontSize: 13, userSelect: 'none' as any },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 4 },
  filtersHint: { color: '#8f8b85', fontSize: 11, marginTop: 2 },
});
