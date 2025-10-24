// src/controllers/messages.controller.ts
import { Request, Response } from "express";
import { messagesService } from "../services/messagesServices";
import { createNotificationsForOfflineUsers } from "./notificationController";
import { db } from "../db/database";
import { messages } from "../db/schema";
import { eq, inArray, sql } from "drizzle-orm";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

class MessagesController {
  async getMessages(req: AuthRequest, res: Response) {
    try {
      const { channelId, cursor } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!channelId || typeof channelId !== "string") {
        return res.status(400).json({ error: "ChannelId missing" });
      }

      const result = await messagesService.getMessages(
        channelId,
        cursor as string | undefined
      );

      return res.status(200).json(result);
    } catch (error) {
      console.error("❌ [Messages GET]", error);
      return res.status(500).json({ error: "Internal Server error" });
    }
  }

  async createMessage(req: AuthRequest, res: Response) {
    try {
      const { content, fileUrl } = req.body;
      const { channelId, serverId, profileId } = req.query;

      if (!content || !channelId || !serverId || !profileId) {
        return res.status(400).json({
          error:
            "Missing required fields: content, channelId, serverId, profileId",
        });
      }

      const result = await messagesService.createMessage({
        content,
        fileUrl,
        channelId: channelId as string,
        serverId: serverId as string,
        profileId: profileId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io && result) {
        const addKey = `chat:${channelId}:messages`;
        io.to(channelId as string).emit(addKey, result);
        console.log(`📢 Emitted message to ${addKey}`);

        // Create notifications for offline users
        await createNotificationsForOfflineUsers(
          channelId as string,
          result.id,
          result.member.userId,
          result.member.user.name || "Someone",
          content,
          io
        );
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

 
  async updateMessage(req: AuthRequest, res: Response) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const { profileId, channelId } = req.query;

      if (!content || !profileId) {
        return res.status(400).json({
          error: "Missing required fields: content, profileId",
        });
      }

      if (!messageId) {
        return res.status(400).json({ error: "Message ID is required" });
      }

      const result = await messagesService.updateMessage({
        messageId,
        content,
        profileId: profileId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io && result) {
        const updateKey = `chat:${channelId}:messages:update`;
        io.to(channelId as string).emit(updateKey, {
          action: "update",
          message: result,
        });
        console.log(`📢 Emitted message update to ${updateKey}`);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("❌ Error updating message:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("Unauthorized")) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to update message" });
    }
  }

  async deleteMessage(req: AuthRequest, res: Response) {
    try {
      const { messageId } = req.params;
      const { profileId, channelId } = req.query;

      if (!messageId || !profileId) {
        return res.status(400).json({
          error: "Missing required fields: messageId, profileId",
        });
      }

      await messagesService.deleteMessage({
        messageId,
        profileId: profileId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io) {
        const updateKey = `chat:${channelId}:messages:update`;
        io.to(channelId as string).emit(updateKey, {
          action: "delete",
          messageId: messageId,
        });
        console.log(`📢 Emitted message deletion to ${updateKey}`);
      }

      return res.status(200).json({
        success: true,
        message: "Message deleted successfully",
      });
    } catch (error) {
      console.error("❌ Error deleting message:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("Unauthorized")) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to delete message" });
    }
  }

  async toggleReaction(req: AuthRequest, res: Response) {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const { profileId, channelId } = req.query;

      if (!emoji || !profileId) {
        return res.status(400).json({ error: "Missing emoji or profileId" });
      }

      if (!channelId) {
        return res.status(400).json({ error: "Missing channelId" });
      }

      const result = await messagesService.toggleReaction({
        messageId,
        emoji,
        profileId: profileId as string,
      });

      // Socket.io emit
      const io = req.app.get("io");
      if (io && result) {
        const updateKey = `chat:${channelId}:messages:update`;
        io.to(channelId as string).emit(updateKey, {
          action: "update",
          message: result,
        });
        console.log(`📢 Emitted reaction update to ${updateKey}`);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("❌ Error toggling reaction:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to toggle reaction" });
    }
  }
}

export const messagesController = new MessagesController();
