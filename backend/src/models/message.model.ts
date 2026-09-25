export type Message = {
  id: string;
  activityId: string;
  senderId: string;
  text: string;
  createdAt: Date;
};

export type CreateMessageDto = {
  text: string;
};

export function createMessageObject(id: string, activityId: string, senderId: string, data: CreateMessageDto, createdAt: Date = new Date()): Message {
  return {
    id,
    activityId,
    senderId,
    text: data.text,
    createdAt,
  };
}

export type Conversation = {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: Date;
};

export type ConversationDto = {
  id: string;
  otherUser: { id: string; name: string; avatarUrl?: string };
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string;
};
