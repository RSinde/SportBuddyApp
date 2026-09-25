import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, ScrollView, View, Image, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AnimatedWeatherIcon } from '@/components/animated-weather-icon';
// import { DIFFICULTY_COLORS } from '@/constants/difficulty';
import { sportImages } from '@/constants/sport-images';
import { BottomTabInset, MaxContentWidth, Spacing, TopTabInset } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { listActivities, getFriendsActivities, getFriendsFeed, getMyActivities } from '@/services/activities';
import { listSports } from '@/services/sports';
import { getNotifications } from '@/services/notifications';
import { getFriends } from '@/services/friends';
import { Activity, FeedItem } from '@/types/activity';
import { Sport } from '@/types/sport';
import { Friend } from '@/types/friend';
import { SportIcon } from '@/utils/sport-icon';
import { translateSportName } from '@/utils/translate-sport';
import { relativeDate } from '@/utils/date';
import { getWeeklyForecast, DailyForecast } from '@/services/weather';
import { getWeatherInfo, getUvColor } from '@/utils/weather-codes';
import { haversineKm } from '@/utils/distance';
import { useNow } from '@/hooks/use-now';
import * as Location from 'expo-location';
import { useTranslation } from '@/i18n';

const RECOMMENDED_RADIUS_KM = 50;
const MAX_RECOMMENDED_ACTIVITIES = 4;

// const DIFFICULTY_LABELS: Record<Activity['difficultyLevel'], string> = {
//   beginner: 'Beginner',
//   intermediate: 'Intermediate',
//   advanced: 'Advanced',
//   competitive: 'Competitive',
// };


function isUpcoming(activity: Activity) {
  return (
    (activity.status === 'open' || activity.status === 'full') &&
    new Date(activity.date).getTime() >= Date.now()
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function HomeScreen() {
  const { t, language } = useTranslation();
  const { user, profile } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = screenWidth >= 900;
  const firstName = (user?.displayName ?? user?.email ?? '').split(/[\s@]/)[0];
  const now = useNow(1000);

  // const [activities, setActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsActivities, setFriendsActivities] = useState<Activity[]>([]);
  const [friendFeed, setFriendFeed] = useState<FeedItem[]>([]);
  const [followedCompanyActivities, setFollowedCompanyActivities] = useState<Activity[]>([]);
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      // listActivities().then(setActivities).catch(() => setActivities([]));
      getMyActivities().then(setMyActivities).catch(() => setMyActivities([]));
      listSports().then(setSports).catch(() => setSports([]));
      getNotifications()
        .then((list) => setUnreadCount(list.filter((n) => !n.read).length))
        .catch(() => setUnreadCount(0));
      getFriends().then(setFriends).catch(() => setFriends([]));
      getFriendsActivities().then(setFriendsActivities).catch(() => setFriendsActivities([]));
      getFriendsFeed().then(setFriendFeed).catch(() => setFriendFeed([]));

      (async () => {
        const DEFAULT = { latitude: 38.7223, longitude: -9.1393 };
        let coords = DEFAULT;
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({});
            coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          }
        } catch { }
        setUserCoords(coords);
        try {
          const data = await getWeeklyForecast(coords.latitude, coords.longitude);
          setForecast(data.forecast);
          setLocationName(data.location);
        } catch { }
      })();
    }, [])
  );

  useEffect(() => {
    const followingIds: string[] = profile?.following ?? [];
    if (followingIds.length > 0) {
      Promise.all(followingIds.map(id => listActivities({ createdBy: id })))
        .then(results => setFollowedCompanyActivities(results.flat()))
        .catch(() => setFollowedCompanyActivities([]));
    } else {
      setFollowedCompanyActivities([]);
    }
  }, [profile?.following?.join(',')]);


  const sportNameById = new Map(sports.map((s) => [s.id, s.name]));

  const myUpcomingActivities = myActivities
    .filter((a) =>
      (a.status === 'open' || a.status === 'full') &&
      new Date(a.date).getTime() > now &&
      a.participantsList.includes(user?.uid ?? '')
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const nextActivity = myUpcomingActivities[0] ?? null;
  const otherUpcomingActivities = myUpcomingActivities.slice(1);

  function countdown(iso: string): string {
    const diff = new Date(iso).getTime() - now;
    if (diff <= 0) return t('home.now');
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  const friendNameById = new Map(friends.map((f) => [f.userId, f.user.name.split(' ')[0]]));

  function friendsGoingLabel(activity: Activity) {
    const names = activity.participantsList
      .map((id) => friendNameById.get(id))
      .filter((name): name is string => !!name);
    if (names.length === 0) return '';
    if (names.length === 1) return t('home.friendJoining', { name: names[0] });
    if (names.length === 2) return t('home.friendsJoining2', { name1: names[0], name2: names[1] });
    return t('home.friendsJoiningMore', { name: names[0], count: names.length - 1 });
  }


  // const upcoming = activities
  //   .filter(isUpcoming)
  //   .filter((a) => activeFilter === ALL_FILTER || sportNameById.get(a.sportId) === activeFilter)
  //   .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const followedCompanyUpcoming = followedCompanyActivities
    .filter(a => isUpcoming(a) && !a.participantsList.includes(user?.uid ?? ''))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 4);

  const recommended = friendsActivities.filter((a) => {
    if (!isUpcoming(a) || a.participantsList.includes(user?.uid ?? '')) return false;
    if (!userCoords) return true;
    return haversineKm(userCoords.latitude, userCoords.longitude, a.location.lat, a.location.lng) <= RECOMMENDED_RADIUS_KM;
  }).slice(0, MAX_RECOMMENDED_ACTIVITIES);

  const sidebarContent = (
    <View style={styles.sidebarInner}>
      {forecast && forecast.length > 0 && (() => {
        const today = forecast[0];
        const { icon, category, labelKey } = getWeatherInfo(today.weatherCode);
        const sportHint =
          category === 'clear' || category === 'partly-cloud' ? t('home.weather.idealForPlaying')
            : category === 'cloud' ? t('home.weather.goodForPlaying')
              : category === 'drizzle' || category === 'rain' ? t('home.weather.difficultConditions')
                : category === 'storm' ? t('home.weather.notRecommended')
                  : '';
        return (
          <View style={styles.compactWeather}>
            <View style={styles.compactWeatherHeader}>
              <ThemedText style={styles.compactWeatherTitle}>{t('home.weather.title')}</ThemedText>
              {locationName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="location-outline" size={11} color="#8f8b85" />
                  <ThemedText style={styles.compactWeatherLocation}>{locationName}</ThemedText>
                </View>
              )}
            </View>

            {/* Hoje — grande */}
            <View style={styles.compactToday}>
              <AnimatedWeatherIcon icon={icon} category={category} size={48} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.compactTodayTemp}>{Math.round(today.tempMax)}°</ThemedText>
                <ThemedText style={styles.compactTodayLabel}>{t(labelKey)}{sportHint}</ThemedText>
              </View>
              <View style={styles.compactSideInfo}>
                <View style={styles.compactPrecip}>
                  <Ionicons name="water-outline" size={13} color="#60A5FA" />
                  <ThemedText style={styles.compactPrecipText}>{Math.round(today.precipitationProbability)}%</ThemedText>
                </View>
                {today.uvIndex !== null && (
                  <View style={styles.compactUv}>
                    <Ionicons name="sunny-outline" size={13} color={getUvColor(today.uvIndex)} />
                    <ThemedText style={[styles.compactUvText, { color: getUvColor(today.uvIndex) }]}>
                      {t('home.weather.uv', { value: Math.round(today.uvIndex) })}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.compactDivider} />

            {/* Próximos dias — pequeno */}
            <View style={styles.compactWeatherRow}>
              {forecast.slice(1, 5).map((day) => {
                const dayLabel = t(`weather.weekday.${new Date(day.date).getDay()}`);
                const dayWeather = getWeatherInfo(day.weatherCode);
                return (
                  <View key={day.date} style={styles.compactDayItem}>
                    <ThemedText style={styles.compactDayLabel}>{dayLabel}</ThemedText>
                    <AnimatedWeatherIcon icon={dayWeather.icon} category={dayWeather.category} size={22} />
                    <ThemedText style={styles.compactDayTemp}>{Math.round(day.tempMax)}°</ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })()}

      {friendFeed.length > 0 && (
        <View style={styles.sidebarSection}>
          <ThemedText type="subtitle" style={styles.sidebarTitle}>{t('home.friendsActivity')}</ThemedText>
          {friendFeed.slice(0, 6).map((item, i) => (
            <Pressable
              key={`feed-${i}`}
              onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.activityId } })}
              style={({ pressed }) => [styles.feedSidebarItem, pressed && styles.pressed]}
            >
              <View style={styles.feedAvatar}>
                <ThemedText style={styles.feedAvatarText}>{getInitials(item.userName)}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.feedSidebarText} numberOfLines={2}>
                  <ThemedText style={styles.feedSidebarName}>{item.userName} </ThemedText>
                  {item.type === 'joined' && t('home.feed.joined')}
                  {item.type === 'created' && t('home.feed.organised')}
                  {item.type === 'mvp' && t('home.feed.wonMvpIn')}
                  <ThemedText style={styles.feedSidebarActivity}>{item.activityTitle}</ThemedText>
                </ThemedText>
                <ThemedText style={styles.feedTime}>{relativeDate(item.timestamp, t, language)}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: '#0a0a0b' }]}>
      <SafeAreaView style={[styles.safeArea, isWide && styles.safeAreaWide]}>
        <View style={[styles.mainLayout, isWide && styles.mainLayoutWide]}>

          {/* COLUNA PRINCIPAL */}
          <View style={styles.mainColumn}>
            {/* CABEÇALHO */}
            <View style={[styles.header, styles.headerRow]}>
              <View style={styles.profileHeader}>
                <Link href="/profile" asChild>
                  <Pressable hitSlop={8}>
                    {profile?.avatarUrl || user?.photoURL ? (
                      <Image source={{ uri: profile?.avatarUrl ?? user?.photoURL ?? undefined }} style={styles.profilePic} />
                    ) : (
                      <View style={styles.profilePicPlaceholder}>
                        <Ionicons name="person" size={24} color="#8f8b85" />
                      </View>
                    )}
                  </Pressable>
                </Link>
                {isWide && (
                  <View>
                    <ThemedText type="subtitle" style={styles.profileName}>
                      {t('home.greeting', { name: firstName })}
                    </ThemedText>
                    <ThemedText style={styles.greetingText}>
                      {t('home.subtitle')}
                    </ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.headerIcons}>
                <Link href="/notifications" asChild>
                  <Pressable style={styles.iconBtn} hitSlop={8}>
                    <Ionicons name="notifications-outline" size={24} color="#f4f2ef" />
                    {unreadCount > 0 && (
                      <View style={styles.iconBadge}>
                        <ThemedText style={styles.iconBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</ThemedText>
                      </View>
                    )}
                  </Pressable>
                </Link>
                <Link href="/friends" asChild>
                  <Pressable style={styles.iconBtn} hitSlop={8}>
                    <Ionicons name="people-outline" size={24} color="#f4f2ef" />
                  </Pressable>
                </Link>
                <Link href={{ pathname: '/friends', params: { mode: 'search' } }} asChild>
                  <Pressable style={styles.iconBtn} hitSlop={8}>
                    <Ionicons name="search-outline" size={24} color="#f4f2ef" />
                  </Pressable>
                </Link>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

              {/* PRÓXIMA ATIVIDADE */}
              {nextActivity && (
                <View style={styles.nextSection}>
                  <View style={styles.nextSectionHeader}>
                    <ThemedText style={styles.nextSectionLabel}>{t('home.nextActivityLabel')}</ThemedText>
                    {otherUpcomingActivities.length > 0 && (
                      <Pressable
                        onPress={() => setShowAllActivities((v) => !v)}
                        style={({ pressed }) => [styles.seeAllToggle, pressed && styles.pressed]}
                      >
                        <ThemedText style={styles.seeAllSmall}>
                          {showAllActivities ? t('home.showLess') : t('home.showAll')}
                        </ThemedText>
                        <Ionicons
                          name={showAllActivities ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color="#e8823f"
                        />
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.nextCard}>
                    <View style={styles.nextCardLeft}>
                      <View style={styles.nextSportCircle}>
                        <SportIcon sportName={sportNameById.get(nextActivity.sportId)} size={28} color="#e8823f" />
                      </View>
                      <ThemedText style={styles.nextComecaLabel}>{t('home.startsIn')}</ThemedText>
                      <ThemedText style={styles.nextCountdown}>{countdown(nextActivity.date)}</ThemedText>
                    </View>

                    <View style={styles.nextCardRight}>
                      <View style={styles.nextTitleRow}>
                        <ThemedText style={styles.nextCardTitle} numberOfLines={1}>
                          {sportNameById.get(nextActivity.sportId) ? `${translateSportName(sportNameById.get(nextActivity.sportId), language)} · ` : ''}{nextActivity.title}
                        </ThemedText>
                        {nextActivity.status === 'full' ? (
                          <View style={styles.confirmedBadge}>
                            <ThemedText style={styles.confirmedText}>{t('home.confirmed')}</ThemedText>
                          </View>
                        ) : (
                          <View style={[styles.confirmedBadge, { backgroundColor: 'rgba(232,130,63,0.12)', borderColor: 'rgba(232,130,63,0.3)' }]}>
                            <ThemedText style={[styles.confirmedText, { color: '#e8823f' }]}>
                              {t('home.spotsLeft', { count: nextActivity.maxParticipants - nextActivity.participantsList.length })}
                            </ThemedText>
                          </View>
                        )}
                      </View>

                      <View style={styles.nextInfoRow}>
                        <Ionicons name="calendar-outline" size={13} color="#c9c5bf" />
                        <ThemedText style={styles.nextInfoText} numberOfLines={1}>
                          {(() => {
                            const d = new Date(nextActivity.date);
                            const isToday = d.toDateString() === new Date().toDateString();
                            return `${isToday ? t('home.today') : formatDate(nextActivity.date)} · ${formatTime(nextActivity.date)}`;
                          })()}
                        </ThemedText>
                        <Ionicons name="location-outline" size={13} color="#c9c5bf" style={{ marginLeft: 6 }} />
                        <ThemedText style={styles.nextInfoText} numberOfLines={1}>{nextActivity.location.name}</ThemedText>
                        <Ionicons name="people-outline" size={13} color="#c9c5bf" style={{ marginLeft: 6 }} />
                        <ThemedText style={styles.nextInfoText} numberOfLines={1}>
                          {nextActivity.participantsList.length}/{nextActivity.maxParticipants}
                        </ThemedText>
                      </View>

                      <View style={styles.nextCardActions}>
                        <Pressable
                          onPress={() => router.push({ pathname: '/activity/[id]', params: { id: nextActivity.id } })}
                          style={styles.nextBtn}
                        >
                          <Text style={styles.nextBtnText}>{t('home.viewActivity')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => router.push({ pathname: '/chat/[id]', params: { id: nextActivity.id } })}
                          style={styles.nextBtnGhost}
                        >
                          <Ionicons name="chatbubble-outline" size={14} color="#8f8b85" />
                          <ThemedText style={styles.nextBtnGhostText}>{t('home.chat')}</ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {showAllActivities && otherUpcomingActivities.length > 0 && (
                    <View style={styles.miniActivitiesList}>
                      {otherUpcomingActivities.map((activity) => {
                        const d = new Date(activity.date);
                        const isToday = d.toDateString() === new Date().toDateString();
                        return (
                          <Pressable
                            key={activity.id}
                            onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
                            style={({ pressed }) => [styles.miniActivityCard, pressed && styles.pressed]}
                          >
                            <View style={styles.miniSportCircle}>
                              <SportIcon sportName={sportNameById.get(activity.sportId)} size={16} color="#e8823f" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={styles.miniActivityTitle} numberOfLines={1}>
                                {activity.title}
                              </ThemedText>
                              <View style={styles.miniInfoRow}>
                                <Ionicons name="calendar-outline" size={11} color="#8f8b85" />
                                <ThemedText style={styles.miniInfoText}>
                                  {isToday ? t('home.today') : formatDate(activity.date)} · {formatTime(activity.date)}
                                </ThemedText>
                                <Ionicons name="location-outline" size={11} color="#8f8b85" style={{ marginLeft: 6 }} />
                                <ThemedText style={styles.miniInfoText} numberOfLines={1}>
                                  {activity.location.name}
                                </ThemedText>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#8f8b85" />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}


              {/* RECOMENDADO PARA TI */}
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>{t('home.recommended')}</ThemedText>
                  {recommended.length > 0 && (
                    <Link href="/explore" asChild>
                      <Pressable style={({ pressed }) => pressed && styles.pressed}>
                        <ThemedText style={styles.seeAll}>{t('home.seeAll')}</ThemedText>
                      </Pressable>
                    </Link>
                  )}
                </View>

                {recommended.length === 0 ? (
                  <View style={styles.recEmpty}>
                    <ThemedText style={styles.recEmptyTitle}>{t('home.noRecommendationsTitle')}</ThemedText>
                    <ThemedText style={styles.recEmptyText}>
                      {t('home.noRecommendationsText')}
                    </ThemedText>
                    <Link href="/explore" asChild>
                      <Pressable style={({ pressed }) => pressed && styles.pressed}>
                        <View style={styles.recEmptyBtn}>
                          <Text style={styles.recEmptyBtnText}>{t('home.exploreActivities')}</Text>
                        </View>
                      </Pressable>
                    </Link>
                  </View>
                ) : (
                  <View style={[styles.recGrid, isWide && styles.recGridWide]}>
                    {recommended.map((activity) => {
                      const spotsLeft = activity.maxParticipants - activity.participantsList.length;
                      const isAlmostFull = spotsLeft <= 3 && spotsLeft > 0 && activity.status === 'open';
                      const isPrivate = activity.requiresApproval;
                      const statusLabel = isAlmostFull ? t('home.almostFull') : activity.status === 'full' ? t('home.full') : isPrivate ? t('explore.card.private') : t('home.open');
                      const statusColor = isAlmostFull ? '#e8823f' : activity.status === 'full' ? '#8f8b85' : isPrivate ? '#8f8b85' : '#4ade80';
                      const goingLabel = friendsGoingLabel(activity);

                      const image = sportImages[activity.sportId];

                      return (
                        <Pressable
                          key={activity.id}
                          onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
                          style={({ pressed }) => [styles.recCard, isWide && styles.recCardWide, pressed && styles.pressed]}
                        >
                          {image ? (
                            <ImageBackground source={image} resizeMode="cover" style={styles.recCardImage}>
                              <View style={styles.recCardImageOverlay} />
                              <View style={styles.recCardImageTopRow}>
                                <View style={styles.recSportChipOnImage}>
                                  <SportIcon sportName={sportNameById.get(activity.sportId)} size={12} color="#f4f2ef" />
                                  <ThemedText style={styles.recSportTextOnImage}>
                                    {translateSportName(sportNameById.get(activity.sportId), language) || activity.sportId}
                                  </ThemedText>
                                </View>
                              </View>
                            </ImageBackground>
                          ) : (
                            <View style={styles.recCardImageFallback}>
                              <SportIcon sportName={sportNameById.get(activity.sportId)} size={26} color="#e8823f" />
                            </View>
                          )}

                          <View style={styles.recCardBody}>
                            {!image && (
                              <View style={styles.recCardTop}>
                                <View style={styles.recSportChip}>
                                  <SportIcon sportName={sportNameById.get(activity.sportId)} size={12} color="#c9c5bf" />
                                  <ThemedText style={styles.recSportText}>
                                    {translateSportName(sportNameById.get(activity.sportId), language) || activity.sportId}
                                  </ThemedText>
                                </View>
                              </View>
                            )}

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <ThemedText style={[styles.recTitle, { flex: 1 }]} numberOfLines={1}>{activity.title}</ThemedText>
                              <View style={[styles.recStatusChip, { borderColor: statusColor + '55' }]}>
                                <ThemedText style={[styles.recStatusText, { color: statusColor }]}>{statusLabel}</ThemedText>
                              </View>
                            </View>

                            <View style={styles.recInfoRow}>
                              <Ionicons name="calendar-outline" size={12} color="#8f8b85" />
                              <ThemedText style={styles.recInfoText}>
                                {formatDate(activity.date)} · {formatTime(activity.date)}
                              </ThemedText>
                            </View>

                            {goingLabel !== '' && (
                              <View style={styles.recFriendsRow}>
                                <Ionicons name="people-outline" size={12} color="#e8823f" />
                                <ThemedText style={styles.recFriendsText} numberOfLines={1}>{goingLabel}</ThemedText>
                              </View>
                            )}

                            <View style={styles.recCardBottom}>
                              <View style={styles.recInfoRow}>
                                <Ionicons name="location-outline" size={12} color="#8f8b85" />
                                <ThemedText style={styles.recInfoText} numberOfLines={1}>{activity.location.name}</ThemedText>
                              </View>
                              <ThemedText style={styles.recParticipants}>
                                {activity.participantsList.length} / {activity.maxParticipants}
                              </ThemedText>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {followedCompanyUpcoming.length > 0 && (
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <ThemedText type="subtitle" style={styles.sectionTitle}>{t('home.followedCompanies')}</ThemedText>
                  </View>
                  <View style={[styles.recGrid, isWide && styles.recGridWide]}>
                    {followedCompanyUpcoming.map((activity) => {
                      const spotsLeft = activity.maxParticipants - activity.participantsList.length;
                      const isAlmostFull = spotsLeft <= 3 && spotsLeft > 0 && activity.status === 'open';
                      const isPrivate = activity.requiresApproval;
                      const statusLabel = isAlmostFull ? t('home.almostFull') : activity.status === 'full' ? t('home.full') : isPrivate ? t('explore.card.private') : t('home.open');
                      const statusColor = isAlmostFull ? '#e8823f' : activity.status === 'full' ? '#8f8b85' : isPrivate ? '#8f8b85' : '#4ade80';
                      const image = sportImages[activity.sportId];
                      return (
                        <Pressable
                          key={activity.id}
                          onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
                          style={({ pressed }) => [styles.recCard, isWide && styles.recCardWide, pressed && styles.pressed]}
                        >
                          {image ? (
                            <ImageBackground source={image} resizeMode="cover" style={styles.recCardImage}>
                              <View style={styles.recCardImageOverlay} />
                              <View style={styles.recCardImageTopRow}>
                                <View style={styles.recSportChipOnImage}>
                                  <SportIcon sportName={sportNameById.get(activity.sportId)} size={12} color="#f4f2ef" />
                                  <ThemedText style={styles.recSportTextOnImage}>
                                    {translateSportName(sportNameById.get(activity.sportId), language) || activity.sportId}
                                  </ThemedText>
                                </View>
                              </View>
                            </ImageBackground>
                          ) : (
                            <View style={styles.recCardImageFallback}>
                              <SportIcon sportName={sportNameById.get(activity.sportId)} size={26} color="#e8823f" />
                            </View>
                          )}
                          <View style={styles.recCardBody}>
                            {!image && (
                              <View style={styles.recCardTop}>
                                <View style={styles.recSportChip}>
                                  <SportIcon sportName={sportNameById.get(activity.sportId)} size={12} color="#c9c5bf" />
                                  <ThemedText style={styles.recSportText}>
                                    {translateSportName(sportNameById.get(activity.sportId), language) || activity.sportId}
                                  </ThemedText>
                                </View>
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <ThemedText style={[styles.recTitle, { flex: 1 }]} numberOfLines={1}>{activity.title}</ThemedText>
                              <View style={[styles.recStatusChip, { borderColor: statusColor + '55' }]}>
                                <ThemedText style={[styles.recStatusText, { color: statusColor }]}>{statusLabel}</ThemedText>
                              </View>
                            </View>
                            <View style={styles.recInfoRow}>
                              <Ionicons name="calendar-outline" size={12} color="#8f8b85" />
                              <ThemedText style={styles.recInfoText}>
                                {formatDate(activity.date)} · {formatTime(activity.date)}
                              </ThemedText>
                            </View>
                            {activity.createdByName && (
                              <View style={styles.recFriendsRow}>
                                <Ionicons name="business-outline" size={12} color="#e8823f" />
                                <ThemedText style={styles.recFriendsText} numberOfLines={1}>{activity.createdByName}</ThemedText>
                              </View>
                            )}
                            <View style={styles.recCardBottom}>
                              <View style={styles.recInfoRow}>
                                <Ionicons name="location-outline" size={12} color="#8f8b85" />
                                <ThemedText style={styles.recInfoText} numberOfLines={1}>{activity.location.name}</ThemedText>
                              </View>
                              <ThemedText style={styles.recParticipants}>
                                {activity.participantsList.length} / {activity.maxParticipants}
                              </ThemedText>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Sidebar inline em mobile */}
              {!isWide && sidebarContent}

            </ScrollView>
          </View>

          {/* SIDEBAR (só wide) */}
          {isWide && (
            <ScrollView
              style={styles.sidebarScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
            >
              {sidebarContent}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: TopTabInset + Spacing.two,
  },
  safeAreaWide: {
    maxWidth: 9999,
    alignSelf: 'stretch',
  },
  mainLayout: { flex: 1 },
  mainLayoutWide: { flexDirection: 'row' },
  mainColumn: { flex: 3, overflow: 'hidden' },

  // Header
  header: { paddingHorizontal: Spacing.four, marginBottom: Spacing.four },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  profilePic: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#111012' },
  profilePicPlaceholder: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#111012',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)',
  },
  profileName: { color: '#f4f2ef', fontSize: 20 },
  greetingText: { color: '#c9c5bf', fontSize: 14, marginTop: 2 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: 6 },
  iconBadge: {
    position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#eb8f84', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: '#0a0a0b',
  },
  iconBadgeText: { color: '#f4f2ef', fontSize: 10, fontWeight: 'bold' },

  scrollContent: { paddingBottom: BottomTabInset + Spacing.four },

  // Next activity
  nextSection: { paddingHorizontal: Spacing.four, marginBottom: Spacing.five },
  nextSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.two,
  },
  nextSectionLabel: {
    color: '#8f8b85', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.8,
  },
  seeAllToggle: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllSmall: { color: '#e8823f', fontWeight: 'bold', fontSize: 12 },
  nextCard: {
    backgroundColor: '#111012', borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', overflow: 'hidden',
  },
  nextCardLeft: {
    width: 110, backgroundColor: '#0f0e12', padding: Spacing.three,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.one,
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.06)',
  },
  nextSportCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(232,130,63,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  nextComecaLabel: { color: '#8f8b85', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  nextCountdown: { color: '#f4f2ef', fontSize: 22, fontWeight: 'bold' },
  nextCardRight: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  nextTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nextCardTitle: { color: '#f4f2ef', fontSize: 15, fontWeight: 'bold', flex: 1 },
  confirmedBadge: {
    backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  confirmedText: { color: '#4ade80', fontSize: 11, fontWeight: 'bold' },
  nextInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', rowGap: 4 },
  nextInfoText: { color: '#c9c5bf', fontSize: 13, flexShrink: 1 },
  nextCardActions: { flexDirection: 'row', gap: Spacing.two, marginTop: 4 },
  nextBtn: {
    height: 38, backgroundColor: '#e8823f',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, flex: 1,
  },
  nextBtnText: { color: '#0a0a0b', fontWeight: 'bold', fontSize: 14 },
  nextBtnGhost: {
    height: 38, paddingHorizontal: 16, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  nextBtnGhostText: { color: '#8f8b85', fontSize: 14 },

  // Mini activities list (dropdown "Ver todas")
  miniActivitiesList: { marginTop: Spacing.three, gap: Spacing.two },
  miniActivityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111012', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', padding: Spacing.three,
  },
  miniSportCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(232,130,63,0.12)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  miniActivityTitle: { color: '#f4f2ef', fontSize: 13, fontWeight: 'bold' },
  miniInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  miniInfoText: { color: '#8f8b85', fontSize: 11, flexShrink: 1 },


  recEmpty: {
    marginHorizontal: Spacing.four,
    backgroundColor: '#111012',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  recEmptyTitle: { color: '#f4f2ef', fontSize: 17, fontWeight: 'bold', textAlign: 'center', fontFamily: 'Archivo_700Bold' },
  recEmptyText: { color: '#8f8b85', fontSize: 14, textAlign: 'center', lineHeight: 20, fontFamily: 'HankenGrotesk_400Regular' },
  recEmptyBtn: {
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#e8823f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recEmptyBtnText: { color: '#0a0a0b', fontWeight: 'bold', fontSize: 15, fontFamily: 'HankenGrotesk_700Bold' },

  // Recommended grid
  sectionBlock: { marginBottom: Spacing.five },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.four, marginBottom: Spacing.three,
  },
  sectionTitle: { color: '#f4f2ef', fontSize: 20 },
  seeAll: { color: '#e8823f', fontWeight: 'bold', fontSize: 14 },
  recGrid: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  recGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  recCard: {
    backgroundColor: '#111012', borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  recCardWide: { width: '48%', flexGrow: 0, flexShrink: 0 },
  recCardImage: { height: 100, justifyContent: 'flex-start' },
  recCardImageOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,10,11,0.5)',
  },
  recCardImageTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 10,
  },
  recCardImageFallback: {
    height: 100, backgroundColor: 'rgba(232,130,63,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  recCardBody: { padding: Spacing.three, gap: 6 },
  recCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  recSportChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  recSportText: { color: '#c9c5bf', fontSize: 11, fontWeight: '600' },
  recSportChipOnImage: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(10,10,11,0.6)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  recSportTextOnImage: { color: '#f4f2ef', fontSize: 11, fontWeight: '700' },
  recStatusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  recStatusChipOnImage: {
    backgroundColor: 'rgba(10,10,11,0.6)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  recStatusText: { fontSize: 11, fontWeight: '600' },
  recTitle: { color: '#f4f2ef', fontSize: 15, fontWeight: 'bold' },
  recInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recInfoText: { color: '#8f8b85', fontSize: 12, flexShrink: 1 },
  recFriendsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recFriendsText: { color: '#e8823f', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  recCardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 4, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  recParticipants: { color: '#8f8b85', fontSize: 12 },

  // Sidebar
  sidebarScroll: {
    flex: 1,
    maxWidth: 340,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
  },
  sidebarInner: { padding: Spacing.four, gap: Spacing.five },
  sidebarSection: { gap: Spacing.three },
  sidebarTitle: { color: '#f4f2ef', fontSize: 18, marginBottom: 4 },
  feedSidebarItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  feedAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#1e1d22',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  feedAvatarText: { color: '#c9c5bf', fontSize: 11, fontWeight: 'bold' },
  feedSidebarText: { color: '#c9c5bf', fontSize: 12, lineHeight: 16 },
  feedSidebarName: { color: '#f4f2ef', fontWeight: 'bold' },
  feedSidebarActivity: { color: '#e8823f', fontWeight: '600' },
  feedTime: { color: '#8f8b85', fontSize: 10, marginTop: 1 },

  compactWeather: {
    backgroundColor: '#111012',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  compactWeatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactWeatherTitle: { color: '#f4f2ef', fontSize: 15, fontWeight: 'bold' },
  compactWeatherLocation: { color: '#8f8b85', fontSize: 12 },
  compactToday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactTodayTemp: { color: '#f4f2ef', fontSize: 36, fontWeight: 'bold', lineHeight: 40 },
  compactTodayLabel: { color: '#8f8b85', fontSize: 13, marginTop: 2 },
  compactSideInfo: {
    alignItems: 'flex-end',
    gap: 4,
    alignSelf: 'flex-start',
  },
  compactPrecip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactUv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactUvText: { fontSize: 14, fontWeight: '600' },
  compactPrecipText: { color: '#60A5FA', fontSize: 14, fontWeight: '600' },
  compactDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  compactWeatherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compactDayItem: { alignItems: 'center', gap: 4, flex: 1 },
  compactDayLabel: { color: '#8f8b85', fontSize: 11 },
  compactDayTemp: { color: '#f4f2ef', fontSize: 13, fontWeight: 'bold' },

  pressed: { opacity: 0.7 },
});