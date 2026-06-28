# Doc‑QA SaaS (MinerU + pi‑agent‑web + shipany) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `executing-plans` (or `subagent-driven-development`). Execute tasks in order; commit after each; run the Verify block before moving on.

**Goal:** Logged‑in shipany users upload documents, MinerU turns them into Markdown in the user's private workspace, and the pi‑agent‑web chat (read‑only file tools) answers questions / produces plans over those docs, metered by shipany credits.

**Architecture:** `shipany` is the only public surface (auth, free credits, billing, admin, ingest glue). A thin **gateway** validates the better‑auth session and proxies HTTP+WebSocket to ONE shared `pi‑agent‑web` server, scoping every request to the caller's own workspace (`u_<userId>`). The agent is **read‑only** (Read/Grep/Glob over the user's `.md` dir) — no code execution, no per‑user containers, no sandbox. A standalone **MinerU** Python service parses uploads → Markdown written into the user's workspace dir (shared volume). User files live in S3‑compatible storage; chat history lives in shipany's DB.

**Tech Stack:** TanStack Start + better‑auth + drizzle (shipany, Node 20); pi‑agent‑web (Node 20, lit, port 8504); Node `http`+`ws` gateway (port 8520); FastAPI MinerU service (Python 3.11, port 8530); S3‑compatible object storage; Postgres (shipany, **no pgvector**); Docker Compose.

## Global Constraints

- **No RAG / no chunking / no vector DB.** Retrieval = the agent's own `grep`/`find` over real `.md` files.
- **Agent tools are read‑only:** allowlist `Read, Grep, Glob, List`. No `Bash`, `Write`, `Edit`, network, or MCP. This also blocks prompt‑injection‑driven tool abuse.
- **pi‑agent‑web binds loopback only:** `PI_AGENT_WEB_HOST=127.0.0.1`, `PI_AGENT_WEB_PORT=8504`. Never exposed publicly; only the gateway reaches it.
- **Workspace id is derived, not user‑supplied:** `workspaceId = "u_" + userId`. The gateway rejects any path whose workspaceId ≠ the caller's own.
- **Shared paths:** user workspace dir `WORKSPACES_ROOT=/data/workspaces/u_<userId>/` is writable by the MinerU worker and readable by pi‑agent‑web (`PI_AGENT_WEB_DATA_DIR=/data/pi-agent-web`).
- **Storage layout:** bucket `doc-qa`, keys `raw/<userId>/<docId>/<filename>` and `md/<userId>/<docId>/<name>.md`.
- **Credits:** `CREDIT_COST_PER_PROMPT=1` (env). `grantForNewUser` already issues the free quota on signup; the gateway pre‑checks balance and `consume`s after a successful prompt.
- **Internal auth:** gateway ↔ shipany internal calls carry header `x-internal-token: $INTERNAL_API_TOKEN`.
- **LLM:** provider base URL via env (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`); key lives only in pi‑agent‑web's process, never sent to the browser.

---

## Milestone map

- **M1 — Vertical slice (this plan, full detail):** one user can upload a PDF → MinerU → md in their workspace → open the gated chat → ask → streamed answer that greps their md → 1 credit consumed.
- **M2 — Productization:** multi‑doc & multi‑knowledge‑base, ingest status UI, history in shipany DB, citation/source attribution, delete/re‑index.
- **M3 — Hardening:** rate limits, storage quotas per tier, MinerU queue + retries + caching, observability, abuse controls, billing top‑up flow.
- **M4 — Scale & polish:** horizontal gateway/agent replicas, workspace sync from object storage (drop shared volume), optional ripgrep/embedding index for very large corpora, "出方案" templates.

> M2–M4 are outlined at the end; expand each into its own writing‑plans document when reached.

---

# M1 — Vertical slice (detailed tasks)

## Task 1.1 — Config & env surface

**Files**
- Modify: `shipany-tanstack/.env.example`
- Modify: `shipany-tanstack/src/config/index.ts` (envConfigs)
- Create: `infra/.env.docqa.example`

**Interfaces**
- Provides: `envConfigs.workspaces_root`, `envConfigs.pi_agent_web_url`, `envConfigs.internal_api_token`, `envConfigs.mineru_url`, `envConfigs.credit_cost_per_prompt`, `envConfigs.storage_bucket`.

**Steps**
- [ ] Add to `.env.example`:
  ```dotenv
  # Doc-QA
  WORKSPACES_ROOT=/data/workspaces
  PI_AGENT_WEB_URL=http://127.0.0.1:8504
  GATEWAY_PORT=8520
  MINERU_URL=http://127.0.0.1:8530
  INTERNAL_API_TOKEN=change-me-long-random
  CREDIT_COST_PER_PROMPT=1
  STORAGE_BUCKET=doc-qa
  LLM_BASE_URL=
  LLM_API_KEY=
  LLM_MODEL=
  ```
- [ ] Extend `envConfigs` in `src/config/index.ts` to read those keys (mirror the existing `pi_agent_*` entries already present in `src/lib/pi-agent.ts`).
- [ ] Copy the same vars into `infra/.env.docqa.example` for compose.

**Verify**
```bash
cd shipany-tanstack && node -e "import('./src/config/index.ts').then(m=>console.log(typeof m.envConfigs.workspaces_root))"
# expected: string
```
**Commit:** `chore(docqa): add config surface for doc-qa services`

---

## Task 1.2 — Workspace provisioning helper (shipany)

**Files**
- Create: `shipany-tanstack/src/modules/docqa/workspace.ts`
- Create: `shipany-tanstack/src/modules/docqa/workspace.test.ts`

**Interfaces**
- Provides: `workspaceIdFor(userId): string` → `"u_"+userId`; `ensureWorkspaceDir(userId): Promise<string>` (creates `${WORKSPACES_ROOT}/u_<userId>/docs`, returns abs path); `assertOwnedWorkspace(userId, workspaceId): void` (throws if mismatch).
- Consumed by: Task 1.3 (ingest), Task 1.5 (gateway scoping), Task 1.6 (project registration).

**Steps**
- [ ] Implement (immutable, no mutation of inputs):
  ```ts
  import { mkdir } from 'node:fs/promises';
  import path from 'node:path';
  import { envConfigs } from '@/config';

  export function workspaceIdFor(userId: string): string {
    if (!userId) throw new Error('userId required');
    return `u_${userId}`;
  }
  export function workspaceDir(userId: string): string {
    return path.join(envConfigs.workspaces_root, workspaceIdFor(userId));
  }
  export async function ensureWorkspaceDir(userId: string): Promise<string> {
    const docs = path.join(workspaceDir(userId), 'docs');
    await mkdir(docs, { recursive: true });
    return docs;
  }
  export function assertOwnedWorkspace(userId: string, workspaceId: string): void {
    if (workspaceId !== workspaceIdFor(userId)) {
      throw new Error('workspace not owned by user');
    }
  }
  ```
- [ ] Test: `workspaceIdFor('abc')==='u_abc'`; `assertOwnedWorkspace('abc','u_xyz')` throws; `ensureWorkspaceDir` creates the dir (use a tmp `WORKSPACES_ROOT`).

**Verify**
```bash
cd shipany-tanstack && npx vitest run src/modules/docqa/workspace.test.ts
# expected: passing
```
**Commit:** `feat(docqa): workspace provisioning + ownership guard`

---

## Task 1.3 — MinerU Python service

**Files**
- Create: `services/mineru/app.py`
- Create: `services/mineru/requirements.txt`
- Create: `services/mineru/Dockerfile`

**Interfaces**
- Provides: `POST /parse` (multipart `file`) → `200 {"markdown": "<md>", "assets": []}`; `GET /health` → `{"status":"ok"}`.
- Consumed by: Task 1.4.

**Steps**
- [ ] `requirements.txt`: `fastapi`, `uvicorn[standard]`, `python-multipart`, `magic-pdf` (MinerU).
- [ ] `app.py`:
  ```python
  import tempfile, os
  from fastapi import FastAPI, UploadFile, File, HTTPException
  from magic_pdf.pipe.UNIPipe import UNIPipe   # MinerU entry; adjust to installed API
  from magic_pdf.rw.DiskReaderWriter import DiskReaderWriter

  app = FastAPI()

  @app.get("/health")
  def health(): return {"status": "ok"}

  @app.post("/parse")
  async def parse(file: UploadFile = File(...)):
      data = await file.read()
      if not data: raise HTTPException(400, "empty file")
      with tempfile.TemporaryDirectory() as d:
          rw = DiskReaderWriter(d)
          pipe = UNIPipe(data, {"_pdf_type": "", "model_list": []}, rw)
          pipe.pipe_classify(); pipe.pipe_analyze(); pipe.pipe_parse()
          md = pipe.pipe_mk_markdown(d, drop_mode="none")
      return {"markdown": md, "assets": []}
  ```
  > NOTE: MinerU's exact pipeline API varies by version. Pin the version in `requirements.txt`; if the installed API differs, adapt the three `pipe_*` calls — keep the `POST /parse → {markdown}` contract fixed.
- [ ] `Dockerfile`: python:3.11-slim, install reqs, `CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8530"]`.

**Verify**
```bash
cd services/mineru && docker build -t mineru . && docker run -d -p 8530:8530 --name mineru mineru
curl -s localhost:8530/health   # expected: {"status":"ok"}
curl -s -F file=@sample.pdf localhost:8530/parse | head -c 200   # expected: JSON with "markdown"
```
**Commit:** `feat(mineru): FastAPI /parse service wrapping MinerU`

---

## Task 1.4 — Ingest route (shipany): upload → store → MinerU → md into workspace

**Files**
- Create: `shipany-tanstack/src/routes/api/docqa/ingest.ts`
- Create: `shipany-tanstack/src/modules/docqa/ingest.ts`
- Create: `shipany-tanstack/src/modules/docqa/storage.ts` (thin wrapper over existing aws4fetch usage in `src/routes/api/storage/upload-image.ts`)

**Interfaces**
- Provides: `POST /api/docqa/ingest` (multipart `file`) → `{ docId, mdKey, mdPath }`.
- Consumes: `ensureWorkspaceDir` (1.2), MinerU `/parse` (1.3), storage wrapper.

**Steps**
- [ ] `storage.ts`: `putObject(key, bytes, contentType)` and `getSignedUrl(key)` reusing the bucket creds/pattern already in `api/storage/upload-image.ts`.
- [ ] `ingest.ts` (`ingestDocument({ userId, file })`):
  1. `docId = nanoid()`.
  2. `putObject('raw/'+userId+'/'+docId+'/'+file.name, bytes)`.
  3. POST the bytes to `${MINERU_URL}/parse` (multipart) → `markdown`.
  4. `putObject('md/'+userId+'/'+docId+'/'+base+'.md', markdown, 'text/markdown')`.
  5. Write the md to the workspace: `writeFile(path.join(await ensureWorkspaceDir(userId), `${docId}-${base}.md`), markdown)`.
  6. Return `{ docId, mdKey, mdPath }`. Wrap all I/O in try/catch with descriptive `Error`.
- [ ] `ingest.ts` route handler: get session (`getAuth().api.getSession`), 401 if none; parse multipart; call `ingestDocument`; `respData(...)`. Follow the existing `createFileRoute('/api/...').methods({ POST })` + `respData/respErr` pattern from `src/routes/api/wiki/ask.ts`.

**Verify**
```bash
# with shipany dev running and a logged-in cookie in $COOKIE
curl -s -b "$COOKIE" -F file=@sample.pdf http://localhost:3000/api/docqa/ingest
# expected: {"data":{"docId":"...","mdKey":"md/.../x.md","mdPath":"/data/workspaces/u_.../docs/...md"}}
ls /data/workspaces/u_*/docs/   # expected: the new .md file present
```
**Commit:** `feat(docqa): ingest route (upload -> MinerU -> md in workspace)`

---

## Task 1.5 — Auth‑scoping HTTP+WS gateway

**Files**
- Create: `shipany-tanstack/gateway/server.mjs`
- Create: `shipany-tanstack/gateway/package.json` (deps: `http-proxy`)
- Create: `shipany-tanstack/src/routes/api/internal/session.ts` (resolve cookie → userId for the gateway)

**Interfaces**
- Provides: public `:8520` proxy. `GET /api/internal/session` (header `x-internal-token`) → `{ userId }` or 401.
- Consumes: pi‑agent‑web `:8504`; `assertOwnedWorkspace` semantics (enforced inline via regex).

**Steps**
- [ ] `internal/session.ts`: validate `x-internal-token === INTERNAL_API_TOKEN`, then `getAuth().api.getSession({ headers })`; return `{ userId: session.user.id }` or `respErr('Unauthorized')`.
- [ ] `gateway/server.mjs`:
  ```js
  import http from 'node:http';
  import httpProxy from 'http-proxy';
  const PI = process.env.PI_AGENT_WEB_URL;          // http://127.0.0.1:8504
  const SHIPANY = process.env.SHIPANY_URL;          // http://127.0.0.1:3000
  const TOKEN = process.env.INTERNAL_API_TOKEN;
  const proxy = httpProxy.createProxyServer({ target: PI, ws: true });

  async function resolveUser(req) {
    const r = await fetch(`${SHIPANY}/api/internal/session`, {
      headers: { cookie: req.headers.cookie ?? '', 'x-internal-token': TOKEN },
    });
    if (!r.ok) return null;
    const j = await r.json(); return j?.data?.userId ?? null;
  }
  function ownsPath(userId, url) {
    const m = url.match(/^\/agent\/api\/workspaces\/([^/]+)\//);
    return m ? m[1] === `u_${userId}` : true; // non-workspace paths (assets) allowed
  }
  function strip(url){ return url.replace(/^\/agent/, '') || '/'; }

  const server = http.createServer(async (req, res) => {
    const userId = await resolveUser(req);
    if (!userId) { res.writeHead(401).end('unauthorized'); return; }
    if (!ownsPath(userId, req.url)) { res.writeHead(403).end('forbidden'); return; }
    req.url = strip(req.url);
    proxy.web(req, res, {}, () => { res.writeHead(502).end('bad gateway'); });
  });
  server.on('upgrade', async (req, socket, head) => {
    const userId = await resolveUser(req);
    if (!userId || !ownsPath(userId, req.url)) { socket.destroy(); return; }
    req.url = strip(req.url);
    proxy.ws(req, socket, head);
  });
  server.listen(Number(process.env.GATEWAY_PORT || 8520));
  ```
  > pi‑agent‑web's WS is **one‑way server→client**; `http-proxy`'s `ws:true` forwards the upgrade and frames transparently — no custom frame handling needed.

**Verify**
```bash
# pi-agent-web on :8504, shipany on :3000, gateway on :8520
curl -s -b "$COOKIE" http://localhost:8520/agent/api/workspaces/u_OTHER/sessions/x/history -o /dev/null -w "%{http_code}\n"
# expected: 403  (cannot reach another user's workspace)
curl -s -b "$COOKIE" http://localhost:8520/agent/api/workspaces/u_<me>/sessions/x/history -o /dev/null -w "%{http_code}\n"
# expected: 200 or 404 from pi-agent-web (reached upstream), NOT 401/403
```
**Commit:** `feat(docqa): auth-scoping HTTP+WS gateway to pi-agent-web`

---

## Task 1.6 — Register the user's workspace as a pi‑agent‑web project (read‑only)

**Files**
- Create: `shipany-tanstack/src/modules/docqa/agent-project.ts`
- Modify: pi‑agent‑web `apps/pi-agent-web/src/sessiond/pi-runtime.ts` (restrict toolset)

**Interfaces**
- Provides: `ensureAgentProject(userId): Promise<{ workspaceId }>` — idempotently POSTs to pi‑agent‑web's project API so `workspaceId=u_<userId>` points at `${WORKSPACES_ROOT}/u_<userId>/docs`.
- Guarantees: agent runs with read‑only tools only.

**Steps**
- [ ] Inspect pi‑agent‑web project routes (`src/server/routes/projects.ts`) for the create‑project payload; implement `ensureAgentProject` to call it via the gateway/loopback with `id=u_<userId>`, `root=<docs dir>`.
- [ ] In `pi-runtime.ts`, filter the agent's tools to the allowlist before the session runs:
  ```ts
  const READONLY = new Set(['Read', 'Grep', 'Glob', 'List']);
  const tools = allTools.filter(t => READONLY.has(t.name));
  agentSession.tools = tools;   // uses `set tools(AgentTool[])` (packages/agent/src/types.ts)
  ```
  Confirm the exact injection point in `pi-runtime.ts` where the session/agent is constructed; apply the filter there.
- [ ] Call `ensureAgentProject(userId)` at the end of Task 1.4 ingest (after first md write) and on first chat open.

**Verify**
```bash
# after ingest, list projects via gateway
curl -s -b "$COOKIE" http://localhost:8520/agent/api/projects | grep -o "u_<me>"   # expected: present
# prompt-injection guard: a prompt asking the agent to run a shell command returns a refusal / no Bash tool available
```
**Commit:** `feat(docqa): register read-only agent project per user workspace`

---

## Task 1.7 — Credits metering around prompts

**Files**
- Create: `shipany-tanstack/src/routes/api/internal/credits.ts`
- Modify: `shipany-tanstack/gateway/server.mjs`

**Interfaces**
- Provides: `POST /api/internal/credits/check` `{userId}`→`{ok:boolean,balance}`; `POST /api/internal/credits/consume` `{userId,amount,scene}`→`{ok}` (wrap `getBalance`/`consume` from `@/modules/credits/service`). Both require `x-internal-token`.
- Behavior: gateway intercepts `POST /agent/api/workspaces/.../prompt` → pre‑check balance; 402 if `<=0`; on upstream 2xx, `consume(CREDIT_COST_PER_PROMPT)`.

**Steps**
- [ ] Implement `internal/credits.ts` using existing `getBalance` / `consume`.
- [ ] In the gateway request handler, before `proxy.web`, if `req.method==='POST'` and `/\/sessions\/[^/]+\/prompt$/.test(url)`: call `/check`; if not ok → `res.writeHead(402).end('insufficient credits')`. Hook `proxyRes` to `consume` only when `statusCode<300`.

**Verify**
```bash
# zero out the test user's credits via admin, then:
curl -s -b "$COOKIE" -XPOST -H 'content-type: application/json' \
  -d '{"prompt":"hi"}' http://localhost:8520/agent/api/workspaces/u_<me>/sessions/<sid>/prompt \
  -o /dev/null -w "%{http_code}\n"     # expected: 402
# grant credits, repeat -> 200, and balance decremented by 1
```
**Commit:** `feat(docqa): meter prompts against shipany credits at the gateway`

---

## Task 1.8 — Wire the chat UI behind shipany login

**Files**
- Create: `shipany-tanstack/src/routes/(app)/chat.tsx`
- Modify: pi‑agent‑web client base URL config (build the client to call `/agent` via the gateway origin)

**Interfaces**
- Provides: authenticated route `/chat` that loads the pi‑agent‑web client pointed at the gateway (`apiBaseUrl=https://<gateway-origin>/agent`), workspace `u_<userId>`.

**Steps**
- [ ] Build pi‑agent‑web client with `apiBaseUrl` → gateway `/agent` (set via its `apiBaseUrl` constructor arg in `remote-session.ts` / app bootstrap). Serve the static client from shipany `public/agent/` or a CDN.
- [ ] `chat.tsx`: require session (redirect to login if none); read `userId`; mount the agent client iframe/element with `workspaceId=u_<userId>`.
- [ ] Confirm `PI_AGENT_WEB_ALLOWED_ORIGINS` includes the gateway origin so WS/CORS pass.

**Verify (end‑to‑end)**
```bash
docker compose -f infra/docker-compose.yml up -d
# 1) register a user in shipany (free credits granted)
# 2) upload sample.pdf at /chat -> ingest 200, md appears in workspace
# 3) ask "总结这份文档的核心结论" -> streamed answer over WS, grounded in the md
# 4) shipany credits balance decremented by CREDIT_COST_PER_PROMPT
```
**Commit:** `feat(docqa): authenticated chat route wired to gated pi-agent-web`

---

## Task 1.9 — One‑command compose

**Files**
- Create: `infra/docker-compose.yml`

**Steps**
- [ ] Services: `caddy` (TLS, proxies `/`→shipany:3000, `/agent`→gateway:8520), `shipany`, `gateway`, `pi-agent-web` (loopback, shared `/data` volume), `mineru`, `postgres`. Shared named volume `/data` mounted in `mineru` (write) and `pi-agent-web` (read).
- [ ] `.env` from `infra/.env.docqa.example`.

**Verify**
```bash
docker compose -f infra/docker-compose.yml config >/dev/null   # expected: valid
docker compose -f infra/docker-compose.yml up -d && docker compose ps   # expected: all healthy
```
**Commit:** `chore(docqa): docker-compose for the full M1 stack`

---

## M1 Self‑review checklist (run before handoff)

- [ ] No `TBD`/`TODO`/placeholder values remain (the two `NOTE`s in 1.3/1.6 are version‑adaptation points, not placeholders — both keep a fixed contract).
- [ ] Types/interfaces consistent across tasks (`workspaceIdFor`, `/api/internal/*` shapes, gateway path scheme).
- [ ] Read‑only tool allowlist enforced (Task 1.6) — no Write/Bash reachable.
- [ ] Gateway rejects cross‑workspace access (Task 1.5 verify: 403).
- [ ] Credits consumed exactly once per successful prompt (Task 1.7).
- [ ] LLM key never reaches the browser (only in pi‑agent‑web process).

---

# M2–M4 (milestone outlines — expand with writing-plans when reached)

**M2 — Productization**
- Multi‑doc & named knowledge bases (workspace subfolders per KB); doc list + ingest‑status UI; delete/re‑ingest.
- Persist chat history in shipany DB (conversations/messages tables) and rehydrate per session.
- Source attribution: post‑process agent answers to cite `file:line` from the grep hits.

**M3 — Hardening**
- Per‑tier storage quota + per‑file size cap; rate limits on ingest & prompt; MinerU job queue (e.g. BullMQ/Redis) with retries + result cache keyed by file hash.
- Observability (request logs, agent token/credit metrics), abuse controls, billing top‑up + low‑balance UX.

**M4 — Scale & polish**
- Horizontal gateway + pi‑agent‑web replicas; move workspace from shared volume to on‑demand sync from object storage (stateless workers).
- Optional ripgrep prebuilt index / embedding index as an *acceleration tool* for very large corpora (still agentic grep, not chunk‑RAG).
- "出方案" templates; team sharing of knowledge bases (reuse ChromaFs‑style per‑user tree pruning for visibility).

---

## Risks / open verification points

1. **MinerU pipeline API** (Task 1.3) differs across versions — pin the version, keep the `POST /parse → {markdown}` contract.
2. **pi‑agent‑web tool‑injection point** (Task 1.6) — confirm the exact line in `pi-runtime.ts` where the session is built before applying the read‑only filter.
3. **pi‑agent‑web project create payload** (Task 1.6) — read `src/server/routes/projects.ts` to match field names (`id`, `root`).
4. **better‑auth cookie name** in `/api/internal/session` — handle both `better-auth.session_token` and `__Secure-` prefix (see existing `api/auth/token.ts`).
