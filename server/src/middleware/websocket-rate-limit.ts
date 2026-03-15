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
   * Only trusts x-forwarded-for if the connection comes from a trusted proxy
   */
  private getClientIP(req: IncomingMessage): string {
    const remoteAddress = req.socket.remoteAddress;

    // Only trust x-forwarded-for if the connection appears to come from a trusted proxy
    if (this.isTrustedProxy(remoteAddress)) {
      const forwardedFor = req.headers["x-forwarded-for"];
      if (forwardedFor) {
        const firstHeaderValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
        const clientIp = firstHeaderValue.split(",")[0]?.trim();
        if (clientIp) {
          return clientIp;
        }
      }
    }

    return remoteAddress || "unknown";
  }

  /**
   * Determine whether the immediate peer should be treated as a trusted proxy.
   * This implementation trusts loopback and private network ranges.
   */
  private isTrustedProxy(ip: string | undefined): boolean {
    if (!ip) {
      return false;
    }

    // Handle IPv6 addresses that may include a zone, and IPv4-mapped IPv6 addresses
    let normalizedIp = ip;

    // Strip IPv6 zone index (e.g., "%eth0")
    const zoneIndex = normalizedIp.indexOf("%");
    if (zoneIndex !== -1) {
      normalizedIp = normalizedIp.substring(0, zoneIndex);
    }

    // Extract IPv4 part from IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1)
    const ipv4Match = normalizedIp.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (ipv4Match) {
      normalizedIp = ipv4Match[1];
    }

    // Loopback (IPv4 and IPv6)
    if (normalizedIp === "127.0.0.1" || normalizedIp === "::1") {
      return true;
    }

    // Private IPv4 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalizedIp)) {
      return true;
    }
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalizedIp)) {
      return true;
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(normalizedIp)) {
      return true;
    }

    return false;
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
