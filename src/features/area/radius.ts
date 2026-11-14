export const RADIUS_STEPS_M = [500, 1000, 2000, 5000, 10000, 25000, 50000] as const;
export const MIN_SHOPS = 5;
export const MIN_ACTIVE_PEOPLE = 1;
export const MAX_SHOPS = 200;

export type RadiusStep = (typeof RADIUS_STEPS_M)[number];

type ShopWithDistance = { id: string; distance_m: number };

export function chooseShopRadius(shops: ShopWithDistance[]) {
  const sorted = [...shops].sort((a, b) => a.distance_m - b.distance_m);
  let previousCount = 0;

  for (let i = 0; i < RADIUS_STEPS_M.length; i++) {
    const step = RADIUS_STEPS_M[i];
    const inStep = sorted.filter((shop) => shop.distance_m <= step);
    if (inStep.length >= MIN_SHOPS) {
      const previousRadius = RADIUS_STEPS_M[Math.max(0, i - 1)];
      return {
        radius: step,
        shops: inStep,
        expanded: step > RADIUS_STEPS_M[0] && previousCount < MIN_SHOPS,
        previousCount,
        previousRadius,
        exhausted: false,
      };
    }
    previousCount = inStep.length;
  }

  return {
    radius: 50000 as RadiusStep,
    shops: sorted.filter((shop) => shop.distance_m <= 50000),
    expanded: true,
    previousCount,
    previousRadius: 25000 as RadiusStep,
    exhausted: true,
  };
}

export function choosePeopleRadius(
  counts: { radius_m: number; active_people: number }[],
) {
  const sorted = [...counts].sort((a, b) => a.radius_m - b.radius_m);

  for (const item of sorted) {
    if (item.active_people >= MIN_ACTIVE_PEOPLE) {
      return { radius: item.radius_m, count: item.active_people, exhausted: false };
    }
  }

  return { radius: 50000, count: 0, exhausted: true };
}

export function formatRadiusLabel(meters: number) {
  if (meters < 1000) return `${meters} m`;
  return `${meters / 1000} km`;
}

export function shopRadiusMessage(result: ReturnType<typeof chooseShopRadius>) {
  if (result.shops.length === 0) {
    return "No shops are listed within 50 km yet. Add the first one.";
  }
  if (!result.expanded && result.radius === RADIUS_STEPS_M[0]) {
    return `Showing shops within ${formatRadiusLabel(result.radius)}.`;
  }
  if (result.exhausted) {
    return `Showing the closest ${result.shops.length} shops within 50 km.`;
  }
  return `Only ${result.previousCount} shops within ${formatRadiusLabel(
    result.previousRadius,
  )}, so we expanded to ${formatRadiusLabel(result.radius)}.`;
}

export function peopleMessage(
  choice: ReturnType<typeof choosePeopleRadius>,
  youAreActive: boolean,
) {
  if (choice.exhausted || choice.count === 0) {
    return youAreActive
      ? "You are the only one active here right now."
      : "No one is active nearby right now.";
  }
  const noun = choice.count === 1 ? "other person" : "other people";
  return `${choice.count} ${noun} active within ${formatRadiusLabel(choice.radius)}.`;
}
