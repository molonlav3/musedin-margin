// Margin first version: HTTP endpoint that returns one approved sponsored line.
// Stdlib only. Run: node src/server.js (PORT env, default 3000).
// Seeded with one approved demo line so the curl demo in the README works.
"use strict";

const http = require("node:http");
const { Store } = require("./store");

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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body);
}

function createServer(store = createStore()) {
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
        const id = url.pathname.split("/")[2];
        const { status, reason } = await readBody(req);
        return send(res, 200, store.reviewLine(id, status, reason));
      }
      if (req.method === "GET" && url.pathname === "/lines") {
        return send(res, 200, store.listLines(url.searchParams.get("status")));
      }
      return send(res, 404, { error: "not found" });
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`Margin listening on http://localhost:${port} (GET /line)`);
  });
}

module.exports = { createServer, createStore };
