# Barbot Production Deployment Runbook

Overseas VPS · PostgreSQL · Caddy auto-HTTPS · shipany platform + Harvey agent workbench.

## Topology

```
caddy   :80/:443   MAIN_DOMAIN → shipany:3000 ; AGENTS_DOMAIN → harvey:9100 (WS)
shipany :3000      nitro server (internal)
worker             resident agent-task worker (WORKER_LOOP=1)
migrate            one-shot: applies migrations then exits
harvey  :9100      craft-agents server (pre-built image, --allow-insecure-bind)
postgres:5432      internal only
```
Only 80/443 are exposed. Firewall everything else.

## Before you start — read this

- **Two images, two build paths.** shipany builds *inside* compose (`up --build`).
  Harvey builds *on your laptop* and ships as a tar — its webui build needs ~4 GB
  of build RAM, which a small VPS may not have. Don't try to build Harvey on the VPS.
- **VPS sizing.** 4 vCPU / 8 GB is comfortable for the whole stack. The LLM work
  is all remote (DeepSeek), so CPU is mostly idle; RAM is the constraint (postgres +
  node server + worker + Harvey ≈ 2–3 GB steady). Give it ≥ 40 GB disk (images are fat).
- **Secrets are permanent-ish.** `AUTH_SECRET` and `AGENT_JWT_SECRET` invalidate all
  existing sessions / agent tokens if rotated. `CONFIG_ENCRYPTION_KEY` **must be set
  before** you enter any admin key — rotating it later orphans every encrypted value.
  Generate all four once, back them up, don't change them.
- **Harvey membership login.** The "Membership account" button in Harvey talks to
  `VITE_BARBOT_SERVER_URL` (baked into the Harvey image in step 1) → set it to your
  real `https://MAIN_DOMAIN`. Password login (`CRAFT_SERVER_TOKEN`) works regardless.
- **China access.** This is an overseas VPS. DeepSeek is reachable from overseas, but
  mainland visitors will see latency — evaluate a CDN / relay later if it matters.

## 1. Build the Harvey image locally (needs ~4 GB build RAM) and ship it

```bash
cd /path/to/craft-agents-oss
git add -A && git commit -m "barbot customizations"     # logo, Dockerfile fixes, etc.
docker build -f Dockerfile.server \
  --build-arg VITE_BARBOT_SERVER_URL=https://barbot.example.com \
  -t barbot/harvey-server:prod .
docker save barbot/harvey-server:prod | gzip > harvey.tar.gz
scp harvey.tar.gz user@vps:/opt/barbot/
```

## 2. Ship the shipany repo

```bash
# on the VPS
ssh user@vps
sudo mkdir -p /opt/barbot && sudo chown $USER /opt/barbot
# from local: rsync the branch (or git clone it)
rsync -az --exclude node_modules --exclude .output --exclude data \
  /path/to/shipany-tanstack/ user@vps:/opt/barbot/app/
```

## 3. Configure

```bash
cd /opt/barbot/app
gunzip -c ../harvey.tar.gz | docker load

cp deploy/.env.prod.example deploy/.env.prod
# generate secrets:
for k in AUTH_SECRET INTERNAL_API_TOKEN AGENT_JWT_SECRET CONFIG_ENCRYPTION_KEY; do
  echo "$k=$(openssl rand -base64 32)"
done
echo "CRAFT_SERVER_TOKEN=$(openssl rand -hex 24)"
# paste into deploy/.env.prod, set the two domains + a strong POSTGRES_PASSWORD
# (keep DATABASE_URL's password identical to POSTGRES_PASSWORD)
```

## 4. Bring it up

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
# `migrate` runs first (applies drizzle migrations), then shipany + worker start.
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps
```

## 5. Seed the platform

```bash
C="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod"
$C exec worker pnpm rbac:init                    # roles + permissions
# register an admin account in the browser first, then:
$C exec worker pnpm rbac:assign --email=you@example.com --role=admin
```
Then in the browser:

1. `https://MAIN_DOMAIN/admin/settings` → **AI** tab: enter the DeepSeek key
   (`openai_api_key`), `openai_base_url` = `https://api.deepseek.com`,
   `chip_compare_model` (e.g. `deepseek-v4-flash`), and the image relay key
   (`image_api_*`). CONFIG_ENCRYPTION_KEY is already set → these store encrypted.
   Config has a 1-hour cache; if a change doesn't take effect, `$C restart shipany worker`.
2. `https://MAIN_DOMAIN/admin/settings` → **General** tab: set signup credits,
   the per-scene costs (`chip_compare_cost_credits`, `ai_fae_cost_credits`,
   `ee_diagram_*`), and invite-code options.
3. `https://MAIN_DOMAIN/admin/chips`: upload the chip catalog CSV
   (columns: partNumber, manufacturer, description, parameter, sheetUrl —
   upsert is by partNumber+manufacturer). Without a catalog, `/compare`'s
   "add from catalog" and the FAE substitution answers have nothing to match.

## 6. DNS + TLS

Point `A` records for MAIN_DOMAIN and AGENTS_DOMAIN at the VPS IP. Caddy
obtains certificates automatically on first request.

## Ops

```bash
# logs
$C logs -f shipany worker
# backup
$C exec postgres pg_dump -U barbot barbot | gzip > backup-$(date +%F).sql.gz
# restart everything (all state persists in volumes)
$C restart
# update the app: rsync new code, then
$C up -d --build
```

## Known limitations

- device/exchange-code login state is in-memory; a restart drops pending
  logins (users just retry).
- `agents.` runs **one shared Harvey process** with **per-membership
  directory isolation** (`~/.craft-agent/tenants/u_<userId>/`) when
  `CRAFT_MULTI_TENANT=1`. Each user gets a fixed workspace id `u_<userId>`,
  a 1 GiB local quota (`CRAFT_TENANT_QUOTA_BYTES`), and idle purge after
  `CRAFT_TENANT_IDLE_TTL_HOURS` (default 24). WebUI skips the server-token
  gate (`CRAFT_WEBUI_MEMBERSHIP_GATE`, default on with multi-tenant) and uses
  membership login instead. This is not per-user containers; that remains a
  future scale-out option.
