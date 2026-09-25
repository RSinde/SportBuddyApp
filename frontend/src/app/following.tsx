import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getUserProfile, followUser, unfollowUser, searchUsers } from '@/services/users';
import { PublicUser } from '@/types/user';
import { useTranslation } from '@/i18n';

const SEARCH_DEBOUNCE_MS = 400;

function AvatarCircle({ avatarUrl }: { avatarUrl?: string }) {
  if (avatarUrl) return <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />;
  return (
    <View style={styles.avatar}>
      <Ionicons name="business-outline" size={20} color="#8f8b85" />
    </View>
  );
}

export default function FollowingScreen() {
  const { profile, patchProfile, refreshProfile } = useAuth();
  const { t } = useTranslation();

  const [companies, setCompanies] = useState<PublicUser[] | null>(null);
  const [nameFilter, setNameFilter] = useState('');

  const [discoverMode, setDiscoverMode] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverResults, setDiscoverResults] = useState<PublicUser[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);

  const followingRef = useRef(profile?.following);
  followingRef.current = profile?.following;

  useFocusEffect(useCallback(() => {
    const ids = followingRef.current ?? [];
    if (ids.length === 0) { setCompanies([]); return; }
    Promise.all(ids.map((id: string) => getUserProfile(id)))
      .then(profiles => setCompanies(profiles.filter(p => p.role === 'partner')))
      .catch(() => setCompanies([]));
  }, []));

  useEffect(() => {
    if (!discoverMode) return;
    const trimmed = discoverQuery.trim();
    if (trimmed.length < 1) { queueMicrotask(() => { setDiscoverResults(null); setSearching(false); }); return; }
    queueMicrotask(() => setSearching(true));
    const timer = setTimeout(async () => {
      try {
        const users = await searchUsers(trimmed);
        const profiles = await Promise.all(users.map(u => getUserProfile(u.id)));
        setDiscoverResults(profiles.filter(p => p.role === 'partner'));
      } catch {
        setDiscoverResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [discoverQuery, discoverMode]);

  const handleFollow = async (id: string) => {
    if (actionId) return;
    setActionId(id);
    try {
      await followUser(id);
      patchProfile({ following: [...(profile?.following ?? []), id] });
      const company = discoverResults?.find(p => p.id === id);
      if (company) {
        setCompanies(prev => prev ? [...prev, { ...company, isFollowing: true }] : [{ ...company, isFollowing: true }]);
      }
      setDiscoverResults(prev => prev?.map(p => p.id === id ? { ...p, isFollowing: true } : p) ?? prev);
    } finally {
      setActionId(null);
    }
  };

  const handleUnfollow = async (id: string) => {
    if (actionId) return;
    setActionId(id);
    try {
      await unfollowUser(id);
      patchProfile({ following: (profile?.following ?? []).filter(f => f !== id) });
      setCompanies(prev => prev?.filter(c => c.id !== id) ?? prev);
    } finally {
      setActionId(null);
    }
  };

  const followingIds = new Set(profile?.following ?? []);
  const filtered = nameFilter.trim()
    ? (companies ?? []).filter(c => c.name.toLowerCase().includes(nameFilter.trim().toLowerCase()))
    : (companies ?? []);

  if (discoverMode) {
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.discoverHeader}>
            <Pressable onPress={() => { setDiscoverMode(false); setDiscoverQuery(''); setDiscoverResults(null); }} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#f4f2ef" />
            </Pressable>
            <ThemedText style={styles.discoverHeaderTitle}>{t('profile.following.searchCompanies')}</ThemedText>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#8f8b85" />
            <TextInput
              style={[styles.searchInput, { outline: 'none' } as any]}
              placeholder={t('profile.following.searchPlaceholder')}
              placeholderTextColor="#8f8b85"
              value={discoverQuery}
              onChangeText={setDiscoverQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {discoverQuery.length > 0 && (
              <Pressable onPress={() => setDiscoverQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#8f8b85" />
              </Pressable>
            )}
          </View>

          {discoverResults === null ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyText}>{t('profile.following.typeToSearch')}</ThemedText>
            </View>
          ) : discoverResults.length === 0 && !searching ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyText}>{t('profile.following.noCompaniesFound')}</ThemedText>
            </View>
          ) : (
            <>
              <ThemedText style={styles.sectionTitle}>
                {searching ? t('profile.friends.resultsSearching') : t('profile.friends.resultsCount', { count: discoverResults.length })}
              </ThemedText>
              {discoverResults.map(company => {
                const isFollowing = followingIds.has(company.id) || company.isFollowing;
                return (
                  <View key={company.id} style={styles.row}>
                    <Pressable
                      style={({ pressed }) => [styles.info, pressed && styles.pressed]}
                      onPress={() => router.push({ pathname: '/user/[id]', params: { id: company.id } })}>
                      <AvatarCircle avatarUrl={company.avatarUrl} />
                      <View style={styles.textBlock}>
                        <ThemedText style={styles.name} numberOfLines={1}>{company.name}</ThemedText>
                        {company.bio ? <ThemedText style={styles.bio} numberOfLines={1}>{company.bio}</ThemedText> : null}
                      </View>
                    </Pressable>
                    <Pressable
                      style={isFollowing ? styles.followingBtn : styles.followBtn}
                      onPress={() => isFollowing ? handleUnfollow(company.id) : handleFollow(company.id)}
                      disabled={actionId === company.id}>
                      <ThemedText style={isFollowing ? styles.followingText : styles.followText}>
                        {actionId === company.id ? t('profile.following.busy') : isFollowing ? t('profile.user.following') : t('profile.user.follow')}
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.listHeader}>
          <ThemedText style={styles.sectionTitle}>{t('profile.following.followingCount', { count: companies?.length ?? 0 })}</ThemedText>
          <Pressable style={styles.discoverBtn} onPress={() => setDiscoverMode(true)} hitSlop={8}>
            <Ionicons name="search-outline" size={18} color="#e8823f" />
          </Pressable>
        </View>

        {(companies?.length ?? 0) > 0 && (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#8f8b85" />
            <TextInput
              style={[styles.searchInput, { outline: 'none' } as any]}
              placeholder={t('profile.following.filterPlaceholder')}
              placeholderTextColor="#8f8b85"
              value={nameFilter}
              onChangeText={setNameFilter}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {nameFilter.length > 0 && (
              <Pressable onPress={() => setNameFilter('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#8f8b85" />
              </Pressable>
            )}
          </View>
        )}

        {companies === null ? (
          <ThemedText style={styles.emptyText}>{t('profile.loading')}</ThemedText>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="business-outline" size={48} color="#141315" style={{ marginBottom: 8 }} />
            <ThemedText style={styles.emptyText}>
              {companies.length === 0
                ? t('profile.following.noCompaniesYet')
                : t('profile.following.noCompaniesFound')}
            </ThemedText>
          </View>
        ) : (
          filtered.map(company => (
            <View key={company.id} style={styles.row}>
              <Pressable
                style={({ pressed }) => [styles.info, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: company.id } })}>
                <AvatarCircle avatarUrl={company.avatarUrl} />
                <View style={styles.textBlock}>
                  <ThemedText style={styles.name} numberOfLines={1}>{company.name}</ThemedText>
                  {company.bio ? <ThemedText style={styles.bio} numberOfLines={1}>{company.bio}</ThemedText> : null}
                </View>
              </Pressable>
              <Pressable
                style={styles.unfollowBtn}
                onPress={() => handleUnfollow(company.id)}
                disabled={actionId === company.id}>
                <ThemedText style={styles.unfollowText}>
                  {actionId === company.id ? t('profile.following.busy') : t('profile.following.unfollow')}
                </ThemedText>
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { backgroundColor: '#0a0a0b' },
  scrollContent: { flexGrow: 1, paddingVertical: Spacing.four },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },

  backBtn: { alignSelf: 'flex-start' },

  discoverHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  discoverHeaderTitle: { color: '#f4f2ef', fontSize: 18, fontWeight: 'bold' },

  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#f4f2ef', fontSize: 16, fontWeight: 'bold' },
  discoverBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(232,130,63,0.12)' },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111012', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: Spacing.three, height: 48,
  },
  searchInput: { flex: 1, color: '#f4f2ef', fontSize: 15, height: '100%' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111012', borderRadius: 12, padding: Spacing.three,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#1a1a1b', alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  textBlock: { flex: 1, minWidth: 0 },
  name: { color: '#f4f2ef', fontSize: 15 },
  bio: { color: '#8f8b85', fontSize: 13 },

  followBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(232,130,63,0.15)',
  },
  followText: { color: '#e8823f', fontSize: 13, fontWeight: 'bold' },
  followingBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  followingText: { color: '#8f8b85', fontSize: 13 },
  unfollowBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  unfollowText: { color: '#8f8b85', fontSize: 13 },

  empty: { alignItems: 'center', paddingVertical: Spacing.five },
  emptyText: { color: '#8f8b85', fontSize: 14, textAlign: 'center' },

  pressed: { opacity: 0.7 },
});
