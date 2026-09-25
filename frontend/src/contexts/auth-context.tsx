import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';

import { auth } from '@/config/firebase';
import { api, ApiError } from '@/services/api';
import { getMyProfile } from '@/services/users';
import { UserProfile } from '@/types/user';

type AuthContextValue = {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  initializing: boolean;
  profileLoading: boolean;
  signingUp: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signUpOrganization: (
    orgName: string,
    nif: string,
    responsibleName: string,
    email: string,
    password: string
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  patchProfile: (patch: Partial<UserProfile>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_ERROR_KEYS: Record<string, string> = {
  'auth/email-already-in-use': 'auth.error.emailInUse',
  'auth/invalid-email': 'auth.error.invalidEmail',
  'auth/weak-password': 'auth.error.weakPassword',
  'auth/invalid-credential': 'auth.error.invalidCredentials',
  'auth/wrong-password': 'auth.error.invalidCredentials',
  'auth/user-not-found': 'auth.error.invalidCredentials',
};

// Message is a translation key (see i18n/dictionaries/auth.ts) so callers can
// resolve it through useTranslation(); falls back to a raw Error otherwise.
function translateAuthError(err: unknown): Error {
  const code = (err as { code?: string } | null)?.code;
  const key = code ? AUTH_ERROR_KEYS[code] : undefined;
  if (key) return new Error(key);
  return err instanceof Error ? err : new Error('auth.register.genericError');
}

async function createProfileFromFirebaseUser(firebaseUser: FirebaseUser): Promise<void> {
  const baseName = firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User';
  const email = firebaseUser.email ?? '';

  try {
    await api.post('/api/users/profile', { name: baseName, email });
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) return;
    if (err instanceof Error && err.message.includes('nome')) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      await api.post('/api/users/profile', { name: `${baseName} ${suffix}`, email });
      return;
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const signingUpRef = useRef(false);

  const loadProfile = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    try {
      const nextProfile = await getMyProfile();
      setProfile(nextProfile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && !signingUpRef.current) {
        try {
          await createProfileFromFirebaseUser(firebaseUser);
          setProfile(await getMyProfile());
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
      if (!signingUpRef.current) {
        void loadProfile(firebaseUser);
      }
    });
  }, [loadProfile]);

  async function signIn(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw translateAuthError(err);
    }
  }

  async function signUp(name: string, email: string, password: string) {
    setSigningUp(true);
    signingUpRef.current = true;
    try {
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        throw translateAuthError(err);
      }

      await updateProfile(credential.user, { displayName: name });

      try {
        await api.post('/api/users/profile', { name, email });
        await loadProfile(credential.user);
      } catch (err) {
        await credential.user.delete();
        throw err;
      }
    } finally {
      signingUpRef.current = false;
      setSigningUp(false);
    }
  }

  async function signUpOrganization(
    orgName: string,
    nif: string,
    responsibleName: string,
    email: string,
    password: string
  ) {
    setSigningUp(true);
    signingUpRef.current = true;
    try {
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        throw translateAuthError(err);
      }

      await updateProfile(credential.user, { displayName: orgName });

      try {
        await api.post('/api/users/profile', {
          name: orgName,
          email,
          accountType: 'organization',
          nif,
          responsibleName,
        });
        await loadProfile(credential.user);
      } catch (err) {
        await credential.user.delete();
        throw err;
      }
    } finally {
      signingUpRef.current = false;
      setSigningUp(false);
    }
  }

  async function completeGoogleSignIn(firebaseUser: FirebaseUser) {
    try {
      await getMyProfile();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 404) throw err;
      await createProfileFromFirebaseUser(firebaseUser);
    }

    await loadProfile(firebaseUser);
  }

  async function signInWithGoogle() {
    setSigningUp(true);
    signingUpRef.current = true;
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      await completeGoogleSignIn(credential.user);
    } finally {
      signingUpRef.current = false;
      setSigningUp(false);
    }
  }

  // Fluxo nativo (Android/iOS): o ecrã de login obtém o id_token via
  // expo-auth-session e troca-o aqui por uma sessão Firebase — o
  // signInWithPopup usado no web não existe fora do browser.
  async function signInWithGoogleIdToken(idToken: string) {
    setSigningUp(true);
    signingUpRef.current = true;
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      await completeGoogleSignIn(result.user);
    } finally {
      signingUpRef.current = false;
      setSigningUp(false);
    }
  }

  async function signOut() {
    setProfile(null);
    await firebaseSignOut(auth);
  }

  async function refreshProfile() {
    await loadProfile(auth.currentUser);
  }

  function patchProfile(patch: Partial<UserProfile>) {
    setProfile(prev => prev ? { ...prev, ...patch } : prev);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        initializing,
        profileLoading,
        signingUp,
        signIn,
        signUp,
        signUpOrganization,
        signInWithGoogle,
        signInWithGoogleIdToken,
        signOut,
        refreshProfile,
        patchProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
