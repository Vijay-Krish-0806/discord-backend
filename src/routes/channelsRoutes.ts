// src/routes/channel.routes.ts
import { Router } from "express";
import { channelController } from "../controllers/channelController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// DELETE /api/channels/:channelId?serverId=xxx
router.delete("/:channelId", channelController.deleteChannel);

// PATCH /api/channels/:channelId?serverId=xxx
router.patch("/:channelId", channelController.updateChannel);

export default router;
