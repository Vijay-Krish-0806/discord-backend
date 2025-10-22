// src/services/channel.service.ts
import { db } from "../db/database";
import { channels, ChannelType } from "../db/schema";
import { and, eq, ne } from "drizzle-orm";

import { v4 as uuidv4 } from "uuid";

interface CreateChannelParams {
  name: string;
  type: ChannelType;
  serverId: string;
  userId: string;
}

class ChannelService {
  async createChannel(params: CreateChannelParams) {
    const { name, type, serverId, userId } = params;

    // Check if user has permission (ADMIN or MODERATOR)
    const hasPermission = await db.query.members.findFirst({
      where: (members, { eq, and, inArray }) =>
        and(
          eq(members.serverId, serverId),
          eq(members.userId, userId),
          inArray(members.role, ["ADMIN", "MODERATOR"])
        ),
    });

    if (!hasPermission) {
      throw new Error("Insufficient permissions");
    }

    // Create the channel
    await db.insert(channels).values({
      id: uuidv4(),
      name,
      type,
      userId,
      serverId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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

    return server;
  }

  async deleteChannel(channelId: string, serverId: string, userId: string) {
    // Check if user has permission and channel exists
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
                  inArray(members.role, ["ADMIN", "MODERATOR"])
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

    return server;
  }

  async updateChannel(
    channelId: string,
    serverId: string,
    userId: string,
    data: { name: string; type: ChannelType }
  ) {
    // Check if user has permission (ADMIN or MODERATOR)
    const hasPermission = await db.query.members.findFirst({
      where: (members, { eq, and, inArray }) =>
        and(
          eq(members.serverId, serverId),
          eq(members.userId, userId),
          inArray(members.role, ["ADMIN", "MODERATOR"])
        ),
    });

    if (!hasPermission) {
      throw new Error("Insufficient permissions");
    }

    // Update the channel
    await db
      .update(channels)
      .set({
        name: data.name,
        type: data.type,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.serverId, serverId),
          ne(channels.name, "general") // Cannot update "general" channel
        )
      );

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

    return server;
  }
}

export const channelService = new ChannelService();
