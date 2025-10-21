import { eq, and, lt, desc, or } from "drizzle-orm";

import {
  directMessages,
  conversations,
  users,
  type DirectMessage,
  type Member,
  type User,
  type Conversation,
} from "../db/schema";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db/database";

const MESSAGES_BATCH = 10;

export class DirectMessagesService {
  /**
   * Get direct messages for a conversation with pagination
   */
  async getDirectMessages(
    conversationId: string,
    cursor: string | null,
    userId: string
  ): Promise<{
    items: (DirectMessage & {
      member: Member & {
        user: User;
      };
    })[];
    nextCursor: string | null;
  }> {
    // Verify user has access to this conversation
    const conversation = await db.query.conversations.findFirst({
      where: (conversations, { eq, or }) =>
        or(
          eq(conversations.memberOneId, userId),
          eq(conversations.memberTwoId, userId)
        ),
    });

    if (!conversation) {
      throw new Error("Conversation not found or access denied");
    }

    let messages: (DirectMessage & {
      member: Member & {
        user: User;
      };
    })[] = [];

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

    return {
      items: messages,
      nextCursor,
    };
  }

  /**
   * Create a new direct message
   */
  async createDirectMessage(
    content: string,
    fileUrl: string | null,
    conversationId: string,
    profileId: string
  ): Promise<
    DirectMessage & {
      member: Member & {
        user: User;
      };
      conversation: Conversation;
    }
  > {
    if (!content || !conversationId || !profileId) {
      throw new Error(
        "Missing required fields: content, conversationId, profileId"
      );
    }

    const [user] = await db.select().from(users).where(eq(users.id, profileId));

    if (!user) {
      throw new Error("User not found");
    }

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

    const member =
      conversation.memberOne.userId === profileId
        ? conversation.memberOne
        : conversation.memberTwo;

    if (!member) {
      throw new Error("Member not found");
    }

    const [message] = await db
      .insert(directMessages)
      .values({
        id: uuidv4(),
        content,
        fileUrl: fileUrl || null,
        conversationId: conversationId,
        memberId: member.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

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

    if (!result) {
      throw new Error("Failed to create message");
    }

    return result;
  }

  /**
   * Update a direct message
   */
  async updateDirectMessage(
    directMessageId: string,
    content: string,
    profileId: string,
    conversationId: string
  ): Promise<
    DirectMessage & {
      member: Member & {
        user: User;
      };
      conversation: Conversation;
    }
  > {
    if (!content || !profileId || !directMessageId || !conversationId) {
      throw new Error(
        "Missing required fields: content, profileId, conversationId"
      );
    }

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

    const isMessageOwner = existingMessage.member.userId === profileId;

    if (!isMessageOwner) {
      throw new Error("Unauthorized: You can only edit your own messages");
    }

    const [updatedMessage] = await db
      .update(directMessages)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(directMessages.id, directMessageId))
      .returning();

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

    if (!result) {
      throw new Error("Failed to update message");
    }

    return result;
  }

  /**
   * Delete a direct message (soft delete)
   */
  async deleteDirectMessage(
    directMessageId: string,
    profileId: string,
    conversationId: string
  ): Promise<DirectMessage> {
    if (!directMessageId || !profileId || !conversationId) {
      throw new Error(
        "Missing required fields: directMessageId, profileId, conversationId"
      );
    }

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

    const isMessageOwner = existingMessage.member.userId === profileId;

    if (!isMessageOwner) {
      throw new Error("Unauthorized: You can only delete your own messages");
    }

    const [deletedMessage] = await db
      .update(directMessages)
      .set({
        deleted: true,
        content: "This message was deleted",
        updatedAt: new Date(),
      })
      .where(eq(directMessages.id, directMessageId))
      .returning();

    return deletedMessage;
  }

  /**
   * Toggle reaction on a direct message
   */
  async toggleDirectMessageReaction(
    directMessageId: string,
    emoji: string,
    profileId: string,
    conversationId: string
  ): Promise<
    DirectMessage & {
      member: Member & {
        user: User;
      };
      conversation: Conversation;
    }
  > {
    if (!emoji || !profileId || !conversationId) {
      throw new Error(
        "Missing required fields: emoji, profileId, conversationId"
      );
    }

    if (!directMessageId) {
      throw new Error("Missing directMessageId");
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

    const message = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, directMessageId),
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
      .update(directMessages)
      .set({
        reactions: updatedReactions,
      })
      .where(eq(directMessages.id, directMessageId))
      .returning();

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

    if (!result) {
      throw new Error("Failed to update reaction");
    }

    return result;
  }

  /**
   * Get a single direct message by ID
   */
  async getDirectMessageById(
    messageId: string,
    userId: string
  ): Promise<
    | (DirectMessage & {
        member: Member & {
          user: User;
        };
      })
    | null
  > {
    const message = await db.query.directMessages.findFirst({
      where: (messages, { eq }) => eq(messages.id, messageId),
      with: {
        member: {
          with: {
            user: true,
          },
        },
        conversation: true,
      },
    });

    if (!message) {
      return null;
    }

    // Verify user has access to this conversation
    const hasAccess = await db.query.conversations.findFirst({
      where: (conversations, { eq, and, or }) =>
        and(
          eq(conversations.id, message.conversationId),
          or(
            eq(conversations.memberOneId, userId),
            eq(conversations.memberTwoId, userId)
          )
        ),
    });

    if (!hasAccess) {
      throw new Error("Access denied to this message");
    }

    return message;
  }
}

export const directMessagesService = new DirectMessagesService();
