/**
 * PostgreSQL schema definitions.
 *
 * This is the PostgreSQL dialect of the database schema.
 * To use: set DATABASE_PROVIDER=postgres in .env.local,
 * then copy this file's content into schema.ts.
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const table = pgTable;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    utmSource: text('utm_source').notNull().default(''),
    ip: text('ip').notNull().default(''),
    locale: text('locale').notNull().default(''),
  },
  (table) => [
    index('idx_user_name').on(table.name),
    index('idx_user_created_at').on(table.createdAt),
  ]
);

export const session = table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('idx_session_user_expires').on(table.userId, table.expiresAt),
  ]
);

export const account = table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_account_user_id').on(table.userId),
    index('idx_account_provider_account').on(table.providerId, table.accountId),
  ]
);

export const verification = table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_verification_identifier').on(table.identifier),
  ]
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table('config', {
  name: text('name').unique().notNull(),
  value: text('value'),
});

export const taxonomy = table(
  'taxonomy',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    image: text('image'),
    icon: text('icon'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_taxonomy_type_status').on(table.type, table.status),
  ]
);

export const post = table(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').unique().notNull(),
    type: text('type').notNull(),
    title: text('title'),
    description: text('description'),
    image: text('image'),
    content: text('content'),
    categories: text('categories'),
    tags: text('tags'),
    authorName: text('author_name'),
    authorImage: text('author_image'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_post_type_status').on(table.type, table.status),
  ]
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  'order',
  {
    id: text('id').primaryKey(),
    orderNo: text('order_no').unique().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    status: text('status').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    productId: text('product_id'),
    paymentType: text('payment_type'),
    paymentInterval: text('payment_interval'),
    paymentProvider: text('payment_provider').notNull(),
    paymentSessionId: text('payment_session_id'),
    checkoutInfo: text('checkout_info').notNull(),
    checkoutResult: text('checkout_result'),
    paymentResult: text('payment_result'),
    discountCode: text('discount_code'),
    discountAmount: integer('discount_amount'),
    discountCurrency: text('discount_currency'),
    paymentEmail: text('payment_email'),
    paymentAmount: integer('payment_amount'),
    paymentCurrency: text('payment_currency'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    description: text('description'),
    productName: text('product_name'),
    subscriptionId: text('subscription_id'),
    subscriptionResult: text('subscription_result'),
    checkoutUrl: text('checkout_url'),
    callbackUrl: text('callback_url'),
    creditsAmount: integer('credits_amount'),
    creditsValidDays: integer('credits_valid_days'),
    planName: text('plan_name'),
    paymentProductId: text('payment_product_id'),
    invoiceId: text('invoice_id'),
    invoiceUrl: text('invoice_url'),
    subscriptionNo: text('subscription_no'),
    transactionId: text('transaction_id'),
    paymentUserName: text('payment_user_name'),
    paymentUserId: text('payment_user_id'),
  },
  (table) => [
    index('idx_order_user_status_payment_type').on(
      table.userId,
      table.status,
      table.paymentType
    ),
    index('idx_order_transaction_provider').on(
      table.transactionId,
      table.paymentProvider
    ),
    index('idx_order_created_at').on(table.createdAt),
  ]
);

export const subscription = table(
  'subscription',
  {
    id: text('id').primaryKey(),
    subscriptionNo: text('subscription_no').unique().notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    status: text('status').notNull(),
    paymentProvider: text('payment_provider').notNull(),
    subscriptionId: text('subscription_id').notNull(),
    subscriptionResult: text('subscription_result'),
    productId: text('product_id'),
    description: text('description'),
    amount: integer('amount'),
    currency: text('currency'),
    interval: text('interval'),
    intervalCount: integer('interval_count'),
    trialPeriodDays: integer('trial_period_days'),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    planName: text('plan_name'),
    billingUrl: text('billing_url'),
    productName: text('product_name'),
    creditsAmount: integer('credits_amount'),
    creditsValidDays: integer('credits_valid_days'),
    paymentProductId: text('payment_product_id'),
    paymentUserId: text('payment_user_id'),
    canceledAt: timestamp('canceled_at'),
    canceledEndAt: timestamp('canceled_end_at'),
    canceledReason: text('canceled_reason'),
    canceledReasonType: text('canceled_reason_type'),
  },
  (table) => [
    index('idx_subscription_user_status_interval').on(
      table.userId,
      table.status,
      table.interval
    ),
    index('idx_subscription_provider_id').on(
      table.subscriptionId,
      table.paymentProvider
    ),
    index('idx_subscription_created_at').on(table.createdAt),
  ]
);

export const credit = table(
  'credit',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    orderNo: text('order_no'),
    subscriptionNo: text('subscription_no'),
    transactionNo: text('transaction_no').unique().notNull(),
    transactionType: text('transaction_type').notNull(),
    transactionScene: text('transaction_scene'),
    credits: integer('credits').notNull(),
    remainingCredits: integer('remaining_credits').notNull().default(0),
    description: text('description'),
    expiresAt: timestamp('expires_at'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    consumedDetail: text('consumed_detail'),
    metadata: text('metadata'),
  },
  (table) => [
    index('idx_credit_consume_fifo').on(
      table.userId,
      table.status,
      table.transactionType,
      table.remainingCredits,
      table.expiresAt
    ),
    index('idx_credit_order_no').on(table.orderNo),
    index('idx_credit_subscription_no').on(table.subscriptionNo),
  ]
);

export const apikey = table(
  'apikey',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_apikey_user_status').on(table.userId, table.status),
    index('idx_apikey_keyhash_status').on(table.keyHash, table.status),
  ]
);

// ─── RBAC ────────────────────────────────────────────────────────────────────

export const role = table(
  'role',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    sort: integer('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_role_status').on(table.status),
  ]
);

export const permission = table(
  'permission',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_permission_resource_action').on(table.resource, table.action),
  ]
);

export const rolePermission = table(
  'role_permission',
  {
    id: text('id').primaryKey(),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: text('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_role_permission_role_permission').on(
      table.roleId,
      table.permissionId
    ),
  ]
);

export const userRole = table(
  'user_role',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    index('idx_user_role_user_expires').on(table.userId, table.expiresAt),
  ]
);

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiTask = table(
  'ai_task',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    mediaType: text('media_type').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    prompt: text('prompt').notNull(),
    options: text('options'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    taskId: text('task_id'),
    taskInfo: text('task_info'),
    taskResult: text('task_result'),
    costCredits: integer('cost_credits').notNull().default(0),
    scene: text('scene').notNull().default(''),
    creditId: text('credit_id'),
  },
  (table) => [
    index('idx_ai_task_user_media_type').on(table.userId, table.mediaType),
    index('idx_ai_task_media_type_status').on(table.mediaType, table.status),
  ]
);

export const chat = table(
  'chat',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    title: text('title').notNull().default(''),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    content: text('content'),
  },
  (table) => [index('idx_chat_user_status').on(table.userId, table.status)]
);

export const chatMessage = table(
  'chat_message',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: text('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    role: text('role').notNull(),
    parts: text('parts').notNull(),
    metadata: text('metadata'),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
  },
  (table) => [
    index('idx_chat_message_chat_id').on(table.chatId, table.status),
    index('idx_chat_message_user_id').on(table.userId, table.status),
  ]
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type Config = typeof config.$inferSelect;
export type Taxonomy = typeof taxonomy.$inferSelect;
export type NewTaxonomy = typeof taxonomy.$inferInsert;
export type Post = typeof post.$inferSelect;
export type NewPost = typeof post.$inferInsert;
export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
export type Credit = typeof credit.$inferSelect;
export type NewCredit = typeof credit.$inferInsert;
export type Apikey = typeof apikey.$inferSelect;
export type NewApikey = typeof apikey.$inferInsert;
export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;
export type Permission = typeof permission.$inferSelect;
export type RolePermission = typeof rolePermission.$inferSelect;
export type UserRole = typeof userRole.$inferSelect;
export type AiTask = typeof aiTask.$inferSelect;
export type NewAiTask = typeof aiTask.$inferInsert;
export type Chat = typeof chat.$inferSelect;
export type NewChat = typeof chat.$inferInsert;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type NewChatMessage = typeof chatMessage.$inferInsert;

// ─── Tickets (support) ───────────────────────────────────────────────────────

export const ticket = table(
  'ticket',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    title: text('title').notNull(),
    status: text('status').notNull().default('open'), // open | replied | closed
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ticket_user').on(t.userId),
    index('idx_ticket_status').on(t.status),
  ]
);

export const ticketMessage = table(
  'ticket_message',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id')
      .notNull()
      .references(() => ticket.id),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    role: text('role').notNull().default('user'), // user | admin
    content: text('content').notNull(),
    attachments: text('attachments').notNull().default('[]'), // JSON array of image URLs
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_ticket_message_ticket').on(t.ticketId)]
);

export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type TicketMessage = typeof ticketMessage.$inferSelect;
export type NewTicketMessage = typeof ticketMessage.$inferInsert;

// ─── Custom tables ───────────────────────────────────────────────────────────
// Add your own tables below this line.

// ─── AI Support ──────────────────────────────────────────────────────────────

export const aiChatbot = table(
  'ai_chatbot',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default('draft'),
    installStatus: text('install_status').notNull().default('not_installed'),
    publicKey: text('public_key').notNull().unique(),
    allowedDomains: text('allowed_domains').notNull().default('[]'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('idx_ai_chatbot_user_status').on(t.userId, t.status),
    index('idx_ai_chatbot_public_key').on(t.publicKey),
  ]
);

export const aiKnowledgeSource = table(
  'ai_knowledge_source',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull().default('draft'),
    content: text('content'),
    sourceUrl: text('source_url'),
    metadata: text('metadata').notNull().default('{}'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('idx_ai_knowledge_chatbot_type').on(t.chatbotId, t.type),
    index('idx_ai_knowledge_status').on(t.status),
  ]
);

export const aiConversation = table(
  'ai_conversation',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('open'),
    sourceUrl: text('source_url'),
    visitorId: text('visitor_id'),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    lastMessage: text('last_message').notNull().default(''),
    messageCount: integer('message_count').notNull().default(0),
    feedback: text('feedback'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ai_conversation_chatbot_status').on(t.chatbotId, t.status),
    index('idx_ai_conversation_user_created').on(t.userId, t.createdAt),
  ]
);

export const aiConversationMessage = table(
  'ai_conversation_message',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => aiConversation.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    citations: text('citations').notNull().default('[]'),
    feedback: text('feedback'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ai_conversation_message_conversation').on(t.conversationId, t.createdAt),
    index('idx_ai_conversation_message_chatbot').on(t.chatbotId, t.createdAt),
  ]
);

export const aiLead = table(
  'ai_lead',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id'),
    name: text('name'),
    email: text('email'),
    phone: text('phone'),
    sourceUrl: text('source_url'),
    status: text('status').notNull().default('new'),
    priority: text('priority').notNull().default('normal'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ai_lead_chatbot_status').on(t.chatbotId, t.status),
    index('idx_ai_lead_user_created').on(t.userId, t.createdAt),
  ]
);

export const aiHumanEscalation = table(
  'ai_human_escalation',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    leadId: text('lead_id').references(() => aiLead.id),
    conversationId: text('conversation_id'),
    status: text('status').notNull().default('open'),
    assigneeUserId: text('assignee_user_id').references(() => user.id),
    summary: text('summary').notNull().default(''),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ai_escalation_chatbot_status').on(t.chatbotId, t.status),
    index('idx_ai_escalation_assignee').on(t.assigneeUserId),
  ]
);

export const aiAgentToken = table(
  'ai_agent_token',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    accessProfile: text('access_profile').notNull().default('standard'),
    scopes: text('scopes').notNull().default('[]'),
    chatbotIds: text('chatbot_ids').notNull().default('[]'),
    tokenPrefix: text('token_prefix').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => [
    index('idx_ai_agent_token_user_status').on(t.userId, t.status),
    index('idx_ai_agent_token_hash').on(t.tokenHash),
  ]
);

export const aiAgentRun = table(
  'ai_agent_run',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agentTokenId: text('agent_token_id').references(() => aiAgentToken.id),
    chatbotId: text('chatbot_id').references(() => aiChatbot.id),
    action: text('action').notNull(),
    status: text('status').notNull().default('queued'),
    approvalRequired: boolean('approval_required').notNull().default(false),
    summary: text('summary').notNull().default(''),
    diff: text('diff'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('idx_ai_agent_run_user_status').on(t.userId, t.status),
    index('idx_ai_agent_run_chatbot').on(t.chatbotId),
  ]
);

// ─── Agent Task Center ──────────────────────────────────────────────────────

export const agentTask = table(
  'agent_task',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id').references(() => aiChatbot.id, { onDelete: 'cascade' }),
    parentTaskId: text('parent_task_id'),
    type: text('type').notNull(),
    status: text('status').notNull().default('queued'),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id').notNull(),
    authorizationVersion: text('authorization_version').notNull().default(''),
    requestId: text('request_id').notNull().default(''),
    idempotencyKey: text('idempotency_key').notNull(),
    inputSummary: text('input_summary').notNull().default(''),
    outputSummary: text('output_summary').notNull().default(''),
    errorSummary: text('error_summary').notNull().default(''),
    metadata: text('metadata').notNull().default('{}'),
    attempt: integer('attempt').notNull().default(1),
    maxAttempts: integer('max_attempts').notNull().default(5),
    runAfter: timestamp('run_after').defaultNow().notNull(),
    leaseOwner: text('lease_owner'),
    leaseExpiresAt: timestamp('lease_expires_at'),
    cancellationRequestedAt: timestamp('cancellation_requested_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    archivedAt: timestamp('archived_at'),
  },
  (t) => [
    index('idx_agent_task_user_created').on(t.userId, t.createdAt),
    index('idx_agent_task_chatbot_status').on(t.chatbotId, t.status),
    index('idx_agent_task_queue').on(t.status, t.runAfter),
    index('idx_agent_task_idempotency').on(t.userId, t.idempotencyKey),
  ]
);

export const agentTaskEvent = table(
  'agent_task_event',
  {
    id: text('id').primaryKey(), taskId: text('task_id').notNull().references(() => agentTask.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(), type: text('type').notNull(), summary: text('summary').notNull(),
    actorType: text('actor_type').notNull(), actorId: text('actor_id').notNull(),
    requestId: text('request_id').notNull().default(''), details: text('details').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_agent_task_event_task_sequence').on(t.taskId, t.sequence), index('idx_agent_task_event_created').on(t.createdAt)]
);

export const agentTaskArtifact = table(
  'agent_task_artifact',
  {
    id: text('id').primaryKey(), taskId: text('task_id').notNull().references(() => agentTask.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), title: text('title').notNull(), storageKey: text('storage_key'),
    checksum: text('checksum').notNull().default(''), accessScope: text('access_scope').notNull().default('tenant'),
    metadata: text('metadata').notNull().default('{}'), expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_agent_task_artifact_task').on(t.taskId), index('idx_agent_task_artifact_expiry').on(t.expiresAt)]
);

export const agentTaskCheckpoint = table(
  'agent_task_checkpoint',
  {
    id: text('id').primaryKey(), taskId: text('task_id').notNull().references(() => agentTask.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('waiting'), action: text('action').notNull(), summary: text('summary').notNull(),
    requestedByType: text('requested_by_type').notNull(), requestedById: text('requested_by_id').notNull(),
    assigneeUserId: text('assignee_user_id').references(() => user.id), decisionByUserId: text('decision_by_user_id').references(() => user.id),
    decisionReason: text('decision_reason').notNull().default(''), expiresAt: timestamp('expires_at').notNull(),
    decidedAt: timestamp('decided_at'), createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_agent_task_checkpoint_task').on(t.taskId), index('idx_agent_task_checkpoint_status_expiry').on(t.status, t.expiresAt), index('idx_agent_task_checkpoint_assignee').on(t.assigneeUserId, t.status)]
);

export const aiConfigVersion = table(
  'ai_config_version',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    settingKey: text('setting_key').notNull(),
    status: text('status').notNull().default('draft'),
    version: integer('version').notNull().default(1),
    content: text('content').notNull(),
    createdByType: text('created_by_type').notNull().default('user'),
    createdById: text('created_by_id'),
    approvedByUserId: text('approved_by_user_id').references(() => user.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    publishedAt: timestamp('published_at'),
  },
  (t) => [
    index('idx_ai_config_version_chatbot_key').on(t.chatbotId, t.settingKey),
    index('idx_ai_config_version_status').on(t.status),
  ]
);

export const aiAuditLog = table(
  'ai_audit_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    action: text('action').notNull(),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    status: text('status').notNull().default('recorded'),
    diff: text('diff'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_ai_audit_user_created').on(t.userId, t.createdAt),
    index('idx_ai_audit_resource').on(t.resourceType, t.resourceId),
  ]
);

export type AiChatbot = typeof aiChatbot.$inferSelect;
export type NewAiChatbot = typeof aiChatbot.$inferInsert;
export type AiKnowledgeSource = typeof aiKnowledgeSource.$inferSelect;
export type NewAiKnowledgeSource = typeof aiKnowledgeSource.$inferInsert;
export type AiConversation = typeof aiConversation.$inferSelect;
export type NewAiConversation = typeof aiConversation.$inferInsert;
export type AiConversationMessage = typeof aiConversationMessage.$inferSelect;
export type NewAiConversationMessage = typeof aiConversationMessage.$inferInsert;
export type AiLead = typeof aiLead.$inferSelect;
export type NewAiLead = typeof aiLead.$inferInsert;
export type AiHumanEscalation = typeof aiHumanEscalation.$inferSelect;
export type NewAiHumanEscalation = typeof aiHumanEscalation.$inferInsert;
export type AiAgentToken = typeof aiAgentToken.$inferSelect;
export type NewAiAgentToken = typeof aiAgentToken.$inferInsert;
export type AiAgentRun = typeof aiAgentRun.$inferSelect;
export type NewAiAgentRun = typeof aiAgentRun.$inferInsert;
export type AgentTask = typeof agentTask.$inferSelect;
export type NewAgentTask = typeof agentTask.$inferInsert;
export type AgentTaskEvent = typeof agentTaskEvent.$inferSelect;
export type NewAgentTaskEvent = typeof agentTaskEvent.$inferInsert;
export type AgentTaskArtifact = typeof agentTaskArtifact.$inferSelect;
export type NewAgentTaskArtifact = typeof agentTaskArtifact.$inferInsert;
export type AgentTaskCheckpoint = typeof agentTaskCheckpoint.$inferSelect;
export type NewAgentTaskCheckpoint = typeof agentTaskCheckpoint.$inferInsert;
export type AiConfigVersion = typeof aiConfigVersion.$inferSelect;
export type NewAiConfigVersion = typeof aiConfigVersion.$inferInsert;
export type AiAuditLog = typeof aiAuditLog.$inferSelect;
export type NewAiAuditLog = typeof aiAuditLog.$inferInsert;

// ─── Invite Codes ────────────────────────────────────────────────────────────

export const inviteCode = table(
  'invite_code',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    maxUses: integer('max_uses').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    trialDays: integer('trial_days').notNull().default(15),
    note: text('note').default(''),
    createdBy: text('created_by').references(() => user.id),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_invite_code_code').on(t.code)]
);

export const userInvite = table(
  'user_invite',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    inviteCodeId: text('invite_code_id')
      .notNull()
      .references(() => inviteCode.id),
    activatedAt: timestamp('activated_at').defaultNow().notNull(),
    trialEndsAt: timestamp('trial_ends_at').notNull(),
  },
  (t) => [
    index('idx_user_invite_user').on(t.userId),
    index('idx_user_invite_code').on(t.inviteCodeId),
  ]
);

export type InviteCode = typeof inviteCode.$inferSelect;
export type NewInviteCode = typeof inviteCode.$inferInsert;
export type UserInvite = typeof userInvite.$inferSelect;
export type NewUserInvite = typeof userInvite.$inferInsert;

// ─── Chip P2P ────────────────────────────────────────────────────────────────

export const chipSegment = table(
  'chip_segment',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id'),
    name: text('name').notNull(),
    description: text('description'),
    sort: integer('sort').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('idx_chip_segment_parent').on(table.parentId)]
);

export const chip = table(
  'chip',
  {
    id: text('id').primaryKey(),
    manufacturer: text('manufacturer'),
    partNumber: text('part_number').notNull(),
    partNumberNorm: text('part_number_norm').notNull(),
    description: text('description'),
    sheetUrl: text('sheet_url'),
    parameter: text('parameter'),
    segmentId: text('segment_id').references(() => chipSegment.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_chip_part_number').on(table.partNumber),
    index('idx_chip_part_number_norm').on(table.partNumberNorm),
    index('idx_chip_manufacturer').on(table.manufacturer),
  ]
);

export const pin2pin = table(
  'pin2pin',
  {
    id: text('id').primaryKey(),
    chipId: text('chip_id')
      .notNull()
      .references(() => chip.id, { onDelete: 'cascade' }),
    supplier: text('supplier'),
    partNumber: text('part_number').notNull(),
    supplierP2p: text('supplier_p2p'),
    partNumberP2p: text('part_number_p2p').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_pin2pin_chip').on(table.chipId),
    index('idx_pin2pin_part_number').on(table.partNumber),
  ]
);

export const bom = table(
  'bom',
  {
    id: text('id').primaryKey(),
    chipId: text('chip_id')
      .notNull()
      .references(() => chip.id, { onDelete: 'cascade' }),
    manufacturer: text('manufacturer'),
    categoryName: text('category_name'),
    partNumber: text('part_number').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unitPrice: integer('unit_price').notNull().default(0),
    totalPrice: integer('total_price').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('idx_bom_chip').on(table.chipId)]
);

export const pdfParseCache = table(
  'pdf_parse_cache',
  {
    id: text('id').primaryKey(),
    fileMd5: text('file_md5').notNull().unique(),
    fileName: text('file_name').notNull(),
    chipPartNumber: text('chip_part_number').notNull().default(''),
    sourceUrl: text('source_url'),
    pageCount: integer('page_count').notNull().default(0),
    pages: text('pages'),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('idx_pdf_parse_cache_part_number').on(table.chipPartNumber),
    index('idx_pdf_parse_cache_status').on(table.status),
  ]
);

export const chipCompareRecord = table(
  'chip_compare_record',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chipPartNumbers: text('chip_part_numbers').notNull(),
    fileList: text('file_list').notNull().default('[]'),
    status: text('status').notNull().default('pending'),
    stage: text('stage').notNull().default(''),
    provider: text('provider').notNull().default('openai'),
    model: text('model').notNull(),
    language: text('language').notNull().default('en'),
    prompt: text('prompt'),
    result: text('result'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    durationMs: integer('duration_ms'),
    costCredits: integer('cost_credits').notNull().default(0),
    creditId: text('credit_id'),
    cacheKey: text('cache_key').notNull().default(''),
    cacheHit: boolean('cache_hit').notNull().default(false),
    source: text('source').notNull().default('user'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('idx_chip_compare_record_user').on(table.userId, table.createdAt),
    index('idx_chip_compare_record_cache').on(table.cacheKey, table.status),
  ]
);

export const chipCompareTrace = table(
  'chip_compare_trace',
  {
    id: text('id').primaryKey(),
    recordId: text('record_id')
      .notNull()
      .references(() => chipCompareRecord.id, { onDelete: 'cascade' }),
    paramName: text('param_name').notNull(),
    paramCategory: text('param_category'),
    chipsTrace: text('chips_trace').notNull(),
    diffLevel: text('diff_level'),
    diffNote: text('diff_note'),
    userNote: text('user_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('idx_chip_compare_trace_record').on(table.recordId)]
);

export type ChipSegment = typeof chipSegment.$inferSelect;
export type NewChipSegment = typeof chipSegment.$inferInsert;
export type Chip = typeof chip.$inferSelect;
export type NewChip = typeof chip.$inferInsert;
export type Pin2Pin = typeof pin2pin.$inferSelect;
export type NewPin2Pin = typeof pin2pin.$inferInsert;
export type Bom = typeof bom.$inferSelect;
export type NewBom = typeof bom.$inferInsert;
export type PdfParseCache = typeof pdfParseCache.$inferSelect;
export type NewPdfParseCache = typeof pdfParseCache.$inferInsert;
export type ChipCompareRecord = typeof chipCompareRecord.$inferSelect;
export type NewChipCompareRecord = typeof chipCompareRecord.$inferInsert;
export type ChipCompareTrace = typeof chipCompareTrace.$inferSelect;
export type NewChipCompareTrace = typeof chipCompareTrace.$inferInsert;
