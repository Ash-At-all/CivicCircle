import type { PostDraft } from "./schema";
import type { PostAlertType } from "./alerts";
import type { Poll, PollOption, PollResult } from "./types";

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
  alert_type?: string | null;
  image_paths: string[];
  created_at: string;
  updated_at: string;
  votes?: number;
  user_vote?: number;
  helpful_count?: number;
  helpful_marked?: boolean;
  comments?: PersistedComment[];
  poll?: Poll | null;
};

export type PersistedComment = {
  id: string;
  author: string;
  author_username?: string | null;
  body: string;
  replies: PersistedComment[];
};

export type PostEdit = Pick<PostDraft, "title" | "body">;

export interface PostsRepo {
  listPosts(city?: string): Promise<PersistedPost[]>;
  uploadPostImages(images: Blob[]): Promise<string[]>;
  removePostImages(imagePaths: string[]): Promise<void>;
  createPost(post: PostDraft, imagePaths?: string[], anonId?: string, alertType?: PostAlertType | null): Promise<PersistedPost>;
  updatePost(id: string, post: PostEdit): Promise<PersistedPost>;
  deletePost(id: string): Promise<string | null>;
  createPoll(input: { postId: string; question: string; options: string[] }): Promise<{ poll: Poll; options: PollOption[] }>;
  getPoll(pollId: string): Promise<PollResult | null>;
  votePoll(pollId: string, optionId: string): Promise<PollResult | null>;
}

async function readResponse<T>(response: Response): Promise<T> {
  let result: unknown;
  try {
    result = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("The server returned an invalid response. Please try again.");
    }
    throw error;
  }

  if (!response.ok) {
    if (typeof result === "object" && result !== null && "error" in result && typeof result.error === "string") {
      throw new Error(result.error);
    }
    throw new Error(`The server request failed (${response.status}). Please try again.`);
  }
  return result as T;
}

export const postsRepo: PostsRepo = {
  async listPosts(city) {
    const query = city ? `?city=${encodeURIComponent(city)}` : "";
    const result = await readResponse<{ posts: PersistedPost[] }>(
      await fetch(`/api/posts${query}`, { cache: "no-store" }),
    );
    return result.posts;
  },

  async uploadPostImages(images) {
    const formData = new FormData();
    for (const image of images) formData.append("images", image, "post-image.webp");
    const result = await readResponse<{ imagePaths: string[] }>(
      await fetch("/api/posts/images", { method: "POST", body: formData }),
    );
    return result.imagePaths;
  },

  async removePostImages(imagePaths) {
    await readResponse<{ removed: true }>(
      await fetch("/api/posts/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePaths }),
      }),
    );
  },

  async createPost(post: PostDraft, imagePaths?: string[], anonId?: string, alertType?: PostAlertType | null): Promise<PersistedPost> {
    const result = await readResponse<{ post: PersistedPost }>(
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post: { ...post, alert_type: alertType ?? null }, imagePaths, anonId }),
      }),
    );
    return result.post;
  },

  async updatePost(id, post) {
    const result = await readResponse<{ post: PersistedPost }>(
      await fetch(`/api/posts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(post),
      }),
    );
    return result.post;
  },

  async deletePost(id) {
    const result = await readResponse<{ deleted: true; cleanupWarning: string | null }>(
      await fetch(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" }),
    );
    return result.cleanupWarning;
  },

  async createPoll(input: { postId: string; question: string; options: string[] }): Promise<{ poll: Poll; options: PollOption[] }> {
    const result = await readResponse<{ poll: Poll; options: PollOption[] }>(
      await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: input.postId,
          question: input.question,
          options: input.options,
        }),
      }),
    );
    return result;
  },

  async getPoll(pollId: string): Promise<PollResult | null> {
    try {
      const result = await readResponse<PollResult | null>(
        await fetch(`/api/polls/${encodeURIComponent(pollId)}`, { cache: "no-store" }),
      );
      return result;
    } catch {
      return null;
    }
  },

  async votePoll(pollId: string, optionId: string): Promise<PollResult | null> {
    try {
      const result = await readResponse<PollResult | null>(
        await fetch(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ option_id: optionId }),
        }),
      );
      return result;
    } catch {
      return null;
    }
  },
};
