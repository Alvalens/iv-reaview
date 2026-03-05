# iv-reaview — Intervyou Live (Realtime Interview)

Real-time AI interview practice using Gemini Live API for bidirectional voice conversations.

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm

### Setup

```bash
# Install dependencies
cd server && pnpm install && cd ..
cd client && pnpm install && cd ..

# Set up environment
cp server/.env.example server/.env
# Edit server/.env and add your GEMINI_API_KEY

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
- **AI**: Gemini Live API (real-time interview) + Gemini Pro (post-session scoring)

The client/server split is required because Gemini Live API needs persistent WebSocket connections.

See `docs/setup.md` for detailed setup instructions and troubleshooting.
