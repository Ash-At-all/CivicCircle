export type BoardHighlight = {
  slug: string;
  count: number;
};

export type HighlightsResponse = {
  posts: {
    total: number;
    byBoard: BoardHighlight[];
    topTag: { tag: string; count: number } | null;
  };
  chat: {
    recent: number;
    busy: boolean;
    localityName: string | null;
  };
  generatedAt: string;
};
