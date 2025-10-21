// src/controllers/servers.controller.ts
import { Request, Response } from "express";
import { serversService } from "../services/serversService";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

class ServersController {
  async createServer(req: AuthRequest, res: Response) {
    try {
      const { name, imageUrl } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const server = await serversService.createServer({
        name,
        imageUrl,
        userId,
      });

      return res.status(201).json(server);
    } catch (error) {
      console.error("[SERVERS_POST]", error);
      return res.status(500).json({ error: "Internal Error" });
    }
  }

  async deleteServer(req: AuthRequest, res: Response) {
    try {
      const { serverId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!serverId) {
        return res.status(400).json({ error: "Server ID is required" });
      }

      const server = await serversService.deleteServer(serverId, userId);

      return res.status(200).json(server);
    } catch (error) {
      console.error("[SERVER_ID_DELETE]", error);

      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("Unauthorized")
        ) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateServer(req: AuthRequest, res: Response) {
    try {
      const { serverId } = req.params;
      const { name, imageUrl } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!serverId) {
        return res.status(400).json({ error: "Server ID is required" });
      }

      const server = await serversService.updateServer({
        serverId,
        name,
        imageUrl,
        userId,
      });

      return res.status(200).json(server);
    } catch (error) {
      console.error("[SERVER_ID_PATCH]", error);

      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("Unauthorized")
        ) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async regenerateInviteCode(req: AuthRequest, res: Response) {
    try {
      const { serverId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!serverId) {
        return res.status(400).json({ error: "Server id Missing" });
      }

      const server = await serversService.regenerateInviteCode(
        serverId,
        userId
      );

      return res.status(200).json(server);
    } catch (error) {
      console.error("[INVITE_CODE_PATCH]", error);

      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("Unauthorized")
        ) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async leaveServer(req: AuthRequest, res: Response) {
    try {
      const { serverId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!serverId) {
        return res.status(400).json({ error: "Server ID is required" });
      }

      const server = await serversService.leaveServer(serverId, userId);

      return res.status(200).json(server);
    } catch (error) {
      console.log("[SERVER_ID_LEAVE]", error);

      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("owner")
        ) {
          return res.status(404).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal Error" });
    }
  }
}

export const serversController = new ServersController();
