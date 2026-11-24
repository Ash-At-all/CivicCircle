"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { isShopSaved, toggleSavedShop, type SavedShop } from "@/features/saved/store";

type SaveShopInput = Omit<SavedShop, "savedAt">;

export function SaveShopButton({
  shop,
  className = "",
}: {
  shop: SaveShopInput;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSaved(isShopSaved(shop.id));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [shop.id]);

  return (
    <button
      type="button"
      aria-pressed={hydrated ? saved : undefined}
      className={`btn btn-sm btn-tertiary gap-1.5 ${saved ? "text-[var(--accent-ember-ink)]" : ""} ${className}`}
      onClick={() => setSaved(toggleSavedShop(shop))}
    >
      {saved ? (
        <BookmarkCheck className="h-4 w-4" strokeWidth={1.9} />
      ) : (
        <Bookmark className="h-4 w-4" strokeWidth={1.8} />
      )}
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
