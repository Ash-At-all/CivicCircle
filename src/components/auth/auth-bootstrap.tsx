"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { generateGhostHandle } from "@/lib/auth/ghost";

async function ensureGhostProfile() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;

  if (!session) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("Anonymous sign-in failed:", error.message);
      return;
    }
    session = data.session;
  }

  const user = session?.user;
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) return;

  for (let i = 0; i < 5; i++) {
    const username = generateGhostHandle();
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username,
      display_name: username,
    });
    if (!error) return;
    if (!String(error.message).includes("duplicate") && !String(error.message).includes("unique")) {
      return;
    }
  }
}

export function AuthBootstrap() {
  useEffect(() => {
    void ensureGhostProfile();
  }, []);

  return null;
}
