import test from "node:test";
import assert from "node:assert/strict";
import {
  RADIUS_STEPS_M,
  choosePeopleRadius,
  chooseShopRadius,
  formatRadiusLabel,
  peopleMessage,
  shopRadiusMessage,
} from "../../src/features/area/radius.ts";

test("chooses first radius when enough shops are nearby", () => {
  const shops = Array.from({ length: 6 }, (_, i) => ({ id: String(i), distance_m: 100 + i * 20 }));
  const result = chooseShopRadius(shops);
  assert.equal(result.radius, 500);
  assert.equal(result.expanded, false);
  assert.equal(result.shops.length, 6);
});

test("expands radius until minimum shops are found", () => {
  const shops = [
    { id: "1", distance_m: 400 },
    { id: "2", distance_m: 900 },
    { id: "3", distance_m: 950 },
    { id: "4", distance_m: 1800 },
    { id: "5", distance_m: 1900 },
  ];
  const result = chooseShopRadius(shops);
  assert.equal(result.radius, 2000);
  assert.equal(result.expanded, true);
  assert.equal(result.previousCount, 3);
  assert.equal(result.previousRadius, 1000);
});

test("returns exhausted result at 50 km when shops are sparse", () => {
  const shops = [{ id: "1", distance_m: 1200 }, { id: "2", distance_m: 49000 }];
  const result = chooseShopRadius(shops);
  assert.equal(result.radius, 50000);
  assert.equal(result.exhausted, true);
  assert.equal(result.shops.length, 2);
});

test("shop messages are factual", () => {
  const expanded = chooseShopRadius([
    { id: "1", distance_m: 400 },
    { id: "2", distance_m: 900 },
    { id: "3", distance_m: 950 },
    { id: "4", distance_m: 1800 },
    { id: "5", distance_m: 1900 },
  ]);
  assert.equal(
    shopRadiusMessage(expanded),
    "Only 3 shops within 1 km, so we expanded to 2 km.",
  );
  assert.equal(
    shopRadiusMessage({ ...expanded, shops: [], exhausted: true, radius: 50000 }),
    "No shops are listed within 50 km yet. Add the first one.",
  );
});

test("chooses people radius by active count", () => {
  const counts = RADIUS_STEPS_M.map((radius_m) => ({
    radius_m,
    active_people: radius_m >= 2000 ? 2 : 0,
  }));
  const result = choosePeopleRadius(counts);
  assert.equal(result.radius, 2000);
  assert.equal(result.count, 2);
  assert.equal(result.exhausted, false);
});

test("people messages reflect presence honestly", () => {
  assert.equal(
    peopleMessage({ radius: 50000, count: 0, exhausted: true }, true),
    "You are the only one active here right now.",
  );
  assert.equal(
    peopleMessage({ radius: 2000, count: 3, exhausted: false }, true),
    "3 other people active within 2 km.",
  );
  assert.equal(formatRadiusLabel(500), "500 m");
  assert.equal(formatRadiusLabel(2000), "2 km");
});
