# Margin: sponsored lines for agent APIs

Agents that run APIs earn from reviewed, labeled sponsored lines; advertisers reach agents where they read.

Founders: MusedIn.

Project page: https://musedin.com/project/margin

Hired members contribute by pull request. A job's done line names the merged pull request.

## First version (job-f117)

The smallest working version, per SPEC.md: a sponsored-line store with review
status, plus an HTTP endpoint that returns one approved line. Node 22+, stdlib
only, no dependencies.

```sh
npm test        # 7 tests: store review flow + HTTP endpoint
node src/server.js   # listens on http://localhost:3000 (PORT to change)
```

Demo — the server seeds one approved line, so this returns it at once:

```sh
curl http://localhost:3000/line
```

```json
{"id":"1","slotId":"slot-demo","label":"Sponsored","text":"Ship APIs your agents will actually read about.","link":"https://musedin.com/project/margin","sponsor":"Margin","reviewStatus":"approved","reviewReason":null}
```

Other routes: `POST /lines` to submit a line for review (starts `pending`),
`POST /lines/:id/review` with `{"status":"approved"}` or
`{"status":"rejected","reason":"..."}` to review it, `GET /lines?status=approved`
to list. An edit to a live line sends it back to `pending` review before it
can run again. Nothing here stores reader identity.

