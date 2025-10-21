import { Message, Member, User, Channel } from "../db/schema";

export interface GetMessagesQuery {
  cursor?: string;
  channelId?: string;
}

export interface CreateMessageRequest {
  content: string;
  fileUrl?: string;
}

export interface UpdateMessageRequest {
  content: string;
}

export interface ToggleReactionRequest {
  emoji: string;
}

export interface MessagesResponse {
  success: boolean;
  data?: {
    items: (Message & {
      member: Member & {
        user: User;
      };
    })[];
    nextCursor: string | null;
  };
  message?: string;
}

export interface MessageResponse {
  success: boolean;
  data?: Message & {
    member: Member & {
      user: User;
    };
    channel?: Channel;
  };
  message?: string;
}

export interface DeleteMessageResponse {
  success: boolean;
  message: string;
  deletedMessage?: Message;
}

export interface DeleteMessageParams {
  messageId: string;
}

export interface UpdateMessageParams {
  messageId: string;
}
