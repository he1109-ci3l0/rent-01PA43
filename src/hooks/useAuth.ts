import { useState, useEffect } from 'react';
import { User } from '@firebase/auth';
import * as authService from '@/services/firebase/auth';
import type { SignUpForm } from '@/services/firebase/auth';

export type UserRole = 'admin' | 'inquilino';

export interface AuthState {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (form: SignUpForm) => Promise<{ username: string }>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const role: UserRole | null = user
    ? user.email?.startsWith('bailleur') ? 'admin' : 'inquilino'
    : null;

  return {
    user, role, loading,
    signIn: authService.signIn,
    signOut: authService.signOut,
    signUp: authService.signUp,
  };
}
