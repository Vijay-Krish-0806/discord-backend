// src/services/servers.service.ts
import { db } from "../db/database";
import { servers, channels, members } from "../db/schema";
import { eq, and, ne } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

interface CreateServerParams {
  name: string;
  imageUrl?: string;
  userId: string;
}

interface UpdateServerParams {
  serverId: string;
  name: string;
  imageUrl?: string;
  userId: string;
}

class ServersService {
  async createServer(params: CreateServerParams) {
    const { name, imageUrl, userId } = params;

    const serverId = uuidv4();
    const channelId = uuidv4();
    const memberId = uuidv4();
    const inviteCode = uuidv4();

    // Insert server
    await db.insert(servers).values({
      id: serverId,
      name,
      imageUrl: imageUrl || "",
      inviteCode,
      userId,
    });

    // Insert default "general" channel
    await db.insert(channels).values({
      id: channelId,
      name: "general",
      type: "TEXT",
      userId,
      serverId: serverId,
    });

    // Insert member with ADMIN role
    await db.insert(members).values({
      id: memberId,
      role: "ADMIN",
      userId,
      serverId: serverId,
    });

    // Query the complete server
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, serverId),
      with: {
        channels: true,
        members: true,
      },
    });

    return server;
  }

  async deleteServer(serverId: string, userId: string) {
    // Delete only if user is the owner
    const server = await db
      .delete(servers)
      .where(and(eq(servers.id, serverId), eq(servers.userId, userId)))
      .returning();

    if (!server || server.length === 0) {
      throw new Error("Server not found or unauthorized");
    }

    return server;
  }

  async updateServer(params: UpdateServerParams) {
    const { serverId, name, imageUrl, userId } = params;

    // Update only if user is the owner
    const [server] = await db
      .update(servers)
      .set({
        name,
        imageUrl,
        updatedAt: new Date(),
      })
      .where(and(eq(servers.id, serverId), eq(servers.userId, userId)))
      .returning();

    if (!server) {
      throw new Error("Server not found or unauthorized");
    }

    return server;
  }

  async regenerateInviteCode(serverId: string, userId: string) {
    // Regenerate invite code only if user is the owner
    const [server] = await db
      .update(servers)
      .set({
        inviteCode: uuidv4(),
        updatedAt: new Date(),
      })
      .where(and(eq(servers.id, serverId), eq(servers.userId, userId)))
      .returning();

    if (!server) {
      throw new Error("Server not found or unauthorized");
    }

    return server;
  }

  async leaveServer(serverId: string, userId: string) {
    // Check if server exists and user is NOT the owner
    const server = await db.query.servers.findFirst({
      where: (servers, { eq, and, ne, exists }) =>
        and(
          eq(servers.id, serverId),
          ne(servers.userId, userId), // User is NOT the owner
          exists(
            db
              .select()
              .from(members)
              .where(
                and(
                  eq(members.serverId, servers.id),
                  eq(members.userId, userId)
                )
              )
          )
        ),
    });

    if (!server) {
      throw new Error("Server not found or you are the owner");
    }

    // Delete the member record
    await db
      .delete(members)
      .where(and(eq(members.serverId, serverId), eq(members.userId, userId)));

    return server;
  }
}

export const serversService = new ServersService();
