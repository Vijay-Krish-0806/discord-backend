// src/services/messages.service.ts
import { db } from "../db/database";
import { messages, users, members, Message } from "../db/schema";
import { eq, and, lt } from "drizzle-orm";

const MESSAGES_BATCH = 10;

interface CreateMessageParams {
  content: string;
  fileUrl?: string;
  channelId: string;
  serverId: string;
  profileId: string;
}

interface UpdateMessageParams {
  messageId: string;
  content: string;
  profileId: string;
}

interface DeleteMessageParams {
  messageId: string;
  profileId: string;
}

interface ToggleReactionParams {
  messageId: string;
  emoji: string;
  profileId: string;
}

class MessagesService {
  async getMessages(channelId: string, cursor?: string) {
    let messagesList: Message[] = [];

    if (cursor) {
      messagesList = await db.query.messages.findMany({
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
      messagesList = await db.query.messages.findMany({
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
    if (messagesList.length === MESSAGES_BATCH) {
      nextCursor = messagesList[MESSAGES_BATCH - 1].id;
    }

    return { items: messagesList, nextCursor };
  }

  async createMessage(params: CreateMessageParams) {
    const { content, fileUrl, channelId, serverId, profileId } = params;

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    // Verify server exists and user is a member
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

    // Verify channel exists
    const channel = await db.query.channels.findFirst({
      where: (channels, { eq, and }) =>
        and(eq(channels.id, channelId), eq(channels.serverId, serverId)),
    });

    if (!channel) {
      throw new Error("Channel not found");
    }

    // Find the member
    const member = server.members.find((m) => m.userId === profileId);

    if (!member) {
      throw new Error("Member not found");
    }

    // Create the message
    const [message] = await db
      .insert(messages)
      .values({
        content,
        fileUrl,
        channelId,
        memberId: member.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Get the complete message with relations
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

    return result;
  }

  async updateMessage(params: UpdateMessageParams) {
    const { messageId, content, profileId } = params;

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    // Get the existing message
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

    // Check permissions
    const isMessageOwner = existingMessage.member.userId === profileId;
    const isAdmin = existingMessage.member.role === "ADMIN";
    const isModerator = existingMessage.member.role === "MODERATOR";
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      throw new Error("Unauthorized: You can't edit messages");
    }

    // Update the message
    const [updatedMessage] = await db
      .update(messages)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    // Get the complete updated message
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

    return result;
  }

  async deleteMessage(params: DeleteMessageParams) {
    const { messageId, profileId } = params;

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    // Get the existing message
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

    // Check permissions
    const isMessageOwner = existingMessage.member.userId === profileId;
    const isAdmin = existingMessage.member.role === "ADMIN";
    const isModerator = existingMessage.member.role === "MODERATOR";
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      throw new Error(
        "Unauthorized: You don't have permission to delete this message"
      );
    }

    // Soft delete the message
    await db
      .update(messages)
      .set({
        deleted: true,
        content: "This message was deleted",
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));
  }

  async toggleReaction(params: ToggleReactionParams) {
    const { messageId, emoji, profileId } = params;

    // Get the message
    const message = await db.query.messages.findFirst({
      where: (messages, { eq }) => eq(messages.id, messageId),
    });

    if (!message) {
      throw new Error("Message not found");
    }

    // Toggle the reaction
    let updatedReactions = message.reactions ?? [];
    const reactionKey = `${emoji}:${profileId}`;
    const hasReacted = updatedReactions.includes(reactionKey);

    if (hasReacted) {
      updatedReactions = updatedReactions.filter((r) => r !== reactionKey);
    } else {
      updatedReactions.push(reactionKey);
    }

    // Update reactions
    const [updatedMessage] = await db
      .update(messages)
      .set({
        reactions: updatedReactions,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    // Get the complete updated message
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

    return result;
  }
}

export const messagesService = new MessagesService();
