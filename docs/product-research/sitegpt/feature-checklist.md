# AI Support Feature Checklist

Source of truth: `docs/product-research/sitegpt/prd-v1.md`, sections 8 and 10.
Status reflects current code and verification, not planned intent.

| Priority | Feature | Status | Evidence / gap |
| --- | --- | --- | --- |
| P0 | Login and workspace | Implemented | Better Auth settings shell and chatbot routes. |
| P0 | Create and manage chatbots | Implemented | `ai_chatbot` service, API, workspace routes. |
| P0 | Widget installation | Implemented | JS embed, installation check, public widget API. |
| P0 | FAQ, text, URL and file knowledge | Implemented | Custom responses, snippets, URL providers, upload routes. |
| P0 | Grounded chat with citations | Implemented | Retrieval policy and public Widget message flow. |
| P0 | Chat history, lead collection and escalation | Implemented | Conversation, lead and escalation APIs/workspace pages. |
| P0 | Human support and notification | Implemented | Human-support settings, escalation delivery and Widget support replies. |
| P0 | Audit and agent draft approval | Implemented | `ai_audit_log`, `ai_agent_run`, config versions and approval APIs. |
| P0 | Task Center trace and worker | Partial | Runtime, lease worker, Widget and knowledge-sync tasks exist; admin Task Center UI is still missing. |
| P0 | Basic RBAC / member operations | Partial | Core RBAC exists; tenant admin vs operator Task Center permissions are not yet enforced in APIs/UI. |
| P0 | Production backups, logs, alerts, rate limits and domain allowlist | Partial | Launch-operation settings and Widget rate/origin checks exist; no deployed backup/alert/retention worker proof. |
| P0 | Production-safe migration | Blocked | Local `db:push` applied only; repository lacks deployed-schema baseline for incremental migration. |
| P1 | Sync job retries and run history | Partial | Provider sync and Task Center retry model exist; automatic retry scheduler and run history UI are incomplete. |
| P1 | Prompt/persona versioning | Implemented | `ai_config_version`, publish/review and prompt/persona APIs. |
| P1 | Agent suggestions | Partial | Agent drafts and scoped tokens exist; all operations are not yet represented as Task Center tasks. |
| P1 | Usage dashboard | Implemented | Usage API and dashboard panel. |
| P1 | Notification integrations | Partial | Email and webhook reminders exist; Slack/Feishu adapter is not implemented. |
| P1 | Installation detection | Implemented | `install-check` API and workspace form. |

## Current Release Gates

1. Build the authenticated Task Center list, trace detail, approval inbox and controls.
2. Enforce tenant administrator versus operations staff capabilities at the Task Center API boundary.
3. Add scheduled retry, lease-recovery, retention and alert jobs, then verify them end-to-end.
4. Establish the production database baseline and review an incremental migration before deployment.
