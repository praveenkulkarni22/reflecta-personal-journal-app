# Reflecta — Personal Gemini Journal & Zero-Trust Sanctuary

> **A place for every thought. A moment for yourself.**

Reflecta is a production-grade, privacy-first personal sanctuary where individuals can pause, write, think aloud, explore ideas, and reflect on their experiences through meaningful multi-turn conversations with Gemini.

---

## 1. Project Overview & Architecture

Reflecta is built on a **defense-in-depth, zero-leakage security model**:

- **Client Layer**: React 18 + TypeScript + Tailwind CSS with dark luxury styling, ambient audio noise generators, interactive volume reader, and responsive journaling layouts.
- **Server API Gateway**: Express (Node.js) server running on Cloud Run, proxying all Gemini API calls server-side. Operational secrets (Gemini API keys) are **never exposed to the browser**.
- **Gemini Multi-Model Fallback Ladder**: Automated fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`) ensuring high availability and zero-downtime offline reflective synthesis.
- **Authentication & Identity**: Firebase Authentication with Google Sign-In and cryptographic ID token verification on every API request.
- **Data Isolation**: Cloud Firestore with owner-bound, path-isolated security rules (`/users/{userId}/...`).
- **Server-Enforced RBAC Engine**: Zero-Trust Role-Based Access Control enforcing `User`, `Admin`, and `Super Admin` role boundaries server-side with Custom Claims verification.
- **Super Admin Hard Quota Cap**: Strictly enforced ceiling of **at most 3 Super Admins** platform-wide to prevent privilege sprawl and unauthorized escalation.
- **External Webhook Engine**: Server-side webhook dispatcher for Slack, Discord, and Email alerts with SSRF shielding, destination validation, rate limiting, and minimal privacy scope.
- **Original Enhancement**: **The Inner Landscape Synthesizer** — a longitudinal synthesis engine analyzing recurring life pillars, emotional cadence vectors, personal grounding mantras, and seasonal contemplative inquiries.

---

## 2. Server-Enforced Zero-Trust RBAC System

### Role Classification & Privilege Scope Matrix

| Role | Scope & Data Boundary | Core Capabilities | Administrative Permissions |
| :--- | :--- | :--- | :--- |
| **`User`** *(Standard)* | Bound strictly to `users/{userId}/*` in Firestore. | Personal journaling, Socratic dialogue, memory calendar, inner landscape, personal webhook alerts. | **None (`0`)**. Barred from administrative APIs, user registry, and telemetry. |
| **`Admin`** *(Elevated)* | Read-only aggregate metrics, user registry, audit logs, health telemetry. | Inspecting operational metrics, managing user roles, auditing security logs, configuring external webhooks, running permission probes. | Full `admin.*` permission set (`admin.dashboard.read`, `admin.users.read`, `admin.users.manage`, `admin.notifications.manage`, `admin.system.read`, `admin.audit.read`). |
| **`Super Admin`** *(Master)* | Unrestricted platform-wide system & security authority. | Promoting/demoting admin roles, master security policy overrides, infrastructure policy management, full audit control. | All `admin.*` permissions + `super_admin.override`. **Restricted to max 3 Super Admins platform-wide.** |

### Super Admin Quota Control (Maximum 3 Super Admins)
- **Quota Enforcer**: During role assignment (`POST /api/admin/users/:targetUid/role`), the server queries Firestore for existing `super_admin` accounts. If the count is already 3, any attempt to promote another account to `super_admin` is rejected with `400 Bad Request` and logged as a denied security audit event.
- **Demotion Requirement**: To assign a new Super Admin when quota is full (3/3), an existing Super Admin must first be demoted to `Admin` or `User`.

---

## 3. Threat Summary & Security Verification

| Threat Zone | Threat | Impact | Countermeasure Implemented |
|---|---|---|---|
| **Input Surfaces** | Malformed payloads, XSS, oversized input | Denial of service, script injection | Strict server-side Zod validation on all API endpoints; safe markdown rendering without raw HTML passthrough. |
| **Planning & AI Reasoning** | Prompt injection, instruction bypass | Altered assistant behavior | System prompts isolated from user input; user text formatted as explicit untrusted context. |
| **Tool Execution** | Dynamic code execution, privilege escalation | Unauthorized operations | Absolute ban on `eval()`, `new Function()`, or dynamic runtime execution. |
| **Memory & State** | Cross-user data leakage, hijacked conversation IDs | Unauthorized data access | Strict Firestore path isolation (`users/{userId}/...`) and owner-only Security Rules (`request.auth.uid == userId`). |
| **Inter-System Comms** | API key leakage, token forgery | Credential compromise | Gemini API keys stored in Secret Manager; Firebase ID token verification server-side. |
| **Role Escalation** | Client spoofing `isAdmin` or bypassing RBAC | Unauthorized administrative access | Server-side Firebase token verification and custom claims evaluation; client state ignored for authorization. |
| **Quota Bypass** | Unbounded promotion of Super Admins | Privilege sprawl | Server-enforced Super Admin cap (max 3) checked in atomic transactional role assignment handler. |
| **Webhook SSRF** | Attacker submitting internal/loopback webhook URLs | SSRF, internal network scan | Webhook destination URL validation blocking localhost, 127.0.0.1, internal IP ranges, and metadata services. |

---

## 4. Prerequisites

- [Node.js](https://nodejs.org/) v18+ and `npm`
- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk)
- [Firebase CLI (`firebase-tools`)](https://firebase.google.com/docs/cli)
- A Google Cloud Project with billing enabled

---

## 5. Google Cloud APIs Setup

Enable required GCP services:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 6. Google Cloud Secret Manager Configuration

Store Gemini API credentials securely in Secret Manager:

```bash
# 1. Create the Secret in Secret Manager
gcloud secrets create GEMINI_API_KEY \
  --replication-policy="automatic"

# 2. Add your Gemini API Key as the latest version
echo -n "YOUR_GEMINI_API_KEY" | \
gcloud secrets versions add GEMINI_API_KEY \
  --data-file=-

# 3. Grant the Cloud Run runtime service account access to read secrets
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 7. Cloud Firestore Security Rules

Deploy path-isolated security rules to enforce zero cross-user leakage:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Default deny for all unspecified collections
    match /{document=**} {
      allow read, write: if false;
    }

    // UID-bound user private vault
    match /users/{userId} {
      allow read, create, update:
        if request.auth != null &&
           request.auth.uid == userId;

      match /conversations/{conversationId} {
        allow read, write:
          if request.auth != null &&
             request.auth.uid == userId;

        match /messages/{messageId} {
          allow read, write:
            if request.auth != null &&
               request.auth.uid == userId;
        }
      }

      match /journals/{journalId} {
        allow read, write:
          if request.auth != null &&
             request.auth.uid == userId;
      }

      match /summaries/{summaryId} {
        allow read, write:
          if request.auth != null &&
             request.auth.uid == userId;
      }

      match /landscapes/{landscapeId} {
        allow read, write:
          if request.auth != null &&
             request.auth.uid == userId;
      }

      match /notificationSettings/{settingId} {
        allow read, write:
          if request.auth != null &&
             request.auth.uid == userId;
      }

      match /notificationEvents/{eventId} {
        allow read, write:
          if request.auth != null &&
             request.auth.uid == userId;
      }
    }
  }
}
```

---

## 8. Firebase Authentication Setup

1. In the [Firebase Console](https://console.firebase.google.com/), enable **Google Sign-In** under **Authentication > Sign-in method**.
2. Add your authorized domains (`localhost` and Cloud Run deployment domain).
3. Client configuration is automatically read from `firebase-applet-config.json` / environment variables.

---

## 9. API Reference

### Public / Authenticated User Endpoints
- `GET /api/auth/me`: Validates user ID token and returns effective RBAC role (`user`, `admin`, `super_admin`) and permissions.
- `POST /api/chat`: Server-side Gemini multi-turn conversation endpoint with fallback model support.
- `POST /api/journals/summarize`: Generates AI reflection summary and fires external webhooks if configured.
- `POST /api/notifications/test`: Dispatches a test notification to Slack, Discord, or Email with SSRF shielding.

### Administrative Endpoints (`admin.*` required)
- `GET /api/admin/metrics`: Aggregates system metrics, user counts, notification delivery stats, and **Super Admin Quota Status (current / 3 max)**.
- `GET /api/admin/users`: Lists registered accounts with sanitized metadata (zero reflection text).
- `POST /api/admin/users/:targetUid/role`: Assigns user role (`user`, `admin`, `super_admin`). Enforces **Maximum 3 Super Admins** hard cap.
- `GET /api/admin/audit-logs`: Retrieves latest administrative security audit logs.
- `POST /api/admin/probe-permission`: Interactive live permission probe tool to test zero-trust policy evaluations.
- `GET /api/admin/system-health`: Returns real-time health telemetry for Firestore, Gemini API, and Rate Limiting.

---

## 10. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure local environment (`.env.local` - never commit secrets):
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

---

## 11. Cloud Run Deployment

To support secure dynamic deployment on any platform, there are no hardcoded administrator email fallbacks in the codebase. Setting the `ADMIN_EMAILS` environment variable is **strictly mandatory** for the server to successfully boot up.

Deploy directly to Google Cloud Run specifying your bootstrap administrators:

```bash
# Build and deploy container to Cloud Run with mandatory bootstrap administrator emails
gcloud run deploy reflecta \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --set-env-vars="ADMIN_EMAILS=admin@example.com" \
  --update-labels=dev-tutorial=cloud-run-ai-challenge
```

> **CRITICAL MANDATORY NOTE**: Stating `ADMIN_EMAILS` is a requirement. The variable expects a comma-separated list of emails (e.g., `admin1@example.com,admin2@example.com`). These accounts receive dynamic bootstrap privileges inside the **Admin Panel > User Registry** on first sign-in. If this environment variable is missing, the server will crash on startup with a clear configuration validation error.

### Challenge Verification Label
Verify the required challenge label is attached to your Cloud Run service:

```bash
gcloud run services update reflecta \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 12. License & Privacy

Built with zero-trust privacy standards. All reflections and conversations remain isolated to the user's private encrypted vault.
