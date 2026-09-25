import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AvatarCircle } from './avatar-circle';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useChatBadge } from '@/contexts/chat-badge-context';
import { useTranslation } from '@/i18n';

const USER_NAV_ITEMS = [
  { href: '/',                 icon: 'home-outline',        labelKey: 'nav.home'     },
  { href: '/explore',          icon: 'search-outline',      labelKey: 'nav.discover' },
  { href: '/create-activity',  icon: 'add-outline',         labelKey: 'nav.create'   },
  { href: '/chats',            icon: 'chatbubbles-outline', labelKey: 'nav.chats'    },
  { href: '/map',              icon: 'map-outline',         labelKey: 'nav.map'      },
] as const;

const PARTNER_NAV_ITEMS = [
  { href: '/dashboard',        icon: 'grid-outline',           label: 'Dashboard'       },
  { href: '/my-events',        icon: 'calendar-outline',       label: 'Os meus eventos' },
  { href: '/create-activity',  icon: 'add-circle-outline',     label: 'Criar evento'    },
  { href: '/chats',            icon: 'chatbubbles-outline',    label: 'Mensagens'       },
] as const;

export function WebSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { unreadCount } = useChatBadge();
  const { t } = useTranslation();

  const router = useRouter();
  const isPartner = profile?.role === 'partner';
  const navItems: { href: string; icon: string; label?: string; labelKey?: string }[] = isPartner ? [...PARTNER_NAV_ITEMS] : [...USER_NAV_ITEMS];

  return (
    <View style={styles.sidebar}>
      <Link href={isPartner ? '/dashboard' : '/'} style={styles.brandLink}>
        <View style={styles.brand}>
          <Image
            source={require('../../assets/images/sportbuddyIcon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View>
            <ThemedText type="smallBold" style={styles.brandName}>SportBuddy</ThemedText>
            <ThemedText style={styles.brandSlogan}>{t('nav.brandSlogan')}</ThemedText>
          </View>
        </View>
      </Link>

      <View style={styles.nav}>
        {navItems.map(item => {
          const active = item.href === '/' ? pathname === '/'
            : item.href === '/dashboard' ? pathname === '/dashboard' || pathname === '/'
            : pathname.startsWith(item.href);
          const badge = item.href === '/chats' ? unreadCount : 0;
          return (
            <Link key={item.href} href={item.href as any} asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.item, active && styles.itemActive]}>
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={item.icon as any}
                      size={20}
                      color={active ? '#e8823f' : '#8f8b85'}
                      style={styles.icon}
                    />
                    {badge > 0 && (
                      <View style={styles.badgeDot}>
                        <ThemedText style={styles.badgeText}>{badge > 99 ? '99+' : badge}</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText type="smallBold" style={[styles.label, active && styles.labelActive]}>
                    {item.label ?? t(item.labelKey ?? '')}
                  </ThemedText>
                  {active && <View style={styles.dot} />}
                </View>
              </Pressable>
            </Link>
          );
        })}

        {profile?.role === 'admin' && (
          <Link href={'/admin' as any} asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.item, pathname.startsWith('/admin') && styles.itemActive]}>
                <View style={styles.iconWrap}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={pathname.startsWith('/admin') ? '#e8823f' : '#8f8b85'}
                    style={styles.icon}
                  />
                </View>
                <ThemedText type="smallBold" style={[styles.label, pathname.startsWith('/admin') && styles.labelActive]}>
                  {t('nav.admin')}
                </ThemedText>
                {pathname.startsWith('/admin') && <View style={styles.dot} />}
              </View>
            </Pressable>
          </Link>
        )}
      </View>

      {/* Perfil no rodapé: clicar vai para o perfil, o ícone à direita faz logout */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.footerProfile, (pathname.startsWith('/profile') || (isPartner && profile?.id && pathname.startsWith(`/user/${profile.id}`))) && styles.itemActive, pressed && styles.pressed]}
          onPress={() => router.push('/profile')}>
          <AvatarCircle name={profile?.name ?? '?'} avatarUrl={profile?.avatarUrl} size={38} />
          <View style={styles.footerText}>
            <ThemedText type="smallBold" style={styles.footerName} numberOfLines={1}>
              {(profile?.name ?? '').length > 14 ? (profile!.name.slice(0, 14) + '…') : (profile?.name ?? '')}
            </ThemedText>
            <ThemedText style={styles.footerHint}>{t('nav.viewProfile')}</ThemedText>
          </View>
        </Pressable>
        <Pressable
          onPress={signOut}
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
          hitSlop={4}>
          <Ionicons name="log-out-outline" size={20} color="#8f8b85" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: '#0a0a0b',
    borderRightWidth: 1,
    borderRightColor: '#111012',
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  brandLink: { textDecorationLine: 'none' },
  brand: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 40, gap: 12,
    paddingHorizontal: Spacing.two,
  },
  logo: { width: 40, height: 40 },
  brandName: { color: '#f4f2ef', fontSize: 18 },
  brandSlogan: { color: '#e8823f', fontSize: 12 },

  nav: { gap: Spacing.two, flex: 1 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12,
  },
  itemActive: { backgroundColor: 'rgba(207,132,68,0.15)' },
  iconWrap: { position: 'relative' },
  icon: { marginRight: 12 },
  badgeDot: {
    position: 'absolute', top: -6, right: -6,
    minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#f4f2ef', fontSize: 10, fontFamily: 'HankenGrotesk_700Bold', lineHeight: 12 },
  label: { color: '#c9c5bf', fontSize: 16 },
  labelActive: { color: '#e8823f' },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#e8823f',
    marginLeft: 'auto' as any,
  },
  pressed: { opacity: 0.7 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: Spacing.three,
    marginTop: Spacing.three,
  },
  footerProfile: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 12,
    marginRight: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  footerText: { flex: 1, minWidth: 0 },
  footerName: { color: '#f4f2ef', fontSize: 12 },
  footerHint: { color: '#8f8b85', fontSize: 12 },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141315',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
});
