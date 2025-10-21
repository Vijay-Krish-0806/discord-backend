export interface NotificationResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export interface PresenceResponse {
  success: boolean;
  data?: Record<string, { isOnline: boolean; lastSeen: Date | null }>;
  error?: string;
}

export interface SinglePresenceResponse {
  success: boolean;
  data?: { isOnline: boolean; lastSeen: Date | null };
  error?: string;
}
