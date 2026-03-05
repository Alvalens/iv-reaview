# iv-reaview — Setup Guide

## Prerequisites

| Requirement | Minimum | Check |
|-------------|---------|-------|
| Node.js | v20+ | `node --version` |
| pnpm | v10+ | `pnpm --version` |
| Gemini API key | — | [Get one](https://aistudio.google.com/apikey) |

## 1. Clone & Navigate

```bash
cd Z:/0-startup/internal-tools/iv-reaview
```

## 2. Install Dependencies

```bash
# Server
cd server && pnpm install && cd ..

# Client
cd client && pnpm install && cd ..
```

> **pnpm build warnings**: On first install, pnpm may warn about ignored build scripts. The `package.json` in each project already has `pnpm.onlyBuiltDependencies` configured to approve `@prisma/engines`, `prisma`, `esbuild`, and `better-sqlite3`.

## 3. Environment Variables

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
GEMINI_API_KEY="your_gemini_api_key_here"   # Required — get from Google AI Studio
DATABASE_URL="file:./dev.db"                 # SQLite file path (default works)
PORT=8080                                    # Server port (default works)
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google AI API key for Gemini models |
| `DATABASE_URL` | No | `file:./dev.db` | SQLite database file path |
| `PORT` | No | `8080` | Express server port |

## 4. Initialize Database

```bash
cd server

# Generate Prisma client (outputs to src/generated/prisma/)
pnpm db:generate

# Create SQLite database + tables
pnpm db:push

cd ..
```

This creates `server/dev.db` with two tables: `InterviewSession` and `InterviewQuestion`.

### Prisma 7 Notes

iv-reaview uses Prisma 7, which has key differences from earlier versions:

- **No `url` in `schema.prisma`**: The datasource URL is configured in `server/prisma.config.ts`, not in the schema file
- **Adapter required**: SQLite uses `@prisma/adapter-better-sqlite3` + `better-sqlite3`. The adapter is initialized in `server/src/db/prisma.ts`
- **Runtime utils**: `@prisma/client-runtime-utils` is a required peer dependency
- **Custom output**: Prisma client is generated to `server/src/generated/prisma/` (gitignored)

## 5. Start Development Servers

Run each in a separate terminal:

Terminal 1 — Server:
```bash
cd server && pnpm dev
```

Terminal 2 — Client:
```bash
cd client && pnpm dev
```

## 6. Verify Everything Works

| Check | Command / URL | Expected |
|-------|--------------|----------|
| Server running | Terminal output | `Server running on port 8080` |
| Health endpoint | `curl http://localhost:8080/api/health` | `{"status":"ok","timestamp":"..."}` |
| Client running | Terminal output | `VITE ready in Xms` |
| Client UI | http://localhost:5173 | Setup page with persona cards + header |
| API proxy | Client fetches from `/api/*` | Vite proxies to server on :8080 |
| WS proxy | Client connects to `/ws/*` | Vite proxies WebSocket to server |
| Prisma Studio | `cd server && npx prisma studio` | DB browser on :5555 |

## 7. Project Structure

```
iv-reaview/
├── client/                          # React 19 + Vite SPA
│   ├── src/
│   │   ├── main.tsx                 # Entry point
│   │   ├── App.tsx                  # Routes: /, /interview/:id, /results/:id
│   │   ├── styles/globals.css       # Tailwind v4 theme (dark navy)
│   │   ├── lib/                     # Utils, types, API client, persona configs
│   │   ├── components/ui/           # shadcn components
│   │   ├── components/layout/       # Header, Layout
│   │   └── pages/                   # SetupPage, InterviewPage, ResultsPage
│   ├── public/                      # AudioWorklet processors
│   ├── vite.config.ts               # Proxy config for /api + /ws
│   └── components.json              # shadcn config (new-york style)
│
├── server/                          # Express + WebSocket + Prisma
│   ├── src/
│   │   ├── index.ts                 # Server entry (Express + WS upgrade)
│   │   ├── config/env.ts            # Environment validation
│   │   ├── db/prisma.ts             # Prisma client (better-sqlite3 adapter)
│   │   ├── types/index.ts           # Shared TypeScript types
│   │   ├── services/                # Persona generator, prompt builder
│   │   ├── routes/                  # REST endpoints (sessions, cv, scoring)
│   │   └── websocket/proxy.ts       # WebSocket handler (placeholder)
│   ├── prisma/
│   │   └── schema.prisma            # InterviewSession + InterviewQuestion
│   └── prisma.config.ts             # Prisma 7 datasource config
│
├── CLAUDE.md                        # AI assistant instructions
└── README.md                        # Quick start
```

## 8. Available Commands

### Server (`cd server`)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with hot reload (`tsx watch`) |
| `pnpm build` | Generate Prisma client + compile TypeScript |
| `pnpm start` | Run compiled server (`node dist/index.js`) |
| `pnpm db:generate` | Generate Prisma client to `src/generated/prisma/` |
| `pnpm db:push` | Push schema changes to SQLite (no migration files) |

### Client (`cd client`)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server on :5173 with API/WS proxy |
| `pnpm build` | TypeScript check + production build |
| `pnpm preview` | Serve production build locally |

## 9. Dev Proxy Configuration

The Vite dev server proxies requests to the Express server:

| Client Request | Proxied To |
|----------------|-----------|
| `GET /api/health` | `http://localhost:8080/api/health` |
| `POST /api/sessions` | `http://localhost:8080/api/sessions` |
| `ws://localhost:5173/ws/interview/:id` | `ws://localhost:8080/ws/interview/:id` |

This is configured in `client/vite.config.ts`. In production, the Express server serves the built client files directly.

## Troubleshooting

### `Cannot find module '@prisma/client-runtime-utils'`
Run `cd server && pnpm add @prisma/client-runtime-utils` — this is a required peer dep for Prisma 7.

### `Ignored build scripts` warning
The `pnpm.onlyBuiltDependencies` field in `package.json` should already approve the necessary packages. If you still see warnings, run `pnpm approve-builds` and select the blocked packages.

### `PrismaClientInitializationError`
Ensure you've run `pnpm db:generate` after installing dependencies. The Prisma client must be generated before the server can start.

### Port already in use
Change `PORT` in `server/.env` or kill the existing process:
```bash
# Find and kill process on port 8080
lsof -i :8080  # or: netstat -ano | grep 8080 (Windows)
```

### SQLite database locked
The server uses WAL mode for better concurrency. If the database is locked, close any Prisma Studio instances and restart the server.
