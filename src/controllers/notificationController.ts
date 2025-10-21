// src/controllers/notifications.controller.ts
import { Request, Response } from "express";
import { notificationsService } from "../services/notificationsService";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

class NotificationsController {
  async getUsersPresence(req: AuthRequest, res: Response) {
    try {
      console.log("🎯 getUsersPresence called");

      const { userIds } = req.query;
      console.log("📥 Query params:", req.query);

      if (!userIds || typeof userIds !== "string") {
        console.log("❌ Invalid userIds parameter");
        return res.status(400).json({ error: "userIds parameter is required" });
      }

      const userIdArray = userIds.split(",").filter((id) => id.trim() !== "");
      console.log("🔢 Parsed userIdArray:", userIdArray);

      const io = req.app.get("io");

      if (!io) {
        console.log("❌ Socket.io instance not found");
        return res.status(500).json({ error: "Socket.io not initialized" });
      }

      const onlineUsers = io.getOnlineUsers?.() || [];
      console.log("🟢 Online users:", onlineUsers);

      const presence: Record<string, { isOnline: boolean; lastSeen: null }> =
        {};

      userIdArray.forEach((userId: string) => {
        const isOnline = onlineUsers.includes(userId);
        presence[userId] = {
          isOnline,
          lastSeen: null,
        };
        console.log(`  - ${userId}: ${isOnline ? "🟢 online" : "⚫ offline"}`);
      });

      console.log("📤 Sending presence response:", presence);

      // Set headers to prevent caching
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      });

      return res.json(presence);
    } catch (error) {
      console.error("❌ Error getting users presence:", error);
      return res.status(500).json({ error: "Failed to get users presence" });
    }
  }

  async getUserPresence(req: AuthRequest, res: Response) {
    try {
      console.log("🎯 getUserPresence called");

      const { userId } = req.params;
      console.log("👤 userId:", userId);

      if (!userId) {
        return res.status(400).json({ error: "userId parameter is required" });
      }

      const io = req.app.get("io");

      if (!io) {
        return res.status(500).json({ error: "Socket.io not initialized" });
      }

      const onlineUsers = io.getOnlineUsers?.() || [];
      const isOnline = onlineUsers.includes(userId);

      console.log(`📤 ${userId} is ${isOnline ? "🟢 online" : "⚫ offline"}`);

      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
      });

      return res.json({
        isOnline,
        lastSeen: null,
      });
    } catch (error) {
      console.error("❌ Error getting user presence:", error);
      return res.status(500).json({ error: "Failed to get user presence" });
    }
  }

  async getUnreadNotificationCount(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      console.log("Get Unread Notifications count");

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const count = await notificationsService.getUnreadNotificationCount(
        userId
      );

      console.log("Get Unread Notifications count", count);

      return res.status(200).json({ count });
    } catch (error) {
      console.error("❌ Error getting unread notification count:", error);
      return res
        .status(500)
        .json({ error: "Failed to get notification count" });
    }
  }

  async getUserNotifications(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { limit = "20", offset = "0" } = req.query;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const notifications = await notificationsService.getUserNotifications({
        userId,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      return res.status(200).json(notifications);
    } catch (error) {
      console.error("❌ Error getting user notifications:", error);
      return res.status(500).json({ error: "Failed to get notifications" });
    }
  }

  async markNotificationAsRead(req: AuthRequest, res: Response) {
    try {
      const { notificationId } = req.params;

      if (!notificationId) {
        return res.status(400).json({ error: "Notification ID is required" });
      }

      const notification = await notificationsService.markNotificationAsRead(
        notificationId
      );

      return res.status(200).json(notification);
    } catch (error) {
      console.error("❌ Error marking notification as read:", error);
      return res
        .status(500)
        .json({ error: "Failed to mark notification as read" });
    }
  }

  async markAllNotificationsAsRead(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      await notificationsService.markAllNotificationsAsRead(userId);

      return res
        .status(200)
        .json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("❌ Error marking all notifications as read:", error);
      return res
        .status(500)
        .json({ error: "Failed to mark all notifications as read" });
    }
  }

  async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const { notificationId } = req.params;

      if (!notificationId) {
        return res.status(400).json({ error: "Notification ID is required" });
      }

      await notificationsService.deleteNotification(notificationId);

      return res
        .status(200)
        .json({ message: "Notification deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting notification:", error);
      return res.status(500).json({ error: "Failed to delete notification" });
    }
  }
}

export const notificationsController = new NotificationsController();

// Export helper function for creating notifications (used by messages controller)
export { createNotificationsForOfflineUsers } from "../services/notificationsService";
