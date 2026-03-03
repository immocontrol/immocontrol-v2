import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  /* Fix 5: Global auth event handler — toast notifications for key auth events */
  const handleAuthEvent = useCallback((event: AuthChangeEvent) => {
    switch (event) {
      case "TOKEN_REFRESHED":
        /* Silent — no notification needed */
        break;
      case "USER_UPDATED":
        toast.success("Profil aktualisiert");
        break;
      case "SIGNED_OUT":
        /* Silent — handled by redirect */
        break;
      case "MFA_CHALLENGE_VERIFIED":
        toast.success("2FA erfolgreich verifiziert");
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      /* Fix 1: Detect PASSWORD_RECOVERY event so PasswordSettings can skip old password */
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoverySession(true);
      }

      /* Fix 5: Global auth event handling */
      handleAuthEvent(event);
    });

    return () => subscription.unsubscribe();
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
