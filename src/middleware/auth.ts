// import { Socket } from "socket.io";
// import { eq, and, gt } from "drizzle-orm";
// import { parse as parseCookie } from "cookie";
// import { db } from "../db/db";
// import { sessions, users } from "../db/schema";

// export const authenticateSocket = async (socket: Socket, next: Function) => {
//   try {
//     // Parse cookies from handshake
//     const cookieHeader = socket.handshake.headers.cookie || "";
//     console.log("📦 Cookies received:", cookieHeader);

//     const cookies = parseCookie(cookieHeader);
//     console.log("🔍 Parsed cookies:", Object.keys(cookies));

//     // Better Auth stores session token in this cookie
//     let sessionToken = cookies["better-auth.session_token"];

//     if (!sessionToken) {
//       console.warn("❌ No session token provided");
//       socket.emit("authError", {
//         message: "Authentication required",
//         code: "NO_SESSION_TOKEN",
//       });
//       return next(new Error("Authentication required"));
//     }
//     sessionToken = sessionToken.split(".")[0];

//     console.log("✅ Session token found, verifying...");

//     // Verify session in database
//     const [result] = await db
//       .select({
//         user: users,
//         session: sessions,
//       })
//       .from(sessions)
//       .innerJoin(users, eq(sessions.userId, users.id))
//       .where(
//         and(
//           eq(sessions.token, sessionToken),
//           gt(sessions.expiresAt, new Date())
//         )
//       );

//     if (!result) {
//       console.warn("❌ Invalid or expired session");
//       socket.emit("authError", {
//         message: "Invalid or expired session",
//         code: "INVALID_SESSION",
//       });
//       return next(new Error("Invalid or expired session"));
//     }

//     const { user: authenticatedUser, session: userSession } = result;

//     // ✅ IMPORTANT: Attach user data to socket.data (this is what makes it accessible later)
//     socket.data.userId = authenticatedUser.id;
//     socket.data.username = authenticatedUser.name;
//     socket.data.email = authenticatedUser.email;
//     socket.data.sessionId = userSession.id;

//     console.log("✅ User authenticated:", {
//       userId: authenticatedUser.id,
//       username: authenticatedUser.name,
//       email: authenticatedUser.email,
//     });

//     next();
//   } catch (error) {
//     console.error("❌ Authentication error:", error);
//     socket.emit("authError", {
//       message: "Authentication failed",
//       code: "AUTH_ERROR",
//       error: error instanceof Error ? error.message : "Unknown error",
//     });
//     next(new Error("Authentication failed"));
//   }
// };

import { Socket } from "socket.io";
import { db } from "../db/database";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export async function authenticateSocket(socket: Socket, next: any) {
  try {
    // Get userId from auth header or query
    const userId =
      socket.handshake.auth?.userId || socket.handshake.query?.userId;

    if (!userId) {
      console.log("⚠️  Socket connection attempt without userId");
      return next(new Error("Unauthorized: No userId provided"));
    }

    // Verify user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId as string));

    if (!user) {
      return next(new Error("Unauthorized: User not found"));
    }

    socket.data.userId = user.id;
    socket.data.username = user.name;
    console.log(`✅ Socket authenticated for user: ${userId}`);
    next();
  } catch (error) {
    console.error("❌ Socket authentication error:", error);
    next(new Error("Unauthorized: Authentication failed"));
  }
}


import { Server } from "socket.io";
import { NextFunction, Request, Response } from "express";

export const attachUserFromSocket = (io: Server) => {
  return (req:Request, res:Response, next:NextFunction) => {

    const io = req.app.get("io");
    console.log(io)
    if (io?.data?.userId) {
      (req as any).user = { id: io.data.userId };
    }

    next();
  };
};
