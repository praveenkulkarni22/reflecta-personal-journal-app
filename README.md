# Reflecta — Personal Gemini Journal

> **A place for every thought. A moment for yourself.**

Reflecta is a production-grade, privacy-first personal sanctuary where individuals can pause, write, think aloud, explore ideas, and reflect on their experiences through meaningful multi-turn conversations with Gemini.

---

## 1. Project Overview & Architecture

Reflecta is built on a **defense-in-depth, zero-leakage security model**:

- **Client Layer**: React 18 + TypeScript + Tailwind CSS with responsive typography, dark luxury styling, interactive volume reader, and Web Audio API-synthesized ambient noise generators.
- **Server API Gateway**: Express (Node.js) server running on Cloud Run, proxying all Gemini 3.6 Flash calls server-side. Operational secrets (Gemini API keys) are **never exposed to the browser**.
- **Gemini Resilience Ladder**: Automated fallback ladder (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`) with error handling.
- **Authentication**: Firebase Authentication with Google Sign-In and token verification.
- **Data Isolation**: Cloud Firestore with owner-bound, path-isolated security rules (`/users/{userId}/...`).
- **Original Enhancement**: **The Inner Landscape Synthesizer** — a longitudinal synthesis engine analyzing recurring life pillars, emotional cadence vectors, personal grounding mantras, and seasonal contemplative inquiries.

---

## 2. Threat Summary & Security Verification

| Threat Zone | Threat | Impact | Countermeasure Implemented |
|---|---|---|---|
| **Input Surfaces** | Malformed payloads, XSS, oversized input | Denial of service, script injection | Strict server-side Zod validation on all API endpoints; safe markdown rendering without raw HTML passthrough. |
| **Planning & AI Reasoning** | Prompt injection, instruction bypass | Altered assistant behavior | System prompts isolated from user input; user text formatted as explicit untrusted context. |
| **Tool Execution** | Dynamic code execution, privilege escalation | Unauthorized operations | Absolute ban on `eval()`, `new Function()`, or dynamic runtime execution. |
| **Memory & State** | Cross-user data leakage, hijacked conversation IDs | Unauthorized data access | Strict Firestore path isolation (`users/{userId}/...`) and owner-only Security Rules (`request.auth.uid == userId`). |
| **Inter-System Comms** | API key leakage, token forgery | Credential compromise | Gemini API keys stored in Secret Manager; Firebase ID token verification server-side. |

---

## 3. Prerequisites

- [Node.js](https://nodejs.org/) v18+ and `npm`
- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk)
- [Firebase CLI (`firebase-tools`)](https://firebase.google.com/docs/cli)
- A Google Cloud Project with billing enabled

---

## 4. Google Cloud APIs Setup

Enable the required services in your GCP project:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 5. Google Cloud Secret Manager Configuration

Store your Gemini API Key securely in Secret Manager:

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

## 6. Cloud Firestore Security Rules

Deploy the path-isolated security rules to ensure zero cross-user leakage:

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
    }
  }
}
```

---

## 7. Firebase Authentication Setup

1. In the [Firebase Console](https://console.firebase.google.com/), enable **Google Sign-In** under **Authentication > Sign-in method**.
2. Add your authorized domains (e.g. `localhost`, and your Cloud Run deployment domain).
3. Populate client config in your environment.

---

## 8. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure local environment (`.env.local` - never commit secrets):
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

---

## 9. Cloud Run Deployment

Deploy directly to Google Cloud Run with secret binding:

```bash
# Build and deploy container to Cloud Run
gcloud run deploy reflecta \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --update-labels=dev-tutorial=cloud-run-ai-challenge
```

### Challenge Verification Label
Verify the required challenge label is attached to your Cloud Run service:

```bash
gcloud run services update reflecta \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 10. License & Privacy

Built with privacy-first standards. All reflections and conversations remain isolated to the user's private encrypted vault.
