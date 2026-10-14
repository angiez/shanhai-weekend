const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../community-rules.js");

const activity = { status: "open", capacity: 2 };
const cancelled = { status: "cancelled", capacity: 2 };

test("browsing rules do not require an account", function () {
  assert.equal(rules.canRegister(activity, [], null).reason, "signed-out");
  assert.equal(rules.canReadChat(activity, [], null, []), false);
});

test("first registration waits and does not unlock chat", function () {
  const rows = [{ userId: "a", status: "confirmed" }];
  assert.equal(rules.chatUnlocked(rows), false);
  assert.equal(rules.canReadChat(activity, rows, "a", []), false);
  assert.equal(rules.canRegister(activity, rows, "b").ok, true);
});

test("second different participant unlocks chat", function () {
  const rows = [
    { userId: "a", status: "confirmed" },
    { userId: "b", status: "confirmed" }
  ];
  assert.equal(rules.chatUnlocked(rows), true);
  assert.equal(rules.canReadChat(activity, rows, "a", []), true);
  assert.equal(rules.canReadChat(activity, rows, "c", []), false);
  assert.equal(rules.canPost(activity, rows, "b", []), true);
});

test("the same person cannot register twice", function () {
  const rows = [{ userId: "a", status: "confirmed" }];
  assert.equal(rules.canRegister(activity, rows, "a").reason, "duplicate");
});

test("a cancelled registration does not count toward capacity or chat", function () {
  const rows = [
    { userId: "a", status: "confirmed" },
    { userId: "b", status: "cancelled" }
  ];
  assert.equal(rules.chatUnlocked(rows), false);
  assert.equal(rules.canRegister(activity, rows, "b").ok, true);
});

test("capacity and cancellation stop new registrations", function () {
  const full = [
    { userId: "a", status: "confirmed" },
    { userId: "b", status: "confirmed" }
  ];
  assert.equal(rules.canRegister(activity, full, "c").reason, "full");
  assert.equal(rules.canRegister(cancelled, [], "a").reason, "closed");
  assert.equal(rules.canReadChat(cancelled, full, "a", []), false);
});

test("a block stops chat for the blocked relationship", function () {
  const rows = [
    { userId: "a", status: "confirmed" },
    { userId: "b", status: "confirmed" }
  ];
  assert.equal(rules.canReadChat(activity, rows, "a", [{ blockerId: "a", blockedId: "b" }]), false);
  assert.equal(rules.canReadChat(activity, rows, "b", [{ blockerId: "a", blockedId: "b" }]), false);
});
