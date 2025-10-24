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
    // console.log("🔍 [Auth Middleware] Request:", {
    //   method: req.method,
    //   url: req.url,
    //   origin: req.headers.origin,
    //   referer: req.headers.referer,
    // });

    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
      console.log("🔑 Using Bearer token:", token);
    } else if (req.cookies?.["better-auth.session_token"]) {
      const betterAuthCookie = req.cookies["better-auth.session_token"];
      token = betterAuthCookie.split(".")[0];
    }

    if (!token) {
      console.log("❌ No token found");
      return res
        .status(401)
        .json({ error: "Unauthorized - No token provided" });
    }

    // Verify token and get session using the extracted token as session ID
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, token),
      with: {
        user: true,
      },
    });

    if (!session) {
      console.log("❌ Session not found for token:", token);
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    if (session.expiresAt < new Date()) {
      console.log("❌ Session expired:", session.expiresAt);
      return res.status(401).json({ error: "Unauthorized - Token expired" });
    }

    // Attach user to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
    };

    next();
  } catch (error) {
    console.error("❌ [Auth Middleware Error]", error);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
