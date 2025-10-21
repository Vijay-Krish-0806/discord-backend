import { Request, Response, NextFunction } from "express";
import { messagesService } from "../services/messagesServices";
import { 
  GetMessagesQuery,
  CreateMessageRequest,
  UpdateMessageRequest,
  ToggleReactionRequest,
  MessagesResponse,
  MessageResponse,
  DeleteMessageResponse,
  DeleteMessageParams,
  UpdateMessageParams
} from "../types/messages";
import { createNotificationsForOfflineUsers } from "./notificationController";

export class MessagesController {
  /**
   * GET /api/messages
   * Get messages with pagination
   */
  getMessages = async (
    req: Request<{}, MessagesResponse, {}, GetMessagesQuery>,
    res: Response<MessagesResponse>,
    next: NextFunction
  ) => {
    try {
      const { cursor, channelId } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!channelId) {
        return res.status(400).json({
          success: false,
          message: "ChannelId missing",
        });
      }

      const result = await messagesService.getMessages(
        channelId,
        cursor || null,
        userId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[MESSAGES_GET]", error);

      if (error.message === "Channel not found or access denied") {
        return res.status(403).json({
          success: false,
          message: "Channel not found or access denied",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * POST /api/messages
   * Create a new message
   */
  createMessage = async (
    req: Request<{}, MessageResponse, CreateMessageRequest>,
    res: Response<MessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { content, fileUrl } = req.body;
      const { channelId, serverId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await messagesService.createMessage(
        content,
        fileUrl || null,
        channelId as string,
        serverId as string,
        profileId
      );

      // Socket.io emission
      const addKey = `chat:${channelId}:messages`;
      const io = req.app.get("io");

      if (io && result) {
        io.to(channelId as string).emit(addKey, result);
        console.log(`📢 Emitted message to ${addKey}`);

        // Create notifications for offline users
        await createNotificationsForOfflineUsers(
          channelId as string,
          result.id,
          profileId,
          result.member.user.name || "Someone",
          content,
          io
        );
      }

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[MESSAGE_CREATE]", error);

      if (error.message === "Missing required fields: content, channelId, serverId") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      if (error.message === "User not found" || 
          error.message === "Server not found" ||
          error.message === "Channel not found" ||
          error.message === "Member not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }
  };

  /**
   * PATCH /api/messages/:messageId
   * Update a message
   */
  updateMessage = async (
    req: Request<UpdateMessageParams, MessageResponse, UpdateMessageRequest>,
    res: Response<MessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const { channelId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await messagesService.updateMessage(
        messageId,
        content,
        profileId,
        channelId as string
      );

      // Socket.io emission
      const updateKey = `chat:${channelId}:messages:update`;
      const io = req.app.get("io");

      if (io && result) {
        io.to(channelId as string).emit(updateKey, {
          action: "update",
          message: result,
        });
        console.log(`📢 Emitted message update to ${updateKey}`);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[MESSAGE_UPDATE]", error);

      if (error.message === "Missing required fields: content, profileId") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      if (error.message === "User not found" || 
          error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Unauthorized: You can't edit messages") {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to update message",
      });
    }
  };

  /**
   * DELETE /api/messages/:messageId
   * Delete a message
   */
  deleteMessage = async (
    req: Request<DeleteMessageParams, DeleteMessageResponse, {}>,
    res: Response<DeleteMessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { messageId } = req.params;
      const { channelId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const deletedMessage = await messagesService.deleteMessage(
        messageId,
        profileId,
        channelId as string
      );

      // Socket.io emission
      const updateKey = `chat:${channelId}:messages:update`;
      const io = req.app.get("io");

      if (io) {
        io.to(channelId as string).emit(updateKey, {
          action: "delete",
          messageId: messageId,
        });
        console.log(`📢 Emitted message deletion to ${updateKey}`);
      }

      res.json({
        success: true,
        message: "Message deleted successfully",
        deletedMessage,
      });
    } catch (error: any) {
      console.error("[MESSAGE_DELETE]", error);

      if (error.message === "Missing required fields: messageId, profileId") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      if (error.message === "User not found" || 
          error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Unauthorized: You don't have permission to delete this message") {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to delete message",
      });
    }
  };

  /**
   * POST /api/messages/:messageId/reaction
   * Toggle reaction on a message
   */
  toggleReaction = async (
    req: Request<{ messageId: string }, MessageResponse, ToggleReactionRequest>,
    res: Response<MessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const { channelId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await messagesService.toggleReaction(
        messageId,
        emoji,
        profileId,
        channelId as string
      );

      // Socket.io emission
      const io = req.app.get("io");
      if (io && result) {
        const updateKey = `chat:${channelId}:messages:update`;
        io.to(channelId as string).emit(updateKey, {
          action: "update",
          message: result,
        });
        console.log(`📢 Emitted reaction update to ${updateKey}`);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[MESSAGE_REACTION]", error);

      if (error.message === "Missing emoji or profileId" || 
          error.message === "Missing channelId") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: "Failed to toggle reaction",
      });
    }
  };

  /**
   * GET /api/messages/:messageId
   * Get a single message by ID
   */
  getMessage = async (
    req: Request<{ messageId: string }, MessageResponse, {}>,
    res: Response<MessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const message = await messagesService.getMessageById(messageId, userId);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: "Message not found",
        });
      }

      res.json({
        success: true,
        data: message,
      });
    } catch (error: any) {
      console.error("[MESSAGE_GET]", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export const messagesController = new MessagesController();