// src/services/notifications.service.ts
import { db } from "../db/database";
import { notifications } from "../db/schema";
import { eq, and } from "drizzle-orm";

interface GetUserNotificationsParams {
  userId: string;
  limit: number;
  offset: number;
}

class NotificationsService {
  async getUnreadNotificationCount(userId: string) {
    const unreadNotifications = await db.query.notifications.findMany({
      where: (notifications, { eq, and }) =>
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    });

    return unreadNotifications.length;
  }

  async getUserNotifications(params: GetUserNotificationsParams) {
    const { userId, limit, offset } = params;

    const userNotifications = await db.query.notifications.findMany({
      where: (notifications, { eq }) => eq(notifications.userId, userId),
      with: {
        sender: true,
        channel: true,
      },
      orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
      limit,
      offset,
    });

    return userNotifications;
  }

  async markNotificationAsRead(notificationId: string) {
    const [updatedNotification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId))
      .returning();

    return updatedNotification;
  }

  async markAllNotificationsAsRead(userId: string) {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );
  }

  async deleteNotification(notificationId: string) {
    await db.delete(notifications).where(eq(notifications.id, notificationId));
  }
}

export const notificationsService = new NotificationsService();

/**
 * Create notifications for offline users when a message is sent
 * Used by messages controller
 */
// export async function createNotificationsForOfflineUsers(
//   channelId: string,
//   messageId: string,
//   senderId: string,
//   senderName: string,
//   content: string,
//   io: any
// ) {
//   try {
//     const channel = await db.query.channels.findFirst({
//       where: (channels, { eq }) => eq(channels.id, channelId),
//       with: {
//         server: {
//           with: {
//             members: {
//               with: {
//                 user: true,
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!channel) return;

//     const allMembers = channel.server.members;

//     // Get online statuses
//     const memberUserIds = allMembers.map((m) => m.userId);
//     const onlineStatuses = await db.query.userPresence.findMany({
//       where: (userPresence, { inArray }) =>
//         inArray(userPresence.userId, memberUserIds),
//     });

//     const onlineUserIds = onlineStatuses
//       .filter((status) => status.isOnline)
//       .map((status) => status.userId);

//     // Filter members NOT currently viewing this channel (offline + not in socket room)
//     const offlineMembers = allMembers.filter(
//       (member) =>
//         !onlineUserIds.includes(member.userId) && member.userId !== senderId
//     );

//     // Create notifications for offline members
//     if (offlineMembers.length > 0) {
//       const notificationValues = offlineMembers.map((member) => ({
//         userId: member.userId,
//         type: "CHANNEL_MESSAGE" as const,
//         title: `New message in #${channel.name}`,
//         message: `${senderName}: ${content.substring(0, 100)}${
//           content.length > 100 ? "..." : ""
//         }`,
//         channelId: channelId,
//         messageId: messageId,
//         senderId: senderId,
//         isRead: false,
//       }));

//       await db.insert(notifications).values(notificationValues);

//       // Emit real-time notification to recipients who are online
//       offlineMembers.forEach((member) => {
//         io.to(`user:${member.userId}`).emit("newNotification", {
//           userId: member.userId,
//           type: "CHANNEL_MESSAGE",
//           title: `New message in #${channel.name}`,
//           message: `${senderName}: ${content.substring(0, 100)}${
//             content.length > 100 ? "..." : ""
//           }`,
//           channelId: channelId,
//         });
//       });

//       console.log(
//         `🔔 Created ${notificationValues.length} notifications for offline users in #${channel.name}`
//       );
//     }
//   } catch (error) {
//     console.error("Error creating notifications:", error);
//   }
// }

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
    const onlineUsers: Array<string> = io.getOnlineUsers() || [];
    const onlineUsersMap: Map<string, Set<string>> = io.onlineUsers;
    const userActiveChannel: Map<string, string> =
      io.userActiveChannels || new Map();

    // Filter users who are NOT viewing this same channel
    const unseenUsers = allMembers.filter((member) => {
      const userId = member.userId;

      // Skip sender
      if (userId === senderId) return false;

      // If user is offline, notify
      if (!onlineUsers.includes(userId)) return true;

      // If user is online but in a different channel, notify
      const activeChannel = userActiveChannel.get(userId);
      return activeChannel !== channelId;
    });

    if (unseenUsers.length === 0) return;

    const notificationValues = unseenUsers.map((member) => ({
      userId: member.userId,
      type: "CHANNEL_MESSAGE" as const,
      title: `New message in #${channel.name}`,
      message: `${senderName}: ${content.substring(0, 100)}${
        content.length > 100 ? "..." : ""
      }`,
      channelId,
      messageId,
      senderId,
      isRead: false,
    }));

    await db.insert(notifications).values(notificationValues);

    // unseenUsers.forEach((member) => {
    //   console.log(member.userId);
    //   io.to(`${member.userId}`).emit("newNotification", {
    //     userId: member.userId,
    //     type: "CHANNEL_MESSAGE",
    //     title: `New message in #${channel.name}`,
    //     message: `${senderName}: ${content.substring(0, 100)}${
    //       content.length > 100 ? "..." : ""
    //     }`,
    //     channelId,
    //   });
    // });

    for (const member of unseenUsers) {
      const userSockets = onlineUsersMap.get(member.userId);
      if (userSockets && userSockets.size > 0) {
        for (const socketId of userSockets) {
          io.to(socketId).emit("newNotification", {
            userId: member.userId,
            type: "CHANNEL_MESSAGE",
            title: `New message in #${channel.name}`,
            message: `${senderName}: ${content.substring(0, 100)}${
              content.length > 100 ? "..." : ""
            }`,
            channelId,
            messageId,
            senderId,
          });
        }
      }
    }

    console.log(
      `🔔 Created ${notificationValues.length} notifications for unseen users in #${channel.name}`
    );
  } catch (error) {
    console.error("Error creating notifications:", error);
  }
}
