export function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function sourceLabel(source: string) {
  return source === "community" ? "Added by community" : "OpenStreetMap";
}
