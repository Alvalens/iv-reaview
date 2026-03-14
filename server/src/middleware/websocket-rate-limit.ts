import type { IncomingMessage } from "http";
import { rateLimitConfig } from "../config/rate-limit.js";

/**
 * In-memory store for WebSocket connection rate limiting
 */
class WebSocketRateLimiter {
  private connections: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly windowMs: number;
  private readonly maxConnections: number;

  constructor() {
    this.windowMs = rateLimitConfig.websocket.windowMs;
    this.maxConnections = rateLimitConfig.websocket.maxConnections;
  }

  /**
   * Check if a new WebSocket connection is allowed
   * @param req The incoming HTTP request
   * @returns true if allowed, false if rate limited
   */
  isAllowed(req: IncomingMessage): boolean {
    const ip = this.getClientIP(req);
    const now = Date.now();

    // Get or create connection record
    let record = this.connections.get(ip);

    if (!record || now > record.resetTime) {
      // Start new window
      record = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.connections.set(ip, record);
      return true;
    }

    // Check if under limit
    if (record.count < this.maxConnections) {
      record.count++;
      this.connections.set(ip, record);
      return true;
    }

    // Rate limited
    return false;
  }

  /**
   * Get client IP from request
   */
  private getClientIP(req: IncomingMessage): string {
    const forwardedFor = req.headers["x-forwarded-for"];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    }
    return req.socket.remoteAddress || "unknown";
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.connections.entries()) {
      if (now > record.resetTime) {
        this.connections.delete(ip);
      }
    }
  }
}

// Export singleton instance
export const wsRateLimiter = new WebSocketRateLimiter();

// Run cleanup every 5 minutes
setInterval(() => {
  wsRateLimiter.cleanup();
}, 5 * 60 * 1000);
