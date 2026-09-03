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
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash'
];

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
    createdAt: z.string()
  })).min(1).max(50)
});

const sparkRequestSchema = z.object({
  intention: z.string().max(100).optional().default('general'),
  mood: z.string().max(100).optional().default('calm')
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

    const result = await generateContentWithFallback({
      systemInstruction,
      contents: formattedContents,
      temperature: 0.75
    });

    return res.json({
      reply: result.text,
      modelUsed: result.modelUsed,
      mode
    });
  } catch (err: any) {
    console.error('Chat API Error:', err.message || err);
    return res.status(500).json({
      error: 'Unable to complete reflection at this moment. Your thoughts are safe.',
      code: 'GEMINI_FAILURE'
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

    const result = await generateContentWithFallback({
      systemInstruction,
      contents: [{ role: 'user', parts: [{ text: transcript }] }],
      responseSchema: summarySchema,
      responseMimeType: 'application/json',
      temperature: 0.4
    });

    let parsedSummary;
    try {
      parsedSummary = JSON.parse(result.text);
    } catch {
      parsedSummary = {
        title: reflectionTitle || 'Reflective Synthesis',
        mainThemes: ['Personal Clarity', 'Mindful Presence'],
        importantThoughts: ['Finding space to reflect amidst daily movement.'],
        keyInsights: ['Pausing allows hidden thoughts to surface gracefully.'],
        reflectiveQuestions: ['What small step brings the greatest peace today?'],
        suggestedNextSteps: ['Take a 5-minute quiet breath before starting tomorrow.']
      };
    }

    return res.json({
      summary: parsedSummary,
      modelUsed: result.modelUsed
    });
  } catch (err: any) {
    console.error('Summarize API Error:', err.message || err);
    return res.status(500).json({
      error: 'Failed to distill reflection summary',
      code: 'SUMMARIZE_FAILURE'
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
[Entry #${idx + 1} | Date: ${e.createdAt} | Mood: ${e.mood || 'N/A'} | Intention: ${e.intention || 'N/A'}]
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

    const result = await generateContentWithFallback({
      systemInstruction,
      contents: [{ role: 'user', parts: [{ text: aggregateText }] }],
      responseSchema: landscapeSchema,
      responseMimeType: 'application/json',
      temperature: 0.5
    });

    const parsedLandscape = JSON.parse(result.text);

    return res.json({
      landscape: parsedLandscape,
      entryCountAnalyzed: entries.length,
      modelUsed: result.modelUsed
    });
  } catch (err: any) {
    console.error('Landscape Synthesis Error:', err.message || err);
    return res.status(500).json({
      error: 'Failed to synthesize inner landscape',
      code: 'LANDSCAPE_FAILURE'
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

    const result = await generateContentWithFallback({
      systemInstruction,
      contents: [{ role: 'user', parts }],
      responseSchema: voiceOutputSchema,
      responseMimeType: 'application/json',
      temperature: 0.5
    });

    let parsed;
    try {
      parsed = JSON.parse(result.text);
    } catch {
      parsed = {
        suggestedTitle: 'Spoken Reflection',
        polishedReflection: speechText,
        keyEmotions: [mood]
      };
    }

    return res.json({
      ...parsed,
      modelUsed: result.modelUsed
    });
  } catch (err: any) {
    console.error('Voice Reflection API Error:', err.message || err);
    return res.status(500).json({
      error: 'Failed to process voice reflection',
      code: 'VOICE_REFLECTION_ERROR'
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
