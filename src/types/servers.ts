import { Server, Channel, Member, User } from "../db/schema";

// Define a subset of User fields for member responses
export type UserPreview = Pick<User, 'id' | 'name' | 'email' | 'imageUrl'>;

export interface CreateServerRequest {
  name: string;
  imageUrl: string;
}

export interface UpdateServerRequest {
  name?: string;
  imageUrl?: string;
}

export interface JoinServerRequest {
  inviteCode: string;
}

// Base server response without relations
export interface BaseServerResponse {
  success: boolean;
  data?: Server;
  message?: string;
}

// Server response with channels and members (for detailed views)
export interface ServerWithDetailsResponse {
  success: boolean;
  data?: Server & {
    channels: Channel[];
    members: (Member & {
      user: UserPreview;
    })[];
  };
  message?: string;
}

// Server response for list views
export interface ServerWithRelationsResponse {
  success: boolean;
  data?: Server & {
    channels: Channel[];
    members: Member[];
  };
  message?: string;
}

export interface ServersListResponse {
  success: boolean;
  data?: (Server & {
    channels: Channel[];
    members: Member[];
  })[];
  message?: string;
}

export interface DeleteServerParams {
  serverId: string;
}

export interface UpdateServerParams {
  serverId: string;
}

export interface InviteCodeParams {
  serverId: string;
}

export interface LeaveServerParams {
  serverId: string;
}