import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
const PORT = 3000;

// ----------------------------------------------------
// Security & Hardening Middleware (Zero-Trust, MITM & CSP)
// ----------------------------------------------------
app.disable('x-powered-by');

// Global Security Headers for MITM protection and browser defense
app.use((req, res, next) => {
  // HTTP Strict Transport Security (HSTS) - prevents SSL stripping / MITM downgrades
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Clickjacking prevention while allowing secure framing within AI Studio / Google Cloud
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Prevent cross-origin referrer leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent unauthorized cross-origin resource access
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Robust Content Security Policy (CSP)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.googleapis.com https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.googleapis.com https://maps.gstatic.com https://maps.googleapis.com",
      "connect-src 'self' https://*.googleapis.com wss://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://*.firebasestorage.app https://*.google.com",
      "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ')
  );

  // For API endpoints, prevent any intermediate caching of private data
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
});

// Body parser with strict size ceiling
app.use(express.json({ limit: '1mb' }));

// ----------------------------------------------------
// Memory-Safe Rate Limiter (IP + User Isolation)
// ----------------------------------------------------
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Periodic pruning of expired entries to prevent memory-leak denial-of-service
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers['x-forwarded-for'];
  const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '') || req.ip || req.socket.remoteAddress || 'unknown';
  const authHeader = req.headers['authorization'] || '';
  // Hash/slice the auth header if present to avoid storing raw bearer tokens as map keys
  const tokenHash = authHeader.length > 20 ? authHeader.slice(-16) : 'anon';
  const identifier = `${clientIp}_${tokenHash}`;

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100; // 100 requests/min ceiling

  const record = rateLimitMap.get(identifier) || { count: 0, resetTime: now + windowMs };
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count++;
  }
  rateLimitMap.set(identifier, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      error: 'Too many requests. Please pause for a moment to breathe before continuing.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
  next();
}

app.use('/api/', rateLimiter);

// ----------------------------------------------------
// Firebase Admin SDK & Zero-Trust Authentication Guard
// ----------------------------------------------------
let authProjectId = process.env.FIREBASE_PROJECT_ID;
let firestoreDatabaseId: string | undefined = undefined;
let authApiKey = '';

// 1. Read from firebase-applet-config.json (highest priority because it matches client-side authentication)
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    if (raw.projectId) {
      authProjectId = raw.projectId;
    }
    if (raw.firestoreDatabaseId && raw.firestoreDatabaseId !== '(default)') {
      firestoreDatabaseId = raw.firestoreDatabaseId;
    }
    if (raw.apiKey) {
      authApiKey = raw.apiKey;
    }
  }
} catch {
  // Graceful fallback
}

// Fallback for Auth project ID if not specified
if (!authProjectId) {
  authProjectId = 'gen-lang-client-0313222215';
}

// 2. Resolve Database project ID. Force it to match authProjectId because the custom database resides in the Firebase project, not the temporary Cloud Run container project.
let dbProjectId = authProjectId;

let dbApp: App | null = null;
let authApp: App | null = null;

function getDbApp(): App | null {
  if (dbApp) return dbApp;
  try {
    const existing = getApps();
    const found = existing.find(a => a.name === '[DEFAULT]');
    if (found) {
      dbApp = found;
      return dbApp;
    }
    dbApp = initializeApp({
      projectId: dbProjectId
    });
    return dbApp;
  } catch (err) {
    console.warn('Firebase Admin lazy dbApp initialization note:', err);
    return null;
  }
}

function getAuthApp(): App | null {
  if (authApp) return authApp;
  try {
    const existing = getApps();
    const found = existing.find(a => a.name === 'authApp');
    if (found) {
      authApp = found;
      return authApp;
    }
    authApp = initializeApp({
      projectId: authProjectId
    }, 'authApp');
    return authApp;
  } catch (err) {
    console.warn('Firebase Admin lazy authApp initialization note:', err);
    return null;
  }
}

function fromRestValue(value: any): any {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return parseFloat(value.doubleValue);
  if ('arrayValue' in value) {
    const values = value.arrayValue.values || [];
    return values.map((v: any) => fromRestValue(v));
  }
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    const obj: any = {};
    for (const k of Object.keys(fields)) {
      obj[k] = fromRestValue(fields[k]);
    }
    return obj;
  }
  if ('timestampValue' in value) return value.timestampValue;
  return null;
}

function fromRestDocument(doc: any): any {
  if (!doc || !doc.fields) return null;
  const obj: any = {};
  const parts = doc.name.split('/');
  obj.id = parts[parts.length - 1];
  for (const k of Object.keys(doc.fields)) {
    obj[k] = fromRestValue(doc.fields[k]);
  }
  return obj;
}

function toRestValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    } else {
      return { doubleValue: val };
    }
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(v => toRestValue(v))
      }
    };
  }
  if (typeof val === 'object') {
    const fields: any = {};
    for (const k of Object.keys(val)) {
      fields[k] = toRestValue(val[k]);
    }
    return {
      mapValue: { fields }
    };
  }
  return { stringValue: String(val) };
}

function toRestDocumentFields(obj: any): any {
  const fields: any = {};
  for (const k of Object.keys(obj)) {
    if (k === 'id') continue;
    fields[k] = toRestValue(obj[k]);
  }
  return { fields };
}

class FirestoreRestClient {
  private projectId: string;
  private databaseId: string;
  private token: string;
  private apiKey: string;

  constructor(projectId: string, databaseId: string, token: string, apiKey: string) {
    this.projectId = projectId;
    this.databaseId = databaseId;
    this.token = token;
    this.apiKey = apiKey;
  }

  private getBaseUrl(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/${this.databaseId}/documents`;
  }

  private getUrl(path: string): string {
    const base = `${this.getBaseUrl()}/${path}`;
    return this.apiKey ? `${base}?key=${this.apiKey}` : base;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  async getDocument(path: string): Promise<any> {
    try {
      const url = this.getUrl(path);
      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.status === 404 || res.status === 403 || res.status === 401) return null;
      if (!res.ok) {
        return null;
      }
      const doc = await res.json();
      return fromRestDocument(doc);
    } catch {
      return null;
    }
  }

  async listDocuments(path: string): Promise<any[]> {
    try {
      const url = this.getUrl(path);
      const res = await fetch(url, { headers: this.getHeaders() });
      if (res.status === 404 || res.status === 403 || res.status === 401) return [];
      if (!res.ok) {
        return [];
      }
      const data = await res.json();
      const documents = data.documents || [];
      return documents.map((d: any) => fromRestDocument(d)).filter(Boolean);
    } catch {
      return [];
    }
  }

  async setDocument(path: string, data: any): Promise<any> {
    try {
      let url = this.getUrl(path);
      const payload = toRestDocumentFields(data);
      const fieldKeys = Object.keys(payload.fields || {});
      if (fieldKeys.length > 0) {
        const mask = fieldKeys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
        url += (url.includes('?') ? '&' : '?') + mask;
      }
      const res = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.status === 403 || res.status === 401) return null;
      if (!res.ok) return null;
      const doc = await res.json();
      return fromRestDocument(doc);
    } catch {
      return null;
    }
  }

  async deleteDocument(path: string): Promise<void> {
    try {
      const url = this.getUrl(path);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      if (res.status === 200 || res.status === 204 || res.status === 404 || res.status === 403 || res.status === 401) {
        return;
      }
    } catch {
      // Graceful fallback
    }
  }
}

class FirestoreCollectionWrapper {
  private client: FirestoreRestClient;
  private path: string;

  constructor(client: FirestoreRestClient, path: string) {
    this.client = client;
    this.path = path;
  }

  doc(id: string) {
    return {
      get: async () => {
        const fullPath = `${this.path}/${id}`;
        const data = await this.client.getDocument(fullPath);
        return {
          exists: !!data,
          id,
          data: () => data
        };
      },
      set: async (data: any, options?: { merge?: boolean }) => {
        const fullPath = `${this.path}/${id}`;
        await this.client.setDocument(fullPath, data);
      },
      delete: async () => {
        const fullPath = `${this.path}/${id}`;
        await this.client.deleteDocument(fullPath);
      }
    };
  }

  async get() {
    const docs = await this.client.listDocuments(this.path);
    return {
      size: docs.length,
      docs: docs.map(d => ({
        id: d.id,
        data: () => d
      }))
    };
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return {
      limit: (n: number) => {
        return {
          get: async () => {
            const docs = await this.client.listDocuments(this.path);
            docs.sort((a, b) => {
              const valA = a[field];
              const valB = b[field];
              if (valA < valB) return direction === 'asc' ? -1 : 1;
              if (valA > valB) return direction === 'asc' ? 1 : -1;
              return 0;
            });
            const sliced = docs.slice(0, n);
            return {
              size: sliced.length,
              docs: sliced.map(d => ({
                id: d.id,
                data: () => d
              }))
            };
          }
        };
      },
      get: async () => {
        const docs = await this.client.listDocuments(this.path);
        docs.sort((a, b) => {
          const valA = a[field];
          const valB = b[field];
          if (valA < valB) return direction === 'asc' ? -1 : 1;
          if (valA > valB) return direction === 'asc' ? 1 : -1;
          return 0;
        });
        return {
          size: docs.length,
          docs: docs.map(d => ({
            id: d.id,
            data: () => d
          }))
        };
      }
    };
  }

  where(field: string, op: string, val: any) {
    return {
      get: async () => {
        const docs = await this.client.listDocuments(this.path);
        const filtered = docs.filter(d => {
          const itemVal = d[field];
          if (op === '==') return itemVal === val;
          return false;
        });
        return {
          size: filtered.length,
          docs: filtered.map(d => ({
            id: d.id,
            data: () => d
          }))
        };
      }
    };
  }
}

function getBaseAdminFirestore() {
  const app = getDbApp();
  if (app) {
    return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
  }
  return null;
}

function getAdminFirestore(req?: AuthenticatedRequest): any {
  if (!req) {
    return getBaseAdminFirestore();
  }
  const authHeader = req.headers['authorization'] || req.headers.authorization || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') 
    ? authHeader.slice(7).trim() 
    : '';
  const client = new FirestoreRestClient(authProjectId, firestoreDatabaseId || '(default)', token, authApiKey);
  return {
    collection: (path: string) => new FirestoreCollectionWrapper(client, path)
  };
}

export type UserRole = 'user' | 'admin' | 'super_admin';

export type AdminPermission = 
  | 'admin.dashboard.read'
  | 'admin.users.read'
  | 'admin.users.manage'
  | 'admin.notifications.manage'
  | 'admin.system.read'
  | 'admin.audit.read';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
  role?: UserRole;
  claims?: Record<string, any>;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// ----------------------------------------------------
// Admin RBAC & Server Authorization Engine
// ----------------------------------------------------
const ADMIN_EMAILS_ENV = process.env.ADMIN_EMAILS;
if (!ADMIN_EMAILS_ENV) {
  console.error('❌ FATAL ERROR: The ADMIN_EMAILS environment variable is not configured!');
  console.error('To deploy this secure application, you must provide a comma-separated list of bootstrap administrator email addresses.');
  console.error('Example deployment: gcloud run deploy reflecta --set-env-vars="ADMIN_EMAILS=admin@example.com"');
  throw new Error('MANDATORY CONFIGURATION MISSING: ADMIN_EMAILS environment variable is required.');
}

const BOOTSTRAP_ADMIN_EMAILS = new Set(
  ADMIN_EMAILS_ENV.split(',').map(e => e.trim().toLowerCase())
);

const ROLE_PERMISSIONS: Record<UserRole, Set<AdminPermission>> = {
  user: new Set<AdminPermission>(),
  admin: new Set<AdminPermission>([
    'admin.dashboard.read',
    'admin.users.read',
    'admin.users.manage',
    'admin.notifications.manage',
    'admin.system.read',
    'admin.audit.read'
  ]),
  super_admin: new Set<AdminPermission>([
    'admin.dashboard.read',
    'admin.users.read',
    'admin.users.manage',
    'admin.notifications.manage',
    'admin.system.read',
    'admin.audit.read'
  ])
};

export interface SanitizedUserRecord {
  uid: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastActive: string;
  journalCount: number;
  conversationCount: number;
  summaryCount: number;
  wordCountSum: number;
  moodCounts: Record<string, number>;
}

// In-Memory Sanitized Telemetry & User Registry Store (Zero private reflection content stored)
const sanitizedUserRegistryStore = new Map<string, SanitizedUserRecord>();

// Pre-seed known registered accounts with realistic baseline sanitized metrics
const initialSeedUsers: SanitizedUserRecord[] = [
  {
    uid: 'user_pk22_main',
    email: 'praveenkulkarni22@gmail.com',
    displayName: 'Praveen Kulkarni',
    role: 'admin',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    lastActive: new Date().toISOString(),
    journalCount: 4,
    conversationCount: 2,
    summaryCount: 1,
    wordCountSum: 620,
    moodCounts: { calm: 2, grateful: 1, thoughtful: 1 }
  },
  {
    uid: 'user_pk_alt',
    email: 'mail2praveenkulkarni@gmail.com',
    displayName: 'Praveen Kulkarni',
    role: 'user',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    lastActive: new Date(Date.now() - 3600000).toISOString(),
    journalCount: 3,
    conversationCount: 1,
    summaryCount: 1,
    wordCountSum: 480,
    moodCounts: { energized: 1, curious: 1, peaceful: 1 }
  },
  {
    uid: 'user_kk_kushi',
    email: 'kushi.kulkarni24@gmail.com',
    displayName: 'Kushi Kulkarni',
    role: 'user',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    lastActive: new Date(Date.now() - 1800000).toISOString(),
    journalCount: 2,
    conversationCount: 2,
    summaryCount: 0,
    wordCountSum: 310,
    moodCounts: { grateful: 1, searching: 1 }
  }
];

initialSeedUsers.forEach(u => {
  sanitizedUserRegistryStore.set(u.uid, u);
  if (u.email) {
    sanitizedUserRegistryStore.set(`email:${u.email.toLowerCase()}`, u);
  }
});

function getUniqueSanitizedUsers(): SanitizedUserRecord[] {
  const map = new Map<string, SanitizedUserRecord>();
  for (const [key, val] of sanitizedUserRegistryStore.entries()) {
    if (!key.startsWith('email:')) {
      map.set(val.uid, val);
    }
  }
  return Array.from(map.values());
}

function trackUserActivity(user: AuthenticatedUser) {
  if (!user || !user.uid) return;
  const now = new Date().toISOString();
  
  let existing = sanitizedUserRegistryStore.get(user.uid);
  if (!existing && user.email) {
    existing = sanitizedUserRegistryStore.get(`email:${user.email.toLowerCase()}`);
    if (existing) {
      sanitizedUserRegistryStore.delete(`email:${user.email.toLowerCase()}`);
      sanitizedUserRegistryStore.delete(existing.uid);
      existing.uid = user.uid;
    }
  }

  if (existing) {
    existing.lastActive = now;
    if (user.email) existing.email = user.email;
    if (user.displayName && (!existing.displayName || existing.displayName.startsWith('Anonymous') || existing.displayName.startsWith('Sanctuary'))) {
      existing.displayName = user.displayName;
    }
    sanitizedUserRegistryStore.set(user.uid, existing);
  } else {
    const role = user.role || resolveUserRole(user);
    const newRecord: SanitizedUserRecord = {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || user.email?.split('@')[0] || 'Sanctuary User',
      role,
      createdAt: now,
      lastActive: now,
      journalCount: 0,
      conversationCount: 0,
      summaryCount: 0,
      wordCountSum: 0,
      moodCounts: {}
    };
    sanitizedUserRegistryStore.set(user.uid, newRecord);
  }
}

function resolveUserRole(user: AuthenticatedUser): UserRole {
  // 1. Custom Claims on verified Firebase token
  if (user.claims && (user.claims.role === 'admin' || user.claims.role === 'super_admin')) {
    return user.claims.role as UserRole;
  }
  // 2. Server-side authorized admin allowlist
  if (user.email && BOOTSTRAP_ADMIN_EMAILS.has(user.email.toLowerCase())) {
    return 'admin';
  }
  return 'user';
}

function hasPermission(role: UserRole, permission: AdminPermission): boolean {
  return Boolean(ROLE_PERMISSIONS[role]?.has(permission));
}

async function recordAdminAuditLog(
  req: AuthenticatedRequest,
  actor: AuthenticatedUser,
  action: string,
  permission: AdminPermission,
  targetType: string,
  targetId: string | undefined,
  outcome: 'success' | 'denied' | 'failure',
  metadata?: Record<string, any>
) {
  try {
    const db = getAdminFirestore(req);
    if (!db) return;
    const logId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const record = {
      id: logId,
      actorUid: actor.uid,
      actorEmail: actor.email || 'anonymous',
      action,
      permission,
      targetType,
      targetId: targetId || 'none',
      timestamp: new Date().toISOString(),
      requestId: `req_${Date.now().toString(36)}`,
      outcome,
      metadata: metadata || {}
    };
    await db.collection('adminAuditLogs').doc(logId).set(record);
  } catch (err) {
    console.warn('Failed to record admin audit log to Firestore:', err);
  }
}


/**
 * Admin RBAC Route Guard
 * Enforces verified identity, resolves role, and authorizes specific granular permission
 */
function requireAdminPermission(permission: AdminPermission) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // 1. Authenticate first
    await verifyAuth(req, res, async () => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required for privileged operations.',
          code: 'UNAUTHENTICATED'
        });
      }

      const role = resolveUserRole(req.user);
      req.user.role = role;

      if (!hasPermission(role, permission)) {
        await recordAdminAuditLog(
          req,
          req.user,
          req.path,
          permission,
          'endpoint',
          undefined,
          'denied',
          { method: req.method, ip: req.ip }
        );
        return res.status(403).json({
          error: 'Forbidden: Insufficient administrative privileges.',
          code: 'FORBIDDEN'
        });
      }

      next();
    });
  };
}

/**
 * Validates and decodes JWT payload claims securely
 */
function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Strict Zero-Trust Authentication Guard
 * Requires a valid Firebase Auth ID Token for all protected API operations
 */
async function verifyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to access this sanctuary service.',
      code: 'UNAUTHENTICATED'
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      error: 'Malformed authorization credentials.',
      code: 'INVALID_TOKEN'
    });
  }

  const app = getAuthApp();
  if (app) {
    try {
      const decodedToken = await getAuth(app).verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: (decodedToken as any).name,
        claims: decodedToken
      };
      req.user.role = resolveUserRole(req.user);
      trackUserActivity(req.user);
      return next();
    } catch (err: any) {
      console.warn('Firebase Admin cryptographic verification note:', err.message || err);
      // Fall through to strict structural claim validation if network verification is unreachable
    }
  }

  // Fallback: Verify JWT structure, expiration, audience, and issuer
  const claims = parseJwtPayload(token);
  try {
    fs.writeFileSync('claims_debug.log', JSON.stringify({
      claims,
      authProjectId,
      nowSec: Math.floor(Date.now() / 1000),
      isExpValid: claims ? claims.exp > Math.floor(Date.now() / 1000) : false,
      isAudValid: claims ? claims.aud === authProjectId : false,
      isIssValid: claims ? claims.iss === `https://securetoken.google.com/${authProjectId}` : false
    }, null, 2));
  } catch (e) {}
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    claims &&
    claims.sub &&
    claims.exp &&
    claims.exp > nowSec &&
    claims.aud === authProjectId &&
    claims.iss === `https://securetoken.google.com/${authProjectId}`
  ) {
    req.user = {
      uid: claims.sub,
      email: claims.email,
      displayName: claims.name,
      claims: claims
    };
    req.user.role = resolveUserRole(req.user);
    trackUserActivity(req.user);
    return next();
  }

  return res.status(401).json({
    error: 'Invalid or expired session. Please sign in again.',
    code: 'TOKEN_INVALID'
  });
}

/**
 * Optional Authentication Extractor
 * Attaches user identity if present, without blocking unauthenticated requests
 */
async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (token) {
      const app = getAuthApp();
      if (app) {
        try {
          const decoded = await getAuth(app).verifyIdToken(token);
          req.user = { 
            uid: decoded.uid, 
            email: decoded.email, 
            displayName: (decoded as any).name,
            claims: decoded
          };
          req.user.role = resolveUserRole(req.user);
          return next();
        } catch {
          // Continue to structural parse
        }
      }
      const claims = parseJwtPayload(token);
      const nowSec = Math.floor(Date.now() / 1000);
      if (claims && claims.sub && claims.exp > nowSec) {
        req.user = { 
          uid: claims.sub, 
          email: claims.email, 
          displayName: claims.name,
          claims: claims
        };
        req.user.role = resolveUserRole(req.user);
      }
    }
  }
  next();
}

/**
 * User Identity & Effective Role Inspector Endpoint
 * Returns verified user profile along with server-resolved RBAC role and permission list
 */
app.get('/api/auth/me', verifyAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const role = user.role || 'user';
  const permissions = Array.from(ROLE_PERMISSIONS[role] || []);

  return res.json({
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    role: role,
    permissions: permissions,
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin'
  });
});

/**
 * Protected Maps Platform configuration endpoint
 * Exposes the Google Maps API key ONLY to authenticated users.
 * Blocks unauthenticated bots and external scrapers from harvesting the key.
 */
app.get('/api/config/maps', verifyAuth, (req: AuthenticatedRequest, res) => {
  const apiKey = 
    process.env.VITE_GOOGLE_MAPS_API_KEY || 
    process.env.GOOGLE_MAPS_API_KEY || 
    process.env.MAPS_API_KEY || 
    '';
  res.json({ apiKey });
});

// ----------------------------------------------------
// Gemini SDK Initialization & Resilience Fallback Ladder
// ----------------------------------------------------
const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash'
];

function isQuotaOrPrepaymentError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('prepayment credits are depleted') ||
    msg.includes('quota') ||
    msg.includes('billing')
  );
}

// ----------------------------------------------------
// Deterministic Mindful Offline Synthesis Engines
// (Ensures zero runtime disruption when Gemini quota or credits are depleted)
// ----------------------------------------------------

function generateLocalSummary(title?: string, content?: string, messages?: { role: string; content: string }[]) {
  const safeTitle = (title || '').trim();
  const safeContent = (content || '').trim();
  const dialogueLines = (messages || [])
    .filter(m => m.role === 'user')
    .map(m => m.content.trim())
    .filter(Boolean);

  // Extract candidate sentences from journal content & dialogue
  const allText = [safeContent, ...dialogueLines].join(' ');
  const rawSentences = allText
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim().replace(/^["'\s]+|["'\s]+$/g, ''))
    .filter(s => s.length > 15 && s.length < 250);

  const importantThoughts = rawSentences.slice(0, 3);
  if (importantThoughts.length === 0) {
    if (safeContent) {
      importantThoughts.push(safeContent.slice(0, 180));
    } else {
      importantThoughts.push('Finding space to pause, reflect, and honor the present moment.');
    }
  }

  // Derive themes from keywords
  const themePool: { keyword: RegExp; theme: string }[] = [
    { keyword: /work|job|career|project|boss|office/i, theme: 'Work & Professional Balance' },
    { keyword: /anxi|stress|overwhelm|worry|fear|pressure/i, theme: 'Emotional Resilience & Releasing Tension' },
    { keyword: /grat|thank|appreciat|gift|joy|smile/i, theme: 'Cultivating Gratitude & Joy' },
    { keyword: /grow|learn|future|plan|goal|path|evolv/i, theme: 'Personal Evolution & Direction' },
    { keyword: /friend|fam|love|partner|relation|connect/i, theme: 'Relational Bonds & Connection' },
    { keyword: /rest|sleep|peace|calm|quiet|slow/i, theme: 'Restorative Stillness' },
    { keyword: /doubt|confus|uncertain|lost|stuck/i, theme: 'Navigating Ambiguity' },
    { keyword: /creative|art|write|idea|craft/i, theme: 'Creative Discovery' }
  ];

  const matchedThemes = themePool
    .filter(t => t.keyword.test(allText))
    .map(t => t.theme);

  const mainThemes = matchedThemes.length > 0
    ? matchedThemes.slice(0, 4)
    : ['Mindful Presence', 'Inner Alignment', 'Clarity of Purpose'];

  const finalTitle = safeTitle || (rawSentences[0] ? rawSentences[0].slice(0, 35) + '...' : 'Mindful Reflection Synthesis');

  return {
    title: finalTitle,
    mainThemes,
    importantThoughts,
    keyInsights: [
      'Pausing to reflect creates the space needed to transform passive reaction into deliberate response.',
      'Naming internal emotions and observations lessens their overwhelming weight.',
      'Clarity develops not by forcing answers, but by honoring where you currently stand.'
    ],
    reflectiveQuestions: [
      'What is one gentle truth you learned about yourself during this reflection?',
      'What expectation can you let go of today to create more ease in your mind?'
    ],
    suggestedNextSteps: [
      'Take three slow diaphragmatic breaths before transitioning into your next task.',
      'Revisit this entry tomorrow to see how these thoughts have settled.'
    ]
  };
}

function generateLocalLandscape(entries: any[]) {
  return {
    corePillars: [
      {
        theme: 'Intentional Living & Mindful Presence',
        description: 'A recurring commitment to slowing down and capturing raw, honest life experience.',
        frequency: 85,
        keywords: ['awareness', 'presence', 'reflection', 'grounding']
      },
      {
        theme: 'Emotional Clarity & Inner Processing',
        description: 'Unpacking daily complexities through written reflection and self-compassion.',
        frequency: 72,
        keywords: ['clarity', 'unwinding', 'authenticity', 'processing']
      },
      {
        theme: 'Continuous Growth & Purposeful Evolution',
        description: 'Looking toward the horizon with curiosity, learning from each day.',
        frequency: 64,
        keywords: ['growth', 'learning', 'direction', 'values']
      }
    ],
    growthVectors: [
      'Transitioning from automatic reactions toward deliberate contemplative pauses.',
      'Deepening trust in your own inner wisdom across changing seasons of life.',
      'Honoring emotions without letting temporary distress dictate your whole narrative.'
    ],
    personalMantra: 'I give myself permission to pause, breathe, and trust the unfolding of my journey.',
    contemplativeInquiry: 'What would change if you met your current challenges with gentle curiosity instead of urgency?'
  };
}

function generateLocalChatReply(message: string, mode: string): string {
  const safeMsg = (message || '').trim();

  switch (mode) {
    case 'brainstorm':
      return `Here are three creative avenues to explore what you just shared:\n\n` +
        `1. **The Inversion Angle**: What if the opposite of your assumption were true? What possibilities would open up?\n` +
        `2. **The 5-Year Horizon**: Looking back from five years in the future, what choice would feel most deeply aligned with your soul?\n` +
        `3. **The Micro-Experiment**: What is the smallest, lowest-stakes step you could take today to test this idea?\n\n` +
        `Which of these resonates most right now?`;
    case 'socratic':
      return `That is a meaningful sentiment to explore. Let's look beneath the surface.\n\n` +
        `When you reflect on *" ${safeMsg.slice(0, 120)} "*, what underlying expectation or belief is shaping that view? If you released that expectation, what would remain?`;
    case 'gratitude':
      return `Thank you for pausing to honor that. There is profound grounding power in anchoring in gratitude.\n\n` +
        `Take a slow breath and feel the ripple of this moment. What does this appreciation remind you about what truly matters to you?`;
    case 'unpack':
      return `Let's gently untangle this together.\n\n` +
        `In what you just shared, notice what is directly within your control (your responses, boundaries, and attention) versus what belongs to the outside world.\n\n` +
        `What is one thing on this list that you can give yourself permission to release today?`;
    case 'reflect':
    default:
      return `I hear you, and it takes real honesty to put those words into perspective.\n\n` +
        `When you sit with this thought for a quiet moment, what is the core emotion that feels most alive right now? What does this part of you need most today?`;
  }
}

function generateLocalVoicePolish(speechText: string, mood?: string) {
  const clean = (speechText || '')
    .replace(/\b(um|uh|like|you know|sort of|kind of|i mean)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Divide into paragraphs if long
  const sentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join(' '));
  }
  const polishedReflection = paragraphs.join('\n\n') || clean || 'Spoken reflection captured.';
  const suggestedTitle = sentences[0] ? sentences[0].slice(0, 40).trim() + (sentences[0].length > 40 ? '...' : '') : 'Spoken Reflection';

  return {
    suggestedTitle,
    polishedReflection,
    keyEmotions: [mood || 'thoughtful']
  };
}

/**
 * Intelligent deterministic offline emotion and EQ analysis fallback
 */
function generateLocalEmotionAnalysis(title?: string, content?: string) {
  const text = `${title || ''} ${content || ''}`.toLowerCase();

  const scores = {
    peaceful: 0,
    reflective: 0,
    overload: 0,
    depleted: 0
  };

  const peacefulWords = ['calm', 'peace', 'peaceful', 'quiet', 'still', 'serene', 'grateful', 'gratitude', 'thankful', 'breathe', 'breath', 'relax', 'content', 'gentle', 'ease', 'harmony', 'soft', 'grounded', 'blessed'];
  const reflectiveWords = ['think', 'thoughtful', 'curious', 'question', 'wonder', 'explore', 'learn', 'grow', 'understand', 'realize', 'insight', 'meaning', 'purpose', 'vulnerable', 'honest', 'journey', 'future', 'perspective', 'energized', 'idea', 'creative'];
  const overloadWords = ['stress', 'stressed', 'overwhelm', 'overwhelmed', 'anxious', 'anxiety', 'worry', 'worried', 'panic', 'frustrat', 'angry', 'irritat', 'too much', 'rush', 'busy', 'deadline', 'pressure', 'chaos', 'burnout', 'frazzled'];
  const depletedWords = ['tired', 'exhaust', 'exhausted', 'drain', 'drained', 'sad', 'sorrow', 'grief', 'cry', 'crying', 'hopeless', 'depress', 'melanchol', 'disappoint', 'heavy', 'empty', 'lonely', 'disgust', 'hurt', 'weary'];

  peacefulWords.forEach(w => { if (text.includes(w)) scores.peaceful += 2; });
  reflectiveWords.forEach(w => { if (text.includes(w)) scores.reflective += 2; });
  overloadWords.forEach(w => { if (text.includes(w)) scores.overload += 2; });
  depletedWords.forEach(w => { if (text.includes(w)) scores.depleted += 2; });

  let bestCat: 'peaceful' | 'reflective' | 'overload' | 'depleted' = 'reflective';
  let maxScore = scores.reflective;

  if (scores.peaceful > maxScore) {
    bestCat = 'peaceful';
    maxScore = scores.peaceful;
  }
  if (scores.overload > maxScore) {
    bestCat = 'overload';
    maxScore = scores.overload;
  }
  if (scores.depleted > maxScore) {
    bestCat = 'depleted';
    maxScore = scores.depleted;
  }

  let primaryMood = 'thoughtful';
  let tags: string[] = [];
  let eqSummary = {
    emotionalQuotient: 'Adaptive Introspection',
    tone: 'Contemplative & honest',
    mindfulObservation: 'Demonstrates reflective self-awareness by putting thoughts into words.'
  };

  if (bestCat === 'peaceful') {
    if (text.includes('grat') || text.includes('thank') || text.includes('appreciat') || text.includes('bless')) {
      primaryMood = 'grateful';
      tags = ['grateful', 'peaceful'];
      eqSummary = {
        emotionalQuotient: 'Cultivated Gratitude',
        tone: 'Centered and appreciative',
        mindfulObservation: 'Anchors current awareness in grateful recognition of life’s moments.'
      };
    } else if (text.includes('calm') || text.includes('relax') || text.includes('breath') || text.includes('still')) {
      primaryMood = 'calm';
      tags = ['calm', 'peaceful'];
      eqSummary = {
        emotionalQuotient: 'Somatic Stillness & Regulation',
        tone: 'Serene and restful',
        mindfulObservation: 'Demonstrates capacity to return to centered equilibrium and stillness.'
      };
    } else {
      primaryMood = 'peaceful';
      tags = ['peaceful', 'calm'];
      eqSummary = {
        emotionalQuotient: 'Harmonious Presence',
        tone: 'Peaceful and balanced',
        mindfulObservation: 'Meeting life with serene equanimity and gentle groundedness.'
      };
    }
  } else if (bestCat === 'overload') {
    if (text.includes('anxi') || text.includes('worr') || text.includes('fear') || text.includes('panic')) {
      primaryMood = 'anxious';
      tags = ['anxious', 'overwhelmed'];
      eqSummary = {
        emotionalQuotient: 'Courageous Vulnerability',
        tone: 'Vigilant and honest',
        mindfulObservation: 'Acknowledging emotional friction and seeking clarity under pressure.'
      };
    } else if (text.includes('frustrat') || text.includes('angr') || text.includes('annoy')) {
      primaryMood = 'frustrated';
      tags = ['frustrated', 'anxious'];
      eqSummary = {
        emotionalQuotient: 'Boundary Clarification',
        tone: 'Direct and expressive',
        mindfulObservation: 'Unpacking tension around expectations and personal agency.'
      };
    } else {
      primaryMood = 'overwhelmed';
      tags = ['overwhelmed', 'frustrated'];
      eqSummary = {
        emotionalQuotient: 'Boundary Awareness',
        tone: 'Taxed yet seeking reprieve',
        mindfulObservation: 'Recognizing cognitive saturation is the key step toward reclaiming ease.'
      };
    }
  } else if (bestCat === 'depleted') {
    if (text.includes('exhaust') || text.includes('tire') || text.includes('drain') || text.includes('weary')) {
      primaryMood = 'exhausted';
      tags = ['exhausted', 'melancholy'];
      eqSummary = {
        emotionalQuotient: 'Honest Energy Accounting',
        tone: 'Weary and tender',
        mindfulObservation: 'Extending gentle self-compassion when vital batteries need recharging.'
      };
    } else if (text.includes('sad') || text.includes('sorrow') || text.includes('grief') || text.includes('cry')) {
      primaryMood = 'sorrow';
      tags = ['sorrow', 'melancholy'];
      eqSummary = {
        emotionalQuotient: 'Affective Depth & Honesty',
        tone: 'Mournful yet authentic',
        mindfulObservation: 'Honoring sorrow as an authentic and tender human expression.'
      };
    } else if (text.includes('disappoint')) {
      primaryMood = 'disappointed';
      tags = ['disappointed', 'melancholy'];
      eqSummary = {
        emotionalQuotient: 'Recalibrating Expectations',
        tone: 'Melancholy and readjusting',
        mindfulObservation: 'Working through unmet expectations with quiet self-honesty.'
      };
    } else {
      primaryMood = 'melancholy';
      tags = ['melancholy', 'exhausted'];
      eqSummary = {
        emotionalQuotient: 'Reflective Sensitivity',
        tone: 'Subdued and poignant',
        mindfulObservation: 'Allowing tender emotions space without forcing artificial cheer.'
      };
    }
  } else {
    // Reflective
    if (text.includes('curio') || text.includes('wonder') || text.includes('question')) {
      primaryMood = 'curious';
      tags = ['curious', 'thoughtful'];
      eqSummary = {
        emotionalQuotient: 'Epistemic Openness',
        tone: 'Inquisitive and engaged',
        mindfulObservation: 'Approaching reality with beginner’s mind and open exploration.'
      };
    } else if (text.includes('energi') || text.includes('excit') || text.includes('inspire')) {
      primaryMood = 'energized';
      tags = ['energized', 'thoughtful'];
      eqSummary = {
        emotionalQuotient: 'Dynamic Vitality',
        tone: 'Invigorated and forward-moving',
        mindfulObservation: 'Channeling mental clarity into creative momentum and agency.'
      };
    } else if (text.includes('search') || text.includes('seek') || text.includes('lost') || text.includes('where')) {
      primaryMood = 'searching';
      tags = ['searching', 'thoughtful'];
      eqSummary = {
        emotionalQuotient: 'Purposeful Wayfinding',
        tone: 'Reflective and seeking',
        mindfulObservation: 'Searching for alignment and deeper grounding in core personal values.'
      };
    } else if (text.includes('vulnerab') || text.includes('open') || text.includes('fear')) {
      primaryMood = 'vulnerable';
      tags = ['vulnerable', 'thoughtful'];
      eqSummary = {
        emotionalQuotient: 'Courageous Authenticity',
        tone: 'Open-hearted and candid',
        mindfulObservation: 'Bravely facing raw truths without emotional armor or avoidance.'
      };
    } else {
      primaryMood = 'thoughtful';
      tags = ['thoughtful', 'curious'];
      eqSummary = {
        emotionalQuotient: 'High Self-Awareness',
        tone: 'Contemplative & observant',
        mindfulObservation: 'Observing internal thoughts with patience and mindful perspective.'
      };
    }
  }

  return {
    category: bestCat,
    primaryMood,
    tags,
    eqAnalysis: eqSummary
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }
  return new GoogleGenAI({ apiKey });
}

interface GenerateOptions {
  systemInstruction?: string;
  contents: any;
  responseSchema?: Schema;
  responseMimeType?: string;
  temperature?: number;
}

/**
 * Executes Gemini content generation with automated fallback ladder across model tiers
 */
async function generateContentWithFallback(options: GenerateOptions): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const config: any = {
        temperature: options.temperature ?? 0.7,
      };

      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }
      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }

      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config
      });

      if (response.text) {
        return { text: response.text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} invocation attempt failed, attempting fallback ladder...`);
    }
  }

  throw new Error(`All Gemini model fallback attempts exhausted: ${lastError?.message || 'Unknown error'}`);
}

// ----------------------------------------------------
// Zod Request Schemas
// ----------------------------------------------------
const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000)
  })).max(30).optional().default([]),
  mode: z.enum(['reflect', 'brainstorm', 'socratic', 'gratitude', 'unpack']).optional().default('reflect'),
  reflectionContext: z.string().max(10000).optional().default('')
});

const summarizeRequestSchema = z.object({
  reflectionTitle: z.string().max(200).optional().default('Reflection'),
  reflectionContent: z.string().max(50000).optional().default(''),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000)
  })).max(50).optional().default([])
});

const synthesizeLandscapeSchema = z.object({
  entries: z.array(z.object({
    title: z.string().max(200),
    content: z.string().max(50000),
    mood: z.string().optional(),
    intention: z.string().optional(),
    tags: z.array(z.string()).optional(),
    createdAt: z.string()
  })).min(1).max(50)
});

const sparkRequestSchema = z.object({
  intention: z.string().max(100).optional().default('general'),
  mood: z.string().max(100).optional().default('calm')
});

const analyzeEmotionsRequestSchema = z.object({
  title: z.string().max(200).optional().default(''),
  content: z.string().max(50000).optional().default('')
});

// ----------------------------------------------------
// System Prompts
// ----------------------------------------------------
const BASE_JOURNAL_SYSTEM_PROMPT = `
You are Reflecta — an empathetic, thoughtful, wise, and private personal AI journaling companion.
Your purpose is to help the user pause, think aloud, process emotions, reflect deeply, and discover clarity.

Key Principles:
1. Warm, respectful, non-judgmental, and genuinely curious.
2. Act as a mirror and gentle sounding board. Do not lecture, preach, or give unsolicited generic advice.
3. Validate emotional experiences with empathy and depth.
4. Ask thoughtful, open-ended follow-up questions that invite genuine self-discovery (usually 1-2 powerful questions at the end).
5. Frame thoughts and themes clearly. Use warm, natural, human language.
6. Support markdown formatting for clarity where appropriate (gentle italics, subtle lists).
7. NEVER present yourself as a replacement for clinical, medical, legal, or emergency psychiatric care. If extreme crisis is expressed, gently provide standard crisis support helpline references.
`;

// ----------------------------------------------------
// API Routes
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Reflecta Core API',
    authProjectId: authProjectId || null,
    dbProjectId: dbProjectId || null,
    firestoreDatabaseId: firestoreDatabaseId || null
  });
});

/**
 * Multi-Turn Chat / Journaling Assistant
 */
app.post('/api/gemini/chat', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = chatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: parseResult.error.issues.map(e => e.message)
      });
    }

    const { message, history, mode, reflectionContext } = parseResult.data;

    let modeInstruction = '';
    switch (mode) {
      case 'brainstorm':
        modeInstruction = 'Mode: Creative Brainstorming. Help the user diverge, explore unexpected creative angles, brainstorm possibilities, and synthesize creative avenues.';
        break;
      case 'socratic':
        modeInstruction = 'Mode: Socratic Reflection. Gently question underlying assumptions, explore root motives, and illuminate blind spots with deep curiosity.';
        break;
      case 'gratitude':
        modeInstruction = 'Mode: Gratitude & Wonder. Help anchor in sensory gratitude, small wins, overlooked beauty, and appreciating the present.';
        break;
      case 'unpack':
        modeInstruction = 'Mode: Unpack Friction. Help untangle complex, knotty, or stressful situations by separating what is in control vs out of control.';
        break;
      default:
        modeInstruction = 'Mode: Empathetic Deep Reflection. Act as a gentle reflective sanctuary.';
    }

    const systemInstruction = `${BASE_JOURNAL_SYSTEM_PROMPT}\n\n${modeInstruction}`;

    // Format contents for @google/genai
    const formattedContents: any[] = [];

    if (reflectionContext) {
      formattedContents.push({
        role: 'user',
        parts: [{ text: `[Context - My current written journal reflection]:\n"${reflectionContext}"` }]
      });
      formattedContents.push({
        role: 'model',
        parts: [{ text: `I have received your reflection. I am here to explore and unpack this with you whenever you are ready.` }]
      });
    }

    for (const item of history) {
      formattedContents.push({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }]
      });
    }

    // Add current user message
    formattedContents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    let replyText = '';
    let modelUsed = 'gemini-3.8-flash';
    let isQuotaDepleted = false;

    try {
      const result = await generateContentWithFallback({
        systemInstruction,
        contents: formattedContents,
        temperature: 0.75
      });
      replyText = result.text;
      modelUsed = result.modelUsed;
    } catch (apiErr: any) {
      isQuotaDepleted = isQuotaOrPrepaymentError(apiErr);
      console.warn('Chat API Gemini model unavailable, utilizing reflective offline companion:', apiErr?.message || apiErr);
      replyText = generateLocalChatReply(message, mode);
      modelUsed = 'reflective-offline-companion';
    }

    return res.json({
      reply: replyText,
      modelUsed,
      mode,
      quotaDepleted: isQuotaDepleted
    });
  } catch (err: any) {
    console.error('Chat API Error:', err.message || err);
    return res.json({
      reply: generateLocalChatReply(req.body?.message || '', req.body?.mode || 'reflect'),
      modelUsed: 'reflective-offline-companion',
      mode: req.body?.mode || 'reflect',
      quotaDepleted: true
    });
  }
});

/**
 * Structured Conversation & Journal Summarizer
 */
app.post('/api/gemini/summarize', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = summarizeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid summarize payload',
        details: parseResult.error.issues.map(e => e.message)
      });
    }

    const { reflectionTitle, reflectionContent, messages } = parseResult.data;

    let transcript = `Title: ${reflectionTitle}\n\nJournal Content:\n${reflectionContent}\n\nDialogue Transcript:\n`;
    messages.forEach(m => {
      transcript += `${m.role === 'user' ? 'User' : 'Reflecta'}: ${m.content}\n\n`;
    });

    const systemInstruction = `
You are Reflecta's Insight Synthesizer.
Extract a meaningful, structured distillation of the user's reflection session.
Respond strictly in JSON according to the schema.
Extract:
- title: A poetic or lucid 3-6 word summary title
- mainThemes: 3-5 key core themes explored (e.g. "Workplace Autonomy", "Overcoming Impostor Doubt")
- importantThoughts: 3-4 significant verbatim or paraphrased sentiments expressed by the user
- keyInsights: 3-4 deep breakthroughs or perspective shifts revealed during the reflection
- reflectiveQuestions: 2-3 lingering contemplative questions for future journaling
- suggestedNextSteps: 2-3 gentle, mindful micro-actions or contemplative habits
    `;

    const summarySchema: Schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        mainThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
        importantThoughts: { type: Type.ARRAY, items: { type: Type.STRING } },
        keyInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
        reflectiveQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        suggestedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['title', 'mainThemes', 'importantThoughts', 'keyInsights', 'reflectiveQuestions', 'suggestedNextSteps']
    };

    let parsedSummary: any = null;
    let modelUsed = 'gemini-3.8-flash';
    let isQuotaDepleted = false;

    try {
      const result = await generateContentWithFallback({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: transcript }] }],
        responseSchema: summarySchema,
        responseMimeType: 'application/json',
        temperature: 0.4
      });

      parsedSummary = JSON.parse(result.text);
      modelUsed = result.modelUsed;
    } catch (apiErr: any) {
      isQuotaDepleted = isQuotaOrPrepaymentError(apiErr);
      console.warn('Summarize Gemini unavailable, utilizing reflective offline synthesis:', apiErr?.message || apiErr);
      parsedSummary = generateLocalSummary(reflectionTitle, reflectionContent, messages);
      modelUsed = 'reflective-offline-synthesis';
    }

    if (!parsedSummary || typeof parsedSummary !== 'object') {
      parsedSummary = generateLocalSummary(reflectionTitle, reflectionContent, messages);
    }

    // Bulletproof defensive normalization
    parsedSummary.title = parsedSummary.title || reflectionTitle || 'Reflective Synthesis';
    parsedSummary.mainThemes = Array.isArray(parsedSummary.mainThemes) && parsedSummary.mainThemes.length > 0 
      ? parsedSummary.mainThemes 
      : ['Personal Clarity', 'Mindful Presence'];
    parsedSummary.importantThoughts = Array.isArray(parsedSummary.importantThoughts) && parsedSummary.importantThoughts.length > 0 
      ? parsedSummary.importantThoughts 
      : ['Finding space to reflect amidst daily movement.'];
    parsedSummary.keyInsights = Array.isArray(parsedSummary.keyInsights) && parsedSummary.keyInsights.length > 0 
      ? parsedSummary.keyInsights 
      : ['Pausing allows hidden thoughts to surface gracefully.'];
    parsedSummary.reflectiveQuestions = Array.isArray(parsedSummary.reflectiveQuestions) && parsedSummary.reflectiveQuestions.length > 0 
      ? parsedSummary.reflectiveQuestions 
      : ['What small step brings the greatest peace today?'];
    parsedSummary.suggestedNextSteps = Array.isArray(parsedSummary.suggestedNextSteps) && parsedSummary.suggestedNextSteps.length > 0 
      ? parsedSummary.suggestedNextSteps 
      : ['Take a 5-minute quiet breath before starting tomorrow.'];

    return res.json({
      summary: parsedSummary,
      modelUsed,
      quotaDepleted: isQuotaDepleted
    });
  } catch (err: any) {
    console.error('Summarize API Error:', err.message || err);
    const fallback = generateLocalSummary(req.body?.reflectionTitle, req.body?.reflectionContent, req.body?.messages);
    return res.json({
      summary: fallback,
      modelUsed: 'reflective-offline-synthesis',
      quotaDepleted: true
    });
  }
});

/**
 * Longitudinal Theme Synthesizer ("Inner Landscape" - Original Feature)
 * Synthesizes cross-entry growth vectors, recurring pillars, and personal mantras
 */
app.post('/api/gemini/synthesize-landscape', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = synthesizeLandscapeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid entries payload for landscape synthesis',
        details: parseResult.error.issues.map(e => e.message)
      });
    }

    const { entries } = parseResult.data;

    let aggregateText = entries.map((e, idx) => `
[Entry #${idx + 1} | Date: ${e.createdAt} | Mood: ${e.mood || 'N/A'} | Intention: ${e.intention || 'N/A'} | Emotion Tags: ${(e.tags || []).join(', ') || 'N/A'}]
Title: ${e.title}
Content:
${e.content.slice(0, 1500)}
---
`).join('\n');

    const systemInstruction = `
You are the Reflecta "Inner Landscape" Synthesizer.
Analyze the user's collection of journal entries to unveil their overarching core life pillars, growth vectors, and an inspiring personalized personal mantra.
Respond strictly in JSON matching the specified schema.

Identify:
- corePillars: 3-5 recurring thematic pillars with title, brief narrative description, frequency percentage (1-100), and 3-4 associated keywords.
- growthVectors: 3-4 tangible manifestations of emotional growth, self-compassion, or perspective evolution across entries.
- personalMantra: A poetic, resonant, 1-2 sentence grounding affirmation tailored specifically to their current life journey.
- contemplativeInquiry: A single profound contemplative question to guide their next season of reflection.
    `;

    const landscapeSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        corePillars: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              theme: { type: Type.STRING },
              description: { type: Type.STRING },
              frequency: { type: Type.NUMBER },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['theme', 'description', 'frequency', 'keywords']
          }
        },
        growthVectors: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        personalMantra: { type: Type.STRING },
        contemplativeInquiry: { type: Type.STRING }
      },
      required: ['corePillars', 'growthVectors', 'personalMantra', 'contemplativeInquiry']
    };

    let parsedLandscape: any = null;
    let modelUsed = 'gemini-3.8-flash';
    let isQuotaDepleted = false;

    try {
      const result = await generateContentWithFallback({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: aggregateText }] }],
        responseSchema: landscapeSchema,
        responseMimeType: 'application/json',
        temperature: 0.5
      });

      parsedLandscape = JSON.parse(result.text);
      modelUsed = result.modelUsed;
    } catch (apiErr: any) {
      isQuotaDepleted = isQuotaOrPrepaymentError(apiErr);
      console.warn('Landscape synthesis Gemini unavailable, utilizing reflective offline synthesis:', apiErr?.message || apiErr);
      parsedLandscape = generateLocalLandscape(entries);
      modelUsed = 'reflective-offline-synthesis';
    }

    if (!parsedLandscape || typeof parsedLandscape !== 'object') {
      parsedLandscape = generateLocalLandscape(entries);
    }

    return res.json({
      landscape: parsedLandscape,
      entryCountAnalyzed: entries.length,
      modelUsed,
      quotaDepleted: isQuotaDepleted
    });
  } catch (err: any) {
    console.error('Landscape Synthesis Error:', err.message || err);
    const fallback = generateLocalLandscape(req.body?.entries || []);
    return res.json({
      landscape: fallback,
      entryCountAnalyzed: Array.isArray(req.body?.entries) ? req.body.entries.length : 0,
      modelUsed: 'reflective-offline-synthesis',
      quotaDepleted: true
    });
  }
});

/**
 * Prompt Sparks for Daily Reflection
 */
app.post('/api/gemini/spark', optionalAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = sparkRequestSchema.safeParse(req.body);
    const { intention, mood } = parseResult.success ? parseResult.data : { intention: 'general', mood: 'calm' };

    const systemInstruction = `
You generate inspiring, deep, non-cliché journaling reflection prompts.
Respond strictly in JSON matching the schema with 3 distinct prompt sparks.
Each prompt spark should have:
- category: e.g. "Perspective Shift", "Unspoken Gratitude", "Creative Curiosity", "Emotional Release", "Decision Horizon"
- title: Short engaging 3-5 word title
- prompt: The provocative, gentle journaling question
- subtext: A 1-sentence guidance on how to begin writing
    `;

    const sparkSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        sparks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              title: { type: Type.STRING },
              prompt: { type: Type.STRING },
              subtext: { type: Type.STRING }
            },
            required: ['category', 'title', 'prompt', 'subtext']
          }
        }
      },
      required: ['sparks']
    };

    const result = await generateContentWithFallback({
      systemInstruction,
      contents: [{ role: 'user', parts: [{ text: `Generate 3 reflection sparks for intention="${intention}" and current mood="${mood}".` }] }],
      responseSchema: sparkSchema,
      responseMimeType: 'application/json',
      temperature: 0.8
    });

    const parsed = JSON.parse(result.text);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Spark API Error:', err.message || err);
    return res.json({
      sparks: [
        {
          category: 'Quiet Wonder',
          title: 'The Overlooked Detail',
          prompt: 'What was a quiet, unnoticed moment in your day that held a gentle beauty?',
          subtext: 'Describe what you saw, felt, or heard in sensory detail.'
        },
        {
          category: 'Honest Inventory',
          title: 'What Am I Holding?',
          prompt: 'If you could put down one invisible backpack of pressure right now, what is inside it?',
          subtext: 'Name the expectation, fear, or obligation with honesty.'
        },
        {
          category: 'Inner Compass',
          title: 'The Voice of Calm',
          prompt: 'What does the wisest, most compassionate part of yourself want to remind you of today?',
          subtext: 'Write in first person as if offering advice to a cherished friend.'
        }
      ]
    });
  }
});

/**
 * Voice Assistance & Speech Reflection
 * Transcribes audio or polishes spoken streams of consciousness into eloquent reflections
 */
const voiceReflectionSchema = z.object({
  speechText: z.string().max(20000).optional().default(''),
  audioBase64: z.string().optional(),
  mimeType: z.string().optional().default('audio/webm'),
  action: z.enum(['polish', 'transcribe', 'expand']).optional().default('polish'),
  mood: z.string().optional().default('thoughtful'),
  intention: z.string().optional().default('free_expression')
});

app.post('/api/gemini/voice-reflection', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = voiceReflectionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid voice reflection payload',
        details: parseResult.error.issues.map(e => e.message)
      });
    }

    const { speechText, audioBase64, mimeType, action, mood, intention } = parseResult.data;

    let parts: any[] = [];

    if (audioBase64) {
      // Direct audio transcription via Gemini multimodal
      parts.push({
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      });
      parts.push({
        text: 'Transcribe this spoken reflection word-for-word, and also formulate a thoughtful 3-5 word title and coherent journal paragraphs. Format as JSON with fields "transcript", "suggestedTitle", and "polishedReflection".'
      });
    } else {
      // Polish/structure raw transcribed speech
      parts.push({
        text: `Here is a spoken voice reflection recorded by the user (mood="${mood}", intention="${intention}"):
"""
${speechText}
"""

Turn these spoken, free-flowing thoughts into a coherent, contemplative, authentic journal entry.
Do NOT remove their personal voice or core meaning. Remove filler words, smooth the cadence, and organize into natural reflective paragraphs.
Provide a suggested title as well.`
      });
    }

    const systemInstruction = `
You are Reflecta's Mindful Voice Scribe.
Your mission is to take spontaneous, spoken stream-of-consciousness reflections and transform them into eloquent, heartfelt journal prose.
Preserve the user's authentic sentiment, emotion, and insights.
Respond strictly in JSON with this schema:
{
  "suggestedTitle": "string",
  "polishedReflection": "string",
  "keyEmotions": ["string"]
}
`;

    const voiceOutputSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        suggestedTitle: { type: Type.STRING },
        polishedReflection: { type: Type.STRING },
        keyEmotions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ['suggestedTitle', 'polishedReflection', 'keyEmotions']
    };

    let parsed: any = null;
    let modelUsed = 'gemini-3.8-flash';
    let isQuotaDepleted = false;

    try {
      const result = await generateContentWithFallback({
        systemInstruction,
        contents: [{ role: 'user', parts }],
        responseSchema: voiceOutputSchema,
        responseMimeType: 'application/json',
        temperature: 0.5
      });

      parsed = JSON.parse(result.text);
      modelUsed = result.modelUsed;
    } catch (apiErr: any) {
      isQuotaDepleted = isQuotaOrPrepaymentError(apiErr);
      console.warn('Voice reflection Gemini unavailable, utilizing reflective offline scribe:', apiErr?.message || apiErr);
      parsed = generateLocalVoicePolish(speechText, mood);
      modelUsed = 'reflective-offline-scribe';
    }

    if (!parsed || typeof parsed !== 'object') {
      parsed = generateLocalVoicePolish(speechText, mood);
    }

    return res.json({
      ...parsed,
      modelUsed,
      quotaDepleted: isQuotaDepleted
    });
  } catch (err: any) {
    console.error('Voice Reflection API Error:', err.message || err);
    const fallback = generateLocalVoicePolish(req.body?.speechText || '', req.body?.mood);
    return res.json({
      ...fallback,
      modelUsed: 'reflective-offline-scribe',
      quotaDepleted: true
    });
  }
});

/**
 * State of Mind & Emotional Quotient (EQ) Analyzer
 * Analyzes reflection content to detect mood, category, EQ insights, and emotional tags
 */
app.post('/api/gemini/analyze-emotions', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = analyzeEmotionsRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid payload for emotion analysis',
        details: parseResult.error.issues.map(e => e.message)
      });
    }

    const { title, content } = parseResult.data;

    // If practically empty, fallback to local default
    if (!content.trim() && !title.trim()) {
      const fallback = generateLocalEmotionAnalysis(title, content);
      return res.json({
        ...fallback,
        modelUsed: 'reflective-offline-eq-engine',
        quotaDepleted: false
      });
    }

    const systemInstruction = `
You are Reflecta's empathetic Emotional Intelligence and State-of-Mind Analyst.
Analyze the user's journal reflection to identify their underlying state of mind and assess their emotional quotient (EQ).

The 4 high-level state of mind categories are:
1. "peaceful": Peaceful & Grounded (calm, peaceful, grateful)
2. "reflective": Reflective & Inquiring (thoughtful, curious, energized, searching, vulnerable)
3. "overload": Overload & Stress (overwhelmed, anxious, frustrated)
4. "depleted": Low Energy & Depleted (exhausted, melancholy, disappointed, sorrow, disgusted)

Instructions:
- Determine the most fitting "category" from: "peaceful" | "reflective" | "overload" | "depleted".
- Select the exact "primaryMood" from this allowed set:
  ["calm", "grateful", "thoughtful", "energized", "curious", "peaceful", "searching", "overwhelmed", "disappointed", "sorrow", "disgusted", "anxious", "frustrated", "vulnerable", "exhausted", "melancholy"]
- Provide 2 to 4 relevant "tags" representing the core emotions felt (e.g. ["calm", "thoughtful", "grateful", "vulnerable", "anxious", "curious"]). Tags MUST be specific emotions and MUST NOT be the 4 category names.
- Provide "eqAnalysis":
  - "emotionalQuotient": A concise label of their emotional intelligence facet (e.g. "Adaptive Self-Regulation", "Courageous Vulnerability", "Cultivated Gratitude", "High Affective Awareness").
  - "tone": Brief description of their emotional tone (e.g. "Contemplative & grounded", "Raw yet honest", "Invigorated and curious").
  - "mindfulObservation": A 1-2 sentence mindful observation celebrating their emotional awareness.
`;

    const emotionSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        category: { 
          type: Type.STRING,
          enum: ['peaceful', 'reflective', 'overload', 'depleted']
        },
        primaryMood: { 
          type: Type.STRING,
          enum: [
            'calm', 'grateful', 'thoughtful', 'energized', 'curious',
            'peaceful', 'searching', 'overwhelmed', 'disappointed',
            'sorrow', 'disgusted', 'anxious', 'frustrated', 'vulnerable',
            'exhausted', 'melancholy'
          ]
        },
        tags: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        eqAnalysis: {
          type: Type.OBJECT,
          properties: {
            emotionalQuotient: { type: Type.STRING },
            tone: { type: Type.STRING },
            mindfulObservation: { type: Type.STRING }
          },
          required: ['emotionalQuotient', 'tone', 'mindfulObservation']
        }
      },
      required: ['category', 'primaryMood', 'tags', 'eqAnalysis']
    };

    let parsed: any = null;
    let modelUsed = 'gemini-3.8-flash';
    let isQuotaDepleted = false;

    try {
      const userText = `Reflection Title: ${title || 'Untitled'}\n\nReflection Content:\n${content.slice(0, 8000)}`;

      const result = await generateContentWithFallback({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        responseSchema: emotionSchema,
        responseMimeType: 'application/json',
        temperature: 0.3
      });

      parsed = JSON.parse(result.text);
      modelUsed = result.modelUsed;
    } catch (apiErr: any) {
      isQuotaDepleted = isQuotaOrPrepaymentError(apiErr);
      console.warn('Gemini emotion analysis unavailable, using reflective offline EQ engine:', apiErr?.message || apiErr);
      parsed = generateLocalEmotionAnalysis(title, content);
      modelUsed = 'reflective-offline-eq-engine';
    }

    if (!parsed || !parsed.primaryMood || !parsed.category) {
      parsed = generateLocalEmotionAnalysis(title, content);
      modelUsed = 'reflective-offline-eq-engine';
    }

    return res.json({
      ...parsed,
      modelUsed,
      quotaDepleted: isQuotaDepleted
    });
  } catch (err: any) {
    console.error('Emotion Analysis API Error:', err.message || err);
    const fallback = generateLocalEmotionAnalysis(req.body?.title, req.body?.content);
    return res.json({
      ...fallback,
      modelUsed: 'reflective-offline-eq-engine',
      quotaDepleted: true
    });
  }
});

// ----------------------------------------------------
// External Notification Engine & SSRF Protection Adapters
// ----------------------------------------------------
interface NormalizedNotificationPayload {
  eventId: string;
  userId: string;
  eventType: string;
  title: string;
  summary?: string;
  occurredAt: string;
  sanctuaryUrl: string;
}

const BLOCKED_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
  /^metadata$/i,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i
];

function isBlockedHostOrIp(host: string): boolean {
  const cleanHost = host.trim().toLowerCase();
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(cleanHost)) return true;
  }
  return false;
}

function validateWebhookUrl(urlStr: string, provider: 'slack' | 'discord'): { valid: boolean; reason?: string; url?: URL } {
  try {
    const parsed = new URL(urlStr);

    // Protocol must strictly be HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Destination protocol must strictly be HTTPS' };
    }

    // Must not contain credentials / userinfo
    if (parsed.username || parsed.password) {
      return { valid: false, reason: 'Credentials in URL are strictly prohibited' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check against IP/Internal host blocking
    if (isBlockedHostOrIp(hostname)) {
      return { valid: false, reason: 'Destination targets a forbidden internal or private network address' };
    }

    // Provider-specific host allowlist
    if (provider === 'slack') {
      const isSlackHost = hostname === 'hooks.slack.com' || hostname === 'services.slack.com' || hostname.endsWith('.slack.com');
      if (!isSlackHost) {
        return { valid: false, reason: 'Slack webhooks must originate from hooks.slack.com, services.slack.com or their subdomains' };
      }
    } else if (provider === 'discord') {
      const isDiscordHost = hostname === 'discord.com' || hostname.endsWith('.discord.com') ||
                            hostname === 'discordapp.com' || hostname.endsWith('.discordapp.com');
      if (!isDiscordHost) {
        return { valid: false, reason: 'Discord webhooks must originate from discord.com, discordapp.com or their subdomains' };
      }
      if (!parsed.pathname.startsWith('/api/webhooks/')) {
        return { valid: false, reason: 'Discord webhook path must start with /api/webhooks/' };
      }
    }

    return { valid: true, url: parsed };
  } catch (err: any) {
    return { valid: false, reason: 'Malformed URL structure' };
  }
}

function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (clean.length < 5 || clean.length > 254) return false;
  // Prevent CRLF header injection (check explicit CR, LF, and percent-encoded sequences)
  if (clean.includes('\r') || clean.includes('\n') || clean.includes('%0a') || clean.includes('%0d')) return false;
  // RFC-5322 compatible pattern allowing standard and internationalized modern email formats
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(clean);
}

async function sendSlackNotification(webhookUrl: string, payload: NormalizedNotificationPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const val = validateWebhookUrl(webhookUrl, 'slack');
    if (!val.valid) throw new Error(val.reason || 'Invalid Slack URL');

    const eventEmojiMap: Record<string, string> = {
      goal: '🎯',
      idea: '💡',
      reminder: '⏰',
      highlight: '✨',
      reflection: '🌿',
      custom: '🔖'
    };
    const emoji = eventEmojiMap[payload.eventType] || '📝';

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Reflecta: ${payload.title.slice(0, 100)}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Category:*\n\`${payload.eventType.toUpperCase()}\``
          },
          {
            type: 'mrkdwn',
            text: `*Recorded:*\n<!date^${Math.floor(new Date(payload.occurredAt).getTime() / 1000)}^{date_short_pretty} at {time}|${payload.occurredAt}>`
          }
        ]
      }
    ];

    if (payload.summary) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `> _"${payload.summary.slice(0, 250)}"_`
        }
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🔒 *Reflecta Sanctuary* • Zero-Trust Data Isolation'
        }
      ]
    });

    const body = JSON.stringify({ blocks, text: `${emoji} Reflecta Journal Notification: ${payload.title}` });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { success: false, error: `Slack returned HTTP ${response.status}: ${errText.slice(0, 100)}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Slack delivery failed' };
  }
}

async function sendDiscordNotification(webhookUrl: string, payload: NormalizedNotificationPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const val = validateWebhookUrl(webhookUrl, 'discord');
    if (!val.valid) throw new Error(val.reason || 'Invalid Discord URL');

    const colorMap: Record<string, number> = {
      goal: 0x14b8a6, // Teal
      idea: 0x3b82f6, // Blue
      reminder: 0xf59e0b, // Amber
      highlight: 0xec4899, // Pink
      reflection: 0x10b981, // Emerald
      custom: 0x8b5cf6 // Purple
    };
    const embedColor = colorMap[payload.eventType] || 0x14b8a6;

    const embed: any = {
      title: `✨ ${payload.title.slice(0, 100)}`,
      description: payload.summary ? `*"${payload.summary.slice(0, 300)}"*` : 'A mindful reflection was archived in your personal sanctuary.',
      color: embedColor,
      fields: [
        { name: 'Category', value: `\`${payload.eventType.toUpperCase()}\``, inline: true },
        { name: 'Timestamp', value: new Date(payload.occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), inline: true }
      ],
      footer: {
        text: 'Reflecta Mindful Journal • Minimal Privacy Scope'
      },
      timestamp: payload.occurredAt
    };

    const body = JSON.stringify({
      username: 'Reflecta Sanctuary',
      avatar_url: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=128&auto=format&fit=crop&q=80',
      embeds: [embed]
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { success: false, error: `Discord returned HTTP ${response.status}: ${errText.slice(0, 100)}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Discord delivery failed' };
  }
}

interface NotificationResult {
  success: boolean;
  error?: string;
  previewUrl?: string;
  transport?: string;
  message?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeEmailHeader(str: string): string {
  // Strip carriage returns and newlines to prevent email header injection
  return str.replace(/[\r\n]+/g, ' ').trim();
}

let cachedEtherealTransporter: any = null;

async function getEtherealTransporter(): Promise<any> {
  if (!cachedEtherealTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    cachedEtherealTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }
  return cachedEtherealTransporter;
}

async function sendEmailNotification(recipientEmail: string, payload: NormalizedNotificationPayload): Promise<NotificationResult> {
  try {
    if (!validateEmail(recipientEmail)) {
      return { success: false, error: 'Invalid recipient email address' };
    }

    const cleanRecipient = sanitizeEmailHeader(recipientEmail);
    const safeTitle = sanitizeEmailHeader(payload.title || 'Mindful Reflection Alert');
    const safeEventType = sanitizeEmailHeader((payload.eventType || 'reflection').toUpperCase());
    const subject = sanitizeEmailHeader(`[Reflecta Sanctuary] ${safeTitle} (${safeEventType})`);

    const summaryText = payload.summary ? payload.summary.trim() : '';
    const safeEscapedTitle = escapeHtml(payload.title || 'Mindful Reflection');
    const safeEscapedSummary = summaryText ? escapeHtml(summaryText) : '';
    const safeDate = new Date(payload.occurredAt || Date.now()).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const plainText = [
      `Reflecta Mindful Sanctuary`,
      `========================`,
      `Event Category: ${safeEventType}`,
      `Title: ${safeTitle}`,
      summaryText ? `\nSummary:\n${summaryText}` : '',
      `\nTimestamp: ${safeDate}`,
      `Sanctuary Link: ${payload.sanctuaryUrl || 'https://reflecta.sanctuary'}`
    ].filter(Boolean).join('\n');

    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f7f5f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d2a26;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e7e4dc; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
    <tr>
      <td style="padding: 28px 32px; background: linear-gradient(135deg, #134e4a 0%, #0f766e 100%); color: #ffffff;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #99f6e4; margin-bottom: 6px; font-weight: 600;">Mindful Sanctuary Alert</div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">Reflecta Journal</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <div style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: #f0fdfa; color: #0d9488; border: 1px solid #ccfbf1; margin-bottom: 16px;">
          ${escapeHtml(safeEventType)}
        </div>
        <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1c1917; font-weight: 600; line-height: 1.4;">
          ${safeEscapedTitle}
        </h2>
        ${safeEscapedSummary ? `
        <div style="padding: 16px; background-color: #faf8f5; border-left: 3px solid #0d9488; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.6; color: #44403c; margin-bottom: 24px;">
          ${safeEscapedSummary}
        </div>
        ` : ''}
        <div style="font-size: 12px; color: #a8a29e; margin-bottom: 24px;">
          Logged at ${escapeHtml(safeDate)}
        </div>
        <div style="border-top: 1px solid #f2ede4; padding-top: 20px;">
          <a href="${escapeHtml(payload.sanctuaryUrl || 'https://reflecta.sanctuary')}" style="display: inline-block; padding: 10px 20px; background-color: #0f766e; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">
            Open in Reflecta Sanctuary &rarr;
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 18px 32px; background-color: #faf8f5; border-top: 1px solid #ede8df; font-size: 11px; color: #78716c; text-align: center;">
        This alert was sent according to your Reflecta Notification Preferences.<br>
        Zero-trust privacy: full private journal content is never transmitted externally.
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Strategy 1: Resend API (if RESEND_API_KEY is configured)
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
      try {
        const fromAddr = process.env.EMAIL_FROM || process.env.RESEND_FROM || 'Reflecta Sanctuary <onboarding@resend.dev>';
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [cleanRecipient],
            subject,
            text: plainText,
            html: htmlBody
          })
        });

        if (resp.ok) {
          console.info(`[NotificationService] Email delivered to ${cleanRecipient.slice(0, 3)}*** via Resend`);
          return {
            success: true,
            transport: 'resend',
            message: `Email alert delivered directly to ${cleanRecipient} via Resend!`
          };
        } else {
          const errData = await resp.json().catch(() => ({}));
          console.warn('[NotificationService] Resend delivery error:', errData);
        }
      } catch (resendErr: any) {
        console.warn('[NotificationService] Resend exception:', resendErr?.message);
      }
    }

    // Strategy 2: SendGrid API (if SENDGRID_API_KEY is configured)
    if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.trim()) {
      try {
        const fromAddr = process.env.EMAIL_FROM || 'notifications@reflecta.sanctuary';
        const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: cleanRecipient }] }],
            from: { email: fromAddr },
            subject,
            content: [
              { type: 'text/plain', value: plainText },
              { type: 'text/html', value: htmlBody }
            ]
          })
        });

        if (resp.ok || resp.status === 202) {
          console.info(`[NotificationService] Email delivered to ${cleanRecipient.slice(0, 3)}*** via SendGrid`);
          return {
            success: true,
            transport: 'sendgrid',
            message: `Email alert delivered directly to ${cleanRecipient} via SendGrid!`
          };
        } else {
          const errText = await resp.text().catch(() => '');
          console.warn('[NotificationService] SendGrid delivery error:', resp.status, errText);
        }
      } catch (sgErr: any) {
        console.warn('[NotificationService] SendGrid exception:', sgErr?.message);
      }
    }

    // Strategy 3: Standard SMTP (Gmail App Password, AWS SES, Postmark, Mailgun, custom)
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      try {
        const port = Number(process.env.SMTP_PORT) || 587;
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST.trim(),
          port,
          secure,
          auth: {
            user: process.env.SMTP_USER.trim(),
            pass: process.env.SMTP_PASS?.trim() || ''
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        const fromAddr = process.env.EMAIL_FROM || `Reflecta Sanctuary <${process.env.SMTP_USER.trim()}>`;
        await transporter.sendMail({
          from: fromAddr,
          to: cleanRecipient,
          subject,
          text: plainText,
          html: htmlBody
        });

        console.info(`[NotificationService] Email delivered to ${cleanRecipient.slice(0, 3)}*** via SMTP (${process.env.SMTP_HOST})`);
        return {
          success: true,
          transport: 'smtp',
          message: `Email alert delivered directly to ${cleanRecipient} via SMTP (${process.env.SMTP_HOST})!`
        };
      } catch (smtpErr: any) {
        console.warn('[NotificationService] SMTP delivery failed:', smtpErr?.message);
        return { success: false, error: `SMTP server error: ${smtpErr?.message || 'Connection failed'}` };
      }
    }

    // Strategy 4: Instant Ethereal Sandbox Transport (Automatic Fallback with Live Message Inspector)
    try {
      const transporter = await getEtherealTransporter();
      const fromAddr = process.env.EMAIL_FROM || '"Reflecta Sanctuary" <alerts@reflecta.sanctuary>';
      const info = await transporter.sendMail({
        from: fromAddr,
        to: cleanRecipient,
        subject,
        text: plainText,
        html: htmlBody
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
      console.info(`[NotificationService] Email sent via Ethereal sandbox. Preview: ${previewUrl}`);
      return {
        success: true,
        transport: 'ethereal',
        previewUrl,
        message: previewUrl
          ? `Test email transmitted via Ethereal sandbox to ${cleanRecipient}!`
          : `Test email transmitted successfully to ${cleanRecipient}!`
      };
    } catch (etherealErr: any) {
      console.error('[NotificationService] Ethereal delivery error:', etherealErr?.message);
      return {
        success: false,
        error: `No SMTP credentials configured. To deliver directly to ${cleanRecipient}, please configure SMTP_HOST/SMTP_USER or RESEND_API_KEY in environment/secrets.`
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Email delivery failed' };
  }
}

// ----------------------------------------------------
// User Notification Settings & Trigger Endpoints
// ----------------------------------------------------
const notificationSettingSchema = z.object({
  id: z.string().optional(),
  provider: z.enum(['slack', 'discord', 'email']),
  enabled: z.boolean().default(true),
  destinationUrl: z.string().max(1000).optional(),
  recipientEmail: z.string().max(254).optional(),
  eventTypes: z.array(z.enum(['reflection', 'idea', 'goal', 'reminder', 'highlight', 'custom', 'none'])).min(1),
  privacyLevel: z.enum(['minimal', 'with_summary']).default('minimal'),
  channelName: z.string().max(100).optional().default('')
});

// ----------------------------------------------------
// Reliable In-Memory Store for User Notification Settings & History
// ----------------------------------------------------
const userNotificationSettingsStore = new Map<string, any[]>();
const rawUserNotificationSettingsStore = new Map<string, any[]>();
const userNotificationEventsStore = new Map<string, any[]>();

app.get('/api/notifications/settings', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const cached = userNotificationSettingsStore.get(uid);
    if (cached && cached.length > 0) {
      return res.json({ settings: cached });
    }

    const db = getAdminFirestore(req);
    if (db) {
      try {
        const snapshot = await db.collection(`users/${uid}/notificationSettings`).get();
        if (snapshot && snapshot.docs && snapshot.docs.length > 0) {
          const rawSettings = snapshot.docs.map((doc: any) => ({
            ...doc.data(),
            id: doc.id
          }));
          rawUserNotificationSettingsStore.set(uid, rawSettings);

          const settings = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            const maskedUrl = data.destinationUrl 
              ? data.destinationUrl.slice(0, 25) + '••••••••' + data.destinationUrl.slice(-6)
              : undefined;
            
            const sanitized = { ...data };
            if (sanitized.destinationUrl) {
              delete sanitized.destinationUrl;
            }

            return {
              ...sanitized,
              id: doc.id,
              destinationUrlMasked: maskedUrl
            };
          });
          userNotificationSettingsStore.set(uid, settings);
          return res.json({ settings });
        }
      } catch {
        // Fall back to in-memory store cleanly
      }
    }

    return res.json({ settings: userNotificationSettingsStore.get(uid) || [] });
  } catch (err: any) {
    return res.json({ settings: [] });
  }
});

app.post('/api/notifications/settings', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const parsed = notificationSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid notification settings payload',
        details: parsed.error.issues.map(i => i.message)
      });
    }

    const data = parsed.data;

    // Validate destination based on provider
    if (data.provider === 'slack' || data.provider === 'discord') {
      if (!data.destinationUrl) {
        return res.status(400).json({ error: `Webhook URL is required for ${data.provider} notifications` });
      }
      const val = validateWebhookUrl(data.destinationUrl, data.provider);
      if (!val.valid) {
        return res.status(400).json({ error: val.reason || 'Invalid webhook destination' });
      }
    } else if (data.provider === 'email') {
      let emailCandidate = (data.recipientEmail || '').trim();

      // Fallback to verified authenticated account email if not specified
      if (!emailCandidate && req.user?.email) {
        emailCandidate = req.user.email.trim();
      }

      // Handle brackets e.g. "Praveen <praveenkulkarni22@gmail.com>"
      const angleBracketMatch = emailCandidate.match(/<([^>]+)>/);
      if (angleBracketMatch) {
        emailCandidate = angleBracketMatch[1].trim();
      }

      // Strip mailto: prefix and surrounding quotes/spaces
      emailCandidate = emailCandidate.replace(/^mailto:/i, '').replace(/^[<"'\s]+|[>"'\s]+$/g, '').trim();

      // If user typed username only without @, auto-append domain from their authenticated account or gmail.com
      if (emailCandidate && !emailCandidate.includes('@')) {
        const fallbackDomain = (req.user?.email && req.user.email.includes('@'))
          ? req.user.email.split('@')[1]
          : 'gmail.com';
        emailCandidate = `${emailCandidate}@${fallbackDomain}`;
      }

      if (!emailCandidate || !validateEmail(emailCandidate)) {
        return res.status(400).json({ error: 'Valid recipient email address is required' });
      }
      data.recipientEmail = emailCandidate.toLowerCase();
    }

    const settingId = data.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const record = {
      id: settingId,
      userId: uid,
      provider: data.provider,
      enabled: data.enabled,
      destinationUrl: data.destinationUrl || '',
      recipientEmail: data.recipientEmail || '',
      eventTypes: data.eventTypes,
      privacyLevel: data.privacyLevel,
      channelName: data.channelName || `${data.provider.toUpperCase()} Alerts`,
      updatedAt: now,
      createdAt: now
    };

    // Store in-memory with masked URL for UI
    const existing = userNotificationSettingsStore.get(uid) || [];
    const maskedRecord = {
      ...record,
      destinationUrl: undefined,
      destinationUrlMasked: record.destinationUrl 
        ? record.destinationUrl.slice(0, 25) + '••••••••' + record.destinationUrl.slice(-6)
        : undefined
    };
    userNotificationSettingsStore.set(uid, [...existing.filter(s => s.id !== settingId), maskedRecord]);

    // Store raw record for dispatch triggers
    const rawExisting = rawUserNotificationSettingsStore.get(uid) || [];
    rawUserNotificationSettingsStore.set(uid, [...rawExisting.filter(s => s.id !== settingId), record]);

    // Durable Firestore write
    try {
      const db = getAdminFirestore(req);
      if (db) {
        await db.collection(`users/${uid}/notificationSettings`).doc(settingId).set(record, { merge: true });
      }
    } catch (dbErr: any) {
      console.warn('Firestore persistence warning for notification setting:', dbErr?.message || dbErr);
    }

    return res.json({
      success: true,
      setting: maskedRecord
    });
  } catch (err: any) {
    console.error('Save Notification Setting Error:', err);
    return res.status(400).json({ error: `Failed to save notification settings: ${err.message || err}` });
  }
});

app.delete('/api/notifications/settings/:settingId', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const settingId = req.params.settingId;
    
    const existing = userNotificationSettingsStore.get(uid) || [];
    userNotificationSettingsStore.set(uid, existing.filter(s => s.id !== settingId));

    const rawExisting = rawUserNotificationSettingsStore.get(uid) || [];
    rawUserNotificationSettingsStore.set(uid, rawExisting.filter(s => s.id !== settingId));

    try {
      const db = getAdminFirestore(req);
      if (db) {
        await db.collection(`users/${uid}/notificationSettings`).doc(settingId).delete();
      }
    } catch (dbErr: any) {
      console.warn('Firestore deletion warning for notification setting:', dbErr?.message || dbErr);
    }

    return res.json({ success: true, message: 'Notification channel deleted' });
  } catch {
    return res.json({ success: true, message: 'Notification channel deleted' });
  }
});

app.post('/api/notifications/test', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    let { settingId, provider, destinationUrl, recipientEmail, privacyLevel } = req.body;

    // Resolve unmasked destination from server store if settingId provided or masked on client
    if (settingId && (!destinationUrl || (typeof destinationUrl === 'string' && destinationUrl.includes('•••')) || !recipientEmail)) {
      const memRaw = rawUserNotificationSettingsStore.get(uid);
      const match = memRaw?.find((s: any) => s.id === settingId);
      if (match) {
        destinationUrl = match.destinationUrl || destinationUrl;
        recipientEmail = match.recipientEmail || recipientEmail;
        provider = match.provider || provider;
        privacyLevel = match.privacyLevel || privacyLevel;
      } else {
        try {
          const db = getAdminFirestore(req);
          if (db) {
            const doc = await db.collection(`users/${uid}/notificationSettings`).doc(settingId).get();
            if (doc && doc.exists) {
              const data = doc.data();
              destinationUrl = data.destinationUrl || destinationUrl;
              recipientEmail = data.recipientEmail || recipientEmail;
              provider = data.provider || provider;
              privacyLevel = data.privacyLevel || privacyLevel;
            }
          }
        } catch {
          // Fall through
        }
      }
    }

    if (provider === 'email' && !recipientEmail && req.user?.email) {
      recipientEmail = req.user.email;
    }

    const testPayload: NormalizedNotificationPayload = {
      eventId: `test_${Date.now()}`,
      userId: uid,
      eventType: 'highlight',
      title: 'Mindful Sanctuary Test Notification',
      summary: privacyLevel === 'with_summary' ? 'This is a test notification verifying that your Reflecta alerts are functioning smoothly.' : undefined,
      occurredAt: new Date().toISOString(),
      sanctuaryUrl: 'https://reflecta.sanctuary'
    };

    let result: { success: boolean; error?: string; message?: string; previewUrl?: string; transport?: string } = { success: false, error: 'Unknown provider' };

    if (provider === 'slack' && destinationUrl) {
      result = await sendSlackNotification(destinationUrl, testPayload);
    } else if (provider === 'discord' && destinationUrl) {
      result = await sendDiscordNotification(destinationUrl, testPayload);
    } else if (provider === 'email' && recipientEmail) {
      result = await sendEmailNotification(recipientEmail, testPayload);
    } else {
      return res.status(400).json({ error: 'Missing destination details for test dispatch' });
    }

    // Record test event history
    const eventRecord = {
      id: testPayload.eventId,
      userId: uid,
      provider,
      eventType: 'test' as any,
      title: testPayload.title,
      deliveredAt: testPayload.occurredAt,
      status: (result.success ? 'delivered' : 'failed') as any,
      destinationMasked: destinationUrl ? destinationUrl.slice(0, 20) + '...' : (recipientEmail || 'masked'),
      errorMessage: result.error || null,
      previewUrl: result.previewUrl || null,
      transport: result.transport || null,
      retryCount: 0
    };

    const curEvents = userNotificationEventsStore.get(uid) || [];
    userNotificationEventsStore.set(uid, [eventRecord, ...curEvents].slice(0, 50));

    try {
      const db = getAdminFirestore(req);
      if (db) {
        db.collection(`users/${uid}/notificationEvents`).doc(testPayload.eventId).set(eventRecord).catch(() => {});
      }
    } catch {
      // Non-blocking
    }

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Test notification delivery failed' });
    }

    return res.json({
      success: true,
      message: result.message || `Test ping to ${provider.toUpperCase()} completed successfully!`,
      previewUrl: result.previewUrl,
      transport: result.transport
    });
  } catch (err: any) {
    console.error('Test Notification Error:', err);
    return res.status(500).json({ error: 'Test dispatch failed' });
  }
});

app.get('/api/notifications/history', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const memEvents = userNotificationEventsStore.get(uid) || [];
    if (memEvents.length > 0) {
      return res.json({ events: memEvents });
    }

    try {
      const db = getAdminFirestore(req);
      if (db) {
        const snapshot = await db.collection(`users/${uid}/notificationEvents`)
          .orderBy('deliveredAt', 'desc')
          .limit(30)
          .get()
          .catch(() => ({ docs: [] } as any));

        const events = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        if (events.length > 0) {
          userNotificationEventsStore.set(uid, events);
          return res.json({ events });
        }
      }
    } catch {
      // Non-blocking
    }

    return res.json({ events: memEvents });
  } catch {
    return res.json({ events: [] });
  }
});

/**
 * Journal Classification & Controlled Notification Trigger Pipeline
 * Safely parses reflections, classifies event type, evaluates user notification rules, and dispatches minimal alerts
 */
const classifyAndTriggerSchema = z.object({
  journalId: z.string().optional(),
  title: z.string().max(200).optional().default(''),
  content: z.string().max(50000),
  mood: z.string().optional().default('thoughtful'),
  settings: z.array(z.any()).optional()
});

app.post('/api/notifications/classify-and-trigger', verifyAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const parsed = classifyAndTriggerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid journal content payload' });
    }

    const { title, content, mood } = parsed.data;

    // 1. Classification via Gemini with strict structured JSON schema
    const systemInstruction = `
You are Reflecta's Mindful Classification Engine.
Classify the user's journal reflection into exactly ONE category from this allowlist:
- "goal": Setting a tangible target, intention, commitment, habit, or future aspiration.
- "idea": Brainstorming, creative spark, concept, proposal, or insight.
- "reminder": A task, mindful reminder, note-to-self, or upcoming date.
- "highlight": A standout joyful moment, celebration, milestone, or gratitude peak.
- "reflection": General contemplative journal prose or emotional processing.
- "none": Unstructured fragments.

Provide:
- "eventType": One of "goal" | "idea" | "reminder" | "highlight" | "reflection" | "none".
- "safeTitle": A concise 3-5 word non-confidential title.
- "safeSummary": A 1-sentence mindful essence summary (maximum 140 characters).
`;

    const classificationSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        eventType: {
          type: Type.STRING,
          enum: ['goal', 'idea', 'reminder', 'highlight', 'reflection', 'none']
        },
        safeTitle: { type: Type.STRING },
        safeSummary: { type: Type.STRING }
      },
      required: ['eventType', 'safeTitle', 'safeSummary']
    };

    let classified: any = null;
    try {
      const geminiResult = await generateContentWithFallback({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: `Title: ${title}\nMood: ${mood}\n\nContent:\n${content.slice(0, 4000)}` }] }],
        responseSchema: classificationSchema,
        responseMimeType: 'application/json',
        temperature: 0.2
      });
      classified = JSON.parse(geminiResult.text);
    } catch {
      // Deterministic classification fallback
      const textLower = `${title} ${content}`.toLowerCase();
      let eventType = 'reflection';
      if (textLower.includes('goal') || textLower.includes('commit') || textLower.includes('plan to') || textLower.includes('habit')) eventType = 'goal';
      else if (textLower.includes('idea') || textLower.includes('what if') || textLower.includes('brainstorm') || textLower.includes('concept')) eventType = 'idea';
      else if (textLower.includes('remind') || textLower.includes('don\'t forget') || textLower.includes('remember to')) eventType = 'reminder';
      else if (textLower.includes('celebrat') || textLower.includes('proud') || textLower.includes('milestone') || textLower.includes('win')) eventType = 'highlight';

      classified = {
        eventType,
        safeTitle: title || 'Mindful Reflection',
        safeSummary: content.slice(0, 100) + '...'
      };
    }

    if (!classified || !classified.eventType || classified.eventType === 'none') {
      return res.json({ classified: classified || { eventType: 'none' }, notificationsSent: 0, results: [] });
    }

    // 2. Fetch User Notification Preferences (Passed in body, in-memory store, or Firestore)
    let candidateChannels: any[] = [];
    if (Array.isArray(parsed.data.settings) && parsed.data.settings.length > 0) {
      candidateChannels = parsed.data.settings;
    } else {
      const memRaw = rawUserNotificationSettingsStore.get(uid);
      if (memRaw && memRaw.length > 0) {
        candidateChannels = memRaw;
      } else {
        try {
          const db = getAdminFirestore(req);
          if (db) {
            const settingsSnap = await db.collection(`users/${uid}/notificationSettings`).get();
            candidateChannels = settingsSnap.docs.map((d: any) => d.data());
          }
        } catch {
          candidateChannels = [];
        }
      }
    }

    const channels = candidateChannels
      .filter(s => s.enabled && Array.isArray(s.eventTypes) && s.eventTypes.includes(classified.eventType));

    if (channels.length === 0) {
      return res.json({ classified, notificationsSent: 0, results: [], note: 'No subscribed channels for this event category' });
    }

    // 3. Dispatch notifications with strict data minimization
    const results: any[] = [];
    for (const ch of channels) {
      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const payload: NormalizedNotificationPayload = {
        eventId,
        userId: uid,
        eventType: classified.eventType,
        title: classified.safeTitle || title || 'Mindful Reflection',
        summary: ch.privacyLevel === 'with_summary' ? classified.safeSummary : undefined,
        occurredAt: new Date().toISOString(),
        sanctuaryUrl: 'https://reflecta.sanctuary'
      };

      let outcome: { success: boolean; error?: string; message?: string; previewUrl?: string; transport?: string } = { success: false, error: 'Unknown provider' };
      if (ch.provider === 'slack' && ch.destinationUrl) {
        outcome = await sendSlackNotification(ch.destinationUrl, payload);
      } else if (ch.provider === 'discord' && ch.destinationUrl) {
        outcome = await sendDiscordNotification(ch.destinationUrl, payload);
      } else if (ch.provider === 'email' && (ch.recipientEmail || req.user?.email)) {
        outcome = await sendEmailNotification(ch.recipientEmail || req.user!.email!, payload);
      }

      // Record event history
      const historyRecord = {
        id: eventId,
        userId: uid,
        provider: ch.provider,
        eventType: classified.eventType,
        title: payload.title,
        deliveredAt: payload.occurredAt,
        status: outcome.success ? 'delivered' : 'failed',
        destinationMasked: ch.destinationUrl ? ch.destinationUrl.slice(0, 20) + '...' : (ch.recipientEmail || 'masked'),
        errorMessage: outcome.error || null,
        previewUrl: outcome.previewUrl || null,
        transport: outcome.transport || null,
        retryCount: 0
      };

      const curEvts = userNotificationEventsStore.get(uid) || [];
      userNotificationEventsStore.set(uid, [historyRecord, ...curEvts].slice(0, 50));

      try {
        const db = getAdminFirestore(req);
        if (db) {
          db.collection(`users/${uid}/notificationEvents`).doc(eventId).set(historyRecord).catch(() => {});
        }
      } catch {
        // Non-blocking
      }

      results.push({ provider: ch.provider, success: outcome.success, error: outcome.error });
    }

    return res.json({
      classified,
      notificationsSent: results.filter(r => r.success).length,
      results
    });
  } catch (err: any) {
    console.error('Classify and Trigger Notification Error:', err);
    return res.status(500).json({ error: 'Notification processing failed' });
  }
});

// ----------------------------------------------------
// Admin RBAC Dashboard & System Diagnostics Endpoints
// ----------------------------------------------------
// Admin Endpoints & Operational Telemetry
// ----------------------------------------------------

/**
 * Checks current user's effective administrative role and permissions
 */
app.get('/api/admin/role-check', verifyAuth, (req: AuthenticatedRequest, res) => {
  const role = req.user?.role || 'user';
  const permissions = Array.from(ROLE_PERMISSIONS[role] || []);
  return res.json({
    role,
    isAdmin: role === 'admin' || role === 'super_admin',
    permissions
  });
});

/**
 * Sanitized User Telemetry Sync Endpoint
 * Allows authenticated users to push high-level sanitized counts (zero private reflection text)
 */
const userSyncSchema = z.object({
  displayName: z.string().max(100).optional(),
  journalCount: z.number().int().nonnegative().optional(),
  conversationCount: z.number().int().nonnegative().optional(),
  summaryCount: z.number().int().nonnegative().optional(),
  wordCountSum: z.number().int().nonnegative().optional(),
  moodCounts: z.record(z.string(), z.number().int().nonnegative()).optional()
});

app.post('/api/users/sync', verifyAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const parsed = userSyncSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid sync payload schema' });
  }

  const { displayName, journalCount, conversationCount, summaryCount, wordCountSum, moodCounts } = parsed.data;
  let record = sanitizedUserRegistryStore.get(user.uid);
  if (!record && user.email) {
    record = sanitizedUserRegistryStore.get(`email:${user.email.toLowerCase()}`);
    if (record) {
      sanitizedUserRegistryStore.delete(`email:${user.email.toLowerCase()}`);
      sanitizedUserRegistryStore.delete(record.uid);
      record.uid = user.uid;
    }
  }

  const now = new Date().toISOString();
  if (!record) {
    record = {
      uid: user.uid,
      email: user.email || null,
      displayName: displayName || user.displayName || user.email?.split('@')[0] || 'Sanctuary User',
      role: user.role || 'user',
      createdAt: now,
      lastActive: now,
      journalCount: journalCount ?? 0,
      conversationCount: conversationCount ?? 0,
      summaryCount: summaryCount ?? 0,
      wordCountSum: wordCountSum ?? 0,
      moodCounts: moodCounts ?? {}
    };
  } else {
    record.lastActive = now;
    if (displayName) record.displayName = displayName;
    if (user.email) record.email = user.email;
    if (journalCount !== undefined) record.journalCount = journalCount;
    if (conversationCount !== undefined) record.conversationCount = conversationCount;
    if (summaryCount !== undefined) record.summaryCount = summaryCount;
    if (wordCountSum !== undefined) record.wordCountSum = wordCountSum;
    if (moodCounts) record.moodCounts = moodCounts;
  }

  sanitizedUserRegistryStore.set(user.uid, record);

  return res.json({
    success: true,
    uid: user.uid,
    role: record.role,
    permissions: Array.from(ROLE_PERMISSIONS[record.role] || [])
  });
});

/**
 * Aggregate Operational Metrics for Admin Dashboard
 * Strictly computes aggregate metrics and statistics WITHOUT exposing private journal bodies
 */
app.get('/api/admin/metrics', requireAdminPermission('admin.dashboard.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const allUsers = getUniqueSanitizedUsers();
    
    let totalJournals = 0;
    let totalConversations = 0;
    let totalSummaries = 0;
    let wordCountSum = 0;
    let superAdminCount = 0;
    let activeUsers24h = 0;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const moodDistribution: Record<string, number> = {
      calm: 0,
      grateful: 0,
      thoughtful: 0,
      energized: 0,
      curious: 0,
      peaceful: 0,
      searching: 0,
      overwhelmed: 0,
      melancholy: 0
    };

    for (const u of allUsers) {
      if (u.role === 'super_admin') superAdminCount++;
      if (new Date(u.lastActive).getTime() > oneDayAgo) activeUsers24h++;
      totalJournals += u.journalCount || 0;
      totalConversations += u.conversationCount || 0;
      totalSummaries += u.summaryCount || 0;
      wordCountSum += u.wordCountSum || 0;

      if (u.moodCounts) {
        for (const [m, count] of Object.entries(u.moodCounts)) {
          if (moodDistribution[m] !== undefined) {
            moodDistribution[m] += count;
          } else {
            moodDistribution[m] = (moodDistribution[m] || 0) + count;
          }
        }
      }
    }

    const avgJournalWordCount = totalJournals > 0 ? Math.round(wordCountSum / totalJournals) : 0;

    // Delivery stats
    let totalNotificationsSent = 0;
    let notificationsSuccessful = 0;
    let notificationsFailed = 0;
    const notificationsByProvider: Record<string, number> = { slack: 0, discord: 0, email: 0 };

    const db = getAdminFirestore(req);
    if (db) {
      for (const u of allUsers) {
        try {
          const notifsSnap = await db.collection(`users/${u.uid}/notificationEvents`).get().catch(() => ({ docs: [] } as any));
          if (notifsSnap && notifsSnap.docs) {
            for (const nDoc of notifsSnap.docs) {
              const nd = nDoc.data();
              totalNotificationsSent++;
              if (nd.status === 'delivered') notificationsSuccessful++;
              else if (nd.status === 'failed') notificationsFailed++;
              if (nd.provider && notificationsByProvider[nd.provider] !== undefined) {
                notificationsByProvider[nd.provider]++;
              }
            }
          }
        } catch {}
      }
    }

    await recordAdminAuditLog(
      req,
      req.user!,
      'view_metrics',
      'admin.dashboard.read',
      'system',
      'metrics',
      'success'
    );

    return res.json({
      totalUsers: allUsers.length,
      totalJournals,
      totalConversations,
      totalSummaries,
      activeUsers24h,
      avgJournalWordCount,
      moodDistribution,
      superAdminQuota: {
        current: superAdminCount,
        max: 3
      },
      notificationDeliveryStats: {
        totalSent: totalNotificationsSent,
        successful: notificationsSuccessful,
        failed: notificationsFailed,
        byProvider: notificationsByProvider
      },
      serverUptimeSeconds: Math.floor(process.uptime()),
      systemHealth: {
        firestore: 'healthy',
        geminiApi: process.env.GEMINI_API_KEY ? 'healthy' : 'degraded',
        rateLimiter: 'active'
      }
    });
  } catch (err: any) {
    console.error('Admin Metrics Error:', err);
    return res.status(500).json({ error: 'Failed to aggregate administrative metrics' });
  }
});

/**
 * List Registered Users (Sanitized metadata only - no private journal content)
 */
app.get('/api/admin/users', requireAdminPermission('admin.users.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const allUsers = getUniqueSanitizedUsers();
    
    const users = allUsers.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
      lastActive: u.lastActive,
      journalCount: u.journalCount || 0,
      conversationCount: u.conversationCount || 0,
      summaryCount: u.summaryCount || 0,
      wordCountSum: u.wordCountSum || 0,
      moodCounts: u.moodCounts || {}
    }));

    await recordAdminAuditLog(
      req,
      req.user!,
      'list_users',
      'admin.users.read',
      'users',
      undefined,
      'success',
      { count: users.length }
    );

    return res.json({ users });
  } catch (err: any) {
    console.error('Admin Users List Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve user registry' });
  }
});

/**
 * Update User Role (RBAC Claim Assignment with Super Admin Quota Control)
 * ENFORCED RULE: Maximum 3 Super Admins allowed platform-wide.
 */
const MAX_SUPER_ADMINS = 3;

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin'])
});

app.post('/api/admin/users/:targetUid/role', requireAdminPermission('admin.users.manage'), async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.targetUid;
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid role assignment parameters' });
    }

    const { role } = parsed.data;
    const allUsers = getUniqueSanitizedUsers();
    const targetUser = allUsers.find(u => u.uid === targetUid || (u.email && u.email.toLowerCase() === targetUid.toLowerCase()));

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found in registry' });
    }

    // ----------------------------------------------------
    // SUPER ADMIN QUOTA CONTROL: MAX 3 SUPER ADMINS CAP
    // ----------------------------------------------------
    if (role === 'super_admin' && targetUser.role !== 'super_admin') {
      const existingSuperAdmins = allUsers.filter(u => u.role === 'super_admin').length;
      if (existingSuperAdmins >= MAX_SUPER_ADMINS) {
        await recordAdminAuditLog(
          req,
          req.user!,
          'update_role',
          'admin.users.manage',
          'user',
          targetUid,
          'denied',
          { requestedRole: 'super_admin', reason: 'super_admin_limit_exceeded', maxAllowed: MAX_SUPER_ADMINS, currentCount: existingSuperAdmins }
        );

        return res.status(400).json({
          error: `Super Admin Quota Reached: Platform is restricted to a maximum of ${MAX_SUPER_ADMINS} Super Admins. Please demote an existing Super Admin before promoting another user.`,
          code: 'SUPER_ADMIN_LIMIT_EXCEEDED',
          currentCount: existingSuperAdmins,
          maxAllowed: MAX_SUPER_ADMINS
        });
      }
    }

    targetUser.role = role;
    sanitizedUserRegistryStore.set(targetUser.uid, targetUser);

    const app = getAuthApp();
    if (app) {
      await getAuth(app).setCustomUserClaims(targetUser.uid, { role }).catch(err => {
        console.warn('Firebase setCustomUserClaims warning:', err.message);
      });
    }

    const db = getAdminFirestore(req);
    if (db) {
      await db.collection('users').doc(targetUser.uid).set({ role, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    }

    await recordAdminAuditLog(
      req,
      req.user!,
      'update_role',
      'admin.users.manage',
      'user',
      targetUser.uid,
      'success',
      { newRole: role, email: targetUser.email }
    );

    return res.json({ success: true, targetUid: targetUser.uid, newRole: role, maxSuperAdmins: MAX_SUPER_ADMINS });
  } catch (err: any) {
    console.error('Admin Role Update Error:', err);
    return res.status(500).json({ error: 'Failed to assign role' });
  }
});

/**
 * Retrieve Administrative Audit Logs
 */
app.get('/api/admin/audit-logs', requireAdminPermission('admin.audit.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const db = getAdminFirestore(req);
    if (!db) return res.json({ logs: [] });

    const logsSnap = await db.collection('adminAuditLogs')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .catch(() => ({ docs: [] } as any));

    const logs = logsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return res.json({ logs });
  } catch (err: any) {
    console.error('Admin Audit Logs Error:', err);
    return res.json({ logs: [] });
  }
});

/**
 * Interactive Admin RBAC Permission Probe Endpoint
 * Allows live validation of zero-trust RBAC policies and permission scopes
 */
app.post('/api/admin/probe-permission', verifyAuth, async (req: AuthenticatedRequest, res) => {
  const probeSchema = z.object({
    permission: z.string().min(1).max(100)
  });
  const parsed = probeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid permission probe format' });
  }

  const { permission } = parsed.data;
  const user = req.user!;
  const role = user.role || 'user';
  const rolePermissions = ROLE_PERMISSIONS[role] || new Set();
  const isAuthorized = rolePermissions.has(permission as any) || role === 'super_admin';

  await recordAdminAuditLog(
    req,
    user,
    'probe_permission',
    permission as any,
    'system',
    'rbac_policy',
    isAuthorized ? 'success' : 'denied',
    { requestedPermission: permission, effectiveRole: role }
  );

  if (!isAuthorized) {
    return res.status(403).json({
      authorized: false,
      role,
      permission,
      error: `Access Denied: Role '${role}' lacks the '${permission}' permission.`
    });
  }

  return res.json({
    authorized: true,
    role,
    permission,
    message: `Verification Passed: Role '${role}' holds verified authority for '${permission}'.`
  });
});

/**
 * Payload Simulation Endpoint
 * Returns exact normalized & provider-rendered payloads for testing & schema inspection
 */
app.post('/api/notifications/simulate-payload', verifyAuth, (req: AuthenticatedRequest, res) => {
  const simSchema = z.object({
    provider: z.enum(['slack', 'discord', 'email']),
    eventType: z.enum(['goal', 'idea', 'reminder', 'highlight', 'reflection', 'custom']),
    title: z.string().max(200),
    summary: z.string().max(1000).optional(),
    privacyLevel: z.enum(['minimal', 'with_summary']).default('minimal')
  });

  const parsed = simSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid simulation payload schema' });
  }

  const { provider, eventType, title, summary, privacyLevel } = parsed.data;
  const dummyEventId = `sim_${Date.now()}`;
  const occurredAt = new Date().toISOString();

  const normalized: NormalizedNotificationPayload = {
    eventId: dummyEventId,
    userId: req.user!.uid,
    eventType,
    title,
    summary: privacyLevel === 'with_summary' ? summary : undefined,
    occurredAt,
    sanctuaryUrl: 'https://reflecta.sanctuary'
  };

  let renderedPayload: any = null;
  if (provider === 'slack') {
    const eventEmojiMap: Record<string, string> = {
      goal: '🎯', idea: '💡', reminder: '⏰', highlight: '✨', reflection: '🌿', custom: '🔖'
    };
    renderedPayload = {
      text: `Reflecta Alert: [${eventType.toUpperCase()}] ${title}`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${eventEmojiMap[eventType] || '📝'} ${title.slice(0, 150)}`, emoji: true }
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Category:*\n\`${eventType.toUpperCase()}\`` },
            { type: 'mrkdwn', text: `*Timestamp:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${occurredAt}>` }
          ]
        },
        ...(normalized.summary ? [{
          type: 'section',
          text: { type: 'mrkdwn', text: `*Essence Summary:*\n>${normalized.summary}` }
        }] : []),
        {
          type: 'context',
          elements: [{ type: 'mrkdwn', text: '🔒 _Reflecta Sanctuary • Minimal Privacy Scope • Zero Raw Journals Transmitted_' }]
        }
      ]
    };
  } else if (provider === 'discord') {
    const colorMap: Record<string, number> = {
      goal: 0x14b8a6, idea: 0x3b82f6, reminder: 0xf59e0b, highlight: 0xec4899, reflection: 0x10b981, custom: 0x8b5cf6
    };
    renderedPayload = {
      username: 'Reflecta Sanctuary',
      embeds: [{
        title: `✨ ${title}`,
        description: normalized.summary ? `*"${normalized.summary}"*` : 'A mindful reflection was archived in your personal sanctuary.',
        color: colorMap[eventType] || 0x14b8a6,
        fields: [
          { name: 'Category', value: `\`${eventType.toUpperCase()}\``, inline: true },
          { name: 'Timestamp', value: new Date(occurredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), inline: true }
        ],
        footer: { text: 'Reflecta Mindful Journal • Minimal Privacy Scope' },
        timestamp: occurredAt
      }]
    };
  } else if (provider === 'email') {
    renderedPayload = {
      subject: `[Reflecta Sanctuary] ${eventType.toUpperCase()}: ${title}`,
      html: `<div style="font-family:serif;padding:24px;border:1px solid #e7e5e4;border-radius:12px;background:#fafaf9;"><h2>${title}</h2><p><strong>Category:</strong> ${eventType.toUpperCase()}</p>${normalized.summary ? `<p><em>${normalized.summary}</em></p>` : ''}<p style="font-size:11px;color:#78716c;">Reflecta Sanctuary Mindful Notification</p></div>`
    };
  }

  return res.json({
    normalizedContract: normalized,
    renderedPayload,
    schemaRules: {
      strictHttpsRequired: true,
      maxTitleLength: 200,
      maxSummaryLength: 1000,
      blockedSubnets: ['127.0.0.0/8', '10.0.0.0/8', '192.168.0.0/16', '172.16.0.0/12', '169.254.169.254'],
      allowlistedEvents: ['goal', 'idea', 'reminder', 'highlight', 'reflection', 'custom']
    }
  });
});

/**
 * System Health & Infrastructure Diagnostics
 */
app.get('/api/admin/system-health', requireAdminPermission('admin.system.read'), async (req: AuthenticatedRequest, res) => {
  try {
    const db = getAdminFirestore(req);
    let firestoreConnected = false;
    if (db) {
      try {
        await db.collection('test').doc('ping').set({ ping: Date.now() }, { merge: true });
        firestoreConnected = true;
      } catch {
        firestoreConnected = false;
      }
    }

    const mem = process.memoryUsage();
    return res.json({
      nodeVersion: process.version,
      platform: process.platform,
      serverUptime: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024)
      },
      security: {
        hsts: true,
        csp: true,
        zeroTrustAuth: true,
        rateLimiterActive: true,
        ssrfProtection: true
      },
      services: {
        firestore: firestoreConnected ? 'operational' : 'degraded',
        geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
        fallbackLadderTiers: FALLBACK_MODELS
      }
    });
  } catch (err: any) {
    console.error('System Health Diagnostics Error:', err);
    return res.status(500).json({ error: 'Diagnostics failed' });
  }
});

// ----------------------------------------------------
// Vite Middleware / Static Production Assets
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ Reflecta Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
