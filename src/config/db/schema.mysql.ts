/**
 * MySQL schema definitions.
 *
 * This is the MySQL dialect of the database schema.
 * To use: set DATABASE_PROVIDER=mysql in .env.local,
 * then copy this file's content into schema.ts.
 */

import {
  boolean,
  index,
  int,
  longtext,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

const table = mysqlTable;

const varchar191 = (name: string) => varchar(name, { length: 191 });

// ─── Auth ────────────────────────────────────────────────────────────────────

export const user = table(
  'user',
  {
    id: varchar191('id').primaryKey(),
    name: varchar191('name').notNull(),
    email: varchar191('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    utmSource: varchar('utm_source', { length: 100 }).notNull().default(''),
    ip: varchar('ip', { length: 45 }).notNull().default(''),
    locale: varchar('locale', { length: 20 }).notNull().default(''),
  },
  (table) => [
    index('idx_user_name').on(table.name),
    index('idx_user_created_at').on(table.createdAt),
  ]
);

export const session = table(
  'session',
  {
    id: varchar191('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: varchar191('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    userId: varchar191('user_id')
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
    id: varchar191('id').primaryKey(),
    accountId: varchar191('account_id').notNull(),
    providerId: varchar('provider_id', { length: 50 }).notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: varchar('scope', { length: 255 }),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('idx_account_user_id').on(table.userId),
    index('idx_account_provider_account').on(table.providerId, table.accountId),
  ]
);

export const verification = table(
  'verification',
  {
    id: varchar191('id').primaryKey(),
    identifier: varchar191('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('idx_verification_identifier').on(table.identifier),
  ]
);

// ─── Content ─────────────────────────────────────────────────────────────────

export const config = table('config', {
  name: varchar191('name').unique().notNull(),
  value: text('value'),
});

export const taxonomy = table(
  'taxonomy',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: varchar191('parent_id'),
    slug: varchar191('slug').unique().notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    image: text('image'),
    icon: varchar191('icon'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_taxonomy_type_status').on(table.type, table.status),
  ]
);

export const post = table(
  'post',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: varchar191('parent_id'),
    slug: varchar191('slug').unique().notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }),
    description: text('description'),
    image: text('image'),
    content: longtext('content'),
    categories: text('categories'),
    tags: text('tags'),
    authorName: varchar191('author_name'),
    authorImage: text('author_image'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_post_type_status').on(table.type, table.status),
  ]
);

// ─── Business ────────────────────────────────────────────────────────────────

export const order = table(
  'order',
  {
    id: varchar191('id').primaryKey(),
    orderNo: varchar191('order_no').unique().notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'),
    status: varchar('status', { length: 50 }).notNull(),
    amount: int('amount').notNull(),
    currency: varchar('currency', { length: 10 }).notNull(),
    productId: varchar191('product_id'),
    paymentType: varchar('payment_type', { length: 50 }),
    paymentInterval: varchar('payment_interval', { length: 50 }),
    paymentProvider: varchar('payment_provider', { length: 50 }).notNull(),
    paymentSessionId: varchar191('payment_session_id'),
    checkoutInfo: text('checkout_info').notNull(),
    checkoutResult: text('checkout_result'),
    paymentResult: text('payment_result'),
    discountCode: varchar191('discount_code'),
    discountAmount: int('discount_amount'),
    discountCurrency: varchar('discount_currency', { length: 10 }),
    paymentEmail: varchar191('payment_email'),
    paymentAmount: int('payment_amount'),
    paymentCurrency: varchar('payment_currency', { length: 10 }),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    description: text('description'),
    productName: varchar('product_name', { length: 255 }),
    subscriptionId: varchar191('subscription_id'),
    subscriptionResult: text('subscription_result'),
    checkoutUrl: text('checkout_url'),
    callbackUrl: text('callback_url'),
    creditsAmount: int('credits_amount'),
    creditsValidDays: int('credits_valid_days'),
    planName: varchar191('plan_name'),
    paymentProductId: varchar191('payment_product_id'),
    invoiceId: varchar191('invoice_id'),
    invoiceUrl: text('invoice_url'),
    subscriptionNo: varchar191('subscription_no'),
    transactionId: varchar191('transaction_id'),
    paymentUserName: varchar191('payment_user_name'),
    paymentUserId: varchar191('payment_user_id'),
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
    id: varchar191('id').primaryKey(),
    subscriptionNo: varchar191('subscription_no').unique().notNull(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'),
    status: varchar('status', { length: 50 }).notNull(),
    paymentProvider: varchar('payment_provider', { length: 50 }).notNull(),
    subscriptionId: varchar191('subscription_id').notNull(),
    subscriptionResult: text('subscription_result'),
    productId: varchar191('product_id'),
    description: text('description'),
    amount: int('amount'),
    currency: varchar('currency', { length: 10 }),
    interval: varchar('interval', { length: 50 }),
    intervalCount: int('interval_count'),
    trialPeriodDays: int('trial_period_days'),
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    planName: varchar191('plan_name'),
    billingUrl: text('billing_url'),
    productName: varchar('product_name', { length: 255 }),
    creditsAmount: int('credits_amount'),
    creditsValidDays: int('credits_valid_days'),
    paymentProductId: varchar191('payment_product_id'),
    paymentUserId: varchar191('payment_user_id'),
    canceledAt: timestamp('canceled_at'),
    canceledEndAt: timestamp('canceled_end_at'),
    canceledReason: text('canceled_reason'),
    canceledReasonType: varchar('canceled_reason_type', { length: 50 }),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userEmail: varchar191('user_email'),
    orderNo: varchar191('order_no'),
    subscriptionNo: varchar191('subscription_no'),
    transactionNo: varchar191('transaction_no').unique().notNull(),
    transactionType: varchar('transaction_type', { length: 50 }).notNull(),
    transactionScene: varchar('transaction_scene', { length: 50 }),
    credits: int('credits').notNull(),
    remainingCredits: int('remaining_credits').notNull().default(0),
    description: text('description'),
    expiresAt: timestamp('expires_at'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    keyHash: varchar191('key_hash').notNull(),
    keyPrefix: varchar191('key_prefix').notNull(),
    title: varchar191('title').notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    name: varchar191('name').notNull().unique(),
    title: varchar191('title').notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    sort: int('sort').default(0).notNull(),
  },
  (table) => [
    index('idx_role_status').on(table.status),
  ]
);

export const permission = table(
  'permission',
  {
    id: varchar191('id').primaryKey(),
    code: varchar191('code').notNull().unique(),
    resource: varchar('resource', { length: 50 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    title: varchar191('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('idx_permission_resource_action').on(table.resource, table.action),
  ]
);

export const rolePermission = table(
  'role_permission',
  {
    id: varchar191('id').primaryKey(),
    roleId: varchar191('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionId: varchar191('permission_id')
      .notNull()
      .references(() => permission.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roleId: varchar191('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    mediaType: varchar('media_type', { length: 50 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    model: varchar191('model').notNull(),
    prompt: longtext('prompt').notNull(),
    options: longtext('options'),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    taskId: varchar191('task_id'),
    taskInfo: longtext('task_info'),
    taskResult: longtext('task_result'),
    costCredits: int('cost_credits').notNull().default(0),
    scene: varchar('scene', { length: 100 }).notNull().default(''),
    creditId: varchar191('credit_id'),
  },
  (table) => [
    index('idx_ai_task_user_media_type').on(table.userId, table.mediaType),
    index('idx_ai_task_media_type_status').on(table.mediaType, table.status),
  ]
);

export const chat = table(
  'chat',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    model: varchar191('model').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull().default(''),
    parts: longtext('parts').notNull(),
    metadata: longtext('metadata'),
    content: longtext('content'),
  },
  (table) => [index('idx_chat_user_status').on(table.userId, table.status)]
);

export const chatMessage = table(
  'chat_message',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatId: varchar191('chat_id')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    parts: longtext('parts').notNull(),
    metadata: longtext('metadata'),
    model: varchar191('model').notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('open'), // open | replied | closed
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index('idx_ticket_user').on(t.userId),
    index('idx_ticket_status').on(t.status),
  ]
);

export const ticketMessage = table(
  'ticket_message',
  {
    id: varchar191('id').primaryKey(),
    ticketId: varchar191('ticket_id')
      .notNull()
      .references(() => ticket.id),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id),
    role: varchar('role', { length: 50 }).notNull().default('user'), // user | admin
    content: longtext('content').notNull(),
    attachments: longtext('attachments').notNull(), // JSON array of image URLs (default [] set by service)
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull().default(''),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    installStatus: varchar('install_status', { length: 50 }).notNull().default('not_installed'),
    publicKey: varchar191('public_key').notNull().unique(),
    allowedDomains: longtext('allowed_domains').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: varchar191('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    content: longtext('content'),
    sourceUrl: text('source_url'),
    metadata: longtext('metadata').notNull(),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: varchar191('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('open'),
    sourceUrl: text('source_url'),
    visitorId: varchar191('visitor_id'),
    contactName: varchar('contact_name', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),
    lastMessage: text('last_message').notNull().default(''),
    messageCount: int('message_count').notNull().default(0),
    feedback: varchar('feedback', { length: 50 }),
    metadata: longtext('metadata').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index('idx_ai_conversation_chatbot_status').on(t.chatbotId, t.status),
    index('idx_ai_conversation_user_created').on(t.userId, t.createdAt),
  ]
);

export const aiConversationMessage = table(
  'ai_conversation_message',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: varchar191('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    conversationId: varchar191('conversation_id')
      .notNull()
      .references(() => aiConversation.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).notNull(),
    content: longtext('content').notNull(),
    citations: longtext('citations').notNull(),
    feedback: varchar('feedback', { length: 50 }),
    metadata: longtext('metadata').notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: varchar191('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    conversationId: varchar191('conversation_id'),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 100 }),
    sourceUrl: text('source_url'),
    status: varchar('status', { length: 50 }).notNull().default('new'),
    priority: varchar('priority', { length: 50 }).notNull().default('normal'),
    metadata: longtext('metadata').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index('idx_ai_lead_chatbot_status').on(t.chatbotId, t.status),
    index('idx_ai_lead_user_created').on(t.userId, t.createdAt),
  ]
);

export const aiHumanEscalation = table(
  'ai_human_escalation',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: varchar191('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    leadId: varchar191('lead_id').references(() => aiLead.id),
    conversationId: varchar191('conversation_id'),
    status: varchar('status', { length: 50 }).notNull().default('open'),
    assigneeUserId: varchar191('assignee_user_id').references(() => user.id),
    summary: text('summary').notNull().default(''),
    metadata: longtext('metadata').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index('idx_ai_escalation_chatbot_status').on(t.chatbotId, t.status),
    index('idx_ai_escalation_assignee').on(t.assigneeUserId),
  ]
);

export const aiAgentToken = table(
  'ai_agent_token',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    accessProfile: varchar('access_profile', { length: 50 }).notNull().default('standard'),
    scopes: longtext('scopes').notNull(),
    chatbotIds: longtext('chatbot_ids').notNull(),
    tokenPrefix: varchar('token_prefix', { length: 32 }).notNull(),
    tokenHash: varchar('token_hash', { length: 191 }).notNull(),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    agentTokenId: varchar191('agent_token_id').references(() => aiAgentToken.id),
    chatbotId: varchar191('chatbot_id').references(() => aiChatbot.id),
    action: varchar('action', { length: 191 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('queued'),
    approvalRequired: boolean('approval_required').notNull().default(false),
    summary: text('summary').notNull().default(''),
    diff: longtext('diff'),
    metadata: longtext('metadata').notNull(),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: varchar191('chatbot_id').references(() => aiChatbot.id, { onDelete: 'cascade' }),
    parentTaskId: varchar191('parent_task_id'),
    type: varchar('type', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('queued'),
    actorType: varchar('actor_type', { length: 50 }).notNull(),
    actorId: varchar191('actor_id').notNull(),
    authorizationVersion: varchar('authorization_version', { length: 100 }).notNull().default(''),
    requestId: varchar191('request_id').notNull().default(''),
    idempotencyKey: varchar191('idempotency_key').notNull(),
    inputSummary: text('input_summary').notNull(),
    outputSummary: text('output_summary').notNull(),
    errorSummary: text('error_summary').notNull(),
    metadata: longtext('metadata').notNull(),
    attempt: int('attempt').notNull().default(1),
    maxAttempts: int('max_attempts').notNull().default(5),
    runAfter: timestamp('run_after').defaultNow().notNull(),
    leaseOwner: varchar191('lease_owner'),
    leaseExpiresAt: timestamp('lease_expires_at'),
    cancellationRequestedAt: timestamp('cancellation_requested_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'), completedAt: timestamp('completed_at'), archivedAt: timestamp('archived_at'),
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
    id: varchar191('id').primaryKey(), taskId: varchar191('task_id').notNull().references(() => agentTask.id, { onDelete: 'cascade' }),
    sequence: int('sequence').notNull(), type: varchar('type', { length: 100 }).notNull(), summary: text('summary').notNull(),
    actorType: varchar('actor_type', { length: 50 }).notNull(), actorId: varchar191('actor_id').notNull(),
    requestId: varchar191('request_id').notNull().default(''), details: longtext('details').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_agent_task_event_task_sequence').on(t.taskId, t.sequence), index('idx_agent_task_event_created').on(t.createdAt)]
);

export const agentTaskArtifact = table(
  'agent_task_artifact',
  {
    id: varchar191('id').primaryKey(), taskId: varchar191('task_id').notNull().references(() => agentTask.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 100 }).notNull(), title: varchar('title', { length: 255 }).notNull(), storageKey: varchar191('storage_key'),
    checksum: varchar('checksum', { length: 128 }).notNull().default(''), accessScope: varchar('access_scope', { length: 50 }).notNull().default('tenant'),
    metadata: longtext('metadata').notNull(), expiresAt: timestamp('expires_at'), createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_agent_task_artifact_task').on(t.taskId), index('idx_agent_task_artifact_expiry').on(t.expiresAt)]
);

export const agentTaskCheckpoint = table(
  'agent_task_checkpoint',
  {
    id: varchar191('id').primaryKey(), taskId: varchar191('task_id').notNull().references(() => agentTask.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('waiting'), action: varchar('action', { length: 191 }).notNull(), summary: text('summary').notNull(),
    requestedByType: varchar('requested_by_type', { length: 50 }).notNull(), requestedById: varchar191('requested_by_id').notNull(),
    assigneeUserId: varchar191('assignee_user_id').references(() => user.id), decisionByUserId: varchar191('decision_by_user_id').references(() => user.id),
    decisionReason: text('decision_reason').notNull(), expiresAt: timestamp('expires_at').notNull(),
    decidedAt: timestamp('decided_at'), createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_agent_task_checkpoint_task').on(t.taskId), index('idx_agent_task_checkpoint_status_expiry').on(t.status, t.expiresAt), index('idx_agent_task_checkpoint_assignee').on(t.assigneeUserId, t.status)]
);

export const aiConfigVersion = table(
  'ai_config_version',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chatbotId: varchar191('chatbot_id')
      .notNull()
      .references(() => aiChatbot.id, { onDelete: 'cascade' }),
    settingKey: varchar('setting_key', { length: 191 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    version: int('version').notNull().default(1),
    content: longtext('content').notNull(),
    createdByType: varchar('created_by_type', { length: 50 }).notNull().default('user'),
    createdById: varchar191('created_by_id'),
    approvedByUserId: varchar191('approved_by_user_id').references(() => user.id),
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
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    actorType: varchar('actor_type', { length: 50 }).notNull(),
    actorId: varchar191('actor_id').notNull(),
    resourceType: varchar('resource_type', { length: 100 }).notNull(),
    resourceId: varchar191('resource_id').notNull(),
    action: varchar('action', { length: 191 }).notNull(),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    status: varchar('status', { length: 50 }).notNull().default('recorded'),
    diff: longtext('diff'),
    metadata: longtext('metadata').notNull(),
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

// ─── Chip P2P ────────────────────────────────────────────────────────────────

export const chipSegment = table(
  'chip_segment',
  {
    id: varchar191('id').primaryKey(),
    parentId: varchar191('parent_id'),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    sort: int('sort').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index('idx_chip_segment_parent').on(table.parentId)]
);

export const chip = table(
  'chip',
  {
    id: varchar191('id').primaryKey(),
    manufacturer: varchar('manufacturer', { length: 255 }),
    partNumber: varchar('part_number', { length: 255 }).notNull(),
    partNumberNorm: varchar('part_number_norm', { length: 255 }).notNull(),
    description: text('description'),
    sheetUrl: varchar('sheet_url', { length: 512 }),
    parameter: longtext('parameter'),
    segmentId: varchar191('segment_id').references(() => chipSegment.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    chipId: varchar191('chip_id')
      .notNull()
      .references(() => chip.id, { onDelete: 'cascade' }),
    supplier: varchar('supplier', { length: 255 }),
    partNumber: varchar('part_number', { length: 255 }).notNull(),
    supplierP2p: varchar('supplier_p2p', { length: 255 }),
    partNumberP2p: varchar('part_number_p2p', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('idx_pin2pin_chip').on(table.chipId),
    index('idx_pin2pin_part_number').on(table.partNumber),
  ]
);

export const bom = table(
  'bom',
  {
    id: varchar191('id').primaryKey(),
    chipId: varchar191('chip_id')
      .notNull()
      .references(() => chip.id, { onDelete: 'cascade' }),
    manufacturer: varchar('manufacturer', { length: 255 }),
    categoryName: varchar('category_name', { length: 255 }),
    partNumber: varchar('part_number', { length: 255 }).notNull(),
    quantity: int('quantity').notNull().default(1),
    unitPrice: int('unit_price').notNull().default(0),
    totalPrice: int('total_price').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index('idx_bom_chip').on(table.chipId)]
);

export const pdfParseCache = table(
  'pdf_parse_cache',
  {
    id: varchar191('id').primaryKey(),
    fileMd5: varchar191('file_md5').notNull().unique(),
    fileName: varchar('file_name', { length: 512 }).notNull(),
    chipPartNumber: varchar('chip_part_number', { length: 255 })
      .notNull()
      .default(''),
    sourceUrl: varchar('source_url', { length: 1024 }),
    pageCount: int('page_count').notNull().default(0),
    pages: longtext('pages'),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index('idx_pdf_parse_cache_part_number').on(table.chipPartNumber),
    index('idx_pdf_parse_cache_status').on(table.status),
  ]
);

export const chipCompareRecord = table(
  'chip_compare_record',
  {
    id: varchar191('id').primaryKey(),
    userId: varchar191('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    chipPartNumbers: text('chip_part_numbers').notNull(),
    fileList: text('file_list').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    stage: varchar('stage', { length: 255 }).notNull().default(''),
    provider: varchar('provider', { length: 50 }).notNull().default('openai'),
    model: varchar191('model').notNull(),
    language: varchar('language', { length: 20 }).notNull().default('en'),
    prompt: longtext('prompt'),
    result: longtext('result'),
    inputTokens: int('input_tokens'),
    outputTokens: int('output_tokens'),
    durationMs: int('duration_ms'),
    costCredits: int('cost_credits').notNull().default(0),
    creditId: varchar191('credit_id'),
    cacheKey: varchar191('cache_key').notNull().default(''),
    cacheHit: boolean('cache_hit').notNull().default(false),
    source: varchar('source', { length: 50 }).notNull().default('user'),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
    id: varchar191('id').primaryKey(),
    recordId: varchar191('record_id')
      .notNull()
      .references(() => chipCompareRecord.id, { onDelete: 'cascade' }),
    paramName: varchar('param_name', { length: 255 }).notNull(),
    paramCategory: varchar('param_category', { length: 255 }),
    chipsTrace: longtext('chips_trace').notNull(),
    diffLevel: varchar('diff_level', { length: 50 }),
    diffNote: text('diff_note'),
    userNote: text('user_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
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
