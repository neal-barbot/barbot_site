# AI 客服后台产品 PRD v1

日期：2026-07-08
调研对象：SiteGPT 管理后台
目标产品：面向企业/站点的 AI 客服、知识库、线索收集、人工支持与 agent 运维后台

## 1. 背景

用户希望先上线一个可用的 AI 客服产品，后续通过 Codex、Hermes Agent 或其他自动化 agent 持续运维。产品不能只做一个聊天窗口，还必须有清晰的后台管理能力，让人类管理员和 agent 都能安全地更新知识库、调整提示词、处理线索、发帖/回复、配置人工支持和查看运行状态。

本 PRD 以 SiteGPT 的后台信息架构为参考，结合我们自己的上线目标，定义一版可实施、可被 agent 长期维护的产品方案。

## 2. 调研证据

调研方式：

- 使用用户已登录的系统 Chrome 访问 `sitegpt.ai` 后台。
- 只进行只读调研：页面导航、文案读取、截图保存；未创建、删除、提交或修改任何后台数据。
- 截图统一保存在 `docs/product-research/sitegpt/screenshots/`。

已保存截图索引：

| 文件 | 页面/功能 | 状态 |
| --- | --- | --- |
| `screenshots/00-custom-responses-list.png` | Custom Responses 列表 | 已截图 |
| `screenshots/01-custom-response-add.png` | Add Custom Response 弹窗 | 已截图 |
| `screenshots/02-custom-responses-current-user.png` | 用户打开的 Custom Responses 页面 | 已截图 |
| `screenshots/03-global-chatbots-dashboard.png` | 全局 Chatbots Dashboard | 已截图 |
| `screenshots/04-workspace-dashboard.png` | 单 Chatbot Dashboard | 已截图 |
| `screenshots/05-installation.png` | Installation | 已截图 |
| `screenshots/06-sdk-methods.png` | SDK Advanced | 已截图 |
| `screenshots/07-chat-history.png` | Chat History | 已截图 |
| `screenshots/08-leads-overview.png` | Leads Overview | 已截图 |
| `screenshots/09-leads-settings.png` | Leads Settings | 已截图 |
| `screenshots/10-text-snippets.png` | Text Snippets | 已截图 |
| `screenshots/11-website-links.png` | Website Links | 已截图 |
| `screenshots/12-files-data-sources.png` | Files & Data Sources | 已截图 |
| `screenshots/13-auto-sync-jobs.png` | Auto Sync Jobs | 已截图 |
| `screenshots/14-conversation-starters.png` | Conversation Starters | 已截图 |
| `screenshots/15-conversation-followups.png` | Conversation Followups | 已截图 |
| `screenshots/16-chatbot-instructions.png` | Chatbot Instructions | 已截图 |
| `screenshots/17-human-support-user.png` | Human Support 设置 | 已截图 |
| `screenshots/18-chatbot-persona.png` | Chatbot Persona | 已截图 |
| `screenshots/19-language-region.png` | Language & Region | 已截图 |
| `screenshots/20-appearance.png` | Appearance | 已截图 |
| `screenshots/21-members.png` | Members | 已截图 |
| `screenshots/22-integrations.png` | Integrations | 已截图 |
| `screenshots/23-settings.png` | Settings | 已截图 |
| `screenshots/24-global-agents.png` | 全局 Agents | 已截图 |
| `screenshots/25-global-billing.png` | Billing | 已截图 |
| `screenshots/26-global-usage.png` | Usage | 已截图 |
| `screenshots/27-global-profile.png` | Profile | 已截图 |

截图覆盖状态：SiteGPT 顶部全局导航和单 Chatbot 工作区主流程均已截图。Docs 是文档入口，Support 是 `mailto:support@sitegpt.ai`，Feedback 是浮层/反馈入口，不作为核心后台功能页展开。

## 3. 产品定位

一句话定位：

企业把网站、文档、FAQ 和客服流程交给 AI 客服后台管理；人类负责审批和高风险操作，agent 负责日常知识更新、线索整理、问题发现和运营维护。

核心用户：

- 站点 Owner：创建 chatbot、安装到网站、看使用量和计费。
- 业务管理员：维护知识库、调整回答策略、查看对话和线索。
- 客服人员：处理人工支持请求、回复用户、关闭工单。
- 自动化 Agent：在授权范围内执行知识库维护、回复草稿、线索归类、异常巡检。

## 4. 信息架构

全局层：

- Chatbots：多 chatbot 列表、创建 chatbot、复制 embed、打开预览聊天。
- Agents：配置自动化 agent、权限、任务、运行日志。
- Billing：套餐、支付、额度。
- Usage：调用量、消息量、知识库用量、agent 操作用量。
- Profile：账户资料。
- Docs / Support / Feedback：文档、支持和反馈入口。

单个 Chatbot 工作区：

- Dashboard
- Installation
- SDK Advanced
- Chat History
- Leads
- Knowledge Base
  - Custom Responses
  - Text Snippets
  - Website Links
  - Files & Data Sources
  - Auto Sync Jobs
- Customizations
  - Conversation Starters
  - Conversation Followups
  - Chatbot Instructions
  - Chatbot Persona
  - Language & Region
  - Appearance
  - Human Support
- Advanced
  - Members
  - Integrations
  - Settings

## 5. 核心对象模型

必须落库的核心实体：

- `Workspace`：团队/租户。
- `Chatbot`：一个可安装的客服机器人。
- `KnowledgeSource`：知识来源抽象父对象。
- `CustomResponse`：确定性 FAQ 问答。
- `TextSnippet`：手动粘贴的文本片段。
- `WebsiteLink`：待抓取网页 URL。
- `UploadedFile`：PDF、Markdown、TXT、CSV 等文件。
- `SyncJob`：自动同步任务。
- `Conversation`：一次用户会话。
- `Message`：会话消息。
- `Lead`：线索。
- `HumanEscalation`：人工支持请求。
- `PromptSetting`：系统指令、persona、followup 策略等版本化设置。
- `AppearanceSetting`：聊天窗样式。
- `Member`：成员。
- `Role` / `Permission`：权限系统。
- `AgentWorker`：自动化 agent 身份。
- `AgentRun`：agent 执行记录。
- `AuditLog`：人类/agent 的管理动作审计。
- `Integration`：第三方连接。
- `UsageEvent`：计量事件。

## 6. 功能需求

### 6.1 Chatbots 总览

用户故事：

- 作为 Owner，我要看到所有 chatbot，并能创建、复制安装代码、打开测试聊天。
- 作为 agent，我要能读取 chatbot 列表，并只操作被授权的 chatbot。

功能要求：

- 展示 chatbot 名称、状态、安装状态、最近对话数、知识库状态。
- 支持创建新 chatbot。
- 支持复制 embed snippet。
- 支持打开 Chat Now 预览窗口。
- 支持进入单个 chatbot dashboard。

验收标准：

- 新建 chatbot 后出现在列表。
- Copy Embed 返回当前 chatbot 的唯一安装代码。
- Agent 只能读取授权 chatbot。

### 6.1A 全局 Agents

已观察到的 SiteGPT 功能：

- 页面文案：Manage CLI, API, and MCP access for your SiteGPT account。
- 提供 MCP docs、Agent guide、OpenAPI、Agent manifest 链接。
- Use SiteGPT CLI with AI agents：指导给个人 AI assistant 配置 scoped CLI profile 和 SiteGPT skill file。
- Create API token：Token name、Expires、Access。
- Access profile：Standard、Full、Custom。
- Standard 被标注为推荐，说明为 CLI access without token, billing, or integration writes。
- API Tokens 表格列：Token、Status、Scopes、Chatbots、Last Used、Action。
- MCP connections：展示来自 Claude 等 AI app 的 browser-approved MCP connections。

功能要求：

- 提供 agent/API token 创建、过期时间、scope、绑定 chatbot 范围。
- 支持 OpenAPI、MCP manifest、agent skill file 下载。
- 支持 token 列表、最近使用时间、撤销、禁用、轮换。
- Standard profile 必须默认排除 billing、member、integration secret 写权限。
- Custom profile 必须支持最小权限矩阵。

Agent 控制：

- `agent_token.create`
- `agent_token.revoke`
- `agent_token.read`
- `mcp_connection.read`
- `mcp_connection.revoke`

### 6.1B Billing

已观察到的 SiteGPT 功能：

- Plans & Billing：查看 plan 和支付设置。
- Trial 状态提示，并可 End trial & bill now。
- Current Plan：Starter、yearly billing、续费日期、Change plan、Update Payment Method。
- Addons：Remove Powered by SiteGPT、Extra Messages。
- Danger Zone：Cancel Subscription，取消后 chatbots 会停止响应。
- Your Account Usage：Chatbots Usage、Pages Usage、Members Usage。
- Billing History：invoice、amount、payment method、date paid、products、payment status、subscription status。

功能要求：

- 展示当前套餐、订阅状态、续费日期、试用状态。
- 支持支付方式更新、发票下载、套餐变更。
- 支持 addons/extra quota。
- 取消订阅必须二次确认，并明确影响范围。
- 对 agent 默认禁止 billing 写权限。

### 6.1C Usage

已观察到的 SiteGPT 功能：

- Account Usage：查看 chatbots、pages、messages、members 用量。
- 展示 reset date。
- Pages Usage 解释一页约等于 2,500 个清洗后的字符。
- Usage History 支持 GPT-4.1-mini、GPT-4.1 切换。
- 图表支持 Download SVG、Download PNG、Download CSV。

功能要求：

- 展示账户级 usage quota 和 reset date。
- 按模型、月份、chatbot、成员维度查看用量。
- 支持导出 CSV/PNG。
- 支持用量告警和接近限额提醒。
- agent 可读 usage，不可修改 quota 或 billing。

### 6.1D Profile

已观察到的 SiteGPT 功能：

- Profile：查看和更新账户 details。
- 可上传 Avatar。
- 可编辑 Name。
- Email 为 disabled，不可直接修改，提示联系 `support@sitegpt.ai` 修改邮箱。
- Save Changes。

功能要求：

- 支持头像、名称、邮箱展示。
- 邮箱变更必须走安全流程或客服流程。
- 后续应补充 MFA、会话管理、登录设备和账号删除。

### 6.2 Dashboard

已观察到的 SiteGPT 功能：

- 资产统计：Total Links、Total Files、Total Custom Responses。
- 消息与反馈统计：Total Messages、Positive Feedback、Negative Feedback。
- 知识库用量：Total Pages Consumed，并说明一页约等于 2,500 个清洗后的字符。
- Status & Preview：当机器人没有知识时，提示添加 links、files、custom responses。
- Installation 摘要：Chatbot ID 和 JavaScript embed code。

功能要求：

- 展示今日对话数、已解决率、人工转接数、线索数、知识库同步状态。
- 展示最近对话、最近失败同步、近期 agent 操作。
- 提供上线检查清单：安装、知识库、外观、人工支持、通知、权限。

Agent 控制：

- `dashboard.read`
- `healthcheck.run`
- `launch_checklist.read`

### 6.3 Installation

已观察到的 SiteGPT 功能：

- 展示 Chatbot ID，并支持复制。
- 提供三种安装方式：JavaScript Embed、iFrame Embed、Inline Container。
- Inline Container 支持 `sitegpt-chat-widget` 容器和 `hideBubble=true` 参数。
- 提供平台说明：General、WordPress、Shopify、Squarespace、Wix、Webflow、Custom HTML。

功能要求：

- 提供 JavaScript embed 代码。
- 提供 npm/package、React/Vue/Next.js 安装说明。
- 展示当前站点是否已检测到安装脚本。
- 支持复制代码。

验收标准：

- 安装代码包含 chatbotId。
- 支持管理员填写站点 URL 后做脚本检测。

### 6.4 SDK Advanced

已观察到的 SiteGPT 功能：

- 暴露 `$sitegpt` 前端对象，用于控制 widget 外观、上下文、session 和可见性。
- 支持单个 embedded widget、多实例 widget、programmatic-only floating widget。
- 支持发送消息、重置会话、管理用户 session、控制打开/关闭、增强上下文、注入自定义 CSS。
- 用户 session 登录需要后端签名，适合把敏感身份逻辑放在服务端。

功能要求：

- 提供前端 SDK 方法：open、close、sendMessage、identifyUser、setMetadata。
- 提供服务端 API：创建会话、发送消息、查询历史、提交反馈、创建人工支持请求。
- 提供 webhook 文档。

Agent 控制：

- agent 可生成用户项目里的安装 PR，但不能直接读取生产密钥。

### 6.5 Chat History

已观察到的 SiteGPT 功能：

- 空状态文案为 `It's quiet in here...`，提示当前没有 conversations。

功能要求：

- 列表支持搜索、时间筛选、状态筛选、是否升级人工、是否有差评。
- 详情展示完整 transcript、引用来源、用户信息、反馈、转人工状态。
- 支持导出、标记已解决、创建知识缺口。

Agent 控制：

- `conversation.read`
- `conversation.summarize`
- `knowledge_gap.create`
- `conversation.tag`

### 6.6 Leads

已观察到的 SiteGPT 功能：

- Leads Overview：显示 Leads(0)、搜索框和空状态。
- Leads Settings：可开启 Lead Collection；可配置 Email、Name、Phone Number；有 Industry Template 和 Collection Triggers。
- Leads Human Support：作为 Leads 模块下的子页存在。

功能要求：

- 展示线索列表：姓名、邮箱、来源页面、最近消息、状态、负责人、创建时间。
- 线索详情展示关联对话、用户元数据、人工支持请求、备注。
- 支持状态流转：new、qualified、contacted、closed、spam。

Agent 控制：

- 自动归类线索。
- 生成联系建议。
- 识别垃圾线索。
- 高风险操作如主动发邮件默认需要审批。

### 6.7 Human Support

已观察到的 SiteGPT 功能：

- Enable Human Support。
- Show escalation buttons after responses。
- Replace other suggestions with escalation buttons。
- Positive Feedback Prompt。
- Request Human Support Prompt。
- Human Support Confirmation Message。
- Escalation Notifications。

我们的功能要求：

- 可按 chatbot 开关人工支持。
- 可设置转人工按钮是否显示在每次 AI 回复后。
- 可设置转人工按钮是否替代普通 followup。
- 可编辑正向反馈文案、转人工 CTA 文案、确认消息。
- 可配置通知邮箱、Slack/Discord/飞书 webhook。
- 转人工时自动保存当前会话上下文、用户输入、页面 URL、用户联系信息。

Agent 控制：

- `escalation.read`
- `escalation.assign`
- `escalation.summarize`
- `reply.draft`
- `reply.send`，默认关闭，需要显式授权。

### 6.8 Custom Responses

已观察到的 SiteGPT 功能：

- 列表页有 `Watch Video Tutorial`、筛选和 Add。
- Add 弹窗包含 `Question`、`Answer`、Discard、Add Custom Response。

我们的功能要求：

- FAQ 问答优先于普通 RAG/生成答案。
- 支持标签、启用/停用、搜索、批量导入。
- 支持版本历史和命中统计。
- 支持测试：输入问题后展示是否命中该 custom response。

Agent 控制：

- 可创建/更新/停用 FAQ。
- 大批量修改必须 dry-run + 管理员确认。

### 6.9 Text Snippets

已观察到的 SiteGPT 功能：

- 页面标题为 Text。
- 提示只添加 FAQ、产品详情等 reference content，不要放 instructions 或 system prompts。
- 提供大 textarea 和 Save Changes。

功能要求：

- 管理员可手动输入标题、正文、标签。
- 支持启用/停用、更新时间、索引状态。
- 支持从 conversation 中一键转成 snippet。

### 6.10 Website Links

已观察到的 SiteGPT 功能：

- 支持 Refresh、Export to CSV、Search links、Add Links。
- 状态卡：Total、Trained、Pending、Failed。
- 表格列：URL、Source、Status、Added On、Last Synced At、Actions。
- 左侧子功能：Links List、Add Links、Add Multiple Links、Add from Sitemap、Scrape Website、Add YouTube Videos。

功能要求：

- 添加单个 URL 或 sitemap。
- 支持包含/排除规则。
- 展示抓取状态、页面数量、失败原因。
- 支持手动重抓。

### 6.11 Files & Data Sources

已观察到的 SiteGPT 功能：

- 支持 Refresh、Export to CSV、Search files、Add Files。
- 状态卡：Total、Trained、Pending、Failed。
- 表格列：File、Source、Status、Added On、Last Synced At、Actions。
- 左侧数据源：Upload Local Files、Notion、Google Drive、Dropbox、OneDrive、Box、GitHub。

功能要求：

- 支持上传 PDF、TXT、Markdown、CSV、Docx。
- 展示解析状态、页数/字符数、索引状态。
- 支持删除和重新解析。
- 后续支持 Google Drive、Notion、Confluence、GitHub。

### 6.12 Auto Sync Jobs

已观察到的 SiteGPT 功能：

- 空状态提示尚无 sync jobs。
- 提示从添加 content sources 并启用 automated sync 开始。
- 提供 Add Content 入口。

功能要求：

- 管理网页、文件、第三方数据源的定时同步。
- 支持频率、下次运行时间、最近运行结果。
- 支持暂停、恢复、手动运行、查看日志。

### 6.13 Conversation Starters

已观察到的 SiteGPT 功能：

- Add Button 表单。
- Button Action 支持 Send Message、Open Link。
- 字段包括 Button Label、Message Text。

功能要求：

- 配置聊天窗口初始快捷问题。
- 支持排序、启用/停用、按语言配置。

### 6.14 Conversation Followups

已观察到的 SiteGPT 功能：

- Add Button 表单。
- Button Action 支持 Send Message、Open Link、Escalate。
- 字段包括 Button Label、Message Text。

功能要求：

- 配置 AI 回复后推荐的下一步问题。
- 支持由模型生成或管理员固定。
- 支持被 Human Support CTA 替代。

### 6.15 Chatbot Instructions

已观察到的 SiteGPT 功能：

- Settings > Instructions。
- 可编辑 Fallback Message。
- Default Instructions 支持 None，并可 View Details。
- 有 Temperature 参数，当前观察值为 0.5。
- 支持 Custom Instructions 和 Add New Instructions。

功能要求：

- 配置系统指令、回答边界、安全策略、拒答策略。
- 必须版本化。
- 支持测试区：输入样例问题，预览回答风格。

Agent 控制：

- agent 修改 instructions 默认进入草稿，需要人类批准后发布。

### 6.16 Chatbot Persona

已观察到的 SiteGPT 功能：

- Settings > Personas。
- 默认 persona 模板包括 Default、Default Classic、Neutral、Professional/Formal、Informative、Engaging、Inspirational、Playful/Funny、Sales Expert、Consultant、Problem Solver、Urgent & Action-Oriented。
- 支持 Custom Personas 和 Add New Persona。

功能要求：

- 配置角色、语气、行业身份、回答长度。
- 支持模板：客服、销售顾问、技术支持、文档助手。

### 6.17 Language & Region

已观察到的 SiteGPT 功能：

- Settings > Localization。
- 覆盖 Home、Messages、Message、Top Menu、Account、Lead Form 等大量 widget 文案。
- 可编辑 bot/you/agent、转人工确认、继续 AI、预约、表单提交、OTP、登出等具体文案。

功能要求：

- 设置默认语言、时区、日期格式。
- 支持多语言文案。
- 支持自动检测用户语言。

### 6.18 Appearance

已观察到的 SiteGPT 功能：

- Content：Chatbot Name、Tooltip、Welcome Message、Input Placeholder Text。
- Chat Interface：Primary Color、Text Color、Icon Background Color、Transparent Icon Background、Link Color。
- 右侧提供实时 chatbot 预览。

功能要求：

- 设置头像、品牌色、位置、欢迎语、占位文案、聊天按钮。
- 支持桌面/移动预览。
- 支持注入自定义 CSS 的安全白名单。

### 6.19 Members

已观察到的 SiteGPT 功能：

- 可输入 email 邀请成员。
- 角色下拉默认显示 Agent。
- 当前用户显示为 Super Admin。
- 当前计划触发提示：超过可邀请成员数量，需要 Upgrade。
- 有 Pending Invitations 区域。

功能要求：

- 邀请成员。
- 设置角色：Owner、Admin、Support、Editor、Viewer、Agent。
- 支持移除成员和重发邀请。

### 6.20 Integrations

已观察到的 SiteGPT 功能：

- 集成卡片包括 Google Chat、Messenger、Crisp、Slack、Freshdesk、Zendesk Messaging、Zendesk Legacy、Zoho SalesIQ。
- 每个集成都有 Get Started 入口。
- Zendesk Messaging 说明为一键安装 Zendesk AI Agent，无需 API keys。

功能要求：

- 支持邮件、Slack、Discord、飞书、Webhook、CRM、Helpdesk。
- 每个集成展示连接状态和最近错误。
- Secret 不可回显。

### 6.21 Settings

功能要求：

- Chatbot 名称、域名限制、数据保留策略、删除 chatbot。
- 安全设置：允许来源域名、速率限制、隐私提示。

## 7. Agent 管理控制台

SiteGPT 已经提供全局 Agents 页，用于 CLI、API token、MCP connections、OpenAPI 和 agent manifest。我们的差异化不应是从零做一个“agent 入口”，而是在这个基础上强化审批、回滚、审计和人机协作控制。

核心能力：

- 创建 Agent Worker / API token / MCP connection。
- 为 agent 绑定角色、权限范围、可访问 chatbot 和过期时间。
- 配置可执行动作：知识库维护、线索整理、人工支持草稿、健康巡检。
- 配置审批策略：自动执行、需要审批、禁止执行。
- 查看 API token 最近使用时间、MCP connection、agent run 日志。
- 对 agent 操作进行回滚或禁用。

建议拆成独立的 Agent 运维面，而不是只复用 Members 里的 `Agent` 角色：

- Agent Identity：每个 agent 是服务账号，有独立 token、到期时间、IP/环境限制。
- Scope：绑定 workspace、chatbot、知识库类型、可访问 conversation/lead 范围。
- Action Policy：每个动作有 `read`、`draft`、`propose`、`execute`、`delete` 五档能力。
- Approval Queue：prompt/persona、批量知识库更新、主动外发消息、删除数据必须进入审批队列。
- Dry Run Diff：agent 修改 custom response、text snippet、instructions 前必须生成 diff。
- Version & Rollback：FAQ、prompt、persona、appearance、human support 文案都要可回滚。
- Run Log：记录输入、工具调用、输出、审批人、执行结果和错误。
- Kill Switch：管理员可一键暂停某个 agent 或某类动作。
- OpenAPI / MCP / Skill File：对外暴露机器可读接口和操作说明，但所有写权限仍受 scope 和审批约束。

Agent 权限原则：

- 默认只读。
- 写操作最小授权。
- 涉及发消息、删数据、改账单、改成员必须显式授权。
- 每个 agent 操作必须写入 `AuditLog`。
- token 默认短期有效，支持撤销和轮换。

首批 agent 权限矩阵：

| 权限 | 默认 | 是否需要审批 | 说明 |
| --- | --- | --- | --- |
| `dashboard.read` | 允许 | 否 | 读取健康状态和上线检查 |
| `knowledge.read` | 允许 | 否 | 读取知识库状态，不读取 secret |
| `knowledge.propose` | 允许 | 否 | 生成 FAQ/snippet/link 修改草稿 |
| `knowledge.publish` | 禁止 | 是 | 发布知识库变更 |
| `prompt.propose` | 允许 | 否 | 生成 instructions/persona 修改草稿 |
| `prompt.publish` | 禁止 | 是 | 发布 prompt/persona |
| `conversation.read` | 可配置 | 否 | 读取对话，默认脱敏邮箱/电话 |
| `conversation.reply_draft` | 允许 | 否 | 生成人工回复草稿 |
| `conversation.reply_send` | 禁止 | 是 | 对用户实际发消息 |
| `lead.classify` | 允许 | 否 | 线索归类 |
| `lead.export` | 禁止 | 是 | 导出个人信息 |
| `member.write` | 禁止 | 是 | 邀请/移除成员 |
| `billing.write` | 禁止 | 是 | 计费相关动作 |
| `integration.write` | 禁止 | 是 | 连接第三方、写入 secret |

## 8. MVP 范围

第一阶段必须做：

- 登录与 workspace。
- Chatbots 总览。
- 单 chatbot 后台 shell。
- Custom Responses。
- Text Snippets。
- Website Links。
- Files upload。
- Chat widget preview。
- Installation embed。
- Chat History。
- Leads。
- Human Support 开关和通知。
- Members + 基础 RBAC。
- Agent 只读巡检和知识库草稿建议。
- Audit Log。
- 关键配置版本化：custom responses、instructions、persona、human support 文案。

第一阶段暂缓：

- Billing 完整支付。
- 复杂 CRM 集成。
- 多语言完整翻译后台。
- 高级 SDK 全量方法。
- agent 自动发外部消息。

## 9. 原型图

可打开的静态原型：

- `prototype.html`
- `prototype-preview.png`：HTML 原型的首屏截图，便于快速预览。

原型覆盖：

- 全局 Chatbots。
- 全局 Agents / Billing / Usage / Profile。
- 单 chatbot Dashboard。
- Installation / SDK Advanced。
- Knowledge Base。
- Human Support。
- Agent Control Center。
- Chat History / Leads。
- Appearance。
- Members / Integrations。

## 10. 上线前计划

上线前 P0：

- 可登录、可创建 chatbot。
- 可安装 widget。
- 可添加至少三类知识：FAQ、文本、文件/URL。
- 可聊天并引用知识。
- 可查看 chat history。
- 可收集 lead。
- 可开启 human support 并生成 escalation。
- 基础权限和审计。
- 后台错误监控。
- 管理员能查看 agent 草稿、批准/拒绝、回滚已发布配置。
- 生产环境有数据库备份、日志、错误告警、限流和域名白名单。
- 关键安全项：secret 不回显、PII 脱敏、删除/外发/成员/计费动作二次确认。

上线前 P1：

- 同步任务和失败重试。
- Prompt/persona 版本化。
- Agent 草稿建议。
- 使用量面板。
- 通知集成。
- Installation 检测：验证用户站点是否已安装 widget。
- 集成 Slack/飞书/邮件中的至少一种通知渠道。

上线前 P2：

- 计费。
- 高级 SDK。
- CRM/Helpdesk 集成。
- 多语言后台。
- 多 agent 协作：巡检 agent、知识库 agent、客服草稿 agent 分权运行。

## 11. 后续深测清单

当前调研已经覆盖顶部全局功能和单 Chatbot 工作区主流程。后续如果要进入实现前验证，建议做真实数据闭环深测：

- 添加一条测试 FAQ，验证 custom response 命中、版本和回滚。
- 添加一个测试 URL，验证抓取、索引、失败重试和引用来源。
- 发起一次测试 conversation，验证 chat history、feedback、lead collection 和 human support escalation。
- 创建一个低权限测试 token，验证 API/MCP scope、last used、撤销和审批流。
