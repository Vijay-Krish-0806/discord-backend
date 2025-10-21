// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { db } from "../db/database";
import { eq } from "drizzle-orm";
import { sessions } from "../db/schema";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header or cookies
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : req.cookies?.token;

    if (!token) {
      return res
        .status(401)
        .json({ error: "Unauthorized - No token provided" });
    }

    // Verify token and get session
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, token),
      with: {
        user: true,
      },
    });

    if (!session) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Unauthorized - Token expired" });
    }

    // Attach user to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
    };

    next();
  } catch (error) {
    console.error("[Auth Middleware]", error);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
