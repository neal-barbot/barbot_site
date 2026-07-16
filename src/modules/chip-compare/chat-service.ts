import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/core/db';
import { chat, chatMessage, type Chat, type ChatMessage } from '@/config/db/schema';
import { getUuid } from '@/lib/hash';

/**
 * Persistent QA chat sessions for the chip pin-to-pin assistant, backed by
 * the built-in `chat` / `chat_message` tables. Every operation is scoped to
 * the owning user — a chat id from another user behaves like "not found".
 */

const CHAT_MODEL = 'deepseek-chat';
const CHAT_PROVIDER = 'deepseek';
const STATUS_ACTIVE = 'active';
const STATUS_DELETED = 'deleted';

export interface ChatMessageView {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

export interface ChatView {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

function textToParts(content: string): string {
  return JSON.stringify([{ type: 'text', text: content }]);
}

function partsToText(parts: string): string {
  try {
    const parsed = JSON.parse(parts);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
    }
  } catch {
    // fall through — legacy/plain-text parts
  }
  return parts;
}

function toChatView(row: Chat): ChatView {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessageView(row: ChatMessage): ChatMessageView {
  return {
    id: row.id,
    role: row.role,
    content: partsToText(row.parts),
    createdAt: row.createdAt,
  };
}

async function getOwnedChat(chatId: string, userId: string): Promise<Chat | null> {
  const [found] = await db()
    .select()
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId), eq(chat.status, STATUS_ACTIVE)))
    .limit(1);
  return found ?? null;
}

export async function createChat(userId: string, title: string): Promise<ChatView> {
  const now = new Date();
  const row: Chat = {
    id: getUuid(),
    userId,
    status: STATUS_ACTIVE,
    createdAt: now,
    updatedAt: now,
    model: CHAT_MODEL,
    provider: CHAT_PROVIDER,
    title: title.trim().slice(0, 200),
    parts: '[]',
    metadata: null,
    content: null,
  };
  await db().insert(chat).values(row);
  return toChatView(row);
}

export async function listChats(userId: string): Promise<ChatView[]> {
  const rows = await db()
    .select()
    .from(chat)
    .where(and(eq(chat.userId, userId), eq(chat.status, STATUS_ACTIVE)))
    .orderBy(desc(chat.updatedAt))
    .limit(100);
  return rows.map(toChatView);
}

export async function getChatMessages(
  chatId: string,
  userId: string
): Promise<{ chat: ChatView; messages: ChatMessageView[] } | null> {
  const owned = await getOwnedChat(chatId, userId);
  if (!owned) return null;

  const rows = await db()
    .select()
    .from(chatMessage)
    .where(and(eq(chatMessage.chatId, chatId), eq(chatMessage.status, STATUS_ACTIVE)))
    .orderBy(asc(chatMessage.createdAt))
    .limit(500);
  return { chat: toChatView(owned), messages: rows.map(toMessageView) };
}

export async function appendMessage(
  chatId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessageView | null> {
  const owned = await getOwnedChat(chatId, userId);
  if (!owned) return null;

  const now = new Date();
  const row: ChatMessage = {
    id: getUuid(),
    userId,
    chatId,
    status: STATUS_ACTIVE,
    createdAt: now,
    updatedAt: now,
    role,
    parts: textToParts(content),
    metadata: null,
    model: owned.model,
    provider: owned.provider,
  };
  await db().insert(chatMessage).values(row);

  // Bump the session and backfill an empty title from the first user message.
  const nextTitle =
    owned.title === '' && role === 'user' ? content.trim().slice(0, 80) : owned.title;
  await db()
    .update(chat)
    .set({ updatedAt: now, title: nextTitle })
    .where(eq(chat.id, chatId));

  return toMessageView(row);
}

export async function deleteChat(chatId: string, userId: string): Promise<boolean> {
  const owned = await getOwnedChat(chatId, userId);
  if (!owned) return false;

  // Soft delete — the session drops out of every list/read query.
  await db().update(chat).set({ status: STATUS_DELETED }).where(eq(chat.id, chatId));
  await db()
    .update(chatMessage)
    .set({ status: STATUS_DELETED })
    .where(eq(chatMessage.chatId, chatId));
  return true;
}
