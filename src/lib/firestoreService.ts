import { auth, getCurrentUserToken } from './firebase';
import { 
  JournalEntry, 
  Conversation, 
  ConversationMessage, 
  ConversationSummary, 
  InnerLandscapeSynthesis, 
  CalendarEvent,
  NotificationSetting,
  NotificationEventRecord
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Deeply sanitizes objects to remove undefined properties before writing to Firestore
 */
export function sanitizePayload<T extends Record<string, any>>(obj: T): T {
  const clean = {} as Record<string, any>;
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      clean[key] = sanitizePayload(val);
    } else {
      clean[key] = val;
    }
  }
  return clean as T;
}

/**
 * Assert that the requested operation belongs to the currently authenticated user
 */
function assertUserAuth(userId: string) {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error('Authentication violation: UID mismatch or unauthenticated user');
  }
}

// ----------------------------------------------------
// Secure DB Proxy Network Helpers
// ----------------------------------------------------

async function dbGet(path: string): Promise<any> {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    'Accept-Language': 'en',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(`/api/db/get?path=${encodeURIComponent(path)}`, { headers });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to get document at path: ${path}`);
  }
  const body = await res.json();
  return body.data;
}

async function dbSet(path: string, data: any): Promise<void> {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(`/api/db/set?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    throw new Error(`Failed to set document at path: ${path}`);
  }
}

async function dbDelete(path: string): Promise<void> {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(`/api/db/delete?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers
  });
  if (!res.ok) {
    throw new Error(`Failed to delete document at path: ${path}`);
  }
}

async function dbList(path: string): Promise<any[]> {
  const token = await getCurrentUserToken();
  const headers: Record<string, string> = {
    'Accept-Language': 'en',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  const res = await fetch(`/api/db/list?path=${encodeURIComponent(path)}`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to list documents at path: ${path}`);
  }
  const body = await res.json();
  return body.documents || [];
}

// ----------------------------------------------------
// User Profile
// ----------------------------------------------------
export async function syncUserProfile(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) {
  assertUserAuth(user.uid);
  const path = `users/${user.uid}`;
  try {
    const existing = await dbGet(path);
    if (!existing) {
      await dbSet(path, sanitizePayload({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    } else {
      await dbSet(path, sanitizePayload({
        ...existing,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        updatedAt: new Date().toISOString()
      }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------
// Journal Entries
// ----------------------------------------------------
export async function saveJournalEntry(userId: string, entry: Omit<JournalEntry, 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<JournalEntry> {
  assertUserAuth(userId);
  const id = entry.id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/journals/${id}`;
  try {
    const now = new Date().toISOString();
    const fullEntry: JournalEntry = {
      ...entry,
      id,
      userId,
      createdAt: now,
      updatedAt: now
    };
    await dbSet(path, sanitizePayload(fullEntry));
    return fullEntry;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserJournals(userId: string, maxLimit = 50): Promise<JournalEntry[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/journals`;
  try {
    const docs = await dbList(path);
    const journals = docs as JournalEntry[];
    journals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return journals.slice(0, maxLimit);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/journals/${entryId}`;
  try {
    await dbDelete(path);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ----------------------------------------------------
// Conversations & Messages
// ----------------------------------------------------
export async function createConversation(userId: string, title: string, journalEntryId?: string): Promise<Conversation> {
  assertUserAuth(userId);
  const convId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/conversations/${convId}`;
  try {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: convId,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      lastMessageSnippet: '',
      messageCount: 0,
      journalEntryId
    };
    await dbSet(path, sanitizePayload(conv));
    return conv;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserConversations(userId: string, maxLimit = 30): Promise<Conversation[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/conversations`;
  try {
    const docs = await dbList(path);
    const convs = docs as Conversation[];
    convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return convs.slice(0, maxLimit);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchConversationMessages(userId: string, conversationId: string): Promise<ConversationMessage[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const docs = await dbList(path);
    const msgs = docs as ConversationMessage[];
    msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return msgs.slice(0, 100);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function appendConversationMessage(
  userId: string, 
  conversationId: string, 
  message: Omit<ConversationMessage, 'id' | 'timestamp'>
): Promise<ConversationMessage> {
  assertUserAuth(userId);
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/conversations/${conversationId}/messages/${msgId}`;
  try {
    const now = new Date().toISOString();
    const fullMsg: ConversationMessage = {
      ...message,
      id: msgId,
      timestamp: now
    };
    await dbSet(path, sanitizePayload(fullMsg));

    // Update conversation parent metadata
    const convPath = `users/${userId}/conversations/${conversationId}`;
    const snippet = message.content.slice(0, 90).replace(/\n/g, ' ');
    
    const existingConv = await dbGet(convPath);
    if (existingConv) {
      await dbSet(convPath, sanitizePayload({
        ...existingConv,
        updatedAt: now,
        lastMessageSnippet: snippet,
        messageCount: (existingConv.messageCount || 0) + 1
      }));
    } else {
      await dbSet(convPath, sanitizePayload({
        id: conversationId,
        userId,
        title: snippet.slice(0, 40) || 'Reflection Dialogue',
        createdAt: now,
        updatedAt: now,
        lastMessageSnippet: snippet,
        messageCount: 1
      }));
    }

    return fullMsg;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ----------------------------------------------------
// Summaries
// ----------------------------------------------------
export async function saveConversationSummary(userId: string, summary: ConversationSummary): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/summaries/${summary.id}`;
  try {
    await dbSet(path, sanitizePayload(summary));

    const convPath = `users/${userId}/conversations/${summary.conversationId}`;
    const existingConv = await dbGet(convPath);
    if (existingConv) {
      await dbSet(convPath, sanitizePayload({
        ...existingConv,
        summary
      }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserSummaries(userId: string, maxLimit = 20): Promise<ConversationSummary[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/summaries`;
  try {
    const docs = await dbList(path);
    const summaries = docs as ConversationSummary[];
    summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return summaries.slice(0, maxLimit);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ----------------------------------------------------
// Longitudinal Theme Syntheses
// ----------------------------------------------------
export async function saveLandscapeSynthesis(userId: string, synthesis: InnerLandscapeSynthesis): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/insights/${synthesis.id}`;
  try {
    await dbSet(path, sanitizePayload(synthesis));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchLatestLandscapeSynthesis(userId: string): Promise<InnerLandscapeSynthesis | null> {
  assertUserAuth(userId);
  const path = `users/${userId}/insights`;
  try {
    const docs = await dbList(path);
    const insights = docs as InnerLandscapeSynthesis[];
    if (insights.length === 0) return null;
    insights.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    return insights[0];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ----------------------------------------------------
// Calendar Events & Reminders
// ----------------------------------------------------
export async function saveCalendarEvent(
  userId: string, 
  event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<CalendarEvent> {
  assertUserAuth(userId);
  const id = event.id || `event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/events/${id}`;
  try {
    const now = new Date().toISOString();
    const fullEvent: CalendarEvent = {
      ...event,
      id,
      userId,
      createdAt: now,
      updatedAt: now
    };
    await dbSet(path, sanitizePayload(fullEvent));
    return fullEvent;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserCalendarEvents(userId: string, maxLimit = 150): Promise<CalendarEvent[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/events`;
  try {
    const docs = await dbList(path);
    const events = docs as CalendarEvent[];
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return events.slice(0, maxLimit);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/events/${eventId}`;
  try {
    await dbDelete(path);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleCalendarEventCompletion(userId: string, eventId: string, isCompleted: boolean): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/events/${eventId}`;
  try {
    const existing = await dbGet(path);
    if (existing) {
      await dbSet(path, sanitizePayload({
        ...existing,
        isCompleted,
        updatedAt: new Date().toISOString()
      }));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ----------------------------------------------------
// External Notification Settings & Events (Owner-Bound)
// ----------------------------------------------------
export async function saveUserNotificationSetting(userId: string, setting: Partial<NotificationSetting> & { id: string }): Promise<NotificationSetting> {
  assertUserAuth(userId);
  const path = `users/${userId}/notificationSettings/${setting.id}`;
  try {
    const now = new Date().toISOString();
    const fullSetting: NotificationSetting = {
      id: setting.id,
      userId,
      provider: setting.provider || 'discord',
      enabled: setting.enabled !== false,
      destinationUrl: setting.destinationUrl,
      recipientEmail: setting.recipientEmail,
      eventTypes: setting.eventTypes || ['goal', 'idea', 'reminder', 'highlight'],
      privacyLevel: setting.privacyLevel || 'minimal',
      channelName: setting.channelName || `${(setting.provider || 'discord').toUpperCase()} Alerts`,
      createdAt: setting.createdAt || now,
      updatedAt: now
    };
    await dbSet(path, sanitizePayload(fullSetting));
    return fullSetting;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserNotificationSettings(userId: string): Promise<NotificationSetting[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/notificationSettings`;
  try {
    const docs = await dbList(path);
    return docs.map(data => ({
      ...data,
      id: data.id || `setting-${Math.random().toString(36).slice(2, 9)}`
    } as NotificationSetting));
  } catch (error) {
    return [];
  }
}

export async function deleteUserNotificationSetting(userId: string, settingId: string): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/notificationSettings/${settingId}`;
  try {
    await dbDelete(path);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserNotificationEvents(userId: string, maxLimit = 50): Promise<NotificationEventRecord[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/notificationEvents`;
  try {
    const docs = await dbList(path);
    const records = docs as NotificationEventRecord[];
    records.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
    return records.slice(0, maxLimit);
  } catch (error) {
    return [];
  }
}
