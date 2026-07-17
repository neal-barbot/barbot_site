# Barbot

**AI agents for the semiconductor industry.** Barbot is a multi-product platform
that turns the technical grind of chip work — cross-referencing, selection support,
knowledge lookup — into AI agents. One platform, one credit balance, every product.

Built for chip vendors and distributors: the buyers are FAE / sales / customer
engineers whose core job is selection support.

## Products

| Product | What it does |
|---------|-------------|
| **Chip P2P** | AI reads datasheets and finds pin-to-pin alternatives in minutes — parameter-level diffs with datasheet page-anchored provenance, a substitution verdict tag (pin2pin / functional / not-substitutable), editable reports, one-click blog publish. |
| **AI FAE** | A 24/7 AI Field Application Engineer for your website — answers technical questions and grounds substitution answers in the live chip catalog, captures leads, hands off to human support. |
| **EE Block Diagram** | Describe an electronic system, get a functional block diagram — exact-label structured SVG (downloadable vector) or a datasheet-style AI rendering. |
| **Harvey Agents** | The heavy-duty agent workbench — connect data sources and MCP tools, run long batch tasks (datasheet crawling, BOM matching), keep every session organized. |

All products share one account, one credit pool, and one billing model:
pay per use, with cache hits free.

## Architecture

Barbot is built on a headless SaaS engine (payments, credits, subscriptions,
auth, RBAC, i18n) with the chip-vendor product surface built on top. The platform
(control plane) runs the web app + billing; the Harvey agent workbench (execution
plane) runs the heavy agent workloads and plugs into the platform through a thin
token / usage / balance contract.

```
src/
├── core/           # Infrastructure (db, auth, payment, email, storage, ai, i18n)
├── modules/
│   ├── chips/           # chip catalog + shared agent tools
│   ├── chip-compare/    # datasheet compare pipeline, EE diagram engines
│   ├── ai-support/      # AI FAE chatbot + knowledge base
│   ├── agent-gateway/   # platform contract: tokens, usage, device login, membership
│   └── credits · rbac · payment · subscriptions · apikeys · ai-tasks
├── routes/         # File-based routes (pages + /api server routes)
│   ├── compare/ diagram/ chips/   # Chip P2P + EE diagram tools
│   └── api/agent/ api/auth/desktop/ api/internal/   # agent + membership contract
├── config/         # Environment, DB schema templates (sqlite/postgres/mysql)
└── components/ blocks/ lib/

sdk/barbot-agent-sdk.mjs   # zero-dependency client for external agent executors
deploy/                    # production docker-compose stack + runbook
```

## Quick Start (local dev)

```bash
pnpm install
cp .env.example .env.development   # set VITE_APP_URL, DATABASE_*, AUTH_SECRET
pnpm db:push
pnpm rbac:init --admin-email=admin@example.com --admin-password=your-password
pnpm dev                            # http://localhost:3000
```

Then at `/admin/settings` → AI: enter the DeepSeek API key and model; import a
chip catalog CSV at `/admin/chips`. `AGENTS.md` has the full developer guide.

## Deployment

Production deploy (VPS · PostgreSQL · Caddy auto-HTTPS · platform + Harvey) is
scripted in [`deploy/`](./deploy/) — see [deploy/README.md](./deploy/README.md)
for the full runbook.

## Tech Stack

- TanStack Start (Vite 8 + nitro, React 19, TypeScript strict), file-based routing
- TanStack Query / Form / Table; shadcn/ui v4 (Tailwind CSS 4)
- better-auth + Drizzle ORM (SQLite / PostgreSQL / MySQL)
- Paraglide JS for i18n (English + Chinese)
- LLM: DeepSeek (Anthropic- and OpenAI-compatible endpoints); gpt-image via relay
- All business logic self-contained — no external SaaS for payments/credits/auth

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server (port 3000) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production server |
| `pnpm agent:worker` | Agent-task worker (add `WORKER_LOOP=1` to run resident) |
| `pnpm db:setup / db:push / db:generate / db:migrate` | Schema tooling |
| `pnpm rbac:init / rbac:assign` | RBAC bootstrap + role assignment |

## License

Proprietary. See [LICENSE](./LICENSE).
