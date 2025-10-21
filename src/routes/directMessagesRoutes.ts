import express from "express";
import { directMessagesController } from "../controllers/directMessagesController";
import { authenticateSocket } from "../middleware/auth";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateSocket);

// GET /api/direct-messages?conversationId=:conversationId&cursor=:cursor
router.get("/", directMessagesController.getDirectMessages);

// POST /api/direct-messages?conversationId=:conversationId
router.post("/", directMessagesController.createDirectMessage);

// GET /api/direct-messages/:messageId
router.get("/:messageId", directMessagesController.getDirectMessage);

// PATCH /api/direct-messages/:directMessageId?conversationId=:conversationId
router.patch("/:directMessageId", directMessagesController.updateDirectMessage);

// DELETE /api/direct-messages/:directMessageId?conversationId=:conversationId
router.delete(
  "/:directMessageId",
  directMessagesController.deleteDirectMessage
);

// POST /api/direct-messages/:directMessageId/reaction?conversationId=:conversationId
router.post(
  "/:directMessageId/reaction",
  directMessagesController.toggleDirectMessageReaction
);

export default router;
