// src/services/directMessages.service.ts
import { db } from "../db/database";
import { directMessages, users, DirectMessage } from "../db/schema";
import { eq, and, lt } from "drizzle-orm";

const MESSAGES_BATCH = 10;

interface CreateDirectMessageParams {
  content: string;
  fileUrl?: string;
  conversationId: string;
  profileId: string;
}

interface UpdateDirectMessageParams {
  directMessageId: string;
  content: string;
  profileId: string;
  conversationId: string;
}

interface DeleteDirectMessageParams {
  directMessageId: string;
  profileId: string;
  conversationId: string;
}

interface ToggleReactionParams {
  directMessageId: string;
  emoji: string;
  profileId: string;
  conversationId: string;
}

class DirectMessagesService {
  async getDirectMessages(conversationId: string, cursor?: string) {
    let messages: DirectMessage[] = [];

    if (cursor) {
      messages = await db.query.directMessages.findMany({
        where: (messages, { eq, and, lt }) =>
          and(
            eq(messages.conversationId, conversationId),
            lt(messages.id, cursor)
          ),
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
      messages = await db.query.directMessages.findMany({
        where: (messages, { eq }) =>
          eq(messages.conversationId, conversationId),
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
    if (messages.length === MESSAGES_BATCH) {
      nextCursor = messages[MESSAGES_BATCH - 1].id;
    }

    return { items: messages, nextCursor };
  }

  async createDirectMessage(params: CreateDirectMessageParams) {
    const { content, fileUrl, conversationId, profileId } = params;

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    // Get conversation and verify user is part of it
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, conversationId),
      with: {
        memberOne: {
          with: {
            user: true,
          },
        },
        memberTwo: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Determine which member is sending the message
    const member =
      conversation.memberOne.userId === profileId
        ? conversation.memberOne
        : conversation.memberTwo;

    if (!member) {
      throw new Error("Member not found");
    }

    // Create the message
    const [message] = await db
      .insert(directMessages)
      .values({
        content,
        fileUrl,
        conversationId,
        memberId: member.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Get the complete message with relations
    const result = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, message.id),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        conversation: true,
      },
    });

    return result;
  }

  async updateDirectMessage(params: UpdateDirectMessageParams) {
    const { directMessageId, content, profileId, conversationId } = params;

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    // Get the conversation to verify user is part of it
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, conversationId),
      with: {
        memberOne: { with: { user: true } },
        memberTwo: { with: { user: true } },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isUserInConversation =
      conversation.memberOne.userId === profileId ||
      conversation.memberTwo.userId === profileId;

    if (!isUserInConversation) {
      throw new Error("Not authorized for this conversation");
    }

    // Get the existing message
    const existingMessage = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, directMessageId),
      with: {
        member: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!existingMessage || existingMessage.deleted) {
      throw new Error("Message not found");
    }

    // Check if user owns the message
    const isMessageOwner = existingMessage.member.userId === profileId;

    if (!isMessageOwner) {
      throw new Error("Unauthorized: You can only edit your own messages");
    }

    // Update the message
    const [updatedMessage] = await db
      .update(directMessages)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(directMessages.id, directMessageId))
      .returning();

    // Get the complete updated message
    const result = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, updatedMessage.id),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        conversation: true,
      },
    });

    return result;
  }

  async deleteDirectMessage(params: DeleteDirectMessageParams) {
    const { directMessageId, profileId, conversationId } = params;

    // Verify user exists
    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

    // Get the conversation to verify user is part of it
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, conversationId),
      with: {
        memberOne: { with: { user: true } },
        memberTwo: { with: { user: true } },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isUserInConversation =
      conversation.memberOne.userId === profileId ||
      conversation.memberTwo.userId === profileId;

    if (!isUserInConversation) {
      throw new Error("Not authorized for this conversation");
    }

    // Get the existing message
    const existingMessage = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, directMessageId),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        conversation: true,
      },
    });

    if (!existingMessage) {
      throw new Error("Message not found");
    }

    // Check if user owns the message
    const isMessageOwner = existingMessage.member.userId === profileId;

    if (!isMessageOwner) {
      throw new Error("Unauthorized: You can only delete your own messages");
    }

    // Soft delete the message
    await db
      .update(directMessages)
      .set({
        deleted: true,
        content: "This message was deleted",
        updatedAt: new Date(),
      })
      .where(eq(directMessages.id, directMessageId));
  }

  async toggleDirectMessageReaction(params: ToggleReactionParams) {
    const { directMessageId, emoji, profileId, conversationId } = params;

    // Get the conversation to verify user is part of it
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq }) => eq(conversations.id, conversationId),
      with: {
        memberOne: { with: { user: true } },
        memberTwo: { with: { user: true } },
      },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isUserInConversation =
      conversation.memberOne.userId === profileId ||
      conversation.memberTwo.userId === profileId;

    if (!isUserInConversation) {
      throw new Error("Not authorized for this conversation");
    }

    // Get the message
    const message = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, directMessageId),
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

    // Update reactions without changing updatedAt
    const [updatedMessage] = await db
      .update(directMessages)
      .set({
        reactions: updatedReactions,
      })
      .where(eq(directMessages.id, directMessageId))
      .returning();

    // Get the complete updated message
    const result = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, updatedMessage.id),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        conversation: true,
      },
    });

    return result;
  }
}

export const directMessagesService = new DirectMessagesService();
