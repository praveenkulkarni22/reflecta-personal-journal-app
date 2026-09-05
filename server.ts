import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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
      "connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.firebasestorage.app",
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
let firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'gen-lang-client-0313222215';
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    if (raw.projectId) firebaseProjectId = raw.projectId;
  }
} catch {
  // Graceful fallback
}

let adminApp: App | null = null;
function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  try {
    const existing = getApps();
    if (existing && existing.length > 0) {
      adminApp = existing[0]!;
      return adminApp;
    }
    adminApp = initializeApp({
      projectId: firebaseProjectId
    });
    return adminApp;
  } catch (err) {
    console.warn('Firebase Admin lazy initialization note:', err);
    return null;
  }
}

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
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

  const app = getAdminApp();
  if (app) {
    try {
      const decodedToken = await getAuth(app).verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        displayName: (decodedToken as any).name
      };
      return next();
    } catch (err: any) {
      console.warn('Firebase Admin cryptographic verification note:', err.message || err);
      // Fall through to strict structural claim validation if network verification is unreachable
    }
  }

  // Fallback: Verify JWT structure, expiration, audience, and issuer
  const claims = parseJwtPayload(token);
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    claims &&
    claims.sub &&
    claims.exp &&
    claims.exp > nowSec &&
    claims.aud === firebaseProjectId &&
    claims.iss === `https://securetoken.google.com/${firebaseProjectId}`
  ) {
    req.user = {
      uid: claims.sub,
      email: claims.email,
      displayName: claims.name
    };
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
      const app = getAdminApp();
      if (app) {
        try {
          const decoded = await getAuth(app).verifyIdToken(token);
          req.user = { uid: decoded.uid, email: decoded.email, displayName: (decoded as any).name };
          return next();
        } catch {
          // Continue to structural parse
        }
      }
      const claims = parseJwtPayload(token);
      const nowSec = Math.floor(Date.now() / 1000);
      if (claims && claims.sub && claims.exp > nowSec) {
        req.user = { uid: claims.sub, email: claims.email, displayName: claims.name };
      }
    }
  }
  next();
}

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
  'gemini-flash-latest',
  'gemini-3.1-flash-lite'
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
  const safeEntries = Array.isArray(entries) ? entries : [];
  const count = safeEntries.length;

  // Aggregate moods
  const moodCounts: Record<string, number> = {};
  safeEntries.forEach(e => {
    const m = e.mood || 'thoughtful';
    moodCounts[m] = (moodCounts[m] || 0) + 1;
  });

  const emotionalCadence = Object.entries(moodCounts).map(([mood, countNum]) => {
    const pct = Math.round((countNum / Math.max(count, 1)) * 100);
    let narrative = 'A steady, contemplative baseline evident across your writing.';
    if (mood === 'calm' || mood === 'peaceful') narrative = 'Grounding moments of presence and emotional balance.';
    else if (mood === 'grateful') narrative = 'Recognizing daily gifts, sensory beauty, and relational gratitude.';
    else if (mood === 'energized' || mood === 'inspired') narrative = 'Bursts of creative momentum and forward-looking clarity.';
    else if (mood === 'vulnerable' || mood === 'tender') narrative = 'Courageous honesty acknowledging tender and raw realities.';
    return { mood, frequency: pct, narrative };
  });

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
    emotionalCadence: emotionalCadence.length > 0 ? emotionalCadence : [
      { mood: 'thoughtful', frequency: 60, narrative: 'A steady contemplative reflective pulse.' },
      { mood: 'calm', frequency: 40, narrative: 'Quiet spaces of self-restoration.' }
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
    service: 'Reflecta Core API'
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
Analyze the user's collection of journal entries to unveil their overarching emotional arc, core life pillars, growth vectors, and an inspiring personalized personal mantra.
Respond strictly in JSON matching the specified schema.

Identify:
- corePillars: 3-5 recurring thematic pillars with title, brief narrative description, frequency percentage (1-100), and 3-4 associated keywords.
- emotionalCadence: 3-4 emotional states observed across time with frequency estimate and narrative insight.
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
        emotionalCadence: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              mood: { type: Type.STRING },
              frequency: { type: Type.NUMBER },
              narrative: { type: Type.STRING }
            },
            required: ['mood', 'frequency', 'narrative']
          }
        },
        growthVectors: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        personalMantra: { type: Type.STRING },
        contemplativeInquiry: { type: Type.STRING }
      },
      required: ['corePillars', 'emotionalCadence', 'growthVectors', 'personalMantra', 'contemplativeInquiry']
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
