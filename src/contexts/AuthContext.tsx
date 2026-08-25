import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { clearPersistedAuthSession, supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/auth';

const AUTH_REQUEST_TIMEOUT_MS = 12_000;
const AUTH_LOGIN_REQUEST_TIMEOUT_MS = 17_000;
const PROFILE_REQUEST_TIMEOUT_MS = 8_000;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  retrySession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function withTimeout<T>(
  request: PromiseLike<T>,
  timeoutMessage: string,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    request.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function fetchProfile(userId: string): Promise<Profile> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    PROFILE_REQUEST_TIMEOUT_MS,
  );

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, is_active, created_at, updated_at')
      .eq('id', userId)
      .abortSignal(controller.signal)
      .single();

    if (error) {
      if (controller.signal.aborted) {
        throw new Error('Tempo esgotado ao carregar seu perfil.');
      }
      throw new Error(error.message);
    }
    if (!data) throw new Error('Perfil não encontrado.');
    return data as Profile;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const profileRequestRef = useRef<{ userId: string; request: Promise<Profile> } | null>(null);

  const isAdmin = profile?.role === 'admin';

  const setAuthState = useCallback((nextSession: Session | null) => {
    const previousUserId = activeUserIdRef.current;
    const nextUserId = nextSession?.user.id ?? null;
    activeUserIdRef.current = nextUserId;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession || previousUserId !== nextUserId) {
      profileRequestRef.current = null;
      setProfile(null);
    }
  }, []);

  // Reuse the profile request when a sign-in event and the login form arrive
  // together, avoiding duplicated calls during a slow connection.
  const loadProfile = useCallback((userId: string | undefined): Promise<Profile | null> => {
    if (!userId) {
      setProfile(null);
      return Promise.resolve(null);
    }

    const pending = profileRequestRef.current;
    if (pending?.userId === userId) return pending.request;

    const request: Promise<Profile> = fetchProfile(userId)
      .then((nextProfile) => {
        if (activeUserIdRef.current === userId) setProfile(nextProfile);
        return nextProfile;
      })
      .finally(() => {
        if (profileRequestRef.current?.request === request) {
          profileRequestRef.current = null;
        }
      });

    profileRequestRef.current = { userId, request };
    return request;
  }, []);

  const clearLocalSession = useCallback(async (notifyServer = true) => {
    if (!notifyServer) {
      clearPersistedAuthSession();
      setAuthState(null);
      return;
    }

    try {
      await withTimeout(
        supabase.auth.signOut({ scope: 'local' }),
        'Tempo esgotado ao encerrar a sessão local.',
      );
    } catch (error) {
      console.error('[AuthContext] Failed to clear local session:', error);
    } finally {
      clearPersistedAuthSession();
      setAuthState(null);
    }
  }, [setAuthState]);

  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        'Tempo esgotado ao verificar sua sessão.',
      );
      if (error) throw new Error(error.message);

      setAuthState(data.session);
      if (data.session?.user) {
        // A sessão já foi validada pelo Auth. Perfil é dado complementar
        // (nome, papel e status) e uma falha temporária nele não pode apagar
        // uma sessão válida nem manter a tela de login em carregamento.
        void loadProfile(data.session.user.id).catch((profileError) => {
          console.warn('[AuthContext] Failed to load profile after session initialization:', profileError);
        });
      }
    } catch (error) {
      console.error('[AuthContext] Failed to initialize session:', error);
      await clearLocalSession(false);
      setAuthError('Não foi possível verificar sua sessão. Confira a conexão e tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [clearLocalSession, loadProfile, setAuthState]);

  useEffect(() => {
    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === 'INITIAL_SESSION') return;

        setAuthState(nextSession);
        if (nextSession?.user) {
          void loadProfile(nextSession.user.id).catch((error) => {
            // Não invalida o login: a sessão já foi confirmada pelo Supabase.
            // O próximo evento de token/sessão tenta o perfil de novo.
            console.warn('[AuthContext] Failed to refresh profile:', error);
          });
        } else {
          setAuthError(null);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initializeAuth, loadProfile, setAuthState]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      setAuthError(null);

      try {
        const { data, error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password }),
          'O login demorou mais que o esperado. Confira a conexão e tente novamente.',
          AUTH_LOGIN_REQUEST_TIMEOUT_MS,
        );
        if (error) return { error: error.message };
        if (!data.session) {
          return { error: 'Não foi possível iniciar sua sessão. Tente novamente.' };
        }

        setAuthState(data.session);
        // Não faça o sucesso do login depender de uma segunda requisição
        // REST. Em rede instável, credenciais válidas eram descartadas quando
        // apenas o perfil excedia o timeout.
        void loadProfile(data.session.user.id).catch((profileError) => {
          console.warn('[AuthContext] Failed to load profile after sign in:', profileError);
        });
        return { error: null };
      } catch (error) {
        console.error('[AuthContext] Failed to sign in:', error);
        const message = error instanceof Error && error.message.startsWith('O login demorou')
          ? error.message
          : 'Não foi possível concluir o login. Tente novamente.';
        // The credential request has already failed. Do not make the user wait
        // for a second network request just to discard a local stale session.
        await clearLocalSession(false);
        setAuthError(message);
        return { error: message };
      }
    },
    [clearLocalSession, loadProfile, setAuthState],
  );

  const signOut = useCallback(async () => {
    await clearLocalSession();
    setAuthError(null);
  }, [clearLocalSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        isAdmin,
        authError,
        signIn,
        signOut,
        retrySession: initializeAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
