// src/routes/messages.routes.ts
import express from "express";
import { messagesController } from "../controllers/messagesControllers";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/messages?channelId=xxx&cursor=xxx
router.get("/", messagesController.getMessages);

// POST /api/messages?channelId=xxx&serverId=xxx&profileId=xxx
router.post("/", messagesController.createMessage);

// PATCH /api/messages/:messageId?channelId=xxx&profileId=xxx
router.patch("/:messageId", messagesController.updateMessage);

// DELETE /api/messages/:messageId?channelId=xxx&profileId=xxx
router.delete("/:messageId", messagesController.deleteMessage);

// POST /api/messages/:messageId/reaction?channelId=xxx&profileId=xxx
router.post("/:messageId/reaction", messagesController.toggleReaction);

export default router;
