import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { postsRepo, type PersistedPost } from "@/features/posts/actions";

export default async function CityPage({ params }: { params: Promise<{ citySlug: string }> }) {
  const { citySlug } = await params;
  let posts: PersistedPost[] = [];
  try {
    posts = await postsRepo.listPosts(citySlug);
  } catch {
    posts = [];
  }

  return (
    <div className="mobile-container">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 pt-[max(env(safe-area-inset-top),12px)] sm:px-6">
          <Link
            href="/home"
            className="btn btn-icon btn-secondary text-[var(--mute)]"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <h1 className="text-[14px] font-medium text-[var(--ink)]">
            {citySlug.replace("-", " ")}
          </h1>
          <div className="w-9" aria-hidden="true" />
        </div>
      </header>

      <main className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <section>
          <p className="dateline">
            <span className="dateline-mark" aria-hidden="true" />
            City board
          </p>
          <h2 className="mt-2 text-h2">Posts</h2>
          {posts.length === 0 ? (
            <div className="card mt-4 px-4 py-10 text-center">
              <span className="app-tile mx-auto mb-3 h-11 w-11 text-[var(--mute)]">
                <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="text-[13px] text-[var(--mute)]">No posts in {citySlug} yet.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {posts.map((post) => (
                <article key={post.id} className="feed-card p-4">
                  <h3 className="text-[18px] font-medium leading-snug text-[var(--ink)]">
                    {post.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--mute)]">{post.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-h2">Chat</h2>
          <div className="card mt-4 flex h-64 flex-col overflow-y-auto p-4">
            <p className="mt-10 text-center text-[13px] text-[var(--mute)]">
              Chat for {citySlug} coming soon.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
