import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Abgelaufener oder widerrufener Refresh-Token (z. B. anderes Gerät, Server-Reset) */
function isRefreshTokenInvalidError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : String(err ?? "");
  const s = msg.toLowerCase();
  return (
    s.includes("refresh_token_not_found") ||
    s.includes("invalid refresh token") ||
    s.includes("refresh token not found") ||
    s.includes("invalid_grant")
  );
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecoverySession: boolean;
  clearRecoverySession: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isRecoverySession: false,
  clearRecoverySession: () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  const clearRecoverySession = () => setIsRecoverySession(false);

  /* FUND-1: Mounted guard prevents state updates after unmount —
     fixes potential memory leak when getSession resolves after provider unmounts */
  const refreshToastShown = useRef(false);

  useEffect(() => {
    let mounted = true;

    const handleInvalidRefresh = () => {
      if (refreshToastShown.current) return;
      refreshToastShown.current = true;
      toast.error("Sitzung abgelaufen — bitte erneut anmelden.");
      void supabase.auth.signOut({ scope: "local" });
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (error && isRefreshTokenInvalidError(error)) {
        handleInvalidRefresh();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      if (isRefreshTokenInvalidError(reason)) {
        e.preventDefault();
        handleInvalidRefresh();
      }
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      /* Fix 1: Detect PASSWORD_RECOVERY event so PasswordSettings can skip old password */
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true);
      }

      /* Fix 5: Global auth event handling — inline to avoid useCallback dependency */
      if (event === "MFA_CHALLENGE_VERIFIED") {
        toast.success("2FA erfolgreich verifiziert");
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isRecoverySession, clearRecoverySession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
