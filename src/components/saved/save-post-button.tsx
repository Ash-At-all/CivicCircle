"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { isPostSaved, toggleSavedPost, type SavedPost } from "@/features/saved/store";

type SavePostInput = Omit<SavedPost, "savedAt">;

export function SavePostButton({
  post,
  className = "",
  compact = false,
}: {
  post: SavePostInput;
  className?: string;
  compact?: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSaved(isPostSaved(post.id));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [post.id]);

  if (!hydrated) {
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center text-[var(--ash)] ${className}`}
        aria-hidden="true"
      >
        <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
    );
  }

  const label = saved ? "Remove from saved" : "Save post";

  if (compact) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={saved}
        title={label}
        className={`btn btn-icon btn-secondary ${saved ? "text-[var(--accent-yellow)]" : "text-[var(--mute)]"} ${className}`}
        onClick={() => setSaved(toggleSavedPost(post))}
      >
        {saved ? (
          <BookmarkCheck className="h-[18px] w-[18px]" strokeWidth={1.9} />
        ) : (
          <Bookmark className="h-[18px] w-[18px]" strokeWidth={1.8} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      className={`action-pill gap-1.5 ${saved ? "text-[var(--accent-yellow)]" : ""} ${className}`}
      onClick={() => setSaved(toggleSavedPost(post))}
    >
      {saved ? (
        <BookmarkCheck className="h-[18px] w-[18px] text-[var(--accent-yellow)]" strokeWidth={1.9} />
      ) : (
        <Bookmark className="h-[18px] w-[18px] text-[var(--accent-yellow)]" strokeWidth={1.8} />
      )}
      <span className="text-[13px] font-medium">{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
