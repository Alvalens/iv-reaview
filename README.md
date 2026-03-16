# iv-reaview — interview Live (Realtime Interview)

Real-time AI interview practice using Gemini Live API for bidirectional voice conversations. Built for the Gemini Live Agent Challenge.

## Features

- Real-time voice interview with AI interviewers (Gemini Live API)
- 3 predefined interviewer personas + AI-generated random personas
- Each persona has a distinct voice, tone, personality, and interview style
- PDF CV upload with automatic text extraction via Gemini
- Per-question multimodal scoring (content + delivery + non-verbal) during the interview
- Comprehensive results dashboard with narrative feedback
- Camera snapshots for non-verbal communication analysis
- Session reconnection on Gemini WebSocket expiry
- JWT authentication with user accounts
- Rate limiting (API, auth, WebSocket)

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm
- Google AI API key (Gemini)

### Setup

```bash
# Install dependencies
cd server && pnpm install && cd ..
cd client && pnpm install && cd ..

# Set up environment
cp server/.env.example server/.env
# Edit server/.env — add GEMINI_API_KEY and JWT_SECRET

# Initialize database
cd server
pnpm db:generate
pnpm db:push
cd ..
```

### Run

```bash
# Terminal 1 — Server (port 8080)
cd server && pnpm dev

# Terminal 2 — Client (port 5173)
cd client && pnpm dev
```

### Verify

- Client: http://localhost:5173
- Server health: http://localhost:8080/api/health
- Prisma Studio: `cd server && npx prisma studio`

## Architecture

- **Client**: React 19 + Vite + Tailwind CSS 4 + shadcn/ui
- **Server**: Express 5 + ws + Prisma 7 + SQLite
- **Auth**: JWT + bcrypt
- **AI**: Gemini Live API (real-time interview) + Gemini 2.5 Flash (scoring + CV extraction + persona generation)

The client/server split is required because Gemini Live API needs persistent WebSocket connections.

See `docs/architecture.md` for comprehensive architecture documentation with diagrams.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | No | Create user account |
| `POST` | `/api/auth/login` | No | Login, returns JWT |
| `GET` | `/api/auth/me` | Yes | Get current user |
| `POST` | `/api/sessions` | Yes | Create interview session |
| `GET` | `/api/sessions/:id` | Yes | Get session details |
| `POST` | `/api/sessions/:id/score` | Yes | Aggregate scores + generate narrative |
| `POST` | `/api/cv/extract` | Yes | Upload PDF CV and extract text |
| `WebSocket` | `/ws/interview/:sessionId` | — | Live interview audio/video stream |

## Environment Variables

```
GEMINI_API_KEY     # Google AI API key (required)
JWT_SECRET         # Secret for JWT signing (required)
DATABASE_URL       # SQLite path (default: file:./dev.db)
PORT               # Server port (default: 8080)
JWT_EXPIRES_IN     # Token expiry (default: 7d)
```

## Deployment

Uses a multi-stage Dockerfile. Deploy to Google Cloud Run:

```bash
gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/interview-live
gcloud run deploy interview-live \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/interview-live \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --timeout 900 \
  --session-affinity \
  --set-env-vars "GEMINI_API_KEY=xxx,JWT_SECRET=xxx"
```
