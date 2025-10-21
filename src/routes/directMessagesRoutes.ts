// src/routes/directMessages.routes.ts
import express from "express";
import { directMessagesController } from "../controllers/directMessagesController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/direct-messages?conversationId=xxx&cursor=xxx
router.get("/", directMessagesController.getDirectMessages);

// POST /api/direct-messages?conversationId=xxx&profileId=xxx
router.post("/", directMessagesController.createDirectMessage);

// PATCH /api/direct-messages/:directMessageId?conversationId=xxx&profileId=xxx
router.patch("/:directMessageId", directMessagesController.updateDirectMessage);

// DELETE /api/direct-messages/:directMessageId?conversationId=xxx&profileId=xxx
router.delete(
  "/:directMessageId",
  directMessagesController.deleteDirectMessage
);

// POST /api/direct-messages/:directMessageId/reaction?conversationId=xxx&profileId=xxx
router.post(
  "/:directMessageId/reaction",
  directMessagesController.toggleDirectMessageReaction
);

export default router;
