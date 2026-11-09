"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonymousSession } from "@/lib/auth";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function init() {
      await ensureAnonymousSession();
      const onboarded = typeof window !== "undefined" ? localStorage.getItem("vibechat-onboarded") : null;
      if (!onboarded) {
        router.replace("/onboarding");
      } else {
        router.replace("/home");
      }
    }
    init();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-[#0B0B14]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
    </div>
  );
}
