import { DirectMessage, Member, User, Conversation } from "../db/schema";

export interface GetDirectMessagesQuery {
  cursor?: string;
  conversationId?: string;
}

export interface CreateDirectMessageRequest {
  content: string;
  fileUrl?: string;
}

export interface UpdateDirectMessageRequest {
  content: string;
}

export interface ToggleReactionRequest {
  emoji: string;
}

export interface DirectMessagesResponse {
  success: boolean;
  data?: {
    items: (DirectMessage & {
      member: Member & {
        user: User;
      };
    })[];
    nextCursor: string | null;
  };
  message?: string;
}

export interface DirectMessageResponse {
  success: boolean;
  data?: DirectMessage & {
    member: Member & {
      user: User;
    };
    conversation?: Conversation;
  };
  message?: string;
}

export interface DeleteMessageResponse {
  success: boolean;
  message: string;
  deletedMessage?: DirectMessage;
}
