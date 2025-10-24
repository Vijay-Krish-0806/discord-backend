// const onlineUsers = new Map<string, Set<string>>();

// export function setupSocketServer(io: any) {
//   io.on("connection", async (socket: any) => {
//     const userId = socket.data.userId;
//     const sessionId = socket.id;

//     console.log(`✅ User connected: ${userId} (Socket: ${sessionId})`);

//     if (userId) {
//       // Track this socket for the user
//       if (!onlineUsers.has(userId)) {
//         onlineUsers.set(userId, new Set());
//       }
//       onlineUsers.get(userId)!.add(sessionId);

//       // Only broadcast if this is their first connection
//       if (onlineUsers.get(userId)!.size === 1) {
//         // Use socket.broadcast.emit to NOT send to the connecting user
//         socket.broadcast.emit("userOnline", { userId, isOnline: true });
//         console.log(`📢 ${userId} is now online - broadcasting to others`);
//       }
//     }

//     socket.onAny((eventName: string, ...args: any[]) => {
//       // console.log(`📨 [${userId}] Event received: "${eventName}"`, args);
//     });

//     // ========== ROOM MANAGEMENT ==========
//     socket.on("joinRoom", (roomId: string) => {
//       socket.join(roomId);
//     });

//     socket.on("leaveRoom", (roomId: string) => {
//       socket.leave(roomId);
//     });

//     // ========== TYPING INDICATOR ==========
//     socket.on("startTyping", (roomId: string) => {
//       socket.to(roomId).emit("typing", {
//         userId: socket.data.userId,
//         username: socket.data.username,
//         roomId,
//       });
//     });

//     socket.on("userStoppedTyping", (data: { roomId: string }) => {
//       socket.to(data.roomId).emit("userStoppedTyping", { userId });
//     });

//     // ========== DISCONNECT ==========
//     socket.on("disconnect", async () => {
//       console.log(`❌ User disconnected: ${userId} (Socket: ${sessionId})`);

//       if (userId && onlineUsers.has(userId)) {
//         const userSockets = onlineUsers.get(userId)!;
//         userSockets.delete(sessionId);

//         // Only broadcast offline if no more connections
//         if (userSockets.size === 0) {
//           onlineUsers.delete(userId);
//           // Use io.emit here to broadcast to everyone
//           io.emit("userOffline", { userId, isOnline: false });
//           console.log(`📢 ${userId} is now offline - broadcasting to all`);
//         } else {
//           console.log(
//             `ℹ️ ${userId} still has ${userSockets.size} active connection(s)`
//           );
//         }
//       }
//     });
//   });

//   // Expose method to get online users
//   io.getOnlineUsers = () => {
//     const users = Array.from(onlineUsers.keys());
//     console.log("📋 Current online users:", users);
//     return users;
//   };
// }

const onlineUsers = new Map<string, Set<string>>();
const userActiveChannel = new Map<string, string>();

export function setupSocketServer(io: any) {
  io.on("connection", async (socket: any) => {
    // Extract userId from auth (sent from frontend)
    const userId = socket.handshake.auth.userId;
    const sessionId = socket.id;

    // Set userId in socket.data for easy access
    socket.data.userId = userId;

    console.log(`✅ User connected: ${userId} (Socket: ${sessionId})`);

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
        console.log(`📢 ${userId} is now online - broadcasting to others`);

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
    socket.on("joinRoom", (roomId: string) => {
      console.log("join-room", roomId, socket.data.userId);
      socket.join(roomId);
      userActiveChannel.set(socket.data.userId, roomId);
    });

    socket.on("leaveRoom", (roomId: string) => {
      console.log("leave-room", roomId, socket.data.userId);

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
      console.log(`❌ User disconnected: ${userId} (Socket: ${sessionId})`);

      if (userId && onlineUsers.has(userId)) {
        const userSockets = onlineUsers.get(userId)!;
        userSockets.delete(sessionId);

        // Only broadcast offline if no more connections
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Use io.emit here to broadcast to everyone
          io.emit("userOffline", { userId, isOnline: false });
          console.log(`📢 ${userId} is now offline - broadcasting to all`);
        } else {
          console.log(
            `ℹ️ ${userId} still has ${userSockets.size} active connection(s)`
          );
        }
      }
    });
  });

  // Expose method to get online users
  io.getOnlineUsers = () => {
    const users = Array.from(onlineUsers.keys());
    console.log("📋 Current online users:", users);
    return users;
  };
  io.onlineUsers = onlineUsers;

  io.userActiveChannels = userActiveChannel;
}
