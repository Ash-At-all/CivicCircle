import Link from "next/link";
import React from "react";
import { processImage } from "@/lib/client-image";
import { postsRepo, type PersistedPost } from "@/features/posts/actions";

export default function CityPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  const [posts, setPosts] = React.useState<PersistedPost[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    postsRepo.listPosts(citySlug).then((data) => {
      setPosts(data);
      setLoading(false);
    });
  }, [citySlug]);

  if (loading) {
    return (
      <div className="mobile-container min-h-[100dvh] bg-[#171921] flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-[spin_1s_linear_infinite] rounded-full border-2 border-[#AD68F5] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-container min-h-[100dvh] bg-[#171921] text-[#F2F0FA] flex flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.08] bg-[#171921]/95 px-4 py-3.5 backdrop-blur-xl pt-[max(env(safe-area-inset-top),4px)]">
        <Link href="/home" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFFFFF]/06 text-[#F2F0FA] hover:text-[#FFFFFF] transition" aria-label="Back to feed">
          <svg className="h-5 w-5" strokeWidth={1.75} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </Link>
        <h1 className="text-lg font-bold text-[#FFFFFF]">{citySlug.replace("-", " ")}</h1>
        <div className="w-9" />
      </header>
      <main className="flex-1 px-4 py-4 space-y-4">
        <h2 className="text-[#FFFFFF] font-semibold text-lg">Posts</h2>
        {posts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[#8B8FA3] text-sm">No posts in {citySlug} yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <article key={post.id} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
                <h3 className="text-[#FFFFFF] font-semibold">{post.title}</h3>
                <p className="mt-1 text-[#8B8FA3] text-sm">{post.body}</p>
              </article>
            ))}
          </div>
        )}
        <h2 className="text-[#FFFFFF] font-semibold text-lg mt-8">Chat</h2>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 h-64 overflow-y-auto flex flex-col space-y-2">
          <p className="text-[#8B8FA3] text-sm text-center mt-10">Chat for {citySlug} coming soon.</p>
        </div>
      </main>
    </div>
  );
}
