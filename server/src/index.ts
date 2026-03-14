import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { env } from "./config/env.js";
import { sessionsRouter } from "./routes/sessions.js";
import { cvRouter } from "./routes/cv.js";
import { scoringRouter } from "./routes/scoring.js";
import { authRouter } from "./routes/auth.js";
import { handleWebSocketConnection } from "./websocket/proxy.js";
import { globalLimiter, authLimiter } from "./middleware/rate-limit.js";
import { wsRateLimiter } from "./middleware/websocket-rate-limit.js";

const app = express();
const server = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Global rate limiter (applied to all API routes)
app.use("/api", globalLimiter);

// REST API routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes with stricter rate limiting
app.use("/api/auth", authLimiter, authRouter);

app.use("/api/sessions", sessionsRouter);
app.use("/api/sessions", scoringRouter);
app.use("/api/cv", cvRouter);

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
