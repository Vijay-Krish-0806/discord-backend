// src/routes/friends.routes.ts
import express from "express";
import { friendsController } from "../controllers/friendControllers";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/friends/search
router.post("/search", friendsController.searchUsers);

// POST /api/friends/requests
router.post("/requests", friendsController.sendFriendRequest);

// GET /api/friends/requests/pending/:userId
router.get("/requests/pending/:userId", friendsController.getPendingRequests);

// PATCH /api/friends/requests/:requestId/accept
router.patch(
  "/requests/:requestId/accept",
  friendsController.acceptFriendRequest
);

// PATCH /api/friends/requests/:requestId/reject
router.patch(
  "/requests/:requestId/reject",
  friendsController.rejectFriendRequest
);

// DELETE /api/friends/requests/:requestId
router.delete("/requests/:requestId", friendsController.cancelFriendRequest);

// GET /api/friends/list/:userId
router.get("/list/:userId", friendsController.getFriendsList);

export default router;
