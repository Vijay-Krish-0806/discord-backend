export interface FriendRequestResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export interface SearchUserResponse {
  id: string;
  name: string | null;
  email: string;
  imageUrl: string | null;
  requestStatus: string | null;
  requestId: string | null;
  isRequestSender: boolean;
}
