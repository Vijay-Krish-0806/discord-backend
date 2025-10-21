import { Request, Response, NextFunction } from "express";
import {
  CreateChannelRequest,
  UpdateChannelRequest,
  ChannelResponse,
  UpdateChannelParams,
  DeleteChannelParams,
} from "../types/channels";
import { channelsService } from "../services/channelsServices";

export class ChannelsController {
  /**
   * POST /api/channels
   * Create a new channel
   */
  createChannel = async (
    req: Request<{}, ChannelResponse, CreateChannelRequest>,
    res: Response<ChannelResponse>,
    next: NextFunction
  ) => {
    try {
      const { name, type } = req.body;
      const serverId = req.query.serverId as string;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!serverId) {
        return res.status(400).json({
          success: false,
          message: "ServerId missing",
        });
      }

      const server = await channelsService.createChannel(
        name,
        type,
        serverId,
        userId
      );

      res.status(201).json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[CHANNEL_CREATE_POST]", error);

      if (error.message === "Insufficient permissions") {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }

      if (error.message === "Name cannot be 'general'") {
        return res.status(400).json({
          success: false,
          message: "Name cannot be 'general'",
        });
      }

      if (error.message === "Server not found") {
        return res.status(404).json({
          success: false,
          message: "Server not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * GET /api/channels/:channelId
   * Get channel by ID
   */
  getChannel = async (
    req: Request<{ channelId: string }>,
    res: Response<ChannelResponse>,
    next: NextFunction
  ) => {
    try {
      const { channelId } = req.params;

      const channel = await channelsService.getChannelById(channelId);

      if (!channel) {
        return res.status(404).json({
          success: false,
          message: "Channel not found",
        });
      }

      res.json({
        success: true,
        data: channel,
      });
    } catch (error: any) {
      console.error("[CHANNEL_GET]", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * GET /api/channels?serverId=:serverId
   * Get all channels for a server
   */
  getChannelsByServer = async (
    req: Request,
    res: Response<ChannelResponse>,
    next: NextFunction
  ) => {
    try {
      const serverId = req.query.serverId as string;

      if (!serverId) {
        return res.status(400).json({
          success: false,
          message: "ServerId is required",
        });
      }

      const channels = await channelsService.getChannelsByServerId(serverId);

      res.json({
        success: true,
        data: channels,
      });
    } catch (error: any) {
      console.error("[CHANNELS_GET]", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  deleteChannel = async (
    req: Request<DeleteChannelParams, ChannelResponse, {}>,
    res: Response<ChannelResponse>,
    next: NextFunction
  ) => {
    try {
      const { channelId } = req.params;
      const serverId = req.query.serverId as string;
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
          message: "Channel id missing",
        });
      }

      if (!serverId) {
        return res.status(400).json({
          success: false,
          message: "Server id missing",
        });
      }

      const server = await channelsService.deleteChannel(
        channelId,
        serverId,
        userId
      );

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[CHANNEL_DELETE]", error);

      if (error.message === "Channel not found or insufficient permissions") {
        return res.status(403).json({
          success: false,
          message: "Channel not found or insufficient permissions",
        });
      }

      if (error.message === "Server not found after deletion") {
        return res.status(404).json({
          success: false,
          message: "Server not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * PATCH /api/channels/:channelId
   * Update a channel
   */
  updateChannel = async (
    req: Request<UpdateChannelParams, ChannelResponse, UpdateChannelRequest>,
    res: Response<ChannelResponse>,
    next: NextFunction
  ) => {
    try {
      const { channelId } = req.params;
      const { name, type } = req.body;
      const serverId = req.query.serverId as string;
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
          message: "Channel id missing",
        });
      }

      if (!serverId) {
        return res.status(400).json({
          success: false,
          message: "Server id missing",
        });
      }

      const server = await channelsService.updateChannel(
        channelId,
        serverId,
        userId,
        { name, type }
      );

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[CHANNEL_UPDATE]", error);

      if (error.message === "Name cannot be general") {
        return res.status(400).json({
          success: false,
          message: "Name cannot be general",
        });
      }

      if (error.message === "Insufficient permissions") {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        });
      }

      if (
        error.message === "Channel not found or cannot update general channel"
      ) {
        return res.status(404).json({
          success: false,
          message: "Channel not found or cannot update general channel",
        });
      }

      if (error.message === "Server not found after update") {
        return res.status(404).json({
          success: false,
          message: "Server not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export const channelsController = new ChannelsController();
