# SiteGPT Product Research PRD

Date: 2026-07-08
Target: SiteGPT chatbot admin console
Workspace observed: `sitegpt.ai/e21c5114-3eae-4112-a27c-d2de504849a8`

## Scope

This document captures SiteGPT's admin product surface for planning a comparable AI customer-support / knowledge-base product. The intended downstream reader is an implementation agent, so the feature map is organized by admin workflows, required entities, and operational controls.

## Evidence Screenshots

Valid screenshots captured in this run:

- Custom Responses list: `screenshots/00-custom-responses-list.png`
- Add Custom Response modal: `screenshots/01-custom-response-add.png`
- Current user view of Custom Responses: `screenshots/02-custom-responses-current-user.png`
- Human Support settings: `screenshots/17-human-support-user.png`

Screenshot capture note: Chrome entered macOS "out of application memory" / paused state during the full sweep, so only the screenshots above are considered valid. Invalid captures were removed from the directory to avoid misleading future agents.

## Navigation Map Observed

Primary chatbot workspace navigation:

- Dashboard: `/dashboard`
- Installation: `/installation`
- SDK Advanced: `/sdk-methods`
- Chat History: `/chat-history`
- Leads: `/leads`

Knowledge Base:

- Custom Responses: `/qna`
- Add Custom Response: `/qna/add`
- Text Snippets: `/text`
- Website Links: `/links`
- Files & Data Sources: `/files`
- Auto Sync Jobs: `/auto-sync-jobs`

Customizations:

- Conversation Starters: `/quick-prompts`
- Conversation Followups: `/followup-prompts`
- Chatbot Instructions: `/settings/prompts`
- Chatbot Persona: `/settings/personas`
- Language & Region: `/settings/localization`
- Appearance: `/appearance`
- Human Support: `/leads/human-support`

Advanced:

- Members: `/members`
- Integrations: `/integrations`
- Settings: `/settings`

Global navigation:

- Chatbots: `/dashboard`
- Agents: `/dashboard/agents`
- Billing: `/billing`
- Usage: `/usage`
- Profile: `/profile`
- Docs
- Support
- Feedback
- My Account

## Core Product Model

SiteGPT is structured around a chatbot workspace. Each workspace owns:

- Knowledge sources that feed the chatbot.
- Conversation customization settings that change chat behavior.
- Lead capture and human-support escalation.
- Installation and SDK surfaces for embedding or integrating the bot.
- Team, integration, billing, usage, and account controls.

For our product, keep this model explicit:

- `Workspace`
- `Chatbot`
- `KnowledgeSource`
- `CustomResponse`
- `TextSnippet`
- `WebsiteLink`
- `UploadedFile`
- `SyncJob`
- `ConversationStarter`
- `FollowupPrompt`
- `InstructionProfile`
- `Persona`
- `LocalizationSetting`
- `AppearanceTheme`
- `Lead`
- `HumanSupportEscalation`
- `Member`
- `Integration`
- `UsageEvent`

## Feature Requirements

### 1. Custom Responses

Observed behavior:

- List page includes title, video tutorial CTA, filter dropdown, and Add button.
- Add flow opens a centered modal over the list.
- Modal fields:
  - `Question`
  - `Answer`
  - `Discard`
  - `Add Custom Response`
- Placeholder example uses pricing FAQ content.

PRD requirements:

- Admin can create deterministic FAQ pairs.
- Bot retrieval should prioritize exact/custom responses over generated answers.
- Admin can filter response list by status/category.
- Empty state should explain what custom responses are for.
- Add/edit modal should support validation, save, discard, and close.

Agent-operability requirements:

- Provide API endpoints to list/create/update/delete custom responses.
- Provide an admin agent action schema:
  - `create_custom_response(question, answer, tags?)`
  - `update_custom_response(id, patch)`
  - `disable_custom_response(id)`
- Keep audit logs for agent-made edits.

### 2. Knowledge Base Sources

Observed modules:

- Text Snippets
- Website Links
- Files & Data Sources
- Auto Sync Jobs

PRD requirements:

- Admin can add raw text snippets as knowledge.
- Admin can add URLs for crawler/import.
- Admin can upload files or connect data sources.
- Admin can configure recurring sync jobs.
- Each source should expose status: pending, indexing, synced, failed, disabled.

Agent-operability requirements:

- Agent can ingest/update/delete sources through scoped admin APIs.
- Agent can inspect source health and retry failed sync jobs.
- Agent must not access sources outside the active workspace.

### 3. Conversation Customization

Observed modules:

- Conversation Starters
- Conversation Followups
- Chatbot Instructions
- Chatbot Persona
- Language & Region
- Appearance

PRD requirements:

- Conversation starters are initial quick prompts shown to users.
- Followups are suggested next questions after bot responses.
- Instructions define bot behavior and answer policy.
- Persona defines tone/style/role.
- Language & Region controls default language and localization.
- Appearance controls widget branding and UI style.

Agent-operability requirements:

- Agent can manage starters/followups as ordered lists.
- Agent can update instructions/persona with versioning.
- Agent can preview changes before publishing.
- Agent changes should require admin approval when touching brand, legal, or escalation text.

### 4. Leads And Human Support

Observed Human Support settings:

- Top-level tabs under Leads:
  - Overview
  - Settings
  - Human Support
- Human Support Options:
  - `Enable Human Support`
  - Description: allow users to request human assistance during conversations.
- Escalation Button Settings:
  - Show escalation buttons after responses.
  - Replace other suggestions with escalation buttons.
  - Positive Feedback Prompt.
  - Request Human Support Prompt.
  - Human Support Confirmation Message.
- Escalation Notifications:
  - Configure email notifications when users escalate to human support.

PRD requirements:

- Admin can enable/disable human support globally per chatbot.
- Admin can decide whether escalation CTAs appear after each AI response.
- Admin can replace suggested followups with escalation CTAs.
- Admin can customize:
  - positive feedback prompt
  - escalation CTA label
  - confirmation message
  - notification recipients
- Product should create a lead/escalation record containing conversation context, user message, contact fields, status, assignee, and timestamps.

Agent-operability requirements:

- Agent can inspect open escalations.
- Agent can assign, label, summarize, or close escalations.
- Agent can draft human replies, but final send should be configurable as auto-send or approval-required.
- Agent needs RBAC-scoped permissions:
  - `lead.read`
  - `lead.update`
  - `escalation.configure`
  - `reply.draft`
  - `reply.send`

### 5. Installation And SDK

Observed modules:

- Installation
- SDK Advanced

PRD requirements:

- Provide embed snippet for website installation.
- Provide advanced SDK/API method docs for custom app integration.
- Installation status should show whether the widget is active.
- Include copy buttons and environment-specific configuration.

Agent-operability requirements:

- Agent can fetch install instructions and generate framework-specific integration snippets.
- Agent can verify whether the widget script is installed by crawling a target URL if permission is granted.

### 6. Chat History

Observed module:

- Chat History

PRD requirements:

- Admin can inspect conversations.
- Should support search, filters, date range, user metadata, lead status, and transcript export.
- Conversation detail should show messages, citations/sources, feedback, escalation state.

Agent-operability requirements:

- Agent can summarize conversations.
- Agent can detect unresolved or low-confidence conversations.
- Agent can create follow-up tasks or knowledge gap tickets.

### 7. Members, Integrations, Settings

Observed modules:

- Members
- Integrations
- Settings

PRD requirements:

- Members: invite users, assign roles, remove users.
- Integrations: connect third-party tools such as email, CRM, Slack/Discord, support desk, analytics, or webhooks.
- Settings: workspace/chatbot-level configuration.

Agent-operability requirements:

- Strong RBAC. Agent should never manage members or billing unless explicitly granted.
- Integrations should expose health checks and credential status without exposing secrets.
- Agent actions should be auditable and reversible where possible.

## MVP Build Plan For Our Product

### Phase 1: Launch-Critical

- Authenticated admin workspace.
- Chatbot settings shell with left navigation.
- Knowledge ingestion:
  - custom responses
  - text snippets
  - website links
  - file uploads
- Chat widget preview and installation snippet.
- Chat history storage.
- Human support toggle and escalation record creation.
- Basic leads dashboard.
- RBAC roles: owner, admin, support agent, read-only, automation agent.

### Phase 2: Agent-Friendly Admin

- Admin API for every CRUD feature.
- Agent action audit log.
- Agent permission scopes.
- Agent dry-run/preview mode.
- Knowledge gap detection from chat history.
- Escalation summary and draft reply generation.

### Phase 3: Production Hardening

- Rate limits and abuse controls.
- Source sync retries and failure reasons.
- Version history for prompts/persona/appearance.
- Notification routing for human support.
- Integration webhooks.
- Usage metering and billing gates.

## Open Screenshot Tasks

The following screenshots still need to be captured after Chrome memory pressure is resolved:

- Dashboard
- Installation
- SDK Advanced
- Chat History
- Leads Overview
- Leads Settings
- Text Snippets list/add flow
- Website Links list/add flow
- Files & Data Sources upload/connect flow
- Auto Sync Jobs list/create flow
- Conversation Starters list/edit flow
- Conversation Followups list/edit flow
- Chatbot Instructions settings
- Chatbot Persona settings
- Language & Region settings
- Appearance settings
- Members management
- Integrations list/configuration
- Settings
- Global Chatbots list
- Agents page
- Billing
- Usage
- Profile
- Feedback flow

Recommended next capture method:

1. Close unused Chrome tabs or restart Chrome.
2. Reopen only the SiteGPT admin tab.
3. Capture one route at a time with Computer Use.
4. Save each screenshot under `docs/product-research/sitegpt/screenshots/`.
5. Update this document's Evidence Screenshots section as each item is completed.

## Product Gaps To Consider For Our Version

- SiteGPT's admin IA is broad but heavily manual. Our advantage can be making every admin surface agent-addressable.
- Human support should be treated as an operational queue, not only a settings toggle.
- Knowledge-source health is critical for trust; surface sync status, failed URLs/files, and stale content clearly.
- Prompt/persona/settings changes need version history because agent-driven operations can drift over time.
- For an agent-maintained product, every feature should have:
  - UI
  - API
  - permission scope
  - audit log
  - rollback/version path where relevant
