import rateLimit from "express-rate-limit";
import { rateLimitConfig } from "../config/rate-limit.js";

/**
 * Per-IP rate limiter
 * Limits requests from each unique IP address
 * Uses default keyGenerator which properly handles IPv6
 */
export const perIPLimiter = rateLimit({
  windowMs: rateLimitConfig.perIP.windowMs,
  max: rateLimitConfig.perIP.maxRequests,
  message: { error: rateLimitConfig.perIP.message },
  standardHeaders: rateLimitConfig.perIP.standardHeaders,
  legacyHeaders: rateLimitConfig.perIP.legacyHeaders,
  // Uses default keyGenerator which properly handles IPv4/IPv6
});

/**
 * Global rate limiter
 * Limits total requests across all IPs
 */
export const globalLimiter = rateLimit({
  windowMs: rateLimitConfig.global.windowMs,
  max: rateLimitConfig.global.maxRequests,
  message: { error: rateLimitConfig.global.message },
  standardHeaders: rateLimitConfig.global.standardHeaders,
  legacyHeaders: rateLimitConfig.global.legacyHeaders,
  // Use a single key for global limit (not IP-based)
  keyGenerator: () => "global",
});

/**
 * Auth endpoints rate limiter (stricter)
 * Applied to login and register endpoints
 * Uses default keyGenerator which properly handles IPv6
 */
export const authLimiter = rateLimit({
  windowMs: rateLimitConfig.auth.windowMs,
  max: rateLimitConfig.auth.maxRequests,
  message: { error: rateLimitConfig.auth.message },
  standardHeaders: rateLimitConfig.auth.standardHeaders,
  legacyHeaders: rateLimitConfig.auth.legacyHeaders,
  // Uses default keyGenerator which properly handles IPv4/IPv6
});
