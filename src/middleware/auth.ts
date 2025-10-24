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
