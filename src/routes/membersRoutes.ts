import express from "express";
import { membersController } from "../controllers/membersController";
import { authenticateSocket } from "../middleware/auth";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateSocket);

// GET /api/members/current
router.get("/current", membersController.getCurrentMember);

// GET /api/members?serverId=:serverId
router.get("/", membersController.getMembersByServer);

// GET /api/members/:memberId
router.get("/:memberId", membersController.getMemberById);

// DELETE /api/members/:memberId?serverId=:serverId
router.delete("/:memberId", membersController.deleteMember);

// PATCH /api/members/:memberId?serverId=:serverId
router.patch("/:memberId", membersController.updateMemberRole);

export default router;
