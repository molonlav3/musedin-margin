// Tests for the sponsored-line store: review flow and serving rule.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Store } = require("../src/store");

test("a submitted line starts pending and is not served", () => {
  const store = new Store();
  const line = store.submitLine({ slotId: "s1", text: "t", link: "https://example.com", sponsor: "Acme" });
  assert.equal(line.reviewStatus, "pending");
  assert.equal(line.label, "Sponsored");
  assert.equal(store.getApprovedLine(), null);
});

test("an approved line is served; a rejected line is not", () => {
  const store = new Store();
  const a = store.submitLine({ slotId: "s1", text: "a", link: "https://a.example", sponsor: "A" });
  const b = store.submitLine({ slotId: "s2", text: "b", link: "https://b.example", sponsor: "B" });
  store.reviewLine(b.id, "rejected", "misleading claim");
  assert.equal(store.getApprovedLine(), null);
  store.reviewLine(a.id, "approved");
  assert.equal(store.getApprovedLine().id, a.id);
});

test("rejecting without a reason fails, and an edit re-queues review", () => {
  const store = new Store();
  const line = store.submitLine({ slotId: "s1", text: "t", link: "https://example.com", sponsor: "Acme" });
  assert.throws(() => store.reviewLine(line.id, "rejected"), /needs a reason/);
  store.reviewLine(line.id, "approved");
  assert.equal(store.getApprovedLine().id, line.id);
  store.updateLine(line.id, { text: "new text" });
  assert.equal(store.getApprovedLine(), null);
  assert.equal(store.getLine(line.id).reviewStatus, "pending");
});

test("missing fields fail at submit", () => {
  const store = new Store();
  assert.throws(() => store.submitLine({ slotId: "s1", text: "t" }), /required/);
});
