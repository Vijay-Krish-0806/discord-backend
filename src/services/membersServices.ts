import { eq, and, ne } from "drizzle-orm";

import {
  members,
  type Member,
  type MemberRole,
  type Server,
  type User,
  type Channel,
} from "../db/schema";
import { db } from "../db/database";

export class MembersService {
  /**
   * Delete a member from server (cannot delete yourself)
   */
  async deleteMember(
    memberId: string,
    serverId: string,
    currentUserId: string
  ): Promise<
    Server & {
      members: (Member & {
        user: User;
      })[];
      channels: Channel[];
    }
  > {
    if (!serverId) {
      throw new Error("ServerId missing");
    }
    if (!memberId) {
      throw new Error("MemberID missing");
    }

    // Delete the member (cannot delete yourself)
    await db
      .delete(members)
      .where(
        and(
          eq(members.id, memberId),
          eq(members.serverId, serverId),
          ne(members.userId, currentUserId)
        )
      );

    // Get the updated server
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, serverId),
      with: {
        members: {
          with: {
            user: true,
          },
          orderBy: (members, { asc }) => [asc(members.role)],
        },
        channels: true,
      },
    });

    if (!server) {
      throw new Error("Server not found after deletion");
    }

    return server;
  }

  /**
   * Update member role (cannot change your own role)
   */
  async updateMemberRole(
    memberId: string,
    serverId: string,
    role: MemberRole,
    currentUserId: string
  ): Promise<
    Server & {
      members: (Member & {
        user: User;
      })[];
      channels: Channel[];
    }
  > {
    if (!serverId) {
      throw new Error("ServerId missing");
    }
    if (!memberId) {
      throw new Error("MemberID missing");
    }

    // Update the member role (cannot change your own role)
    await db
      .update(members)
      .set({
        role: role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(members.id, memberId),
          eq(members.serverId, serverId),
          ne(members.userId, currentUserId)
        )
      );

    // Get the updated server
    const server = await db.query.servers.findFirst({
      where: (servers, { eq }) => eq(servers.id, serverId),
      with: {
        members: {
          with: {
            user: true,
          },
          orderBy: (members, { asc }) => [asc(members.role)],
        },
        channels: true,
      },
    });

    if (!server) {
      throw new Error("Server not found after update");
    }

    return server;
  }

  /**
   * Get current user's member ID
   */
  async getCurrentMemberId(userId: string): Promise<{ memberId: string }> {
    const member = await db.query.members.findFirst({
      where: (members, { eq }) => eq(members.userId, userId),
    });

    if (!member) {
      throw new Error("Member not found");
    }

    return { memberId: member.id };
  }

  /**
   * Get member by ID with user and server info
   */
  async getMemberById(
    memberId: string,
    currentUserId: string
  ): Promise<
    | (Member & {
        user: User;
        server: Server;
      })
    | null
  > {
    const member = await db.query.members.findFirst({
      where: (members, { eq }) => eq(members.id, memberId),
      with: {
        user: true,
        server: true,
      },
    });

    if (!member) {
      return null;
    }

    // Verify current user has access to this server
    const hasAccess = await db.query.members.findFirst({
      where: (members, { eq, and }) =>
        and(
          eq(members.serverId, member.serverId),
          eq(members.userId, currentUserId)
        ),
    });

    if (!hasAccess) {
      throw new Error("Access denied to this member");
    }

    return member;
  }

  /**
   * Get all members for a server
   */
  async getMembersByServer(
    serverId: string,
    currentUserId: string
  ): Promise<
    (Member & {
      user: User;
    })[]
  > {
    // Verify current user has access to this server
    const hasAccess = await db.query.members.findFirst({
      where: (members, { eq, and }) =>
        and(eq(members.serverId, serverId), eq(members.userId, currentUserId)),
    });

    if (!hasAccess) {
      throw new Error("Access denied to this server");
    }

    const serverMembers = await db.query.members.findMany({
      where: (members, { eq }) => eq(members.serverId, serverId),
      with: {
        user: true,
      },
      orderBy: (members, { asc }) => [asc(members.role)],
    });

    return serverMembers;
  }
}

export const membersService = new MembersService();
