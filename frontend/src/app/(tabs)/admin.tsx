import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AvatarCircle } from '@/components/avatar-circle';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  TopTabInset,
} from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  deleteActivityAsAdmin,
  listAdminActivities,
} from '@/services/activities';
import {
  banUser,
  deleteUser,
  listAdminUsers,
  reactivateUser,
  suspendUser,
  updateUserRole,
} from '@/services/users';
import { AdminUser, UserRole } from '@/types/user';
import { Activity } from '@/types/activity';
import { useTranslation } from '@/i18n';

const SUSPEND_DAYS = 7;
const PAGE_SIZE = 5;

type AdminTab = 'users' | 'activities';

const ROLE_OPTIONS: UserRole[] = ['participant', 'partner', 'admin'];

function roleLabel(role: UserRole, t: (key: string) => string): string {
  return t(`admin.role.${role}`);
}

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  participant: { bg: '#1c1a1d', text: '#c9c5bf', border: 'rgba(255,255,255,0.12)' },
  partner: { bg: 'rgba(232,130,63,0.15)', text: '#e8823f', border: 'rgba(232,130,63,0.5)' },
  admin: { bg: '#e8823f', text: '#1a1005', border: '#e8823f' },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.trim().toLowerCase());
}

export default function AdminScreen() {
  const { profile, profileLoading } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'partner' | 'other'>('all');
  const [usersShown, setUsersShown] = useState(PAGE_SIZE);
  const [activitiesShown, setActivitiesShown] = useState(PAGE_SIZE);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [roleEditFor, setRoleEditFor] = useState<string | null>(null);
  const [confirmUserDeleteId, setConfirmUserDeleteId] = useState<string | null>(null);
  const [confirmActivityDeleteId, setConfirmActivityDeleteId] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    if (profile?.role !== 'admin') {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [nextUsers, nextActivities] = await Promise.all([
        listAdminUsers(),
        listAdminActivities(),
      ]);

      setUsers(nextUsers);
      setActivities(nextActivities);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error.loadDashboard'));
    } finally {
      setLoading(false);
    }
  }, [profile?.role, t]);

  useFocusEffect(
    useCallback(() => {
      void loadAdminData();
    }, [loadAdminData])
  );

  const userNameById = useMemo(
    () => new Map(users.map((user) => [user.id, user.name])),
    [users]
  );

  const userRoleById = useMemo(
    () => new Map(users.map((user) => [user.id, user.role])),
    [users]
  );

  const visibleUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') {
      list = list.filter((user) => user.role === roleFilter);
    }
    if (search.trim()) {
      list = list.filter((user) =>
        [user.name, user.email ?? '', roleLabel(user.role, t), user.status, user.id].some((value) =>
          matchesSearch(value, search)
        )
      );
    }
    return list;
  }, [search, roleFilter, users, t]);

  const visibleActivities = useMemo(() => {
    let list = activities;
    if (creatorFilter !== 'all') {
      list = list.filter((activity) => {
        const isPartner = userRoleById.get(activity.createdBy) === 'partner';
        return creatorFilter === 'partner' ? isPartner : !isPartner;
      });
    }
    if (search.trim()) {
      list = list.filter((activity) =>
        [
          activity.title,
          activity.description,
          activity.status,
          activity.sportId,
          activity.location.name,
          userNameById.get(activity.createdBy) ?? activity.createdBy,
        ].some((value) => matchesSearch(value, search))
      );
    }
    return list;
  }, [activities, search, creatorFilter, userNameById, userRoleById]);

  function switchTab(next: AdminTab) {
    setTab(next);
    setSearch('');
    setOpenMenuFor(null);
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    setBusyKey(`role:${userId}`);
    setError(null);
    try {
      const updated = await updateUserRole(userId, role);
      setUsers((current) => current.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      setOpenMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error.updateRole'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBan(userId: string) {
    setBusyKey(`ban:${userId}`);
    setError(null);
    try {
      const updated = await banUser(userId);
      setUsers((current) => current.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      setOpenMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error.banUser'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSuspend(userId: string) {
    setBusyKey(`suspend:${userId}`);
    setError(null);
    try {
      const updated = await suspendUser(userId, SUSPEND_DAYS);
      setUsers((current) => current.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      setOpenMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error.suspendUser'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReactivate(userId: string) {
    setBusyKey(`reactivate:${userId}`);
    setError(null);
    try {
      const updated = await reactivateUser(userId);
      setUsers((current) => current.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
      setOpenMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error.reactivateUser'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (confirmUserDeleteId !== userId) {
      setConfirmUserDeleteId(userId);
      return;
    }

    setBusyKey(`delete-user:${userId}`);
    setError(null);
    try {
      await deleteUser(userId);
      setUsers((current) => current.map((u) => (u.id === userId ? { ...u, status: 'deleted' } : u)));
      setConfirmUserDeleteId(null);
      setOpenMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error.deleteUser'));
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (confirmActivityDeleteId !== activityId) {
      setConfirmActivityDeleteId(activityId);
      return;
    }

    setBusyKey(`delete-activity:${activityId}`);
    setError(null);
    try {
      await deleteActivityAsAdmin(activityId);
      setActivities((current) => current.filter((a) => a.id !== activityId));
      setConfirmActivityDeleteId(null);
      setOpenMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.error.deleteActivity'));
    } finally {
      setBusyKey(null);
    }
  }

  if (profileLoading || loading) {
    return (
      <View style={styles.centered}>
        <ThemedText style={styles.subtleText}>{t('admin.loadingDashboard')}</ThemedText>
      </View>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <View style={styles.centered}>
        <Ionicons name="shield-outline" size={40} color="#6b6862" />
        <ThemedText style={styles.emptyTitle}>{t('admin.restrictedTitle')}</ThemedText>
        <ThemedText style={styles.subtleText}>{t('admin.restrictedBody')}</ThemedText>
      </View>
    );
  }

  const shownUsers = visibleUsers.slice(0, usersShown);
  const shownActivities = visibleActivities.slice(0, activitiesShown);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={styles.eyebrow}>{t('admin.eyebrow')}</ThemedText>
            <ThemedText style={styles.title}>{t('admin.title')}</ThemedText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            onPress={() => void loadAdminData()}>
            <Ionicons name="refresh-outline" size={16} color="#f4f2ef" />
            <ThemedText style={styles.refreshButtonText}>{t('admin.refresh')}</ThemedText>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatTile icon="people-outline" value={users.length} label={t('admin.usersLabel')} />
          <StatTile icon="calendar-outline" value={activities.length} label={t('admin.activitiesLabel')} />
          <StatTile
            icon="ban-outline"
            value={users.filter((u) => u.status === 'banned').length}
            label={t('admin.statBanned')}
          />
        </View>

        {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

        <View style={styles.toolbarRow}>
          <View style={styles.tabsPill}>
            <Pressable
              style={[styles.tabBtn, tab === 'users' && styles.tabBtnActive]}
              onPress={() => switchTab('users')}>
              <ThemedText style={[styles.tabBtnText, tab === 'users' && styles.tabBtnTextActive]}>
                {t('admin.usersLabel')}
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, tab === 'activities' && styles.tabBtnActive]}
              onPress={() => switchTab('activities')}>
              <ThemedText style={[styles.tabBtnText, tab === 'activities' && styles.tabBtnTextActive]}>
                {t('admin.activitiesLabel')}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color="#8f8b85" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={tab === 'users' ? t('admin.searchUsersPlaceholder') : t('admin.searchActivitiesPlaceholder')}
              placeholderTextColor="#6b6862"
            />
          </View>
        </View>

        {tab === 'users' && (
          <View style={styles.filterRow}>
            <ThemedText style={styles.filterLabel}>{t('admin.roleLabel')}</ThemedText>
            {(['all', 'admin', 'partner', 'participant'] as const).map((option) => {
              const isActive = roleFilter === option;
              const label = option === 'all' ? t('admin.all') : roleLabel(option, t);
              return (
                <Pressable
                  key={option}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setRoleFilter(option)}>
                  <ThemedText style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {tab === 'activities' && (
          <View style={styles.filterRow}>
            <ThemedText style={styles.filterLabel}>{t('admin.creatorLabel')}</ThemedText>
            {(['all', 'partner', 'other'] as const).map((option) => {
              const isActive = creatorFilter === option;
              const label = option === 'all' ? t('admin.all') : option === 'partner' ? t('admin.creatorCompanies') : t('admin.usersLabel');
              return (
                <Pressable
                  key={option}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setCreatorFilter(option)}>
                  <ThemedText style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        {tab === 'users' ? (
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <ThemedText style={[styles.tableHeaderText, styles.colUser]}>{t('admin.colUser')}</ThemedText>
              <ThemedText style={[styles.tableHeaderText, styles.colRole]}>{t('admin.colRole')}</ThemedText>
              <ThemedText style={[styles.tableHeaderText, styles.colStatus]}>{t('admin.colStatus')}</ThemedText>
              <ThemedText style={[styles.tableHeaderText, styles.colActions]}>{t('admin.colActions')}</ThemedText>
            </View>

            {shownUsers.map((user) => {
              const isCurrentAdmin = user.id === profile.id;
              const isBusy =
                busyKey === `role:${user.id}` ||
                busyKey === `ban:${user.id}` ||
                busyKey === `suspend:${user.id}` ||
                busyKey === `reactivate:${user.id}` ||
                busyKey === `delete-user:${user.id}`;
              const isBanned = user.status === 'banned';
              const isSuspended = isBanned && !!user.bannedUntil;
              // Um admin não pode mudar o role de outro admin (nem do próprio).
              const canEditRole = user.role !== 'admin';
              const actionsMenuOpen = openMenuFor === `actions:${user.id}`;
              const roleEditOpen = actionsMenuOpen && roleEditFor === user.id;
              const roleColor = ROLE_COLORS[user.role] ?? ROLE_COLORS.participant;

              return (
                <View key={user.id} style={styles.tableRowWrap}>
                  <View style={styles.tableRow}>
                    <View style={[styles.colUser, styles.userCell]}>
                      <AvatarCircle name={user.name} avatarUrl={user.avatarUrl} size={36} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <ThemedText style={styles.userName} numberOfLines={1}>{user.name}</ThemedText>
                        <ThemedText style={styles.userEmail} numberOfLines={1}>{user.email ?? user.id}</ThemedText>
                      </View>
                    </View>

                    <View style={styles.colRole}>
                      <View style={[styles.roleBadge, { backgroundColor: roleColor.bg, borderColor: roleColor.border }]}>
                        <ThemedText style={[styles.roleBadgeText, { color: roleColor.text }]}>
                          {roleLabel(user.role, t)}
                        </ThemedText>
                        {isCurrentAdmin && (
                          <View style={styles.youTag}>
                            <ThemedText style={styles.youTagText}>{t('admin.youTag')}</ThemedText>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.colStatus}>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: isSuspended ? '#eab308' : isBanned ? '#eb8f84' : '#9ccd6b' },
                          ]}
                        />
                        <ThemedText
                          style={[
                            styles.statusText,
                            { color: isSuspended ? '#eab308' : isBanned ? '#eb8f84' : '#9ccd6b' },
                          ]}>
                          {isSuspended ? t('admin.statusSuspended') : isBanned ? t('admin.statusBanned') : t('admin.statusActive')}
                        </ThemedText>
                      </View>
                      {isSuspended && user.bannedUntil && (
                        <ThemedText style={styles.suspendedUntil}>
                          {t('admin.suspendedUntil', { date: formatDate(user.bannedUntil) })}
                        </ThemedText>
                      )}
                    </View>

                    <View style={[styles.colActions, styles.actionsCell]}>
                      <Pressable
                        style={({ pressed }) => [styles.editRoleBtn, pressed && styles.pressed]}
                        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}>
                        <ThemedText style={styles.editRoleBtnText}>{t('admin.view')}</ThemedText>
                      </Pressable>

                      <Pressable
                        disabled={isBusy}
                        style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed, isBusy && styles.disabled]}
                        onPress={() => {
                          const next = actionsMenuOpen ? null : `actions:${user.id}`;
                          setOpenMenuFor(next);
                          if (!next) setRoleEditFor(null);
                        }}>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#c9c5bf" />
                      </Pressable>
                    </View>
                  </View>

                  {actionsMenuOpen && (
                    <View style={styles.expandPanel}>
                      <View style={styles.actionsRow}>
                        <ActionButton
                          label={t('admin.editRole')}
                          tone="neutral"
                          disabled={isBusy || !canEditRole}
                          onPress={() => setRoleEditFor(roleEditOpen ? null : user.id)}
                        />
                        {!isBanned ? (
                          <>
                            <ActionButton
                              label={t('admin.suspendDays', { days: SUSPEND_DAYS })}
                              tone="warning"
                              disabled={isBusy || isCurrentAdmin}
                              onPress={() => void handleSuspend(user.id)}
                            />
                            <ActionButton
                              label={t('admin.ban')}
                              tone="danger"
                              disabled={isBusy || isCurrentAdmin}
                              onPress={() => void handleBan(user.id)}
                            />
                          </>
                        ) : (
                          <ActionButton
                            label={t('admin.reactivate')}
                            tone="success"
                            disabled={isBusy}
                            onPress={() => void handleReactivate(user.id)}
                          />
                        )}
                        <ActionButton
                          label={confirmUserDeleteId === user.id ? t('admin.confirmDelete') : t('admin.delete')}
                          tone="danger"
                          disabled={isBusy || isCurrentAdmin}
                          onPress={() => void handleDeleteUser(user.id)}
                        />
                      </View>

                      {roleEditOpen && (
                        <View style={styles.chipRow}>
                          {ROLE_OPTIONS.map((role) => {
                            const isActive = user.role === role;
                            return (
                              <Pressable
                                key={role}
                                disabled={isBusy}
                                style={({ pressed }) => [
                                  styles.roleChip,
                                  isActive && styles.roleChipActive,
                                  pressed && !isBusy && styles.pressed,
                                ]}
                                onPress={() => void handleRoleChange(user.id, role)}>
                                <ThemedText style={[styles.roleChipText, isActive && styles.roleChipTextActive]}>
                                  {roleLabel(role, t)}
                                </ThemedText>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}

                      {isCurrentAdmin && (
                        <ThemedText style={styles.helperText}>
                          {t('admin.selfActionHelp')}
                        </ThemedText>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {visibleUsers.length === 0 && (
              <ThemedText style={styles.subtleText}>{t('admin.noUsersFound')}</ThemedText>
            )}

            {visibleUsers.length > 0 && (
              <View style={styles.paginationRow}>
                <ThemedText style={styles.paginationText}>
                  {t('admin.showingCount', { shown: shownUsers.length, total: visibleUsers.length })}
                </ThemedText>
                {usersShown < visibleUsers.length && (
                  <Pressable onPress={() => setUsersShown(visibleUsers.length)}>
                    <ThemedText style={styles.paginationLink}>{t('admin.viewAll')}</ThemedText>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.tableCard}>
            <View style={styles.tableHeaderRow}>
              <ThemedText style={[styles.tableHeaderText, styles.colUser]}>{t('admin.colActivity')}</ThemedText>
              <ThemedText style={[styles.tableHeaderText, styles.colRole]}>{t('admin.colOrganizer')}</ThemedText>
              <ThemedText style={[styles.tableHeaderText, styles.colStatus]}>{t('admin.colStatus')}</ThemedText>
              <ThemedText style={[styles.tableHeaderText, styles.colActions]}>{t('admin.colActions')}</ThemedText>
            </View>

            {shownActivities.map((activity) => {
              const isBusy = busyKey === `delete-activity:${activity.id}`;
              const actionsMenuOpen = openMenuFor === `activity:${activity.id}`;
              const isCompanyOrganizer = userRoleById.get(activity.createdBy) === 'partner';
              const organizerColor = isCompanyOrganizer ? ROLE_COLORS.partner : ROLE_COLORS.participant;

              return (
                <View key={activity.id} style={styles.tableRowWrap}>
                  <View style={styles.tableRow}>
                    <View style={[styles.colUser, { minWidth: 0 }]}>
                      <ThemedText style={styles.userName} numberOfLines={1}>{activity.title}</ThemedText>
                      <ThemedText style={styles.userEmail} numberOfLines={1}>
                        {activity.location.name} · {formatDate(activity.date)}
                      </ThemedText>
                    </View>

                    <View style={styles.colRole}>
                      <View style={[styles.roleBadge, { backgroundColor: organizerColor.bg, borderColor: organizerColor.border }]}>
                        <ThemedText style={[styles.roleBadgeText, { color: organizerColor.text }]} numberOfLines={1}>
                          {userNameById.get(activity.createdBy) ?? activity.createdBy}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.colStatus}>
                      <ThemedText style={styles.plainCellText}>{activity.status}</ThemedText>
                    </View>

                    <View style={[styles.colActions, styles.actionsCell]}>
                      <Pressable
                        style={({ pressed }) => [styles.editRoleBtn, pressed && styles.pressed]}
                        onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}>
                        <ThemedText style={styles.editRoleBtnText}>{t('admin.view')}</ThemedText>
                      </Pressable>
                      <Pressable
                        disabled={isBusy}
                        style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed, isBusy && styles.disabled]}
                        onPress={() => setOpenMenuFor(actionsMenuOpen ? null : `activity:${activity.id}`)}>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#c9c5bf" />
                      </Pressable>
                    </View>
                  </View>

                  {actionsMenuOpen && (
                    <View style={styles.expandPanel}>
                      <View style={styles.actionsRow}>
                        <ActionButton
                          label={t('admin.edit')}
                          tone="success"
                          onPress={() => router.push({ pathname: '/edit-activity/[id]', params: { id: activity.id } })}
                        />
                        <ActionButton
                          label={confirmActivityDeleteId === activity.id ? t('admin.confirmDelete') : t('admin.delete')}
                          tone="danger"
                          disabled={isBusy}
                          onPress={() => void handleDeleteActivity(activity.id)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {visibleActivities.length === 0 && (
              <ThemedText style={styles.subtleText}>{t('admin.noActivitiesFound')}</ThemedText>
            )}

            {visibleActivities.length > 0 && (
              <View style={styles.paginationRow}>
                <ThemedText style={styles.paginationText}>
                  {t('admin.showingCount', { shown: shownActivities.length, total: visibleActivities.length })}
                </ThemedText>
                {activitiesShown < visibleActivities.length && (
                  <Pressable onPress={() => setActivitiesShown(visibleActivities.length)}>
                    <ThemedText style={styles.paginationLink}>{t('admin.viewAll')}</ThemedText>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatTile({ icon, value, label }: { icon: keyof typeof Ionicons.glyphMap; value: number; label: string }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIconBox}>
        <Ionicons name={icon} size={18} color="#e8823f" />
      </View>
      <View>
        <ThemedText style={styles.statValue}>{value}</ThemedText>
        <ThemedText style={styles.statLabel}>{label}</ThemedText>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}) {
  const tones = {
    neutral: { backgroundColor: '#111012', borderColor: 'rgba(255,255,255,0.10)', textColor: '#f4f2ef' },
    success: { backgroundColor: 'rgba(156,205,107,0.12)', borderColor: '#9ccd6b', textColor: '#9ccd6b' },
    warning: { backgroundColor: 'rgba(232,130,63,0.12)', borderColor: '#e8823f', textColor: '#e8823f' },
    danger: { backgroundColor: 'rgba(235,143,132,0.12)', borderColor: '#eb8f84', textColor: '#eb8f84' },
  }[tone];

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: tones.backgroundColor,
          borderColor: tones.borderColor,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}
      onPress={onPress}>
      <ThemedText style={[styles.actionButtonText, { color: tones.textColor }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0b' },
  content: {
    alignItems: 'center',
    paddingTop: TopTabInset + Spacing.three,
    paddingBottom: Platform.OS === 'web' ? Spacing.five : BottomTabInset + Spacing.four,
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth + 240,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0b',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyTitle: { color: '#f4f2ef', fontSize: 18, fontWeight: '700' },
  subtleText: { color: '#8f8b85', textAlign: 'center' },
  errorText: { color: '#eb8f84', textAlign: 'center' },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  eyebrow: {
    color: '#e8823f',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: '700',
  },
  title: { color: '#f4f2ef', fontSize: 26, fontWeight: '700', marginTop: 4, maxWidth: 460 },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 64,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  refreshButtonText: { color: '#f4f2ef', fontWeight: '700', fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
  statTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: '#111012',
    borderRadius: 16,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(232,130,63,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { color: '#f4f2ef', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#8f8b85', fontSize: 12, marginTop: 2 },

  toolbarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tabsPill: {
    flexDirection: 'row',
    backgroundColor: '#111012',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 4,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: { backgroundColor: '#e8823f' },
  tabBtnText: { color: '#c9c5bf', fontWeight: '700', fontSize: 13, userSelect: 'none' as any },
  tabBtnTextActive: { color: '#1a1005' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
    minWidth: 220,
    maxWidth: 340,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, color: '#f4f2ef', fontSize: 14 },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  filterLabel: { color: '#6b6862', fontSize: 12, fontWeight: '700', marginRight: 2 },
  filterChip: {
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: { backgroundColor: '#e8823f', borderColor: '#e8823f' },
  filterChipText: { color: '#c9c5bf', fontSize: 12, fontWeight: '700', userSelect: 'none' as any },
  filterChipTextActive: { color: '#1a1005' },

  tableCard: {
    backgroundColor: '#0a0a0b',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#111012',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: Spacing.two,
  },
  tableHeaderText: {
    color: '#6b6862',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  colUser: { flex: 2.4, minWidth: 140 },
  colRole: { flex: 1.2, minWidth: 100 },
  colStatus: { flex: 1, minWidth: 90 },
  colActions: { flex: 1.6, minWidth: 140 },

  tableRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  userCell: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  userName: { color: '#f4f2ef', fontSize: 14, fontWeight: '700' },
  userEmail: { color: '#8f8b85', fontSize: 12, marginTop: 1 },
  plainCellText: { color: '#c9c5bf', fontSize: 13 },

  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },
  youTag: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  youTagText: { fontSize: 10, fontWeight: '700', color: '#f4f2ef' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },
  suspendedUntil: { color: '#6b6862', fontSize: 11, marginTop: 2 },

  actionsCell: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  editRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  editRoleBtnText: { color: '#f4f2ef', fontSize: 12, fontWeight: '700' },
  moreBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#111012',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },

  expandPanel: {
    backgroundColor: '#111012',
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: Spacing.two,
    gap: Spacing.two,
  },
  expandLabel: {
    color: '#8f8b85',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  roleChip: {
    backgroundColor: '#1c1a1d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleChipActive: { backgroundColor: '#e8823f', borderColor: '#e8823f' },
  roleChipText: { color: '#c9c5bf', fontSize: 12, fontWeight: '700', userSelect: 'none' as any },
  roleChipTextActive: { color: '#1a1005' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionButtonText: { fontSize: 12, fontWeight: '700', userSelect: 'none' as any },
  helperText: { color: '#6b6862', fontSize: 11 },

  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  paginationText: { color: '#6b6862', fontSize: 12 },
  paginationLink: { color: '#e8823f', fontSize: 12, fontWeight: '700', userSelect: 'none' as any },
  pressed: { opacity: 0.75 },
});
