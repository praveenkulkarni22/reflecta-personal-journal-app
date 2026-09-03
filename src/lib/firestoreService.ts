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
  serverTimestamp,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { JournalEntry, Conversation, ConversationMessage, ConversationSummary, InnerLandscapeSynthesis, CalendarEvent } from '../types';

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
}

// ----------------------------------------------------
// Journal Entries
// ----------------------------------------------------
export async function saveJournalEntry(userId: string, entry: Omit<JournalEntry, 'userId' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<JournalEntry> {
  assertUserAuth(userId);
  const id = entry.id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
}

export async function fetchUserJournals(userId: string, maxLimit = 50): Promise<JournalEntry[]> {
  assertUserAuth(userId);
  const journalsRef = collection(db, 'users', userId, 'journals');
  const q = query(journalsRef, orderBy('createdAt', 'desc'), limit(maxLimit));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as JournalEntry);
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  assertUserAuth(userId);
  const entryRef = doc(db, 'users', userId, 'journals', entryId);
  await deleteDoc(entryRef);
}

// ----------------------------------------------------
// Conversations & Messages
// ----------------------------------------------------
export async function createConversation(userId: string, title: string, journalEntryId?: string): Promise<Conversation> {
  assertUserAuth(userId);
  const convId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
}

export async function fetchUserConversations(userId: string, maxLimit = 30): Promise<Conversation[]> {
  assertUserAuth(userId);
  const convsRef = collection(db, 'users', userId, 'conversations');
  const q = query(convsRef, orderBy('updatedAt', 'desc'), limit(maxLimit));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as Conversation);
}

export async function fetchConversationMessages(userId: string, conversationId: string): Promise<ConversationMessage[]> {
  assertUserAuth(userId);
  const msgsRef = collection(db, 'users', userId, 'conversations', conversationId, 'messages');
  const q = query(msgsRef, orderBy('timestamp', 'asc'), limit(100));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as ConversationMessage);
}

export async function appendConversationMessage(
  userId: string, 
  conversationId: string, 
  message: Omit<ConversationMessage, 'id' | 'timestamp'>
): Promise<ConversationMessage> {
  assertUserAuth(userId);
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
    // If doc doesn't exist yet, set it
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
}

// ----------------------------------------------------
// Summaries
// ----------------------------------------------------
export async function saveConversationSummary(userId: string, summary: ConversationSummary): Promise<void> {
  assertUserAuth(userId);
  const summaryRef = doc(db, 'users', userId, 'summaries', summary.id);
  await setDoc(summaryRef, sanitizePayload(summary));

  // Also link summary to conversation
  const convRef = doc(db, 'users', userId, 'conversations', summary.conversationId);
  await updateDoc(convRef, sanitizePayload({
    summary
  })).catch(() => {});
}

export async function fetchUserSummaries(userId: string, maxLimit = 20): Promise<ConversationSummary[]> {
  assertUserAuth(userId);
  const summariesRef = collection(db, 'users', userId, 'summaries');
  const q = query(summariesRef, orderBy('createdAt', 'desc'), limit(maxLimit));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as ConversationSummary);
}

// ----------------------------------------------------
// Longitudinal Theme Syntheses (Original Feature)
// ----------------------------------------------------
export async function saveLandscapeSynthesis(userId: string, synthesis: InnerLandscapeSynthesis): Promise<void> {
  assertUserAuth(userId);
  const insightRef = doc(db, 'users', userId, 'insights', synthesis.id);
  await setDoc(insightRef, sanitizePayload(synthesis));
}

export async function fetchLatestLandscapeSynthesis(userId: string): Promise<InnerLandscapeSynthesis | null> {
  assertUserAuth(userId);
  const insightsRef = collection(db, 'users', userId, 'insights');
  const q = query(insightsRef, orderBy('generatedAt', 'desc'), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) return null;
  return snap.docs[0].data() as InnerLandscapeSynthesis;
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
}

export async function fetchUserCalendarEvents(userId: string, maxLimit = 150): Promise<CalendarEvent[]> {
  assertUserAuth(userId);
  const eventsRef = collection(db, 'users', userId, 'events');
  const q = query(eventsRef, orderBy('date', 'asc'), limit(maxLimit));
  const snap = await getDocs(q);

  return snap.docs.map(doc => doc.data() as CalendarEvent);
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  assertUserAuth(userId);
  const eventRef = doc(db, 'users', userId, 'events', eventId);
  await deleteDoc(eventRef);
}

export async function toggleCalendarEventCompletion(userId: string, eventId: string, isCompleted: boolean): Promise<void> {
  assertUserAuth(userId);
  const eventRef = doc(db, 'users', userId, 'events', eventId);
  await updateDoc(eventRef, sanitizePayload({
    isCompleted,
    updatedAt: new Date().toISOString()
  }));
}

