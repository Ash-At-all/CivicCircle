export type Message = {
  id: string;
  body: string;
  time: string;
  fromYou: boolean;
  author: string;
  author_username: string | null;
  initials: string;
  anon_id: string | null;
};
