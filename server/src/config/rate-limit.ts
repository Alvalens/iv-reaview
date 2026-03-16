/**
 * Rate Limit Configuration
 *
 * All rate limit thresholds are defined here for easy modification.
 * Values can be overridden via environment variables.
 */

export const rateLimitConfig = {
  /**
   * Global rate limit configuration
   * Applied to all requests combined across all IPs
   */
  global: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: parseInt(process.env.RATE_LIMIT_GLOBAL || "1000", 10),
    message: "Server is receiving too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  /**
   * Auth endpoints rate limit (stricter)
   * Applied to login and register endpoints
   */
  auth: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTH || "10", 10),
    message: "Too many authentication attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  /**
   * WebSocket connection rate limit
   * Applied to WebSocket connection attempts
   */
  websocket: {
    windowMs: 60 * 1000, // 1 minute window
    maxConnections: parseInt(process.env.RATE_LIMIT_WS || "5", 10),
    message: "Too many WebSocket connections, please try again later.",
  },
} as const;

// Export individual configs for specific use cases
export const globalRateLimit = rateLimitConfig.global;
export const authRateLimit = rateLimitConfig.auth;
export const wsRateLimit = rateLimitConfig.websocket;
