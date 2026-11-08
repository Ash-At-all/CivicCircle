export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("vibechat-anon-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("vibechat-anon-id", id);
  }
  return id;
}

export function getDisplayName(): string {
  if (typeof window === "undefined") return "Anonymous";
  return localStorage.getItem("vibechat-display-name") || "Anonymous";
}

export function setDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("vibechat-display-name", name.trim().slice(0, 30) || "Anonymous");
}
