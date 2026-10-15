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

test("a block hides that person's messages and leaves the rest of the room", function () {
  const rows = [
    { userId: "a", status: "confirmed" },
    { userId: "b", status: "confirmed" },
    { userId: "c", status: "confirmed" }
  ];
  const blocks = [{ blockerId: "a", blockedId: "b" }];
  assert.equal(rules.canReadChat(activity, rows, "a"), true);
  assert.equal(rules.canReadChat(activity, rows, "c"), true);
  assert.equal(rules.canPost(activity, rows, "a", blocks), true);
  assert.equal(rules.canPost(activity, rows, "b", blocks), true);
  assert.equal(rules.canPost(activity, rows, "c", blocks), true);
  const pair = [
    { userId: "a", status: "confirmed" },
    { userId: "b", status: "confirmed" }
  ];
  assert.equal(rules.canPost(activity, pair, "a", blocks), false);
  assert.equal(rules.canPost(activity, pair, "b", blocks), false);
  assert.equal(rules.hiddenByBlock("b", "a", blocks), true);
  assert.equal(rules.hiddenByBlock("a", "b", blocks), true);
  assert.equal(rules.hiddenByBlock("c", "a", blocks), false);
});

test("someone who never joined cannot read a full activity", function () {
  const rows = [
    { userId: "a", status: "confirmed" },
    { userId: "b", status: "confirmed" }
  ];
  assert.equal(rules.canReadChat(activity, rows, "outsider"), false);
  assert.equal(rules.canPost(activity, rows, "outsider"), false);
});
