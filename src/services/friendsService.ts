// src/services/friends.service.ts
import { db } from "../db/database";
import { friendRequests, users } from "../db/schema";
import { eq, and, or } from "drizzle-orm";

class FriendsService {
  async searchUsers(query: string, userId: string) {
    // Search users by username (not case-sensitive)
    const searchResults = await db.query.users.findMany({
      where: (users, { ilike, and, ne }) =>
        and(ilike(users.name, `%${query}%`), ne(users.id, userId)),
      limit: 10,
    });

    // Get friend request status for each result
    const enrichedResults = await Promise.all(
      searchResults.map(async (user) => {
        const existingRequest = await db.query.friendRequests.findFirst({
          where: (friendRequests, { eq, and, or }) =>
            or(
              and(
                eq(friendRequests.senderId, userId),
                eq(friendRequests.recipientId, user.id)
              ),
              and(
                eq(friendRequests.senderId, user.id),
                eq(friendRequests.recipientId, userId)
              )
            ),
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          requestStatus: existingRequest?.status || null,
          requestId: existingRequest?.id || null,
          isRequestSender: existingRequest?.senderId === userId || false,
        };
      })
    );

    return enrichedResults;
  }

  async sendFriendRequest(senderId: string, recipientId: string) {
    // Check if both users exist
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, senderId));

    const [recipient] = await db
      .select()
      .from(users)
      .where(eq(users.id, recipientId));

    if (!sender || !recipient) {
      throw new Error("One or both users not found");
    }

    // Check if request already exists
    const existingRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq, and, or }) =>
        or(
          and(
            eq(friendRequests.senderId, senderId),
            eq(friendRequests.recipientId, recipientId)
          ),
          and(
            eq(friendRequests.senderId, recipientId),
            eq(friendRequests.recipientId, senderId)
          )
        ),
    });

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        throw new Error("Friend request already pending");
      }
      if (existingRequest.status === "ACCEPTED") {
        throw new Error("Already friends");
      }
      // If rejected, allow re-sending
    }

    // Create friend request
    const [newRequest] = await db
      .insert(friendRequests)
      .values({
        senderId,
        recipientId,
        status: "PENDING",
      })
      .returning();

    return { request: newRequest, sender };
  }

  async getPendingRequests(userId: string) {
    const pendingRequests = await db.query.friendRequests.findMany({
      where: (friendRequests, { eq, and }) =>
        and(
          eq(friendRequests.recipientId, userId),
          eq(friendRequests.status, "PENDING")
        ),
      with: {
        sender: true,
      },
      orderBy: (friendRequests, { desc }) => [desc(friendRequests.createdAt)],
    });

    return pendingRequests;
  }

  async acceptFriendRequest(requestId: string, userId: string) {
    const friendRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq }) => eq(friendRequests.id, requestId),
      with: {
        sender: true,
        recipient: true,
      },
    });

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    if (friendRequest.recipientId !== userId) {
      throw new Error("Unauthorized: Only recipient can accept request");
    }

    if (friendRequest.status !== "PENDING") {
      throw new Error(
        `Request is already ${friendRequest.status.toLowerCase()}`
      );
    }

    // Update request status
    const [updatedRequest] = await db
      .update(friendRequests)
      .set({
        status: "ACCEPTED",
        updatedAt: new Date(),
      })
      .where(eq(friendRequests.id, requestId))
      .returning();

    return {
      request: updatedRequest,
      recipient: friendRequest.recipient,
      senderId: friendRequest.senderId,
      recipientId: friendRequest.recipientId,
    };
  }

  async rejectFriendRequest(requestId: string, userId: string) {
    const friendRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq }) => eq(friendRequests.id, requestId),
    });

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    if (friendRequest.recipientId !== userId) {
      throw new Error("Unauthorized: Only recipient can reject request");
    }

    if (friendRequest.status !== "PENDING") {
      throw new Error(
        `Request is already ${friendRequest.status.toLowerCase()}`
      );
    }

    // Update request status
    const [updatedRequest] = await db
      .update(friendRequests)
      .set({
        status: "REJECTED",
        rejectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(friendRequests.id, requestId))
      .returning();

    return updatedRequest;
  }

  async cancelFriendRequest(requestId: string, userId: string) {
    const friendRequest = await db.query.friendRequests.findFirst({
      where: (friendRequests, { eq }) => eq(friendRequests.id, requestId),
    });

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    if (friendRequest.senderId !== userId) {
      throw new Error("Unauthorized: Only sender can cancel request");
    }

    if (friendRequest.status !== "PENDING") {
      throw new Error("Can only cancel pending requests");
    }

    // Delete the request
    await db.delete(friendRequests).where(eq(friendRequests.id, requestId));
  }

  async getFriendsList(userId: string) {
    const acceptedRequests = await db.query.friendRequests.findMany({
      where: (friendRequests, { eq, and, or }) =>
        and(
          or(
            eq(friendRequests.senderId, userId),
            eq(friendRequests.recipientId, userId)
          ),
          eq(friendRequests.status, "ACCEPTED")
        ),
      with: {
        sender: true,
        recipient: true,
      },
    });

    // Extract friend details
    const friends = acceptedRequests.map((request) =>
      request.senderId === userId ? request.recipient : request.sender
    );

    return friends;
  }
}

export const friendsService = new FriendsService();
