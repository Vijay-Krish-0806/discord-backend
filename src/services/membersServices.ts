// src/services/members.service.ts
import { db } from "../db/database";
import { members, MemberRole } from "../db/schema";
import { and, eq, ne } from "drizzle-orm";

interface DeleteMemberParams {
  memberId: string;
  serverId: string;
  currentUserId: string;
}

interface UpdateMemberRoleParams {
  memberId: string;
  serverId: string;
  role: MemberRole;
  currentUserId: string;
}

class MembersService {
  async getCurrentMember(userId: string) {
    const member = await db.query.members.findFirst({
      where: (members, { eq }) => eq(members.userId, userId),
    });

    return member;
  }

  async deleteMember(params: DeleteMemberParams) {
    const { memberId, serverId, currentUserId } = params;

    // Delete member (cannot delete yourself)
    await db.delete(members).where(
      and(
        eq(members.id, memberId),
        eq(members.serverId, serverId),
        ne(members.userId, currentUserId) // Prevent self-deletion
      )
    );

    // Get updated server with members and channels
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

    return server;
  }

  async updateMemberRole(params: UpdateMemberRoleParams) {
    const { memberId, serverId, role, currentUserId } = params;

    // Update member role (cannot update your own role)
    await db
      .update(members)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(members.id, memberId),
          eq(members.serverId, serverId),
          ne(members.userId, currentUserId) // Prevent self-update
        )
      );

    // Get updated server with members and channels
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

    return server;
  }
}

export const membersService = new MembersService();
