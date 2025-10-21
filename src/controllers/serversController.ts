import { Request, Response, NextFunction } from "express";
import { serversService } from "../services/serversService";
import {
  CreateServerRequest,
  UpdateServerRequest,
  JoinServerRequest,
  BaseServerResponse,
  ServerWithDetailsResponse,
  ServerWithRelationsResponse,
  ServersListResponse,
  DeleteServerParams,
  UpdateServerParams,
  InviteCodeParams,
  LeaveServerParams,
} from "../types/servers";

export class ServersController {
  /**
   * POST /api/servers
   * Create a new server
   */
  createServer = async (
    req: Request<{}, ServerWithRelationsResponse, CreateServerRequest>,
    res: Response<ServerWithRelationsResponse>,
    next: NextFunction
  ) => {
    try {
      const { name, imageUrl } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await serversService.createServer(name, imageUrl, userId);

      res.status(201).json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[SERVERS_CREATE]", error);

      if (error.message === "Name and user ID are required") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Failed to create server") {
        return res.status(500).json({
          success: false,
          message: "Failed to create server",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * DELETE /api/servers/:serverId
   * Delete a server
   */
  deleteServer = async (
    req: Request<DeleteServerParams, BaseServerResponse, {}>,
    res: Response<BaseServerResponse>,
    next: NextFunction
  ) => {
    try {
      const { serverId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await serversService.deleteServer(serverId, userId);

      res.json({
        success: true,
        data: server[0],
      });
    } catch (error: any) {
      console.error("[SERVER_DELETE]", error);

      if (error.message === "Server not found or unauthorized") {
        return res.status(404).json({
          success: false,
          message: "Server not found or unauthorized",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * PATCH /api/servers/:serverId
   * Update a server
   */
  updateServer = async (
    req: Request<UpdateServerParams, BaseServerResponse, UpdateServerRequest>,
    res: Response<BaseServerResponse>,
    next: NextFunction
  ) => {
    try {
      const { serverId } = req.params;
      const { name, imageUrl } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await serversService.updateServer(
        serverId,
        { name, imageUrl },
        userId
      );

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[SERVER_UPDATE]", error);

      if (error.message === "Server not found or unauthorized") {
        return res.status(404).json({
          success: false,
          message: "Server not found or unauthorized",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * PATCH /api/servers/:serverId/invite-code
   * Generate new invite code
   */
  generateInviteCode = async (
    req: Request<InviteCodeParams, BaseServerResponse, {}>,
    res: Response<BaseServerResponse>,
    next: NextFunction
  ) => {
    try {
      const { serverId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await serversService.generateInviteCode(serverId, userId);

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[SERVER_INVITE_CODE]", error);

      if (error.message === "Server not found or unauthorized") {
        return res.status(404).json({
          success: false,
          message: "Server not found or unauthorized",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * PATCH /api/servers/:serverId/leave
   * Leave a server
   */
  leaveServer = async (
    req: Request<LeaveServerParams, BaseServerResponse, {}>,
    res: Response<BaseServerResponse>,
    next: NextFunction
  ) => {
    try {
      const { serverId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await serversService.leaveServer(serverId, userId);

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[SERVER_LEAVE]", error);

      if (error.message === "Server not found or you are the owner") {
        return res.status(400).json({
          success: false,
          message: "Server not found or you are the owner",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * GET /api/servers/:serverId
   * Get server by ID
   */
  getServerById = async (
    req: Request<{ serverId: string }, ServerWithDetailsResponse, {}>,
    res: Response<ServerWithDetailsResponse>,
    next: NextFunction
  ) => {
    try {
      const { serverId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await serversService.getServerById(serverId, userId);

      if (!server) {
        return res.status(404).json({
          success: false,
          message: "Server not found",
        });
      }

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[SERVER_GET]", error);

      if (error.message === "Access denied to this server") {
        return res.status(403).json({
          success: false,
          message: "Access denied to this server",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * GET /api/servers
   * Get all servers for current user
   */
  getUserServers = async (
    req: Request<{}, ServersListResponse, {}>,
    res: Response<ServersListResponse>,
    next: NextFunction
  ) => {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const servers = await serversService.getUserServers(userId);

      res.json({
        success: true,
        data: servers,
      });
    } catch (error: any) {
      console.error("[SERVERS_GET]", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * POST /api/servers/join
   * Join a server using invite code
   */
  joinServer = async (
    req: Request<{}, ServerWithDetailsResponse, JoinServerRequest>,
    res: Response<ServerWithDetailsResponse>,
    next: NextFunction
  ) => {
    try {
      const { inviteCode } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!inviteCode) {
        return res.status(400).json({
          success: false,
          message: "Invite code is required",
        });
      }

      const server = await serversService.joinServer(inviteCode, userId);

      res.status(201).json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[SERVER_JOIN]", error);

      if (error.message === "Invalid invite code") {
        return res.status(404).json({
          success: false,
          message: "Invalid invite code",
        });
      }

      if (error.message === "Already a member of this server") {
        return res.status(400).json({
          success: false,
          message: "Already a member of this server",
        });
      }

      if (error.message === "Failed to join server") {
        return res.status(500).json({
          success: false,
          message: "Failed to join server",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
}

export const serversController = new ServersController();
