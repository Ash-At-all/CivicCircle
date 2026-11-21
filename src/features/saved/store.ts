export type SavedPost = {
  id: string;
  title: string;
  body: string;
  tag: string;
  citySlug: string;
  imageUrl: string | null;
  savedAt: number;
};

export type SavedShop = {
  id: string;
  name: string;
  name_hi: string | null;
  category: string;
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  lat: number;
  lng: number;
  distance_m: number;
  source: string;
  savedAt: number;
};

export const SAVED_POSTS_KEY = "civiccircle-saved-posts";
export const SAVED_SHOPS_KEY = "civiccircle-saved-shops";
export const SAVED_CHANGED_EVENT = "civiccircle:saved-changed";

const MAX_SAVED_ITEMS = 100;

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_SAVED_ITEMS)));
    window.dispatchEvent(new Event(SAVED_CHANGED_EVENT));
  } catch {
    // Storage can be unavailable in private modes.
  }
}

export function readSavedPosts(): SavedPost[] {
  return readList<SavedPost>(SAVED_POSTS_KEY)
    .filter((item) => item && typeof item.id === "string")
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function readSavedShops(): SavedShop[] {
  return readList<SavedShop>(SAVED_SHOPS_KEY)
    .filter((item) => item && typeof item.id === "string")
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function isPostSaved(id: string) {
  return readSavedPosts().some((item) => item.id === id);
}

export function isShopSaved(id: string) {
  return readSavedShops().some((item) => item.id === id);
}

export function toggleSavedPost(input: Omit<SavedPost, "savedAt">): boolean {
  const posts = readSavedPosts();
  const existing = posts.some((item) => item.id === input.id);
  if (existing) {
    writeList(SAVED_POSTS_KEY, posts.filter((item) => item.id !== input.id));
    return false;
  }
  writeList(SAVED_POSTS_KEY, [{ ...input, savedAt: Date.now() }, ...posts]);
  return true;
}

export function toggleSavedShop(input: Omit<SavedShop, "savedAt">): boolean {
  const shops = readSavedShops();
  const existing = shops.some((item) => item.id === input.id);
  if (existing) {
    writeList(SAVED_SHOPS_KEY, shops.filter((item) => item.id !== input.id));
    return false;
  }
  writeList(SAVED_SHOPS_KEY, [{ ...input, savedAt: Date.now() }, ...shops]);
  return true;
}

export function removeSavedPost(id: string) {
  writeList(SAVED_POSTS_KEY, readSavedPosts().filter((item) => item.id !== id));
}

export function removeSavedShop(id: string) {
  writeList(SAVED_SHOPS_KEY, readSavedShops().filter((item) => item.id !== id));
}

export function clearSavedPosts() {
  writeList<SavedPost>(SAVED_POSTS_KEY, []);
}

export function clearSavedShops() {
  writeList<SavedShop>(SAVED_SHOPS_KEY, []);
}
