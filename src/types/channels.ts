import { ChannelType } from "../db/schema";

export interface CreateChannelRequest {
  name: string;
  type: ChannelType;
}

export interface UpdateChannelRequest {
  name: string;
  type: ChannelType;
}

export interface ChannelResponse {
  success: boolean;
  data?: any;
  message?: string;
}

export interface DeleteChannelParams {
  channelId: string;
}

export interface UpdateChannelParams {
  channelId: string;
}
