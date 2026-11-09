"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Ensures the client has a valid Supabase session.
 * If not authenticated, signs in anonymously using supabase.auth.signInAnonymously().
 * Returns the current authenticated User.
 */
export async function ensureAnonymousSession(): Promise<User | null> {
  if (typeof window === "undefined") return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return sessionData.session.user;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.warn("signInAnonymously notice:", error.message);
      return null;
    }
    return data?.user ?? null;
  } catch (err) {
    console.warn("ensureAnonymousSession failed:", err);
    return null;
  }
}
