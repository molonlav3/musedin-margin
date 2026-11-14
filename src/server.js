// Margin first version: HTTP endpoint that returns one approved sponsored line.
// Stdlib only. Run: node src/server.js (PORT env, default 3000).
// Seeded with one approved demo line so the curl demo in the README works.
"use strict";

const http = require("node:http");
const { timingSafeEqual } = require("node:crypto");
const { Store } = require("./store");

// A request body is one small JSON object.
const MAX_BODY = 16 * 1024;

function createStore() {
  const store = new Store();
  const demo = store.submitLine({
    slotId: "slot-demo",
    text: "Ship APIs your agents will actually read about.",
    link: "https://musedin.com/project/margin",
    sponsor: "Margin",
  });
  store.reviewLine(demo.id, "approved");
  return store;
}

// Over MAX_BODY bytes: refused with 413 and not kept.
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    let over = false;
    req.on("data", (chunk) => {
      if (over) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        over = true;
        data = "";
        const err = new Error(`body is over ${MAX_BODY} bytes`);
        err.status = 413;
        return reject(err);
      }
      data += chunk;
    });
    req.on("end", () => {
      if (over) return;
      if (!data) return resolve({});
      try {
        const body = JSON.parse(data);
        resolve(body && typeof body === "object" && !Array.isArray(body) ? body : {});
      } catch {
        reject(new Error("body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// The reviewer's token, compared in constant time.
function isReviewer(req, token) {
  const m = /^Bearer (.+)$/.exec(String(req.headers.authorization || ""));
  if (!m) return false;
  const sent = Buffer.from(m[1]);
  const want = Buffer.from(token);
  return sent.length === want.length && timingSafeEqual(sent, want);
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

// reviewToken: what POST /lines/:id/review must carry (MARGIN_REVIEW_TOKEN); "" turns review over HTTP off.
function createServer(store = createStore(), { reviewToken = process.env.MARGIN_REVIEW_TOKEN || "" } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/line") {
        const line = store.getApprovedLine();
        if (!line) return send(res, 404, { error: "no approved line" });
        return send(res, 200, line);
      }
      if (req.method === "POST" && url.pathname === "/lines") {
        const line = store.submitLine(await readBody(req));
        return send(res, 201, line);
      }
      if (req.method === "POST" && /^\/lines\/[^/]+\/review$/.test(url.pathname)) {
        // A reviewer checks every line before it runs (SPEC.md, review flow): without
        // the reviewer's token anyone who reaches the server could approve their own line.
        if (!reviewToken) return send(res, 403, { error: "review is off: start the server with MARGIN_REVIEW_TOKEN set" });
        if (!isReviewer(req, reviewToken)) return send(res, 401, { error: "review needs the reviewer's token: Authorization: Bearer <token>" });
        const id = url.pathname.split("/")[2];
        const { status, reason } = await readBody(req);
        return send(res, 200, store.reviewLine(id, status, reason));
      }
      if (req.method === "GET" && url.pathname === "/lines") {
        return send(res, 200, store.listLines(url.searchParams.get("status")));
      }
      return send(res, 404, { error: "not found" });
    } catch (err) {
      // An oversized body: answer, then drop the connection instead of reading the rest.
      if (err.status === 413) res.once("finish", () => req.destroy());
      return send(res, err.status || 400, { error: err.message });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`Margin listening on http://localhost:${port} (GET /line)`);
  });
}

module.exports = { createServer, createStore, MAX_BODY };
