import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  unique,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- ENUMS ----------
export const memberRoleEnum = pgEnum("member_role", [
  "ADMIN",
  "MODERATOR",
  "GUEST",
]);
export const channelTypeEnum = pgEnum("channel_type", [
  "TEXT",
  "AUDIO",
  "VIDEO",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "CHANNEL_MESSAGE",
  "DIRECT_MESSAGE",
]);

// ---------- USERS ----------
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------- SERVERS ----------
export const servers = pgTable("servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------- MEMBERS ----------
export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    role: memberRoleEnum("role").notNull().default("GUEST"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("members_user_id_idx").on(table.userId),
    index("members_server_id_idx").on(table.serverId),
    unique("unique_user_server").on(table.userId, table.serverId),
  ]
);

// ---------- CHANNELS ----------
export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: channelTypeEnum("type").notNull().default("TEXT"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("channels_server_id_idx").on(table.serverId),
    index("channels_user_id_idx").on(table.userId),
  ]
);

//-------MESSAGES-------
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    fileUrl: text("file_url"),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    reactions: text("reactions").array().default([]),
    deleted: boolean("deleted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_channel_id_idx").on(table.channelId),
    index("messages_member_id_idx").on(table.memberId),
  ]
);

//-----------CONVERSATIONS--------------//

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberOneId: text("member_one_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    memberTwoId: text("member_two_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_member_one_id_idx").on(table.memberOneId),
    index("conversations_member_two_id_idx").on(table.memberTwoId),
    unique("conversations_members_unique").on(
      table.memberOneId,
      table.memberTwoId
    ),
  ]
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    fileUrl: text("file_url"),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    deleted: boolean("deleted").default(false),
    reactions: text("reactions").array().default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("direct_messages_member_id_idx").on(table.memberId),
    index("direct_messages_conversation_id_idx").on(table.conversationId),
  ]
);

// ---------- SESSIONS ----------
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
  ]
);

// ---------- ACCOUNTS ----------
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const friendRequestStatusEnum = pgEnum("friend_request_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
]);

// Add this table after your existing tables
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendRequestStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  },
  (table) => [
    index("friend_requests_sender_id_idx").on(table.senderId),
    index("friend_requests_recipient_id_idx").on(table.recipientId),
    index("friend_requests_status_idx").on(table.status),
    unique("unique_friend_request").on(table.senderId, table.recipientId),
  ]
);

// Add relations
export const friendRequestsRelations = relations(friendRequests, ({ one }) => ({
  sender: one(users, {
    fields: [friendRequests.senderId],
    references: [users.id],
  }),
  recipient: one(users, {
    fields: [friendRequests.recipientId],
    references: [users.id],
  }),
}));

// ---------- USER PRESENCE ----------
// Track online/offline status and last seen
export const userPresence = pgTable(
  "user_presence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    isOnline: boolean("is_online").notNull().default(false),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    socketId: text("socket_id"), // Current socket connection
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_presence_user_id_idx").on(table.userId),
    index("user_presence_is_online_idx").on(table.isOnline),
  ]
);

// ---------- NOTIFICATIONS ----------
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    channelId: text("channel_id").references(() => channels.id, {
      onDelete: "cascade",
    }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
    }),
    messageId: uuid("message_id"), // Can reference either messages or directMessages
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_is_read_idx").on(table.isRead),
    index("notifications_created_at_idx").on(table.createdAt),
  ]
);

// ---------- RELATIONS ----------
export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, {
    fields: [userPresence.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  sender: one(users, {
    fields: [notifications.senderId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [notifications.channelId],
    references: [channels.id],
  }),
  conversation: one(conversations, {
    fields: [notifications.conversationId],
    references: [conversations.id],
  }),
}));

// ---------- RELATIONS ----------
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  servers: many(servers),
  members: many(members),
  channels: many(channels),
  sentFriendRequests: many(friendRequests, { relationName: "Sender" }),
  receivedFriendRequests: many(friendRequests, { relationName: "Recipient" }),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  user: one(users, { fields: [servers.userId], references: [users.id] }),
  members: many(members),
  channels: many(channels),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, { fields: [members.userId], references: [users.id] }),
  server: one(servers, {
    fields: [members.serverId],
    references: [servers.id],
  }),
  messages: many(messages),
  directMessages: many(directMessages),
  conversationsInitiated: many(conversations, { relationName: "MemberOne" }),
  conversationsReceived: many(conversations, { relationName: "MemberTwo" }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  user: one(users, { fields: [channels.userId], references: [users.id] }),
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  member: one(members, {
    fields: [messages.memberId],
    references: [members.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    memberOne: one(members, {
      fields: [conversations.memberOneId],
      references: [members.id],
      relationName: "MemberOne",
    }),
    memberTwo: one(members, {
      fields: [conversations.memberTwoId],
      references: [members.id],
      relationName: "MemberTwo",
    }),
    directMessages: many(directMessages),
  })
);

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  member: one(members, {
    fields: [directMessages.memberId],
    references: [members.id],
  }),
  conversation: one(conversations, {
    fields: [directMessages.conversationId],
    references: [conversations.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ---------- TYPES ----------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type DirectMessage = typeof directMessages.$inferSelect;
export type NewDirectMessage = typeof directMessages.$inferInsert;
export type Notifications = typeof notifications.$inferSelect;
export type NewNotifications = typeof notifications.$inferInsert;
export type FriendRequest = typeof friendRequests.$inferSelect;
export type NewFriendRequest = typeof friendRequests.$inferInsert;
export type FriendRequestStatus =
  (typeof friendRequestStatusEnum.enumValues)[number];

// Enum value types for TypeScript
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
export type ChannelType = (typeof channelTypeEnum.enumValues)[number];
