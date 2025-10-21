import { Request, Response, NextFunction } from "express";
import { directMessagesService } from "../services/directMessagesService";
import { 
  GetDirectMessagesQuery,
  CreateDirectMessageRequest,
  UpdateDirectMessageRequest,
  ToggleReactionRequest,
  DirectMessagesResponse,
  DirectMessageResponse,
  DeleteMessageResponse
} from "../types/directMessages";

export class DirectMessagesController {
  /**
   * GET /api/direct-messages
   * Get direct messages with pagination
   */
  getDirectMessages = async (
    req: Request<{}, DirectMessagesResponse, {}, GetDirectMessagesQuery>,
    res: Response<DirectMessagesResponse>,
    next: NextFunction
  ) => {
    try {
      const { cursor, conversationId } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          message: "Conversation ID missing",
        });
      }

      const result = await directMessagesService.getDirectMessages(
        conversationId,
        cursor || null,
        userId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[DIRECT_MESSAGES_GET]", error);

      if (error.message === "Conversation not found or access denied") {
        return res.status(403).json({
          success: false,
          message: "Conversation not found or access denied",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * POST /api/direct-messages
   * Create a new direct message
   */
  createDirectMessage = async (
    req: Request<{}, DirectMessageResponse, CreateDirectMessageRequest>,
    res: Response<DirectMessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { content, fileUrl } = req.body;
      const { conversationId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await directMessagesService.createDirectMessage(
        content,
        fileUrl || null,
        conversationId as string,
        profileId
      );

      // Socket.io emission
      const addKey = `chat:${conversationId}:messages`;
      const io = req.app.get("io");

      if (io && result) {
        io.to(conversationId as string).emit(addKey, result);
        console.log(`📢 Emitted message to ${addKey}`);
      }

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[DIRECT_MESSAGE_CREATE]", error);

      if (error.message === "Missing required fields: content, conversationId, profileId") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      if (error.message === "User not found" || 
          error.message === "Conversation not found" || 
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
   * PATCH /api/direct-messages/:directMessageId
   * Update a direct message
   */
  updateDirectMessage = async (
    req: Request<{ directMessageId: string }, DirectMessageResponse, UpdateDirectMessageRequest>,
    res: Response<DirectMessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { directMessageId } = req.params;
      const { content } = req.body;
      const { conversationId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await directMessagesService.updateDirectMessage(
        directMessageId,
        content,
        profileId,
        conversationId as string
      );

      // Socket.io emission
      const updateKey = `chat:${conversationId}:messages:update`;
      const io = req.app.get("io");

      if (io && result) {
        io.to(conversationId as string).emit(updateKey, {
          action: "update",
          message: result,
        });
        console.log(`📢 Emitted direct message update to ${updateKey}`);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[DIRECT_MESSAGE_UPDATE]", error);

      if (error.message === "Missing required fields: content, profileId, conversationId") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      if (error.message === "User not found" || 
          error.message === "Conversation not found" ||
          error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Not authorized for this conversation" ||
          error.message === "Unauthorized: You can only edit your own messages") {
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
   * DELETE /api/direct-messages/:directMessageId
   * Delete a direct message
   */
  deleteDirectMessage = async (
    req: Request<{ directMessageId: string }, DeleteMessageResponse, {}>,
    res: Response<DeleteMessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { directMessageId } = req.params;
      const { conversationId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const deletedMessage = await directMessagesService.deleteDirectMessage(
        directMessageId,
        profileId,
        conversationId as string
      );

      // Socket.io emission
      const updateKey = `chat:${conversationId}:messages:update`;
      const io = req.app.get("io");

      if (io) {
        io.to(conversationId as string).emit(updateKey, {
          action: "delete",
          messageId: directMessageId,
        });
        console.log(`📢 Emitted direct message deletion to ${updateKey}`);
      }

      res.json({
        success: true,
        message: "Message deleted successfully",
        deletedMessage,
      });
    } catch (error: any) {
      console.error("[DIRECT_MESSAGE_DELETE]", error);

      if (error.message === "Missing required fields: directMessageId, profileId, conversationId") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      if (error.message === "User not found" || 
          error.message === "Conversation not found" ||
          error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Not authorized for this conversation" ||
          error.message === "Unauthorized: You can only delete your own messages") {
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
   * POST /api/direct-messages/:directMessageId/reaction
   * Toggle reaction on a direct message
   */
  toggleDirectMessageReaction = async (
    req: Request<{ directMessageId: string }, DirectMessageResponse, ToggleReactionRequest>,
    res: Response<DirectMessageResponse>,
    next: NextFunction
  ) => {
    try {
      const { directMessageId } = req.params;
      const { emoji } = req.body;
      const { conversationId } = req.query;
      const profileId = (req as any).user?.id;

      if (!profileId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const result = await directMessagesService.toggleDirectMessageReaction(
        directMessageId,
        emoji,
        profileId,
        conversationId as string
      );

      // Socket.io emission
      const io = req.app.get("io");
      if (io && result) {
        const updateKey = `chat:${conversationId}:messages:update`;
        io.to(conversationId as string).emit(updateKey, {
          action: "reaction",
          message: result,
        });
        console.log(`📢 Emitted direct message reaction update to ${updateKey}`);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[DIRECT_MESSAGE_REACTION]", error);

      if (error.message === "Missing required fields: emoji, profileId, conversationId") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      if (error.message === "Conversation not found" ||
          error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Not authorized for this conversation") {
        return res.status(403).json({
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
   * GET /api/direct-messages/:messageId
   * Get a single direct message by ID
   */
  getDirectMessage = async (
    req: Request<{ messageId: string }, DirectMessageResponse, {}>,
    res: Response<DirectMessageResponse>,
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

      if (!messageId) {
        return res.status(400).json({
          success: false,
          message: "Message ID missing",
        });
      }

      const message = await directMessagesService.getDirectMessageById(
        messageId,
        userId
      );

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
      console.error("[DIRECT_MESSAGE_GET]", error);

      if (error.message === "Access denied to this message") {
        return res.status(403).json({
          success: false,
          message: "Access denied to this message",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export const directMessagesController = new DirectMessagesController();