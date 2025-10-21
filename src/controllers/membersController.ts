import { Request, Response, NextFunction } from "express";
import { membersService } from "../services/membersServices";
import {
  UpdateMemberRoleRequest,
  MemberResponse,
  CurrentMemberResponse,
  MemberDetailResponse,
  MembersListResponse,
  DeleteMemberParams,
  UpdateMemberParams,
} from "../types/members";

export class MembersController {
  /**
   * DELETE /api/members/:memberId
   * Delete a member from server
   */
  deleteMember = async (
    req: Request<DeleteMemberParams, MemberResponse, {}>,
    res: Response<MemberResponse>,
    next: NextFunction
  ) => {
    try {
      const { memberId } = req.params;
      const serverId = req.query.serverId as string;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await membersService.deleteMember(
        memberId,
        serverId,
        userId
      );

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[MEMBERS_DELETE]", error);

      if (
        error.message === "ServerId missing" ||
        error.message === "MemberID missing"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
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
   * PATCH /api/members/:memberId
   * Update member role
   */
  updateMemberRole = async (
    req: Request<UpdateMemberParams, MemberResponse, UpdateMemberRoleRequest>,
    res: Response<MemberResponse>,
    next: NextFunction
  ) => {
    try {
      const { memberId } = req.params;
      const { role } = req.body;
      const serverId = req.query.serverId as string;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const server = await membersService.updateMemberRole(
        memberId,
        serverId,
        role,
        userId
      );

      res.json({
        success: true,
        data: server,
      });
    } catch (error: any) {
      console.error("[MEMBERS_UPDATE]", error);

      if (
        error.message === "ServerId missing" ||
        error.message === "MemberID missing"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
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

  /**
   * GET /api/members/current
   * Get current user's member ID
   */
  getCurrentMember = async (
    req: Request<{}, CurrentMemberResponse, {}>,
    res: Response<CurrentMemberResponse>,
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

      const result = await membersService.getCurrentMemberId(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error("[CURRENT_MEMBER_GET]", error);

      if (error.message === "Member not found") {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * GET /api/members/:memberId
   * Get member by ID
   */
  getMemberById = async (
    req: Request<{ memberId: string }, MemberDetailResponse, {}>,
    res: Response<MemberDetailResponse>,
    next: NextFunction
  ) => {
    try {
      const { memberId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const member = await membersService.getMemberById(memberId, userId);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: "Member not found",
        });
      }

      res.json({
        success: true,
        data: member,
      });
    } catch (error: any) {
      console.error("[MEMBER_GET]", error);

      if (error.message === "Access denied to this member") {
        return res.status(403).json({
          success: false,
          message: "Access denied to this member",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };

  /**
   * GET /api/members?serverId=:serverId
   * Get all members for a server
   */
  getMembersByServer = async (
    req: Request<{}, MembersListResponse, {}>,
    res: Response<MembersListResponse>,
    next: NextFunction
  ) => {
    try {
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
          message: "ServerId is required",
        });
      }

      const members = await membersService.getMembersByServer(serverId, userId);

      res.json({
        success: true,
        data: members,
      });
    } catch (error: any) {
      console.error("[MEMBERS_GET]", error);

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
}

export const membersController = new MembersController();
