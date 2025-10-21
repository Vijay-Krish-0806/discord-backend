import { Request, Response } from "express";
import { db } from "../db/database";
import { notifications } from "../db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Create notifications for offline users when a message is sent
 */
export async function createNotificationsForOfflineUsers(
  channelId: string,
  messageId: string,
  senderId: string,
  senderName: string,
  content: string,
  io: any
) {
  try {
    const channel = await db.query.channels.findFirst({
      where: (channels, { eq }) => eq(channels.id, channelId),
      with: {
        server: {
          with: {
            members: {
              with: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!channel) return;

    const allMembers = channel.server.members;

    // Get online statuses
    const memberUserIds = allMembers.map((m) => m.userId);
    const onlineStatuses = await db.query.userPresence.findMany({
      where: (userPresence, { inArray }) =>
        inArray(userPresence.userId, memberUserIds),
    });

    const onlineUserIds = onlineStatuses
      .filter((status) => status.isOnline)
      .map((status) => status.userId);

    // Filter members NOT currently viewing this channel (offline + not in socket room)
    const offlineMembers = allMembers.filter(
      (member) =>
        !onlineUserIds.includes(member.userId) && member.userId !== senderId
    );

    // Create notifications for offline members
    if (offlineMembers.length > 0) {
      const notificationValues = offlineMembers.map((member) => ({
        userId: member.userId,
        type: "CHANNEL_MESSAGE" as const,
        title: `New message in #${channel.name}`,
        message: `${senderName}: ${content.substring(0, 100)}${
          content.length > 100 ? "..." : ""
        }`,
        channelId: channelId,
        messageId: messageId,
        senderId: senderId,
        isRead: false,
      }));

      await db.insert(notifications).values(notificationValues);

      // Emit real-time notification to recipients who are online
      offlineMembers.forEach((member) => {
        io.to(`user:${member.userId}`).emit("newNotification", {
          userId: member.userId,
          type: "CHANNEL_MESSAGE",
          title: `New message in #${channel.name}`,
          message: `${senderName}: ${content.substring(0, 100)}${
            content.length > 100 ? "..." : ""
          }`,
          channelId: channelId,
        });
      });

      console.log(
        `🔔 Created ${notificationValues.length} notifications for offline users in #${channel.name}`
      );
    }
  } catch (error) {
    console.error("Error creating notifications:", error);
  }
}

/**
 * Get unread notification count for a user
 */
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = req.params;
    console.log("Get Unread Notifications count");

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const unreadNotifications = await db.query.notifications.findMany({
      where: (notifications, { eq, and }) =>
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    });
    console.log("Get Unread Notifications count", unreadNotifications.length);

    res.status(200).json({ count: unreadNotifications.length });
  } catch (error) {
    console.error("❌ Error getting unread notification count:", error);
    res.status(500).json({ error: "Failed to get notification count" });
  }
};

/**
 * Get all notifications for a user with pagination
 */
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = "20", offset = "0" } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const userNotifications = await db.query.notifications.findMany({
      where: (notifications, { eq }) => eq(notifications.userId, userId),
      with: {
        sender: true,
        channel: true,
      },
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.status(200).json(userNotifications);
  } catch (error) {
    console.error("❌ Error getting user notifications:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({ error: "Notification ID is required" });
    }

    const [updatedNotification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning();

    res.status(200).json(updatedNotification);
  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("❌ Error marking all notifications as read:", error);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
};

//   try {

//     const { userId } = req.params;
//     console.log("get user presence", userId);

//     if (!userId) {
//       return res.status(400).json({ error: "User ID is required" });
//     }

//     const presence = await db.query.userPresence.findFirst({
//       where: (userPresence, { eq }) => eq(userPresence.userId, userId),
//     });
//     console.log("get user presence", presence);

//     if (!presence) {
//       return res.status(200).json({
//         isOnline: false,
//         lastSeen: null,
//       });
//     }

//     res.status(200).json({
//       isOnline: presence.isOnline,
//       lastSeen: presence.lastSeen?.toISOString(),
//     });
//   } catch (error) {
//     console.error("❌ Error getting user presence:", error);
//     res.status(500).json({ error: "Failed to get user presence" });
//   }
// };

// /**
//  * Get presence for multiple users
//  */
// export const getUsersPresence = async (req: Request, res: Response) => {
//   // try {
//   //   const { userIds } = req.query;

//   //   if (!userIds) {
//   //     return res.status(400).json({ error: "User IDs are required" });
//   //   }

//   //   const userIdArray = (userIds as string).split(",");

//   //   const presenceStatuses = await db.query.userPresence.findMany({
//   //     where: (userPresence, { inArray }) =>
//   //       inArray(userPresence.userId, userIdArray),
//   //   });

//   //   // Create map for easy lookup
//   //   const presenceMap = userIdArray.reduce((acc, userId) => {
//   //     const presence = presenceStatuses.find((p) => p.userId === userId);
//   //     acc[userId] = {
//   //       isOnline: presence?.isOnline || false,
//   //       lastSeen: presence?.lastSeen?.toISOString() || null,
//   //     };
//   //     return acc;
//   //   }, {} as Record<string, { isOnline: boolean; lastSeen: string | null }>);

//   //   res.status(200).json(presenceMap);
//   // } catch (error) {
//   //   console.error("❌ Error getting users presence:", error);
//   //   res.status(500).json({ error: "Failed to get users presence" });
//   // }

//   console.log("getUsersPresnece");
//   const { userIds } = req.query;
//   console.log("userIds", userIds);
//   const userIdArray = (userIds as string).split(",");
//   const io = req.app.get("io");
//   const onlineUsers = io.getOnlineUsers?.() || [];
//   console.log(onlineUsers);

//   const presence: Record<string, { isOnline: boolean; lastSeen: null }> = {};
//   userIdArray.forEach((userId: string) => {
//     presence[userId] = {
//       isOnline: onlineUsers.includes(userId),
//       lastSeen: null, // We don't track lastSeen in memory
//     };
//   });

//   res.json(presence);
// };

export const getUsersPresence = async (req: Request, res: Response) => {
  console.log("🎯 getUsersPresence called");

  const { userIds } = req.query;
  console.log("📥 Query params:", req.query);
  console.log("👥 userIds:", userIds);

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

  const presence: Record<string, { isOnline: boolean; lastSeen: null }> = {};

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

  res.json(presence);
};

export const getUserPresence = async (req: Request, res: Response) => {
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

  res.json({
    isOnline,
    lastSeen: null,
  });
};

/**
 * Delete a notification
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    if (!notificationId) {
      return res.status(400).json({ error: "Notification ID is required" });
    }

    await db.delete(notifications).where(eq(notifications.id, notificationId));

    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
};
