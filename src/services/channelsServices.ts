import { eq, and, inArray, asc, ne } from "drizzle-orm";

import {
  channels,
  members,
  servers,
  type MemberRole,
  type ChannelType,
  type Server,
  type Member,
  type Channel,
  type User,
} from "../db/schema";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/database";

export class ChannelsService {
  /**
   * Create a new channel and return the updated server with channels and members
   */
  async createChannel(
    name: string,
    type: ChannelType,
    serverId: string,
    userId: string
  ): Promise<
    Server & {
      channels: Channel[];
      members: (Member & { user: User })[];
    }
  > {
    // Check permissions using your exact schema types
    const hasPermission = await db.query.members.findFirst({
      where: (members, { eq, and, inArray }) =>
        and(
          eq(members.serverId, serverId),
          eq(members.userId, userId),
          inArray(members.role, ["ADMIN", "MODERATOR"] as MemberRole[])
        ),
    });

    if (!hasPermission) {
      throw new Error("Insufficient permissions");
    }

    if (name === "general") {
      throw new Error("Name cannot be 'general'");
    }

    // Create the channel using your schema types
    const [channel] = await db
      .insert(channels)
      .values({
        id: uuidv4(),
        name,
        type,
        userId: userId,
        serverId: serverId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Get updated server with channels and members using your relations
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, serverId),
      with: {
        channels: {
          orderBy: (channels, { asc }) => [asc(channels.createdAt)],
        },
        members: {
          with: {
            user: true,
          },
          orderBy: (members, { asc }) => [asc(members.role)],
        },
      },
    });

    if (!server) {
      throw new Error("Server not found");
    }

    return server;
  }

  /**
   * Get channel by ID with server and member info
   */
  async getChannelById(
    channelId: string
  ): Promise<(Channel & { server: Server }) | null> {
    const channel = await db.query.channels.findFirst({
      where: (channels, { eq }) => eq(channels.id, channelId),
      with: {
        server: true,
      },
    });

    return channel || null;
  }

  /**
   * Get all channels for a server
   */
  async getChannelsByServerId(serverId: string): Promise<Channel[]> {
    const serverChannels = await db.query.channels.findMany({
      where: (channels, { eq }) => eq(channels.serverId, serverId),
      orderBy: (channels, { asc }) => [asc(channels.createdAt)],
    });

    return serverChannels;
  }

  /**
   * delete channel and return updated server
   */

  async deleteChannel(
    channelId: string,
    serverId: string,
    userId: string
  ): Promise<
    Server & {
      channels: Channel[];
      members: (Member & { user: User })[];
    }
  > {
    // Check if channel can be deleted and user has permission
    const canDelete = await db.query.channels.findFirst({
      where: (channels, { eq, and, ne }) =>
        and(
          eq(channels.id, channelId),
          eq(channels.serverId, serverId),
          ne(channels.name, "general")
        ),
      with: {
        server: {
          with: {
            members: {
              where: (members, { eq, and, inArray }) =>
                and(
                  eq(members.userId, userId),
                  inArray(members.role, ["ADMIN", "MODERATOR"] as MemberRole[])
                ),
            },
          },
        },
      },
    });

    if (!canDelete || canDelete.server.members.length === 0) {
      throw new Error("Channel not found or insufficient permissions");
    }

    // Delete the channel
    await db
      .delete(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.serverId, serverId),
          ne(channels.name, "general")
        )
      );

    // Get the updated server
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, serverId),
      with: {
        channels: {
          orderBy: (channels, { asc }) => [asc(channels.createdAt)],
        },
        members: {
          with: {
            user: true,
          },
          orderBy: (members, { asc }) => [asc(members.role)],
        },
      },
    });

    if (!server) {
      throw new Error("Server not found after deletion");
    }

    return server;
  }

  /**
   * Update channel and return updated server
   */
  async updateChannel(
    channelId: string,
    serverId: string,
    userId: string,
    updates: { name: string; type: ChannelType }
  ): Promise<
    Server & {
      channels: Channel[];
      members: (Member & { user: User })[];
    }
  > {
    const { name, type } = updates;

    if (name === "general") {
      throw new Error("Name cannot be general");
    }

    // First, check if user has permission (ADMIN or MODERATOR)
    const hasPermission = await db.query.members.findFirst({
      where: (members, { eq, and, inArray }) =>
        and(
          eq(members.serverId, serverId),
          eq(members.userId, userId),
          inArray(members.role, ["ADMIN", "MODERATOR"] as MemberRole[])
        ),
    });

    if (!hasPermission) {
      throw new Error("Insufficient permissions");
    }

    // Update the channel
    const updateResult = await db
      .update(channels)
      .set({
        name,
        type,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.serverId, serverId),
          ne(channels.name, "general") // Cannot update "general" channel
        )
      )
      .returning();

    if (updateResult.length === 0) {
      throw new Error("Channel not found or cannot update general channel");
    }

    // Get the updated server with channels and members
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, serverId),
      with: {
        channels: {
          orderBy: (channels, { asc }) => [asc(channels.createdAt)],
        },
        members: {
          with: {
            user: true,
          },
          orderBy: (members, { asc }) => [asc(members.role)],
        },
      },
    });

    if (!server) {
      throw new Error("Server not found after update");
    }

    return server;
  }
}

export const channelsService = new ChannelsService();
