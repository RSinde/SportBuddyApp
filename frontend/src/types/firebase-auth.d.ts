// `firebase/auth`'s root type declarations (`firebase/auth/dist/auth/index.d.ts`) point to the
// generic `@firebase/auth` "types" entry, which doesn't include the React Native specific APIs
// (those only exist in `@firebase/auth`'s "react-native" conditional export, which Metro/the
// bundler resolves correctly at runtime, but `tsc` does not pick up for typings).
//
// This augmentation re-adds `getReactNativePersistence` so `@/config/firebase.ts` type-checks.
//
// `export {}` makes this file a module, which makes the `declare module` below an
// *augmentation* (merging with the existing declarations) instead of replacing them entirely.
export {};

declare module 'firebase/auth' {
  import type { Persistence, ReactNativeAsyncStorage } from '@firebase/auth';

  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
