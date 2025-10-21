import { config } from "dotenv";
config({ path: ".env" });

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { connectToDB } from "./db/database";
import { attachUserFromSocket, authenticateSocket } from "./middleware/auth";
import { setupSocketServer } from "./socket-server";

// Import all routes
import messageRoutes from "./routes/messagesRoutes";
import directMessagesRoutes from "./routes/directMessagesRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import friendRoutes from "./routes/friendRoutes";
import channelsRoutes from "./routes/channelsRoutes";
import membersRoutes from "./routes/membersRoutes";
import serversRoutes from "./routes/serversRoutes";

const app = express();
const httpServer = createServer(app);

// Enhanced CORS for Express
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

// Security middleware
app.use(helmet());

// Socket.IO CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
  },
  addTrailingSlash: false,
});

app.set("io", io);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
io.use(authenticateSocket);

// Health check endpoint
app.get("/health", async (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    socketConnections: io.engine.clientsCount,
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// API Routes
app.use("/api/messages", messageRoutes);
app.use("/api/direct-messages", directMessagesRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/channels", channelsRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/servers", serversRoutes);

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({
      success: false,
      message: "API route not found",
    });
  } else {
    next();
  }
});

// Global error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Global error handler:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);

// Setup Socket.IO server
setupSocketServer(io);

async function startServer() {
  try {
    const isDBConnected = await connectToDB();

    if (!isDBConnected) {
      console.error("❌ Failed to connect to database. Exiting...");
      process.exit(1);
    }

    const PORT = process.env.PORT || 4000;

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 Socket.IO server ready`);
      console.log(
        `🌍 CORS origin: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
      );
    });
  } catch (error) {
    console.error("❌ Server startup error:", error);
    process.exit(1);
  }
}

startServer();
