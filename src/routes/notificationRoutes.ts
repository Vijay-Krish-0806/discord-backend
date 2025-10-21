import express from "express";
import {
  getUnreadNotificationCount,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification,
  getUserPresence,
  getUsersPresence,
} from "../controllers/notificationController";

const router = express.Router();

// ========== PRESENCE (ONLINE STATUS) ==========
// IMPORTANT: These must come BEFORE /:userId routes to avoid route conflicts

// Get online status for multiple users
router.get("/presence", getUsersPresence);

// Get online status for a single user
router.get("/presence/:userId", getUserPresence);

// ========== NOTIFICATIONS ==========

// Get unread notification count
router.get("/count/:userId", getUnreadNotificationCount);

// Get all notifications for a user
router.get("/:userId", getUserNotifications);

// Mark a single notification as read
router.patch("/:notificationId/read", markNotificationAsRead);

// Mark all notifications as read for a user
router.patch("/:userId/read-all", markAllNotificationsAsRead);

// Delete a notification
router.delete("/:notificationId", deleteNotification);

export default router;