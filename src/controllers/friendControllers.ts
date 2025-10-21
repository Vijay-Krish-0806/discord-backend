// src/controllers/friends.controller.ts
import { Request, Response } from "express";
import { friendsService } from "../services/friendsService";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

class FriendsController {
  async searchUsers(req: AuthRequest, res: Response) {
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

      const results = await friendsService.searchUsers(query, userId);

      return res.status(200).json(results);
    } catch (error) {
      console.error("Error searching users:", error);
      return res.status(500).json({ error: "Failed to search users" });
    }
  }

  async sendFriendRequest(req: AuthRequest, res: Response) {
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

      const result = await friendsService.sendFriendRequest(
        senderId,
        recipientId
      );

      // Emit notification via Socket.IO
      const io = req.app.get("io");
      if (io && result.sender) {
        io.to(`user:${recipientId}`).emit("friendRequestReceived", {
          requestId: result.request.id,
          sender: {
            id: result.sender.id,
            name: result.sender.name,
            imageUrl: result.sender.imageUrl,
          },
          createdAt: result.request.createdAt,
        });
      }

      return res.status(201).json({
        success: true,
        message: "Friend request sent",
        request: result.request,
      });
    } catch (error) {
      console.error("Error sending friend request:", error);

      if (error instanceof Error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("already") ||
          error.message.includes("friends")
        ) {
          return res.status(400).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to send friend request" });
    }
  }

  async getPendingRequests(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const requests = await friendsService.getPendingRequests(userId);

      return res.status(200).json(requests);
    } catch (error) {
      console.error("Error getting pending requests:", error);
      return res.status(500).json({ error: "Failed to get pending requests" });
    }
  }

  async acceptFriendRequest(req: AuthRequest, res: Response) {
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

      const result = await friendsService.acceptFriendRequest(
        requestId,
        userId
      );

      // Emit notification via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.to(`user:${result.senderId}`).emit("friendRequestAccepted", {
          requestId: result.request.id,
          recipient: {
            id: result.recipient.id,
            name: result.recipient.name,
            imageUrl: result.recipient.imageUrl,
          },
          senderId: result.senderId,
          recipientId: result.recipientId,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Friend request accepted",
        request: result.request,
        senderId: result.senderId,
        recipientId: result.recipientId,
      });
    } catch (error) {
      console.error("Error accepting friend request:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("already")
        ) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to accept friend request" });
    }
  }

  async rejectFriendRequest(req: AuthRequest, res: Response) {
    try {
      const { requestId } = req.params;
      const { userId } = req.body;

      if (!requestId || !userId) {
        return res.status(400).json({
          error: "Request ID and User ID are required",
        });
      }

      const request = await friendsService.rejectFriendRequest(
        requestId,
        userId
      );

      return res.status(200).json({
        success: true,
        message: "Friend request rejected",
        request,
      });
    } catch (error) {
      console.error("Error rejecting friend request:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("already")
        ) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to reject friend request" });
    }
  }

  async cancelFriendRequest(req: AuthRequest, res: Response) {
    try {
      const { requestId } = req.params;
      const { userId } = req.body;

      if (!requestId || !userId) {
        return res.status(400).json({
          error: "Request ID and User ID are required",
        });
      }

      await friendsService.cancelFriendRequest(requestId, userId);

      return res.status(200).json({
        success: true,
        message: "Friend request cancelled",
      });
    } catch (error) {
      console.error("Error cancelling friend request:", error);

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (
          error.message.includes("Unauthorized") ||
          error.message.includes("only")
        ) {
          return res.status(403).json({ error: error.message });
        }
      }

      return res.status(500).json({ error: "Failed to cancel friend request" });
    }
  }

  async getFriendsList(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const friends = await friendsService.getFriendsList(userId);

      return res.status(200).json(friends);
    } catch (error) {
      console.error("Error getting friends list:", error);
      return res.status(500).json({ error: "Failed to get friends list" });
    }
  }
}

export const friendsController = new FriendsController();
