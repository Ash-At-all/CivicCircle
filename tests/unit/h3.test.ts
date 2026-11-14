import test from "node:test";
import assert from "node:assert/strict";
import {
  CITY_BOUNDS,
  cellCentroid,
  coordsToAreaCells,
  inCityBounds,
  validateAreaCell,
} from "../../src/features/area/h3.ts";

test("accepts coordinates inside the launch city bounds", () => {
  assert.equal(inCityBounds(19.8762, 75.3433), true);
  assert.equal(inCityBounds(CITY_BOUNDS.minLat, CITY_BOUNDS.minLng), true);
  assert.equal(inCityBounds(21.0, 75.3), false);
});

test("converts coordinates to locality, ward, and city cells", () => {
  const cells = coordsToAreaCells(19.8762, 75.3433);
  assert.equal(cells.h3r8.length, 15);
  assert.equal(validateAreaCell("locality", cells.h3r8), true);
  assert.equal(validateAreaCell("ward", cells.h3r7), true);
  assert.equal(validateAreaCell("city", cells.h3r5), true);
  assert.match(cells.h3r8, /^88/);
  assert.match(cells.h3r7, /^87/);
  assert.match(cells.h3r5, /^85/);
});

test("rejects coordinates outside the launch city", () => {
  assert.throws(() => coordsToAreaCells(18.5, 73.8), /outside the launch city/i);
});

test("computes a centroid for a valid cell", () => {
  const { h3r8 } = coordsToAreaCells(19.8762, 75.3433);
  const centroid = cellCentroid(h3r8);
  assert.equal(Number.isFinite(centroid.lat), true);
  assert.equal(Number.isFinite(centroid.lng), true);
  assert.equal(inCityBounds(centroid.lat, centroid.lng), true);
});

test("rejects invalid cells", () => {
  assert.equal(validateAreaCell("locality", "not-a-cell"), false);
  assert.throws(() => cellCentroid("not-a-cell"), /invalid h3 cell/i);
});
