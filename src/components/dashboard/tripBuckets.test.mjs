import assert from "node:assert/strict";
import test from "node:test";
import { buildChartPoints, getPerformanceRange } from "./tripBuckets.ts";

test("performance periods cover calendar days in the selected timezone", () => {
  const range = getPerformanceRange("2026-09-30", "weekly", "America/Chicago");
  assert.equal(range.start, "2026-09-24T05:00:00.000Z");
  assert.equal(range.end, "2026-10-01T05:00:00.000Z");
  assert.equal(range.days.length, 7);
  assert.deepEqual([range.days[0], range.days.at(-1)], ["2026-09-24", "2026-09-30"]);
});

test("daily ranges honor 23-hour and 25-hour daylight saving days", () => {
  const spring = getPerformanceRange("2026-03-08", "daily", "America/Chicago");
  const autumn = getPerformanceRange("2026-11-01", "daily", "America/Chicago");
  assert.equal((Date.parse(spring.end) - Date.parse(spring.start)) / 3_600_000, 23);
  assert.equal((Date.parse(autumn.end) - Date.parse(autumn.start)) / 3_600_000, 25);
});

test("chart zero-fills empty days and preserves complete server counts above the REST row limit", () => {
  const points = buildChartPoints(["2026-09-29", "2026-09-30"], "weekly", [{
    bucket: "2026-09-30", total: 1507, completed: 1500, assigned: 3, pending: 1, cancelled: 2, no_show: 1,
  }]);
  assert.deepEqual(points[0], { name: "Tue", total: 0, completed: 0, assigned: 0, pending: 0, cancelled: 0, noShow: 0 });
  assert.deepEqual(points[1], { name: "Wed", total: 1507, completed: 1500, assigned: 3, pending: 1, cancelled: 2, noShow: 1 });
});

test("hourly chart maps database buckets to 24 wall-clock labels", () => {
  const points = buildChartPoints(["2026-09-30"], "daily", [{
    bucket: "2026-09-30 09:00", total: 6, completed: 4, assigned: 2, pending: 0, cancelled: 0, no_show: 0,
  }]);
  assert.equal(points.length, 24);
  assert.equal(points[9].name, "09:00");
  assert.equal(points[9].total, 6);
  assert.equal(points[10].total, 0);
});
