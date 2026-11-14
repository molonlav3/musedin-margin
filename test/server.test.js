// Tests for the HTTP endpoint: GET /line serves one approved line.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer, createStore } = require("../src/server");

async function withServer(t, fn) {
  const server = createServer(createStore());
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  return fn(`http://localhost:${server.address().port}`);
}

test("GET /line returns the seeded approved line, labeled Sponsored", async (t) => {
  await withServer(t, async (base) => {
    const res = await fetch(`${base}/line`);
    assert.equal(res.status, 200);
    const line = await res.json();
    assert.equal(line.label, "Sponsored");
    assert.equal(line.reviewStatus, "approved");
    assert.ok(line.text && line.link && line.sponsor && line.slotId);
  });
});

test("GET /line is 404 when nothing is approved", async (t) => {
  const { Store } = require("../src/store");
  const server = createServer(new Store());
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const res = await fetch(`http://localhost:${server.address().port}/line`);
  assert.equal(res.status, 404);
});

test("submit then review then serve, over HTTP", async (t) => {
  await withServer(t, async (base) => {
    // Clear the seed by using a fresh store path: submit a second line, reject
    // the seed path is already approved, so instead verify the review flow on
    // a new line and that the endpoint still returns an approved line.
    const created = await (
      await fetch(`${base}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: "s9", text: "Second line", link: "https://example.com", sponsor: "Nine" }),
      })
    ).json();
    assert.equal(created.reviewStatus, "pending");
    const reviewed = await (
      await fetch(`${base}/lines/${created.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      })
    ).json();
    assert.equal(reviewed.reviewStatus, "approved");
    const line = await (await fetch(`${base}/line`)).json();
    assert.equal(line.label, "Sponsored");
    assert.equal(line.reviewStatus, "approved");
  });
});
