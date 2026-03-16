import { Router, type Request, type Response, type Router as RouterType } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rate-limit.js";

export const authRouter: RouterType = Router();

// Types
interface RegisterBody {
  username: string;
  password: string;
}

interface LoginBody {
  username: string;
  password: string;
}

interface JwtPayload {
  userId: string;
  username: string;
}

// POST /api/auth/register — Register a new user (with rate limiting)
authRouter.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body as RegisterBody;

    if (!body.username || !body.password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    if (body.username.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }

    if (body.password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: body.username },
    });

    if (existingUser) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: body.username,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username } as JwtPayload,
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );

    res.status(201).json({
      message: "User registered successfully",
      user,
      token,
    });
  } catch (error) {
    console.error("[Auth] Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login — Login user (with rate limiting)
authRouter.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body as LoginBody;

    if (!body.username || !body.password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: body.username },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(body.password, user.password);

    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username } as JwtPayload,
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
      },
      token,
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me — Get current user (protected)
authRouter.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Get user from database using authenticated user id from middleware
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error("[Auth] Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
