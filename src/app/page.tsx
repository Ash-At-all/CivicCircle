"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const onboarded = typeof window !== "undefined" ? localStorage.getItem("vibechat-onboarded") : null;
    if (!onboarded) {
      router.replace("/onboarding");
    } else {
      router.replace("/home");
    }
  }, [router]);

  return (
    <div className="mobile-container flex items-center justify-center min-h-[100dvh] bg-[#0B0B14]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
    </div>
  );
}
