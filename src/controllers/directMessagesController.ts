// src/controllers/directMessages.controller.ts
import { Request, Response } from "express";
import { directMessagesService } from "../services/directMessagesService";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

class DirectMessagesController {
  async getDirectMessages(req: AuthRequest, res: Response) {
    try {
      const { conversationId, cursor } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!conversationId || typeof conversationId !== "string") {
        return res.status(400).json({ error: "ConversationId missing" });
      }

      const result = await directMessagesService.getDirectMessages(
        conversationId,
        cursor as string | undefined
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error("❌ [Direct Messages GET]", error);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  }

  async createDirectMessage(req: AuthRequest, res: Response) {
    try {
      const { content, fileUrl } = req.body;
      const { conversationId, profileId } = req.query;

      if (!content || !conversationId || !profileId) {
        return res.status(400).json({
          error: "Missing required fields: content, conversationId, profileId",
        });
      }

      const result = await directMessagesService.createDirectMessage({
        content,
        fileUrl,
        conversationId: conversationId as string,
        profileId: profileId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io && result) {
        const addKey = `chat:${conversationId}:messages`;
        io.to(conversationId as string).emit(addKey, result);
        console.log(`📢 Emitted message to ${addKey}`);
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error("❌ Error creating message:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to send message" });
    }
  }

  async updateDirectMessage(req: AuthRequest, res: Response) {
    try {
      const { directMessageId } = req.params;
      const { content } = req.body;
      const { profileId, conversationId } = req.query;

      if (!content || !profileId || !directMessageId || !conversationId) {
        return res.status(400).json({
          error: "Missing required fields: content, profileId, conversationId",
        });
      }

      const result = await directMessagesService.updateDirectMessage({
        directMessageId,
        content,
        profileId: profileId as string,
        conversationId: conversationId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io && result) {
        const updateKey = `chat:${conversationId}:messages:update`;
        io.to(conversationId as string).emit(updateKey, {
          action: "update",
          message: result,
        });
        console.log(`📢 Emitted direct message update to ${updateKey}`);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("❌ Error updating direct message:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("Not authorized")
        ) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to update message" });
    }
  }

  async deleteDirectMessage(req: AuthRequest, res: Response) {
    try {
      const { directMessageId } = req.params;
      const { profileId, conversationId } = req.query;

      if (!directMessageId || !profileId || !conversationId) {
        return res.status(400).json({
          error:
            "Missing required fields: directMessageId, profileId, conversationId",
        });
      }

      await directMessagesService.deleteDirectMessage({
        directMessageId,
        profileId: profileId as string,
        conversationId: conversationId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io) {
        const updateKey = `chat:${conversationId}:messages:update`;
        io.to(conversationId as string).emit(updateKey, {
          action: "delete",
          messageId: directMessageId,
        });
        console.log(`📢 Emitted direct message deletion to ${updateKey}`);
      }

      return res.status(200).json({
        success: true,
        message: "Message deleted successfully",
      });
    } catch (error) {
      console.error("❌ Error deleting direct message:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("Not authorized")
        ) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to delete message" });
    }
  }

  async toggleDirectMessageReaction(req: AuthRequest, res: Response) {
    try {
      const { directMessageId } = req.params;
      const { emoji } = req.body;
      const { profileId, conversationId } = req.query;

      if (!emoji || !profileId || !conversationId) {
        return res.status(400).json({
          error: "Missing required fields: emoji, profileId, conversationId",
        });
      }

      if (!directMessageId) {
        return res.status(400).json({ error: "Missing directMessageId" });
      }

      const result = await directMessagesService.toggleDirectMessageReaction({
        directMessageId,
        emoji,
        profileId: profileId as string,
        conversationId: conversationId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io && result) {
        const updateKey = `chat:${conversationId}:messages:update`;
        io.to(conversationId as string).emit(updateKey, {
          action: "reaction",
          message: result,
        });
        console.log(
          `📢 Emitted direct message reaction update to ${updateKey}`
        );
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("❌ Error toggling direct message reaction:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("Not authorized")) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to toggle reaction" });
    }
  }
}

export const directMessagesController = new DirectMessagesController();
