import { eq, and, lt, desc, exists } from "drizzle-orm";

import {
  messages,
  users,
  members,
  type Message,
  type Member,
  type User,
  type Channel,
} from "../db/schema";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/database";

const MESSAGES_BATCH = 10;

export class MessagesService {
  /**
   * Get messages for a channel with pagination
   */
  async getMessages(
    channelId: string,
    cursor: string | null,
    userId: string
  ): Promise<{
    items: (Message & {
      member: Member & {
        user: User;
      };
    })[];
    nextCursor: string | null;
  }> {
    // Verify user has access to this channel
    const channel = await db.query.channels.findFirst({
      where: (channels, { eq }) => eq(channels.id, channelId),
      with: {
        server: {
          with: {
            members: {
              where: (members, { eq }) => eq(members.userId, userId),
            },
          },
        },
      },
    });

    if (!channel || channel.server.members.length === 0) {
      throw new Error("Channel not found or access denied");
    }

    let messageList: (Message & {
      member: Member & {
        user: User;
      };
    })[] = [];

    if (cursor) {
      messageList = await db.query.messages.findMany({
        where: (messages, { eq, and, lt }) =>
          and(eq(messages.channelId, channelId), lt(messages.id, cursor)),
        limit: MESSAGES_BATCH,
        with: {
          member: {
            with: {
              user: true,
            },
          },
        },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      });
    } else {
      messageList = await db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.channelId, channelId),
        limit: MESSAGES_BATCH,
        with: {
          member: {
            with: {
              user: true,
            },
          },
        },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      });
    }

    let nextCursor = null;
    if (messageList.length === MESSAGES_BATCH) {
      nextCursor = messageList[MESSAGES_BATCH - 1].id;
    }

    return {
      items: messageList,
      nextCursor,
    };
  }

  /**
   * Create a new message
   */
  async createMessage(
    content: string,
    fileUrl: string | null,
    channelId: string,
    serverId: string,
    profileId: string
  ): Promise<
    Message & {
      member: Member & {
        user: User;
      };
      channel: Channel;
    }
  > {
    if (!content || !channelId || !serverId || !profileId) {
      throw new Error("Missing required fields: content, channelId, serverId");
    }

    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    const server = await db.query.servers.findFirst({
      where: (servers, { eq, exists }) =>
        and(
          eq(servers.id, serverId),
          exists(
            db
              .select()
              .from(members)
              .where(
                and(
                  eq(members.serverId, servers.id),
                  eq(members.userId, user.id)
                )
              )
          )
        ),
      with: {
        members: true,
      },
    });

    if (!server) {
      throw new Error("Server not found");
    }

    const channel = await db.query.channels.findFirst({
      where: (channels, { eq, and }) =>
        and(eq(channels.id, channelId), eq(channels.serverId, serverId)),
    });

    if (!channel) {
      throw new Error("Channel not found");
    }

    const member = server.members.find((member) => member.userId === profileId);

    if (!member) {
      throw new Error("Member not found");
    }

    const [message] = await db
      .insert(messages)
      .values({
        id: uuidv4(),
        content,
        fileUrl: fileUrl || null,
        channelId: channelId,
        memberId: member.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const result = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, message.id),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        channel: true,
      },
    });

    if (!result) {
      throw new Error("Failed to create message");
    }

    return result;
  }

  /**
   * Update a message
   */
  async updateMessage(
    messageId: string,
    content: string,
    profileId: string,
    channelId: string
  ): Promise<
    Message & {
      member: Member & {
        user: User;
      };
      channel: Channel;
    }
  > {
    if (!content || !profileId) {
      throw new Error("Missing required fields: content, profileId");
    }

    if (!messageId) {
      throw new Error("Message ID is required");
    }

    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    const existingMessage = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, messageId),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        channel: true,
      },
    });

    if (!existingMessage || existingMessage.deleted) {
      throw new Error("Message not found");
    }

    const isMessageOwner = existingMessage.member.userId === profileId;
    const isAdmin = existingMessage.member.role === "ADMIN";
    const isModerator = existingMessage.member.role === "MODERATOR";
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      throw new Error("Unauthorized: You can't edit messages");
    }

    const [updatedMessage] = await db
      .update(messages)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    const result = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, updatedMessage.id),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        channel: true,
      },
    });

    if (!result) {
      throw new Error("Failed to update message");
    }

    return result;
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(
    messageId: string,
    profileId: string,
    channelId: string
  ): Promise<Message> {
    if (!messageId || !profileId) {
      throw new Error("Missing required fields: messageId, profileId");
    }

    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    const existingMessage = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, messageId),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        channel: true,
      },
    });

    if (!existingMessage) {
      throw new Error("Message not found");
    }

    const isMessageOwner = existingMessage.member.userId === profileId;
    const isAdmin = existingMessage.member.role === "ADMIN";
    const isModerator = existingMessage.member.role === "MODERATOR";
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      throw new Error(
        "Unauthorized: You don't have permission to delete this message"
      );
    }

    const [deletedMessage] = await db
      .update(messages)
      .set({
        deleted: true,
        content: "This message was deleted",
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    return deletedMessage;
  }

  /**
   * Toggle reaction on a message
   */
  async toggleReaction(
    messageId: string,
    emoji: string,
    profileId: string,
    channelId: string
  ): Promise<
    Message & {
      member: Member & {
        user: User;
      };
      channel: Channel;
    }
  > {
    if (!emoji || !profileId) {
      throw new Error("Missing emoji or profileId");
    }

    if (!channelId) {
      throw new Error("Missing channelId");
    }

    const message = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, messageId),
    });

    if (!message) {
      throw new Error("Message not found");
    }

    let updatedReactions = message.reactions ?? [];

    const reactionKey = `${emoji}:${profileId}`;
    const hasReacted = updatedReactions.includes(reactionKey);

    if (hasReacted) {
      updatedReactions = updatedReactions.filter((r) => r !== reactionKey);
    } else {
      updatedReactions.push(reactionKey);
    }

    const [updatedMessage] = await db
      .update(messages)
      .set({
        reactions: updatedReactions,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    const result = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, updatedMessage.id),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        channel: true,
      },
    });

    if (!result) {
      throw new Error("Failed to update reaction");
    }

    return result;
  }

  /**
   * Get a single message by ID
   */
  async getMessageById(
    messageId: string,
    userId: string
  ): Promise<
    | (Message & {
        member: Member & {
          user: User;
        };
        channel: Channel;
      })
    | null
  > {
    const message = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, messageId),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        channel: {
          with: {
            server: {
              with: {
                members: {
                  where: (members, { eq }) => eq(members.userId, userId),
                },
              },
            },
          },
        },
      },
    });

    if (!message || message.channel.server.members.length === 0) {
      return null;
    }

    return message;
  }
}

export const messagesService = new MessagesService();
