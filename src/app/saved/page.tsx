"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  ExternalLink,
  MapPin,
  Phone,
  Store,
  Trash2,
} from "lucide-react";
import {
  clearSavedPosts,
  clearSavedShops,
  readSavedPosts,
  readSavedShops,
  removeSavedPost,
  removeSavedShop,
  type SavedPost,
  type SavedShop,
} from "@/features/saved/store";
import { SHOP_CATEGORY_LABELS, type ShopCategory } from "@/features/shops/categories";
import { formatDistance } from "@/features/shops/format";

type Tab = "posts" | "shops";

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [shops, setShops] = useState<SavedShop[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setPosts(readSavedPosts());
      setShops(readSavedShops());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const total = posts.length + shops.length;
  const activeCount = tab === "posts" ? posts.length : shops.length;

  const sortedPosts = useMemo(() => posts, [posts]);
  const sortedShops = useMemo(() => shops, [shops]);

  function removePost(id: string) {
    removeSavedPost(id);
    setPosts((current) => current.filter((item) => item.id !== id));
  }

  function removeShop(id: string) {
    removeSavedShop(id);
    setShops((current) => current.filter((item) => item.id !== id));
  }

  function clearAll() {
    if (tab === "posts") {
      clearSavedPosts();
      setPosts([]);
    } else {
      clearSavedShops();
      setShops([]);
    }
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[var(--canvas)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-white/8 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-3 py-2.5 pt-[max(env(safe-area-inset-top),10px)] sm:px-5">
          <Link href="/home" className="btn btn-icon btn-secondary text-white/80" aria-label="Back to home">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </Link>
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-[var(--accent-yellow)]" strokeWidth={1.8} aria-hidden="true" />
            <h1 className="text-sm font-medium tracking-[0.2px] text-[var(--ink)]">Saved</h1>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-secondary text-[var(--mute)]"
            aria-label={`Clear saved ${tab}`}
            disabled={activeCount === 0}
            onClick={clearAll}
          >
            <Trash2 className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
        <section>
          <p className="text-label">Your device</p>
          <h2 className="mt-1 text-h2">Saved for later</h2>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[var(--mute)]">
            Bookmarks stay in this browser. No account needed, and clearing site data removes them.
          </p>
        </section>

        <div
          role="tablist"
          aria-label="Saved sections"
          className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "posts"}
            className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium transition-colors ${
              tab === "posts" ? "bg-[var(--surface-elevated)] text-[var(--ink)]" : "text-[var(--mute)] hover:text-[var(--ink)]"
            }`}
            onClick={() => setTab("posts")}
          >
            Posts <span className="tabular-nums text-[11px] text-[var(--ash)]">{posts.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "shops"}
            className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium transition-colors ${
              tab === "shops" ? "bg-[var(--surface-elevated)] text-[var(--ink)]" : "text-[var(--mute)] hover:text-[var(--ink)]"
            }`}
            onClick={() => setTab("shops")}
          >
            Places <span className="tabular-nums text-[11px] text-[var(--ash)]">{shops.length}</span>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {!hydrated ? (
            <div className="space-y-3" aria-label="Loading saved items" role="status">
              {[1, 2].map((item) => (
                <div key={item} className="card space-y-3 p-4">
                  <div className="h-3 w-24 rounded bg-white/8" />
                  <div className="h-4 w-3/4 rounded bg-white/10" />
                  <div className="h-3 w-full rounded bg-white/8" />
                </div>
              ))}
            </div>
          ) : tab === "posts" ? (
            sortedPosts.length === 0 ? (
              <EmptyState
                icon={<Bookmark className="h-5 w-5" strokeWidth={1.8} />}
                title="No saved posts yet"
                detail="Tap Save on any post in the home feed to keep it here."
                href="/home"
                action="Browse the feed"
              />
            ) : (
              sortedPosts.map((post) => (
                <article key={post.id} className="card overflow-hidden">
                  <div className="flex items-center gap-2 px-4 pt-3.5">
                    <span className="tag-chip !px-2 !py-0.5">{post.tag || "General"}</span>
                    <span className="text-[11px] text-[var(--ash)]">
                      Saved {new Date(post.savedAt).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-[11px] font-medium text-[var(--accent-red)] hover:underline"
                      onClick={() => removePost(post.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="px-4 pb-3 pt-2">
                    <h3 className="text-[16px] font-semibold leading-snug text-[var(--ink)]">{post.title}</h3>
                    {post.body ? (
                      <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-[var(--body-text)]">
                        {post.body}
                      </p>
                    ) : null}
                    {post.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="mt-3 max-h-44 w-full rounded-[var(--radius-md)] object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 border-t border-[var(--hairline)] px-4 py-2.5">
                    <Link
                      href={`/home?topic=${encodeURIComponent(post.citySlug || "general")}`}
                      className="btn btn-sm btn-tertiary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Open board
                    </Link>
                  </div>
                </article>
              ))
            )
          ) : sortedShops.length === 0 ? (
            <EmptyState
              icon={<Store className="h-5 w-5" strokeWidth={1.8} />}
              title="No saved places yet"
              detail="Tap Save on a shop in Nearby to keep it handy."
              href="/nearby"
              action="Explore nearby"
            />
          ) : (
            sortedShops.map((shop) => {
              const category =
                SHOP_CATEGORY_LABELS[(shop.category as ShopCategory) || "other"] || shop.category;
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${shop.lat},${shop.lng}`,
              )}`;
              return (
                <article key={shop.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-medium text-[var(--ink)]">{shop.name}</h3>
                      {shop.name_hi ? (
                        <p className="mt-0.5 text-[12px] text-[var(--mute)]" lang="hi">
                          {shop.name_hi}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] uppercase tracking-[0.4px] text-[var(--ash)]">{category}</p>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-[var(--accent-red)] hover:underline"
                      onClick={() => removeShop(shop.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-2 text-[13px] text-[var(--body-text)]">{shop.address || "Address not listed"}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[var(--mute)]">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {formatDistance(shop.distance_m)} from your area centre
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="btn btn-sm btn-tertiary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Open in Maps
                    </a>
                    {shop.phone ? (
                      <a href={`tel:${shop.phone}`} className="btn btn-sm btn-tertiary">
                        <Phone className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Call
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {hydrated && total > 0 ? (
          <p className="mt-5 text-center text-[11px] tracking-[0.3px] text-[var(--ash)]">
            {total} {total === 1 ? "item" : "items"} saved on this device.
          </p>
        ) : null}
      </main>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  detail,
  href,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  href: string;
  action: string;
}) {
  return (
    <div className="card px-5 py-10 text-center">
      <span className="app-tile mx-auto mb-4 h-11 w-11 text-[var(--accent-yellow)]">{icon}</span>
      <p className="text-[15px] font-medium text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-[13px] text-[var(--mute)]">{detail}</p>
      <Link href={href} className="btn btn-primary mx-auto mt-5">
        {action}
      </Link>
    </div>
  );
}
