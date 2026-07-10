/**
 * SQLite schema definitions.
 *
 * This is the SQLite dialect of the database schema.
 * To use: set DATABASE_PROVIDER=sqlite in .env.local
 */

import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const table = sqliteTable;

const sqliteNowMs = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' })
      .default(false)
      .notNull(),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    currentPeriodStart: integer('current_period_start', { mode: 'timestamp_ms' }),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    planName: text('plan_name'),
    billingUrl: text('billing_url'),
    productName: text('product_name'),
    creditsAmount: integer('credits_amount'),
    creditsValidDays: integer('credits_valid_days'),
    paymentProductId: text('payment_product_id'),
    paymentUserId: text('payment_user_id'),
    canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
    canceledEndAt: integer('canceled_end_at', { mode: 'timestamp_ms' }),
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
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    status: text('status').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
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
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
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
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
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
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('idx_ai_knowledge_chatbot_type').on(t.chatbotId, t.type),
    index('idx_ai_knowledge_status').on(t.status),
  ]
);

export const aiKnowledgeChunk = table(
  'ai_knowledge_chunk',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => aiKnowledgeSource.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    content: text('content').notNull(),
    checksum: text('checksum').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (t) => [
    index('idx_ai_knowledge_chunk_source').on(t.sourceId, t.ordinal),
    index('idx_ai_knowledge_chunk_chatbot').on(t.chatbotId),
  ]
);

export const aiKnowledgeSyncJob = table(
  'ai_knowledge_sync_job',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    sourceId: text('source_id')
      .notNull()
      .references(() => aiKnowledgeSource.id, { onDelete: 'cascade' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    intervalMinutes: integer('interval_minutes').notNull().default(1440),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    lastRunAt: integer('last_run_at', { mode: 'timestamp_ms' }),
    nextRunAt: integer('next_run_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('idx_ai_knowledge_sync_source').on(t.sourceId),
    index('idx_ai_knowledge_sync_due').on(t.enabled, t.nextRunAt),
  ]
);

export const aiConversationTag = table(
  'ai_conversation_tag',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => aiConversation.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
  },
  (t) => [index('idx_ai_conversation_tag_conversation').on(t.conversationId)]
);

export const aiKnowledgeGap = table(
  'ai_knowledge_gap',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: text('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    conversationId: text('conversation_id').references(() => aiConversation.id),
    question: text('question').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('idx_ai_knowledge_gap_chatbot_status').on(t.chatbotId, t.status)]
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
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
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .$onUpdate(() => new Date())
      .notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
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
    approvalRequired: integer('approval_required', { mode: 'boolean' })
      .notNull()
      .default(false),
    summary: text('summary').notNull().default(''),
    diff: text('diff'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (t) => [
    index('idx_ai_agent_run_user_status').on(t.userId, t.status),
    index('idx_ai_agent_run_chatbot').on(t.chatbotId),
  ]
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
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
    requiresApproval: integer('requires_approval', { mode: 'boolean' })
      .notNull()
      .default(false),
    status: text('status').notNull().default('recorded'),
    diff: text('diff'),
    metadata: text('metadata').notNull().default('{}'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sqliteNowMs)
      .notNull(),
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
export type AiKnowledgeChunk = typeof aiKnowledgeChunk.$inferSelect;
export type NewAiKnowledgeChunk = typeof aiKnowledgeChunk.$inferInsert;
export type AiKnowledgeSyncJob = typeof aiKnowledgeSyncJob.$inferSelect;
export type NewAiKnowledgeSyncJob = typeof aiKnowledgeSyncJob.$inferInsert;
export type AiConversationTag = typeof aiConversationTag.$inferSelect;
export type NewAiConversationTag = typeof aiConversationTag.$inferInsert;
export type AiKnowledgeGap = typeof aiKnowledgeGap.$inferSelect;
export type NewAiKnowledgeGap = typeof aiKnowledgeGap.$inferInsert;
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
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
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
    activatedAt: integer('activated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    trialEndsAt: integer('trial_ends_at', { mode: 'timestamp' }).notNull(),
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
