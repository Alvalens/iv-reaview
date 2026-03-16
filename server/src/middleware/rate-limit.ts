import rateLimit from "express-rate-limit";
import { rateLimitConfig } from "../config/rate-limit.js";

/**
 * AI API rate limiter
 * Limits requests to endpoints that call Gemini AI APIs
 * Applied to: /api/cv/extract, /api/sessions/:id/score
 * Uses default per-IP keying to prevent one user from affecting others
 */
export const aiApiLimiter = rateLimit({
  windowMs: rateLimitConfig.global.windowMs,
  max: rateLimitConfig.global.maxRequests,
  message: { error: rateLimitConfig.global.message },
  standardHeaders: rateLimitConfig.global.standardHeaders,
  legacyHeaders: rateLimitConfig.global.legacyHeaders,
  // Uses default keyGenerator (per IP) - no override needed
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
