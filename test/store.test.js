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

test("a link is http or https, text is one line, and a bad edit changes nothing", () => {
  const store = new Store();
  const ok = { slotId: "s1", text: "t", link: "https://example.com", sponsor: "Acme" };
  assert.throws(() => store.submitLine({ ...ok, link: "javascript:alert(1)" }), /http or https/);
  assert.throws(() => store.submitLine({ ...ok, link: "not a url" }), /http or https/);
  assert.throws(() => store.submitLine({ ...ok, text: "one\ntwo" }), /one line/);
  assert.throws(() => store.submitLine({ ...ok, text: "x".repeat(281) }), /one line/);
  assert.throws(() => store.submitLine({ ...ok, sponsor: 7 }), /must be a string/);
  assert.equal(store.listLines().length, 0, "nothing refused was stored");
  const line = store.submitLine(ok);
  store.reviewLine(line.id, "approved");
  assert.throws(() => store.updateLine(line.id, { link: "data:text/html,x" }), /http or https/);
  assert.equal(store.getLine(line.id).link, "https://example.com");
  assert.equal(store.getLine(line.id).reviewStatus, "approved", "a refused edit leaves the line as it was");
});

test("missing fields fail at submit", () => {
  const store = new Store();
  assert.throws(() => store.submitLine({ slotId: "s1", text: "t" }), /required/);
});
