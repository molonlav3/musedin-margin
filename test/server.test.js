// Tests for the HTTP endpoint: GET /line serves one approved line.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer, createStore, MAX_BODY } = require("../src/server");

const TOKEN = "test-reviewer-token";
const JSON_HEADERS = { "Content-Type": "application/json" };

async function withServer(t, fn) {
  const server = createServer(createStore(), { reviewToken: TOKEN });
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ status: "approved" }),
      })
    ).json();
    assert.equal(reviewed.reviewStatus, "approved");
    const line = await (await fetch(`${base}/line`)).json();
    assert.equal(line.label, "Sponsored");
    assert.equal(line.reviewStatus, "approved");
  });
});

test("a review needs the reviewer's token; with none set, review over HTTP is off", async (t) => {
  await withServer(t, async (base) => {
    const created = await (
      await fetch(`${base}/lines`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ slotId: "s9", text: "Second line", link: "https://example.com", sponsor: "Nine" }) })
    ).json();
    const review = (headers) => fetch(`${base}/lines/${created.id}/review`, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify({ status: "approved" }) });
    assert.equal((await review({})).status, 401);
    assert.equal((await review({ Authorization: "Bearer wrong-token" })).status, 401);
    const pending = await (await fetch(`${base}/lines?status=pending`)).json();
    assert.equal(pending.length, 1, "the line is still pending");
    assert.equal((await review({ Authorization: `Bearer ${TOKEN}` })).status, 200);
  });
  const server = createServer(createStore(), { reviewToken: "" });
  await new Promise((r) => server.listen(0, r));
  t.after(() => new Promise((r) => server.close(r)));
  const res = await fetch(`http://localhost:${server.address().port}/lines/1/review`, { method: "POST", headers: { ...JSON_HEADERS, Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ status: "rejected", reason: "x" }) });
  assert.equal(res.status, 403);
  const seed = await (await fetch(`http://localhost:${server.address().port}/line`)).json();
  assert.equal(seed.reviewStatus, "approved", "the refused review changed nothing");
});

test("a body over the limit is refused, and so is a link that is not http or https", async (t) => {
  await withServer(t, async (base) => {
    const big = await fetch(`${base}/lines`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ slotId: "s1", text: "x".repeat(MAX_BODY), link: "https://example.com", sponsor: "Big" }) });
    assert.equal(big.status, 413);
    const bad = await fetch(`${base}/lines`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ slotId: "s1", text: "t", link: "javascript:alert(1)", sponsor: "Bad" }) });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /http or https/);
    const all = await (await fetch(`${base}/lines`)).json();
    assert.equal(all.length, 1, "only the seeded line is stored");
  });
});
