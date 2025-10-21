import { eq, and } from "drizzle-orm";
import { db } from "../db/database";
import {
  servers,
  channels,
  members,
  type Server,
  type Channel,
  type Member,
  type MemberRole,
  type ChannelType,
} from "../db/schema";
import { v4 as uuidv4 } from "uuid";

export class ServersService {
  /**
   * Create a new server with default general channel and admin member
   */
  async createServer(
    name: string,
    imageUrl: string,
    userId: string
  ): Promise<
    Server & {
      channels: Channel[];
      members: Member[];
    }
  > {
    if (!name || !userId) {
      throw new Error("Name and user ID are required");
    }

    const serverId = uuidv4();
    const channelId = uuidv4();
    const memberId = uuidv4();
    const inviteCode = uuidv4();

    // Insert server
    await db.insert(servers).values({
      id: serverId,
      name,
      imageUrl,
      inviteCode,
      userId,
    });

    // Insert default general channel
    await db.insert(channels).values({
      id: channelId,
      name: "general",
      type: "TEXT" as ChannelType,
      userId,
      serverId: serverId,
    });

    // Insert member as ADMIN
    await db.insert(members).values({
      id: memberId,
      role: "ADMIN" as MemberRole,
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

    if (!server) {
      throw new Error("Failed to create server");
    }

    return server;
  }

  /**
   * Delete a server (only owner can delete)
   */
  async deleteServer(serverId: string, userId: string): Promise<Server[]> {
    const server = await db
      .delete(servers)
      .where(and(eq(servers.id, serverId), eq(servers.userId, userId)))
      .returning();

    if (server.length === 0) {
      throw new Error("Server not found or unauthorized");
    }

    return server;
  }

  /**
   * Update a server (only owner can update)
   */
  async updateServer(
    serverId: string,
    updates: { name?: string; imageUrl?: string },
    userId: string
  ): Promise<Server> {
    const [server] = await db
      .update(servers)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(servers.id, serverId), eq(servers.userId, userId)))
      .returning();

    if (!server) {
      throw new Error("Server not found or unauthorized");
    }

    return server;
  }

  /**
   * Generate new invite code for a server (only owner can generate)
   */
  async generateInviteCode(serverId: string, userId: string): Promise<Server> {
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

  /**
   * Leave a server (cannot leave if you're the owner)
   */
  async leaveServer(serverId: string, userId: string): Promise<Server> {
    const server = await db.query.servers.findFirst({
      where: (servers, { eq, and, ne, exists }) =>
        and(
          eq(servers.id, serverId),
          ne(servers.userId, userId),
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

    await db
      .delete(members)
      .where(and(eq(members.serverId, serverId), eq(members.userId, userId)));

    return server;
  }

  /**
   * Get server by ID with full details
   */
  async getServerById(
    serverId: string,
    userId: string
  ): Promise<
    | (Server & {
        channels: Channel[];
        members: (Member & {
          user: {
            id: string;
            name: string | null;
            email: string;
            imageUrl: string | null;
          };
        })[];
      })
    | null
  > {
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, serverId),
      with: {
        channels: {
          orderBy: (channels, { asc }) => [asc(channels.createdAt)],
        },
        members: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
          orderBy: (members, { asc }) => [asc(members.role)],
        },
      },
    });

    if (!server) {
      return null;
    }

    // Verify user has access to this server
    const hasAccess = await db.query.members.findFirst({
      where: (members, { eq, and }) =>
        and(eq(members.serverId, serverId), eq(members.userId, userId)),
    });

    if (!hasAccess) {
      throw new Error("Access denied to this server");
    }

    return server;
  }

  /**
   * Get all servers for a user
   */
  async getUserServers(userId: string): Promise<
    (Server & {
      channels: Channel[];
      members: Member[];
    })[]
  > {
    const userServers = await db.query.servers.findMany({
      where: (servers, { exists }) =>
        exists(
          db
            .select()
            .from(members)
            .where(
              and(eq(members.serverId, servers.id), eq(members.userId, userId))
            )
        ),
      with: {
        channels: true,
        members: true,
      },
      orderBy: (servers, { asc }) => [asc(servers.createdAt)],
    });

    return userServers;
  }

  /**
   * Join a server using invite code
   */
  async joinServer(
    inviteCode: string,
    userId: string
  ): Promise<
    Server & {
      channels: Channel[];
      members: (Member & {
        user: {
          id: string;
          name: string | null;
          email: string;
          imageUrl: string | null;
        };
      })[];
    }
  > {
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.inviteCode, inviteCode),
    });

    if (!server) {
      throw new Error("Invalid invite code");
    }

    // Check if user is already a member
    const existingMember = await db.query.members.findFirst({
      where: (members, { eq, and }) =>
        and(eq(members.serverId, server.id), eq(members.userId, userId)),
    });

    if (existingMember) {
      throw new Error("Already a member of this server");
    }

    const memberId = uuidv4();

    // Add user as a member
    await db.insert(members).values({
      id: memberId,
      role: "GUEST" as MemberRole,
      userId,
      serverId: server.id,
    });

    // Get the updated server with details
    const updatedServer = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, server.id),
      with: {
        channels: {
          orderBy: (channels, { asc }) => [asc(channels.createdAt)],
        },
        members: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
          orderBy: (members, { asc }) => [asc(members.role)],
        },
      },
    });

    if (!updatedServer) {
      throw new Error("Failed to join server");
    }

    return updatedServer;
  }
}

export const serversService = new ServersService();
