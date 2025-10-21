import { Request, Response } from "express";
import { db } from "../db/database";
import { friendRequests, users, conversations, members } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Search users by username
 */
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    const { userId } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (query.length < 2) {
      return res
        .status(400)
        .json({ error: "Search query must be at least 2 characters" });
    }

    // Search users by username (not case-sensitive)
    const searchResults = await db.query.users.findMany({
      where: (users, { ilike, and, ne }) =>
        and(ilike(users.name, `%${query}%`), ne(users.id, userId)),
      limit: 10,
    });

    // Get friend request status for each result
    const enrichedResults = await Promise.all(
      searchResults.map(async (user) => {
        const existingRequest = await db.query.friendRequests.findFirst({
          where: (friendRequests, { eq, and, or }) =>
            or(
              and(
                eq(friendRequests.senderId, userId),
                eq(friendRequests.recipientId, user.id)
              ),
              and(
                eq(friendRequests.senderId, user.id),
                eq(friendRequests.recipientId, userId)
              )
            ),
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          requestStatus: existingRequest?.status || null,
          requestId: existingRequest?.id || null,
          isRequestSender: existingRequest?.senderId === userId || false,
        };
      })
    );

    res.status(200).json(enrichedResults);
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ error: "Failed to search users" });
  }
};

/**
 * Send friend request
 */
export const sendFriendRequest = async (req: Request, res: Response) => {
  try {
    const { senderId, recipientId } = req.body;

    if (!senderId || !recipientId) {
      return res.status(400).json({
        error: "Sender ID and Recipient ID are required",
      });
    }

    if (senderId === recipientId) {
      return res
        .status(400)
        .json({ error: "Cannot send friend request to yourself" });
    }

    // Check if both users exist
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, senderId));

    const [recipient] = await db
      .select()
      .from(users)
      .where(eq(users.id, recipientId));

    if (!sender || !recipient) {
      return res.status(404).json({ error: "One or both users not found" });
    }

    // Check if request already exists
    const existingRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq, and, or }) =>
        or(
          and(
            eq(friendRequests.senderId, senderId),
            eq(friendRequests.recipientId, recipientId)
          ),
          and(
            eq(friendRequests.senderId, recipientId),
            eq(friendRequests.recipientId, senderId)
          )
        ),
    });

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        return res.status(400).json({
          error: "Friend request already pending",
        });
      }
      if (existingRequest.status === "ACCEPTED") {
        return res.status(400).json({
          error: "Already friends",
        });
      }
      // If rejected, allow re-sending
    }

    // Create friend request
    const [newRequest] = await db
      .insert(friendRequests)
      .values({
        senderId,
        recipientId,
        status: "PENDING",
      })
      .returning();

    // Emit notification via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${recipientId}`).emit("friendRequestReceived", {
        requestId: newRequest.id,
        sender: {
          id: sender.id,
          name: sender.name,
          imageUrl: sender.imageUrl,
        },
        createdAt: newRequest.createdAt,
      });
    }

    res.status(201).json({
      success: true,
      message: "Friend request sent",
      request: newRequest,
    });
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).json({ error: "Failed to send friend request" });
  }
};

/**
 * Get pending friend requests for a user
 */
export const getPendingRequests = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const pendingRequests = await db.query.friendRequests.findMany({
      where: (friendRequests, { eq, and }) =>
        and(
          eq(friendRequests.recipientId, userId),
          eq(friendRequests.status, "PENDING")
        ),
      with: {
        sender: true,
      },
      orderBy: (friendRequests, { desc }) => [desc(friendRequests.createdAt)],
    });
    res.status(200).json(pendingRequests);
  } catch (error) {
    console.error("Error getting pending requests:", error);
    res.status(500).json({ error: "Failed to get pending requests" });
  }
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (req: Request, res: Response) => {
  try {
    console.log("Accept");
    const { requestId } = req.params;
    const { userId } = req.body;

    console.log(requestId, userId);

    if (!requestId || !userId) {
      return res.status(400).json({
        error: "Request ID and User ID are required",
      });
    }

    const friendRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq }) => eq(friendRequests.id, requestId),
      with: {
        sender: true,
        recipient: true,
      },
    });

    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (friendRequest.recipientId !== userId) {
      return res.status(403).json({
        error: "Unauthorized: Only recipient can accept request",
      });
    }

    if (friendRequest.status !== "PENDING") {
      return res.status(400).json({
        error: `Request is already ${friendRequest.status.toLowerCase()}`,
      });
    }

    // Update request status
    const [updatedRequest] = await db
      .update(friendRequests)
      .set({
        status: "ACCEPTED",
        updatedAt: new Date(),
      })
      .where(eq(friendRequests.id, requestId))
      .returning();

    // Emit notification via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${friendRequest.senderId}`).emit("friendRequestAccepted", {
        requestId: updatedRequest.id,
        recipient: {
          id: friendRequest.recipient.id,
          name: friendRequest.recipient.name,
          imageUrl: friendRequest.recipient.imageUrl,
        },
        senderId: friendRequest.senderId,
        recipientId: friendRequest.recipientId,
      });
    }

    res.status(200).json({
      success: true,
      message: "Friend request accepted",
      request: updatedRequest,
      senderId: friendRequest.senderId,
      recipientId: friendRequest.recipientId,
    });
  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).json({ error: "Failed to accept friend request" });
  }
};

/**
 * Reject friend request
 */
export const rejectFriendRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body;

    if (!requestId || !userId) {
      return res.status(400).json({
        error: "Request ID and User ID are required",
      });
    }

    const friendRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq }) => eq(friendRequests.id, requestId),
    });

    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (friendRequest.recipientId !== userId) {
      return res.status(403).json({
        error: "Unauthorized: Only recipient can reject request",
      });
    }

    if (friendRequest.status !== "PENDING") {
      return res.status(400).json({
        error: `Request is already ${friendRequest.status.toLowerCase()}`,
      });
    }

    // Update request status
    const [updatedRequest] = await db
      .update(friendRequests)
      .set({
        status: "REJECTED",
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(friendRequests.id, requestId))
      .returning();

    res.status(200).json({
      success: true,
      message: "Friend request rejected",
      request: updatedRequest,
    });
  } catch (error) {
    console.error("Error rejecting friend request:", error);
    res.status(500).json({ error: "Failed to reject friend request" });
  }
};

/**
 * Get friends list
 */
export const getFriendsList = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const acceptedRequests = await db.query.friendRequests.findMany({
      where: (friendRequests, { eq, and, or }) =>
        and(
          or(
            eq(friendRequests.senderId, userId),
            eq(friendRequests.recipientId, userId)
          ),
          eq(friendRequests.status, "ACCEPTED")
        ),
      with: {
        sender: true,
        recipient: true,
      },
    });

    // Extract friend details
    const friends = acceptedRequests.map((request) =>
      request.senderId === userId ? request.recipient : request.sender
    );

    res.status(200).json(friends);
  } catch (error) {
    console.error("Error getting friends list:", error);
    res.status(500).json({ error: "Failed to get friends list" });
  }
};

/**
 * Cancel/Delete friend request (only sender can cancel pending)
 */
export const cancelFriendRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body;

    if (!requestId || !userId) {
      return res.status(400).json({
        error: "Request ID and User ID are required",
      });
    }

    const friendRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq }) => eq(friendRequests.id, requestId),
    });

    if (!friendRequest) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (friendRequest.senderId !== userId) {
      return res.status(403).json({
        error: "Unauthorized: Only sender can cancel request",
      });
    }

    if (friendRequest.status !== "PENDING") {
      return res.status(400).json({
        error: "Can only cancel pending requests",
      });
    }

    // Delete the request
    await db.delete(friendRequests).where(eq(friendRequests.id, requestId));

    res.status(200).json({
      success: true,
      message: "Friend request cancelled",
    });
  } catch (error) {
    console.error("Error cancelling friend request:", error);
    res.status(500).json({ error: "Failed to cancel friend request" });
  }
};
