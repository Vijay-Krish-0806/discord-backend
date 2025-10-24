// src/routes/members.routes.ts
import express from "express";
import { membersController } from "../controllers/membersController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/members/current
router.get("/current", membersController.getCurrentMember);

// DELETE /api/members/:memberId?serverId=xxx
router.delete("/:memberId", membersController.deleteMember);

// PATCH /api/members/:memberId?serverId=xxx
router.patch("/:memberId", membersController.updateMemberRole);

export default router;