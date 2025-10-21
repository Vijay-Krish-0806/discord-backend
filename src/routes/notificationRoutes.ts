// src/routes/notifications.routes.ts
import express from "express";
import { notificationsController } from "../controllers/notificationController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ========== PRESENCE (ONLINE STATUS) ==========
// IMPORTANT: These must come BEFORE /:userId routes to avoid route conflicts

// GET /api/notifications/presence?userIds=id1,id2,id3
router.get("/presence", notificationsController.getUsersPresence);

// GET /api/notifications/presence/:userId
router.get("/presence/:userId", notificationsController.getUserPresence);

// ========== NOTIFICATIONS ==========

// GET /api/notifications/count/:userId
router.get(
  "/count/:userId",
  notificationsController.getUnreadNotificationCount
);

// GET /api/notifications/:userId?limit=20&offset=0
router.get("/:userId", notificationsController.getUserNotifications);

// PATCH /api/notifications/:notificationId/read
router.patch(
  "/:notificationId/read",
  notificationsController.markNotificationAsRead
);

// PATCH /api/notifications/:userId/read-all
router.patch(
  "/:userId/read-all",
  notificationsController.markAllNotificationsAsRead
);

// DELETE /api/notifications/:notificationId
router.delete("/:notificationId", notificationsController.deleteNotification);

export default router;
