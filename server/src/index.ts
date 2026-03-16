import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { env } from "./config/env.js";
import { sessionsRouter } from "./routes/sessions.js";
import { cvRouter } from "./routes/cv.js";
import { scoringRouter } from "./routes/scoring.js";
import { authRouter } from "./routes/auth.js";
import { handleWebSocketConnection } from "./websocket/proxy.js";
import { wsRateLimiter } from "./middleware/websocket-rate-limit.js";
import { getGeneratedAvatarsDir } from "./services/persona-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// REST API routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (rate limiting applied per-route in auth.ts for /login and /register only)
app.use("/api/auth", authRouter);

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions", scoringRouter);
app.use("/api/cv", cvRouter);

// Serve runtime-generated avatar images (writable on Cloud Run)
app.use("/generated-avatars", express.static(getGeneratedAvatarsDir()));

// Serve client static files in production
// In the Docker image, client build output is copied to ../public relative to dist/
const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));
// SPA fallback — serve index.html for all non-API, non-WS, non-generated routes
app.get(/^\/(?!api|ws|generated-avatars).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "", `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/ws\/interview\/(.+)$/);

  if (!match) {
    socket.destroy();
    return;
  }

  // Check WebSocket rate limit
  if (!wsRateLimiter.isAllowed(request)) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
    socket.destroy();
    return;
  }

  const sessionId = match[1];

  wss.handleUpgrade(request, socket, head, (ws) => {
    handleWebSocketConnection(ws, sessionId);
  });
});

// Start server
server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
  console.log(`  REST API: http://localhost:${env.PORT}/api`);
  console.log(`  WebSocket: ws://localhost:${env.PORT}/ws/interview/:sessionId`);
});
