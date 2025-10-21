// src/controllers/channel.controller.ts
import { Request, Response } from "express";
import { channelService } from "../services/channelServices";
import { ChannelType } from "../db/schema";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

class ChannelController {
  async deleteChannel(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params;
      const { serverId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!channelId) {
        return res.status(400).json({ error: "Channel id missing" });
      }

      if (!serverId || typeof serverId !== "string") {
        return res.status(400).json({ error: "Server id missing" });
      }

      const server = await channelService.deleteChannel(
        channelId,
        serverId,
        userId
      );

      return res.status(200).json(server);
    } catch (error) {
      console.error("[Channel delete]", error);

      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("permissions")
        ) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateChannel(req: AuthRequest, res: Response) {
    try {
      const { channelId } = req.params;
      const { serverId } = req.query;
      const { name, type } = req.body as { name: string; type: ChannelType };
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!channelId) {
        return res.status(400).json({ error: "Channel id missing" });
      }

      if (!serverId || typeof serverId !== "string") {
        return res.status(400).json({ error: "Server id missing" });
      }

      if (name === "general") {
        return res.status(400).json({ error: "Name cannot be general" });
      }

      const server = await channelService.updateChannel(
        channelId,
        serverId,
        userId,
        { name, type }
      );

      return res.status(200).json(server);
    } catch (error) {
      console.error("[Channel update]", error);

      if (error instanceof Error) {
        if (error.message.includes("permissions")) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const channelController = new ChannelController();
