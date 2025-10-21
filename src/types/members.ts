import { Member, MemberRole, Server, User, Channel } from "../db/schema";

export interface UpdateMemberRoleRequest {
  role: MemberRole;
}

export interface MemberResponse {
  success: boolean;
  data?: Server & {
    members: (Member & {
      user: User;
    })[];
    channels: Channel[];
  };
  message?: string;
}

export interface CurrentMemberResponse {
  success: boolean;
  data?: {
    memberId: string;
  };
  message?: string;
}

export interface MemberDetailResponse {
  success: boolean;
  data?: Member & {
    user: User;
    server: Server;
  };
  message?: string;
}

export interface MembersListResponse {
  success: boolean;
  data?: (Member & {
    user: User;
  })[];
  message?: string;
}

export interface DeleteMemberParams {
  memberId: string;
}

export interface UpdateMemberParams {
  memberId: string;
}
