const onlineUsers = new Map<string, Set<string>>();
const userActiveChannel = new Map<string, string>();

export function setupSocketServer(io: any) {
  io.on("connection", async (socket: any) => {
    // Extract userId from auth (sent from frontend)
    const userId = socket.handshake.auth.userId;
    const sessionId = socket.id;

    // Set userId in socket.data for easy access
    socket.data.userId = userId;

    if (userId) {
      // Track this socket for the user
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId)!.add(sessionId);

      // Only broadcast if this is their first connection
      if (onlineUsers.get(userId)!.size === 1) {
        // Use socket.broadcast.emit to NOT send to the connecting user
        socket.broadcast.emit("userOnline", { userId, isOnline: true });

        // Also send current online users to the newly connected user
        const currentOnlineUsers = Array.from(onlineUsers.keys());
        socket.emit("onlineUsers", { users: currentOnlineUsers });
      }
    }

    // Listen for presence requests
    socket.on("requestOnlineUsers", () => {
      const currentOnlineUsers = Array.from(onlineUsers.keys());
      socket.emit("onlineUsers", { users: currentOnlineUsers });
    });

    socket.onAny((eventName: string, ...args: any[]) => {
      // console.log(`📨 [${userId}] Event received: "${eventName}"`, args);
    });

    // ========== ROOM MANAGEMENT ==========
    socket.on("joinRoom", async (roomId: string) => {
      socket.join(roomId);
      userActiveChannel.set(socket.data.userId, roomId);
    });

    socket.on("leaveRoom", (roomId: string) => {
      socket.leave(roomId);
      const current = userActiveChannel.get(socket.data.userId);
      if (current === roomId) userActiveChannel.delete(socket.data.userId);
    });

    // ========== TYPING INDICATOR ==========
    socket.on("startTyping", (roomId: string) => {
      socket.to(roomId).emit("typing", {
        userId: socket.data.userId,
        username: socket.data.username,
        roomId,
      });
    });

    socket.on("userStoppedTyping", (data: { roomId: string }) => {
      socket.to(data.roomId).emit("userStoppedTyping", { userId });
    });

    // ========== DISCONNECT ==========
    socket.on("disconnect", async () => {
      if (userId && onlineUsers.has(userId)) {
        const userSockets = onlineUsers.get(userId)!;
        userSockets.delete(sessionId);

        // Only broadcast offline if no more connections
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Use io.emit here to broadcast to everyone
          io.emit("userOffline", { userId, isOnline: false });
        }
      }
    });
  });

  // Expose method to get online users
  io.getOnlineUsers = () => {
    const users = Array.from(onlineUsers.keys());
    return users;
  };
  io.onlineUsers = onlineUsers;

  io.userActiveChannels = userActiveChannel;
}
