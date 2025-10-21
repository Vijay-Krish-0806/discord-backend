import express from "express";
import { serversController } from "../controllers/serversController";
import { authenticateSocket } from "../middleware/auth";

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateSocket);

// GET /api/servers
router.get("/", serversController.getUserServers);

// POST /api/servers
router.post("/", serversController.createServer);

// POST /api/servers/join
router.post("/join", serversController.joinServer);

// GET /api/servers/:serverId
router.get("/:serverId", serversController.getServerById);

// DELETE /api/servers/:serverId
router.delete("/:serverId", serversController.deleteServer);

// PATCH /api/servers/:serverId
router.patch("/:serverId", serversController.updateServer);

// PATCH /api/servers/:serverId/invite-code
router.patch("/:serverId/invite-code", serversController.generateInviteCode);

// PATCH /api/servers/:serverId/leave
router.patch("/:serverId/leave", serversController.leaveServer);

export default router;
