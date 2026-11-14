const adjectives = ["quiet", "bright", "calm", "swift", "kind", "brave", "local", "sunny"];
const nouns = ["lane", "river", "park", "corner", "bridge", "market", "hill", "tree"];

function randomPart(parts: string[]) {
  return parts[Math.floor(Math.random() * parts.length)];
}

export function generateGhostHandle() {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${randomPart(adjectives)}_${randomPart(nouns)}_${suffix}`.slice(0, 30);
}
