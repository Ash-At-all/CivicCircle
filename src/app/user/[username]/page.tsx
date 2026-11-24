import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  tag: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type Post = {
  id: string;
  city_slug: string;
  tag: string;
  title: string;
  body: string;
  image_paths: string[];
  created_at: string;
  author_id: string;
};

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { cache: "no-store", ...init });
  if (!res.ok) throw new Error(`Request failed with ${res.status}`);
  return res.json() as Promise<T>;
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let profile: Profile | null = null;
  let posts: Post[] = [];
  let error: string | null = null;

  try {
    const prof = await fetchJson<{ profile: Profile | null }>(
      `/api/profiles/${encodeURIComponent(username)}`,
    );
    profile = prof.profile ?? null;
    if (!profile) {
      error = "Profile not found.";
    } else {
      const data = await fetchJson<{ posts: Post[] }>(
        `/api/posts?author=${encodeURIComponent(profile.id)}`,
      );
      posts = Array.isArray(data.posts) ? data.posts : [];
    }
  } catch {
    error = "Could not load that profile. Please try again.";
  }

  if (error) {
    return (
      <div className="mobile-container justify-center px-4 py-16">
        <div className="card mx-auto w-full max-w-md p-5">
          <p className="text-[13px] text-[var(--accent-red)]" role="alert">{error}</p>
          <Link href="/" className="btn btn-tertiary mt-4">
            Back to community
          </Link>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mobile-container justify-center px-4 py-16">
        <div className="card mx-auto w-full max-w-md p-5">
          <p className="text-[13px] text-[var(--mute)]">Profile not found.</p>
          <Link href="/" className="btn btn-tertiary mt-4">
            Back to community
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;
  const initials = profile.username
    .split(/[_\s]+/)
    .map((part: string) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="mobile-container">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 pt-[max(env(safe-area-inset-top),12px)] sm:px-6">
          <Link
            href="/"
            className="btn btn-icon btn-secondary text-[var(--mute)]"
            aria-label="Back to community"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <span className="text-[14px] font-medium text-[var(--ink)]">
            @{profile.username}
          </span>
          <div className="w-9" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <header className="card flex items-center gap-4 p-5">
          <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full border border-[var(--hairline)] bg-[var(--surface-card)] text-[20px] font-semibold text-[var(--ink)]">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="Avatar"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
                priority
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-h1 truncate">{profile.username}</h1>
              {displayName !== profile.username && (
                <span className="text-[13px] text-[var(--mute)]">{displayName}</span>
              )}
              {profile.tag && <span className="badge">{profile.tag}</span>}
            </div>
            <p className="mt-1 text-[12px] text-[var(--ash)]">
              Member of CivicCircle
            </p>
          </div>
        </header>

        <section className="mt-6">
          <p className="dateline">
            <span className="dateline-mark" aria-hidden="true" />
            Activity
          </p>
          <h2 className="mt-2 text-h2">Posts by {profile.username}</h2>
          {posts.length === 0 ? (
            <div className="card mt-4 px-4 py-10 text-center text-[13px] text-[var(--mute)]">
              No posts yet.
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {posts.map((post) => (
                <article key={post.id} className="feed-card flex gap-2.5 p-4">
                  <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--surface-card)] text-[12px] font-semibold text-[var(--mute)]">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="tag-chip">{post.tag}</span>
                    <h3 className="mt-1.5 text-[15px] font-medium leading-snug text-[var(--ink)]">
                      {post.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--mute)]">{post.body}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
