// src/controllers/members.controller.ts
import { Request, Response } from "express";
import { membersService } from "../services/membersServices";
import { MemberRole } from "../db/schema";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

class MembersController {
  async getCurrentMember(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const member = await membersService.getCurrentMember(userId);

      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }

      return res.status(200).json({ memberId: member.id });
    } catch (error) {
      console.error("[GET Current Member]", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteMember(req: AuthRequest, res: Response) {
    try {
      const { memberId } = req.params;
      const { serverId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!serverId || typeof serverId !== "string") {
        return res.status(400).json({ error: "ServerId missing" });
      }

      if (!memberId) {
        return res.status(400).json({ error: "MemberId missing" });
      }

      const server = await membersService.deleteMember({
        memberId,
        serverId,
        currentUserId: userId,
      });

      return res.status(200).json(server);
    } catch (error) {
      console.error("[DELETE Member]", error);

      if (error instanceof Error) {
        if (error.message.includes("Cannot delete yourself")) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateMemberRole(req: AuthRequest, res: Response) {
    try {
      const { memberId } = req.params;
      const { role } = req.body as { role: MemberRole };
      const { serverId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!serverId || typeof serverId !== "string") {
        return res.status(400).json({ error: "ServerId missing" });
      }

      if (!memberId) {
        return res.status(400).json({ error: "MemberId missing" });
      }

      if (!role) {
        return res.status(400).json({ error: "Role missing" });
      }

      const server = await membersService.updateMemberRole({
        memberId,
        serverId,
        role,
        currentUserId: userId,
      });

      return res.status(200).json(server);
    } catch (error) {
      console.error("[PATCH Member Role]", error);

      if (error instanceof Error) {
        if (error.message.includes("Cannot update your own role")) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Internal server error" });
    }
  }
}

export const membersController = new MembersController();
