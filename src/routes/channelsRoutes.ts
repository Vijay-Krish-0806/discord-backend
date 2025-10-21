
import express from "express";
import { channelsController } from "../controllers/channelsController";
import { authenticateSocket } from "../middleware/auth";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateSocket);

// POST /api/channels?serverId=:serverId
router.post("/", channelsController.createChannel);

// GET /api/channels/:channelId
router.get("/:channelId", channelsController.getChannel);

// GET /api/channels?serverId=:serverId
router.get("/", channelsController.getChannelsByServer);

// DELETE /api/channels/:channelId?serverId=:serverId
router.delete("/:channelId", channelsController.deleteChannel);

// PATCH /api/channels/:channelId?serverId=:serverId
router.patch("/:channelId", channelsController.updateChannel);

export default router;
