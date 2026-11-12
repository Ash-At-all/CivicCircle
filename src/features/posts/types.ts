export type PostTag = "General" | "Food" | "Jobs" | "Rent" | "Events" | "Question";

export type PersistedPost = {
  id: string;
  city_slug: string;
  author?: string;
  author_username?: string | null;
  avatar_url?: string | null;
  author_id?: string;
  anon_id?: string;
  mine?: boolean;
  tag: string;
  title: string;
  body: string;
  image_paths: string[];
  created_at: string;
  updated_at: string;
  votes?: number;
  user_vote?: number;
  comments?: PersistedComment[];
};

export type PersistedComment = {
  id: string;
  author: string;
  author_username?: string | null;
  body: string;
  replies: PersistedComment[];
};

export type PostEdit = {
  title: string;
  body: string;
};
