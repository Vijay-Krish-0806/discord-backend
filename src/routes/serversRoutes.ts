// src/routes/servers.routes.ts
import express from "express";
import { serversController } from "../controllers/serversController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/servers
router.post("/", serversController.createServer);

// DELETE /api/servers/:serverId
router.delete("/:serverId", serversController.deleteServer);

// PATCH /api/servers/:serverId
router.patch("/:serverId", serversController.updateServer);

// PATCH /api/servers/:serverId/invite-code
router.patch("/:serverId/invite-code", serversController.regenerateInviteCode);

// PATCH /api/servers/:serverId/leave
router.patch("/:serverId/leave", serversController.leaveServer);

export default router;
