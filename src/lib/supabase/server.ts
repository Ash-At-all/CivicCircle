import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured. Set the project URL and anon key in .env.local.");
  }

  const cookieStore = await cookies();
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("Supabase placeholder not connected") }) }) }),
      update: () => ({ eq: () => ({ error: new Error("Supabase placeholder not connected") }) }),
      delete: () => ({ eq: () => ({ error: new Error("Supabase placeholder not connected") }) }),
      upsert: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: new Error("Supabase placeholder not connected") }),
        remove: async () => ({ data: null, error: new Error("Supabase placeholder not connected") }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
    rpc: async () => ({ data: null, error: new Error("Supabase placeholder not connected") }),
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
