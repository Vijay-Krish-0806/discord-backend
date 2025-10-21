// ============================================
// FILE: routes/friendRoutes.ts (NEW)
// ============================================

import express from "express";
import {
  searchUsers,
  sendFriendRequest,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendsList,
  cancelFriendRequest,
} from "../controllers/friendControllers";

const router = express.Router();

// Search for users
router.post("/search", searchUsers);

// Send friend request
router.post("/requests", sendFriendRequest);

// Get pending friend requests for user
router.get("/requests/pending/:userId", getPendingRequests);

// Accept friend request
router.patch("/requests/:requestId/accept", acceptFriendRequest);

// Reject friend request
router.patch("/requests/:requestId/reject", rejectFriendRequest);

// Cancel outgoing friend request
router.delete("/requests/:requestId", cancelFriendRequest);

// Get friends list
router.get("/list/:userId", getFriendsList);

export default router;



