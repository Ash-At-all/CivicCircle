export type ProfileDraft = {
  username: string;
  display_name?: string;
  tag: string | null;
  avatar_url?: string | null;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  tag: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
