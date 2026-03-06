/**
 * Tool-agnostic auth API. The app only imports from here — never from a
 * specific provider (Lovable, Replit, etc.). To switch tools, replace the
 * implementation below with your deployment's auth (e.g. Supabase direct).
 */
import { lovable } from "./lovable/index";

export type OAuthProvider = "google" | "apple";

export type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export type SignInResult = { error?: Error } | { redirected: true };

export const auth = {
  signInWithOAuth: async (
    provider: OAuthProvider,
    opts?: SignInOptions
  ): Promise<SignInResult> => {
    return lovable.auth.signInWithOAuth(provider, opts);
  },
};
