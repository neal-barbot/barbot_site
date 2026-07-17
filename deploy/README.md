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
Then in the browser at `https://MAIN_DOMAIN/admin/settings` → AI: enter the
DeepSeek key, `chip_compare_model`, and the image relay key. (CONFIG_ENCRYPTION_KEY
is already set, so these are stored encrypted.) Import the chip catalog CSV;
set signup credits / invite-code options.

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
- `agents.` is a single shared Harvey workspace, not per-user instances
  (that's the phase-2 gateway, not in scope here).
