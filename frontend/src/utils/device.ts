import { Platform } from 'react-native';

const MOBILE_USER_AGENT_REGEX = /Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i;

// Detects a real mobile browser via user agent, independent of viewport
// width, so resizing a desktop browser window doesn't trigger mobile-only UI.
export function isMobileWebBrowser(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return false;
  return MOBILE_USER_AGENT_REGEX.test(navigator.userAgent);
}
