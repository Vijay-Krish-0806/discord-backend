import express from "express";
import { messagesController } from "../controllers/messagesControllers";
import { authenticateSocket } from "../middleware/auth";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateSocket);

// GET /api/messages?channelId=:channelId&cursor=:cursor
router.get("/", messagesController.getMessages);

// POST /api/messages?channelId=:channelId&serverId=:serverId
router.post("/", messagesController.createMessage);

// GET /api/messages/:messageId
router.get("/:messageId", messagesController.getMessage);

// PATCH /api/messages/:messageId?channelId=:channelId
router.patch("/:messageId", messagesController.updateMessage);

// DELETE /api/messages/:messageId?channelId=:channelId
router.delete("/:messageId", messagesController.deleteMessage);

// POST /api/messages/:messageId/reaction?channelId=:channelId
router.post("/:messageId/reaction", messagesController.toggleReaction);

export default router;