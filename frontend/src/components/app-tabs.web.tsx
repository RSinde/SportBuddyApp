import { Ionicons } from '@expo/vector-icons';
import {
  TabList,
  TabListProps,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
  Tabs,
} from 'expo-router/ui';
import { Link } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useChatBadge } from '@/contexts/chat-badge-context';
import { useTranslation } from '@/i18n';

export default function AppTabs() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { unreadCount } = useChatBadge();
  const { profile } = useAuth();
  const isPartner = profile?.role === 'partner';
  const showAdminTab = profile?.role === 'admin';
  const { t } = useTranslation();

  const hidePartner = !isPartner || isDesktop;
  const hideUser = isPartner || isDesktop;

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />

      <TabList asChild>
        <CustomTabList isDesktop={isDesktop}>
          {/* Rotas de parceiro — sempre registadas para o router as reconhecer */}
          <TabTrigger name="dashboard" href={'/dashboard' as never} asChild>
            <TabButton icon="grid-outline" isDesktop={isDesktop} hidden={hidePartner}>Dashboard</TabButton>
          </TabTrigger>
          <TabTrigger name="my-events" href={'/my-events' as never} asChild>
            <TabButton icon="calendar-outline" isDesktop={isDesktop} hidden={hidePartner}>Eventos</TabButton>
          </TabTrigger>

          {/* Rotas normais */}
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="home-outline" isDesktop={isDesktop} hidden={hideUser}>{t('nav.home')}</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon="search-outline" isDesktop={isDesktop} hidden={hideUser}>{t('nav.discover')}</TabButton>
          </TabTrigger>
          <Link href="/create-activity" asChild>
            <TabButton icon="add-outline" isDesktop={isDesktop} hidden={isPartner || isDesktop}>{t('nav.create')}</TabButton>
          </Link>
          <TabTrigger name="chats" href="/chats" asChild>
            <TabButton icon="chatbubbles-outline" badge={unreadCount} isDesktop={isDesktop} hidden={isDesktop}>{t('nav.chats')}</TabButton>
          </TabTrigger>
          <TabTrigger name="map" href="/map" asChild>
            <TabButton icon="map-outline" isDesktop={isDesktop} hidden={hideUser}>{t('nav.map')}</TabButton>
          </TabTrigger>
          <Link href="/profile" asChild>
            <TabButton icon="person-outline" isDesktop={isDesktop} hidden={isDesktop}>{t('nav.profile')}</TabButton>
          </Link>

          {showAdminTab && (
            <TabTrigger name="admin" href={'/admin' as never} asChild>
              <TabButton icon="shield-checkmark-outline" isDesktop={isDesktop}>{t('nav.admin')}</TabButton>
            </TabTrigger>
          )}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon?: any; badge?: number; isDesktop?: boolean; hidden?: boolean };

export function TabButton({ children, isFocused, icon, badge, isDesktop, hidden, ...props }: TabButtonProps) {
  return (
    <Pressable {...props} style={hidden ? { display: 'none' } : ({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButtonView,
          !isDesktop && styles.tabButtonViewMobile,
          isFocused && { backgroundColor: 'rgba(207, 132, 68, 0.15)' }
        ]}>

        <View style={[styles.iconWrap, !isDesktop && { marginRight: 0 }]}>
          {icon && (
            <Ionicons
              name={icon}
              size={20}
              color={isFocused ? '#e8823f' : '#8f8b85'}
              style={{ marginRight: isDesktop ? 12 : 0 }}
            />
          )}
          {!!badge && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
        </View>

        {isDesktop && (
          <ThemedText
            type="smallBold"
            style={{ color: isFocused ? '#e8823f' : '#c9c5bf', fontSize: 16 }}>
            {children}
          </ThemedText>
        )}

        {isDesktop && isFocused && <View style={styles.activeDot} />}
      </View>
    </Pressable>
  );
}

type CustomTabListProps = TabListProps & { isDesktop: boolean };

export function CustomTabList({ isDesktop, ...props }: CustomTabListProps) {
  const { t } = useTranslation();

  return (
    <View
      {...props}
      style={[
        styles.tabListContainer,
        isDesktop ? { display: 'none' } : styles.bottomBarContainer
      ]}>

      {isDesktop && (
        <Link href="/" style={styles.brandLink}>
          <View style={styles.brandContainer}>
            <Image
              source={require('../../assets/images/sportbuddyIcon.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <View>
              <ThemedText type="smallBold" style={styles.brandText}>SportBuddy</ThemedText>
              <ThemedText style={styles.brandSlogan}>{t('nav.brandSlogan')}</ThemedText>
            </View>
          </View>
        </Link>
      )}

      <View style={[styles.tabsWrapper, { flexDirection: isDesktop ? 'column' : 'row' }]}>
        {props.children}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    backgroundColor: '#0a0a0b',
  },
  sidebarContainer: {
    left: 0,
    top: 0,
    bottom: 0,
    width: 250,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
    borderRightWidth: 1,
    borderRightColor: '#111012',
  },
  bottomBarContainer: {
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#111012',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  brandLink: {
    textDecorationLine: 'none',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
    paddingHorizontal: Spacing.two,
  },
  logoIcon: {
    width: 40,
    height: 40,
  },
  brandText: {
    color: '#f4f2ef',
    fontSize: 18,
  },
  brandSlogan: {
    color: '#e8823f',
    fontSize: 12,
  },
  tabsWrapper: {
    gap: Spacing.two,
    justifyContent: 'space-around',
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    position: 'relative',
    marginRight: 12,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#f4f2ef',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  tabButtonViewMobile: {
    paddingHorizontal: 10,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e8823f',
    marginLeft: 'auto',
  },
});