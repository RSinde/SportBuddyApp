import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { Archivo_700Bold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { Platform, View, useWindowDimensions } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DownloadAppScreen } from '@/components/download-app-screen';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ChatBadgeProvider } from '@/contexts/chat-badge-context';
import { LanguageProvider } from '@/contexts/language-context';
import { PendingWaitlistProvider } from '@/contexts/pending-waitlist-context';
import { WebSidebar } from '@/components/web-sidebar';
import { useTranslation } from '@/i18n';
import { isMobileWebBrowser } from '@/utils/device';

// 1. Criamos o nosso tema personalizado "Dark Premium"
const SportBuddyTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#e8823f',
    background: '#0a0a0b',
    card: '#0c0c0d',
    text: '#f4f2ef',
    border: 'rgba(255,255,255,0.06)',
    notification: '#eb8f84',
  },
};

function RootNavigator() {
  const { user, initializing, signingUp } = useAuth();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (initializing) {
    return null;
  }

  const authedUser = signingUp ? null : user;

  return (
    <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
      {isDesktop && !!authedUser && <WebSidebar />}
      <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: '#0c0c0d' },
        headerTintColor: '#e8823f', // Cor da seta de "voltar atrás"
        headerTitleStyle: { color: '#f4f2ef', fontWeight: 'bold' },
        headerShadowVisible: false, // Remove a linha feia por baixo do header
      }}
    >
      <Stack.Protected guard={!!authedUser}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen
          name="create-activity"
          options={{ headerShown: true, title: t('layout.newActivity'), presentation: 'modal' }}
        />
        <Stack.Screen name="activity/[id]" options={{ headerShown: true, title: t('layout.activity') }} />
        <Stack.Screen
          name="edit-activity/[id]"
          options={{ headerShown: true, title: t('layout.editActivity'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: true, title: t('layout.editProfile'), presentation: 'modal' }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{ headerShown: true, title: t('layout.chat') }}
        />
        <Stack.Screen
          name="direct-chat/[id]"
          options={{ headerShown: true, title: t('layout.chat') }}
        />
        <Stack.Screen
          name="user/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: true, title: t('layout.notifications') }}
        />
        <Stack.Screen
          name="friends"
          options={{ headerShown: true, title: t('layout.friends') }}
        />
        <Stack.Screen
          name="following"
          options={{ headerShown: true, title: t('layout.following') }}
        />
        <Stack.Screen
          name="followers/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="badges"
          options={{ headerShown: true, title: t('layout.badges'), presentation: 'modal' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!authedUser}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
      </View>
      <LanguageSwitcher />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_700Bold,
    Archivo_900Black,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  // Baseado no user agent, não na largura da janela — redimensionar uma
  // janela de desktop não deve mostrar o ecrã de download da app.
  const isMobileWeb = isMobileWebBrowser();

  if (!fontsLoaded) return null;

  if (isMobileWeb) {
    return <DownloadAppScreen />;
  }

  return (
    <ThemeProvider value={SportBuddyTheme}>
      <AnimatedSplashOverlay />
      <LanguageProvider>
        <AuthProvider>
          <PendingWaitlistProvider>
            <ChatBadgeProvider>
              <RootNavigator />
            </ChatBadgeProvider>
          </PendingWaitlistProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}