import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
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
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date) && !(val instanceof Timestamp)) {
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
// User Profile
// ----------------------------------------------------
export async function syncUserProfile(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }) {
  assertUserAuth(user.uid);
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, sanitizePayload({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    } else {
      await updateDoc(userRef, sanitizePayload({
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
    const entryRef = doc(db, 'users', userId, 'journals', id);
    const now = new Date().toISOString();

    const fullEntry: JournalEntry = {
      ...entry,
      id,
      userId,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(entryRef, sanitizePayload(fullEntry), { merge: true });
    return fullEntry;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserJournals(userId: string, maxLimit = 50): Promise<JournalEntry[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/journals`;
  try {
    const journalsRef = collection(db, 'users', userId, 'journals');
    const q = query(journalsRef, orderBy('createdAt', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as JournalEntry);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/journals/${entryId}`;
  try {
    const entryRef = doc(db, 'users', userId, 'journals', entryId);
    await deleteDoc(entryRef);
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
    const convRef = doc(db, 'users', userId, 'conversations', convId);
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

    await setDoc(convRef, sanitizePayload(conv));
    return conv;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchUserConversations(userId: string, maxLimit = 30): Promise<Conversation[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/conversations`;
  try {
    const convsRef = collection(db, 'users', userId, 'conversations');
    const q = query(convsRef, orderBy('updatedAt', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Conversation);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchConversationMessages(userId: string, conversationId: string): Promise<ConversationMessage[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/conversations/${conversationId}/messages`;
  try {
    const msgsRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
    const q = query(msgsRef, orderBy('timestamp', 'asc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as ConversationMessage);
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
    const msgRef = doc(db, 'users', userId, 'conversations', conversationId, 'messages', msgId);
    const now = new Date().toISOString();

    const fullMsg: ConversationMessage = {
      ...message,
      id: msgId,
      timestamp: now
    };

    await setDoc(msgRef, sanitizePayload(fullMsg));

    // Update conversation parent metadata
    const convRef = doc(db, 'users', userId, 'conversations', conversationId);
    const snippet = message.content.slice(0, 90).replace(/\n/g, ' ');
    
    await updateDoc(convRef, sanitizePayload({
      updatedAt: now,
      lastMessageSnippet: snippet,
    })).catch(async () => {
      await setDoc(convRef, sanitizePayload({
        id: conversationId,
        userId,
        title: snippet.slice(0, 40) || 'Reflection Dialogue',
        createdAt: now,
        updatedAt: now,
        lastMessageSnippet: snippet,
        messageCount: 1
      }), { merge: true });
    });

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
    const summaryRef = doc(db, 'users', userId, 'summaries', summary.id);
    await setDoc(summaryRef, sanitizePayload(summary));

    const convRef = doc(db, 'users', userId, 'conversations', summary.conversationId);
    await updateDoc(convRef, sanitizePayload({
      summary
    })).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserSummaries(userId: string, maxLimit = 20): Promise<ConversationSummary[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/summaries`;
  try {
    const summariesRef = collection(db, 'users', userId, 'summaries');
    const q = query(summariesRef, orderBy('createdAt', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as ConversationSummary);
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
    const insightRef = doc(db, 'users', userId, 'insights', synthesis.id);
    await setDoc(insightRef, sanitizePayload(synthesis));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchLatestLandscapeSynthesis(userId: string): Promise<InnerLandscapeSynthesis | null> {
  assertUserAuth(userId);
  const path = `users/${userId}/insights`;
  try {
    const insightsRef = collection(db, 'users', userId, 'insights');
    const q = query(insightsRef, orderBy('generatedAt', 'desc'), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) return null;
    return snap.docs[0].data() as InnerLandscapeSynthesis;
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
    const eventRef = doc(db, 'users', userId, 'events', id);
    const now = new Date().toISOString();

    const fullEvent: CalendarEvent = {
      ...event,
      id,
      userId,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(eventRef, sanitizePayload(fullEvent), { merge: true });
    return fullEvent;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserCalendarEvents(userId: string, maxLimit = 150): Promise<CalendarEvent[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/events`;
  try {
    const eventsRef = collection(db, 'users', userId, 'events');
    const q = query(eventsRef, orderBy('date', 'asc'), limit(maxLimit));
    const snap = await getDocs(q);

    return snap.docs.map(doc => doc.data() as CalendarEvent);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/events/${eventId}`;
  try {
    const eventRef = doc(db, 'users', userId, 'events', eventId);
    await deleteDoc(eventRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleCalendarEventCompletion(userId: string, eventId: string, isCompleted: boolean): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/events/${eventId}`;
  try {
    const eventRef = doc(db, 'users', userId, 'events', eventId);
    await updateDoc(eventRef, sanitizePayload({
      isCompleted,
      updatedAt: new Date().toISOString()
    }));
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
    const settingRef = doc(db, 'users', userId, 'notificationSettings', setting.id);
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
    await setDoc(settingRef, sanitizePayload(fullSetting), { merge: true });
    return fullSetting;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserNotificationSettings(userId: string): Promise<NotificationSetting[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/notificationSettings`;
  try {
    const ref = collection(db, 'users', userId, 'notificationSettings');
    const snap = await getDocs(ref);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id || data.id || `setting-${Math.random().toString(36).slice(2, 9)}`
      } as NotificationSetting;
    });
  } catch (error) {
    // If collection is empty or offline, return empty list safely
    return [];
  }
}

export async function deleteUserNotificationSetting(userId: string, settingId: string): Promise<void> {
  assertUserAuth(userId);
  const path = `users/${userId}/notificationSettings/${settingId}`;
  try {
    const ref = doc(db, 'users', userId, 'notificationSettings', settingId);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserNotificationEvents(userId: string, maxLimit = 50): Promise<NotificationEventRecord[]> {
  assertUserAuth(userId);
  const path = `users/${userId}/notificationEvents`;
  try {
    const ref = collection(db, 'users', userId, 'notificationEvents');
    const q = query(ref, orderBy('deliveredAt', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id || data.id || `event-${Math.random().toString(36).slice(2, 9)}`
      } as NotificationEventRecord;
    });
  } catch (error) {
    return [];
  }
}

