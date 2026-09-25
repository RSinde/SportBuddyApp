export type Message = {
  id: string;
  activityId: string;
  senderId: string;
  text: string;
  createdAt: string;
};

// Conversa direta (1 para 1) entre amigos.
export type Conversation = {
  id: string;
  otherUser: { id: string; name: string; avatarUrl?: string };
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageSenderId?: string;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
};
