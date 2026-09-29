import assert from "node:assert/strict";
import { test } from "node:test";
import { upcomingDates } from "./prompt";

test("upcoming dates list the next 14 days with correct weekdays and hours", () => {
  // 2026-09-29 is a Tuesday.
  const text = upcomingDates("2026-09-29");
  const lines = text.split("\n").filter((l) => l.startsWith("- "));
  assert.equal(lines.length, 14);
  assert.equal(lines[0], "- Tuesday, September 29 (today): 2026-09-29, open 9:00 AM to 5:00 PM");
  assert.equal(lines[1], "- Wednesday, September 30 (tomorrow): 2026-09-30, open 9:00 AM to 5:00 PM");
  assert.ok(lines.includes("- Sunday, October 4: 2026-10-04, closed"));
  assert.ok(lines.includes("- Tuesday, October 6: 2026-10-06, open 9:00 AM to 5:00 PM"));
  assert.ok(lines.includes("- Wednesday, October 7: 2026-10-07, open 9:00 AM to 5:00 PM"));
  assert.ok(lines.includes("- Thursday, October 8: 2026-10-08, open 10:00 AM to 7:00 PM"));
});

test("this week and next week run Monday to Sunday", () => {
  assert.match(upcomingDates("2026-09-29"), /This week runs from Monday September 28 to Sunday October 4\. Next week runs from Monday October 5 to Sunday October 11\./);
  // On a Sunday, "next week" starts tomorrow and still fits inside the 14 days listed.
  const sunday = upcomingDates("2026-10-04");
  assert.match(sunday, /Next week runs from Monday October 5 to Sunday October 11\./);
  assert.ok(sunday.includes("2026-10-11"));
});
