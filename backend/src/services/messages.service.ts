import { db } from "../config/firebase";
import { Message, CreateMessageDto, createMessageObject, Conversation, DirectMessage, ConversationDto } from "../models/message.model";
import { activitiesService } from "./activities.service";
import { notificationsService } from "./notifications.service";
import { usersService } from "./users.service";

const ACTIVITIES_COLLECTION = "activities";
const CONVERSATIONS_COLLECTION = "conversations";

export class MessagesService {
  private messagesRef(activityId: string) {
    return db.collection(ACTIVITIES_COLLECTION).doc(activityId).collection("messages");
  }

  private conversationsRef = db.collection(CONVERSATIONS_COLLECTION);

  private directMessagesRef(conversationId: string) {
    return this.conversationsRef.doc(conversationId).collection("messages");
  }

  async sendMessage(activityId: string, senderId: string, data: CreateMessageDto): Promise<Message> {
    const activity = await activitiesService.getActivityById(activityId);

    if (!activity) {
      throw new Error("Activity not found");
    }

    if (!activity.participantsList.includes(senderId)) {
      throw new Error("Only participants can send messages");
    }

    if (activity.status === "cancelled") {
      throw new Error("Cannot send messages to a cancelled activity");
    }

    const docRef = this.messagesRef(activityId).doc();
    const now = new Date();
    const message = createMessageObject(docRef.id, activityId, senderId, data, now);
    const preview = data.text.length > 60 ? data.text.slice(0, 60) + "…" : data.text;
    const sender = await usersService.getUserById(senderId);
    const senderName = sender?.name ?? "Alguém";

    await Promise.all([
      docRef.set(message),
      db.collection(ACTIVITIES_COLLECTION).doc(activityId).update({
        lastMessage: preview,
        lastMessageAt: now,
        lastMessageSender: senderName,
        lastMessageSenderId: senderId,
      }),
    ]);

    const others = activity.participantsList.filter(id => id !== senderId);
    if (others.length > 0) {
      await notificationsService.createNotificationForMany(
        others,
        "new_message",
        "notifications.msg.newMessage",
        { name: senderName, title: activity.title, preview },
        activityId
      );
    }

    return message;
  }

  async getMessages(activityId: string, requesterId: string): Promise<Message[]> {
    const activity = await activitiesService.getActivityById(activityId);

    if (!activity) {
      throw new Error("Activity not found");
    }

    if (!activity.participantsList.includes(requesterId) && activity.createdBy !== requesterId) {
      throw new Error("Only participants can read messages");
    }

    const snapshot = await this.messagesRef(activityId)
      .orderBy("createdAt", "asc")
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      } as Message;
    });
  }

  async getLastActivityMessage(activityId: string, requesterId: string): Promise<{ text: string; senderName: string; createdAt: Date } | null> {
    const activity = await activitiesService.getActivityById(activityId);
    if (!activity) throw new Error("Activity not found");
    if (!activity.participantsList.includes(requesterId) && activity.createdBy !== requesterId) throw new Error("Only participants can read messages");

    const snap = await this.messagesRef(activityId).orderBy("createdAt", "desc").limit(1).get();
    if (snap.empty) return null;

    const data = snap.docs[0].data();
    const sender = await usersService.getUserById(data.senderId);
    return {
      text: data.text,
      senderName: sender?.name ?? "Alguém",
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    };
  }

  async getOrCreateConversation(requesterId: string, otherUserId: string): Promise<string> {
    const requesterDoc = await db.collection("users").doc(requesterId).get();
    if (!requesterDoc.exists) throw new Error("Utilizador não encontrado");

    const friends: string[] = requesterDoc.data()!.friends ?? [];
    if (!friends.includes(otherUserId)) throw new Error("Só podes iniciar um chat com amigos");

    const snapshot = await this.conversationsRef
      .where("participants", "array-contains", requesterId)
      .get();

    const existing = snapshot.docs.find((doc) =>
      (doc.data().participants as string[]).includes(otherUserId)
    );

    if (existing) return existing.id;

    const docRef = this.conversationsRef.doc();
    const conversation: Conversation = {
      id: docRef.id,
      participants: [requesterId, otherUserId],
      createdAt: new Date(),
    };
    await docRef.set(conversation);
    return docRef.id;
  }

  async getConversations(userId: string): Promise<ConversationDto[]> {
    const snapshot = await this.conversationsRef
      .where("participants", "array-contains", userId)
      .get();

    const results = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const otherUserId = (data.participants as string[]).find((id) => id !== userId)!;
        const otherUserDoc = await db.collection("users").doc(otherUserId).get();
        if (!otherUserDoc.exists) return null;

        const otherUser = otherUserDoc.data()!;
        return {
          id: doc.id,
          otherUser: { id: otherUserId, name: otherUser.name, avatarUrl: otherUser.avatarUrl },
          lastMessage: data.lastMessage,
          lastMessageAt: data.lastMessageAt?.toDate ? data.lastMessageAt.toDate() : data.lastMessageAt,
          lastMessageSenderId: data.lastMessageSenderId,
        } as ConversationDto;
      })
    );

    return results
      .filter((c): c is ConversationDto => c !== null)
      .filter((c) => c.lastMessage !== undefined)
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  async sendDirectMessage(conversationId: string, senderId: string, text: string): Promise<DirectMessage> {
    const convDoc = await this.conversationsRef.doc(conversationId).get();
    if (!convDoc.exists) throw new Error("Conversa não encontrada");

    const participants: string[] = convDoc.data()!.participants;
    if (!participants.includes(senderId)) throw new Error("Não tens acesso a esta conversa");

    const docRef = this.directMessagesRef(conversationId).doc();
    const now = new Date();
    const message: DirectMessage = {
      id: docRef.id,
      conversationId,
      senderId,
      text,
      createdAt: now,
    };

    const preview = text.length > 60 ? text.slice(0, 60) + "…" : text;

    await Promise.all([
      docRef.set(message),
      this.conversationsRef.doc(conversationId).update({ lastMessage: preview, lastMessageAt: now, lastMessageSenderId: senderId }),
    ]);

    return message;
  }

  async getDirectMessages(conversationId: string, requesterId: string): Promise<DirectMessage[]> {
    const convDoc = await this.conversationsRef.doc(conversationId).get();
    if (!convDoc.exists) throw new Error("Conversa não encontrada");

    const participants: string[] = convDoc.data()!.participants;
    if (!participants.includes(requesterId)) throw new Error("Não tens acesso a esta conversa");

    const snapshot = await this.directMessagesRef(conversationId)
      .orderBy("createdAt", "asc")
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      } as DirectMessage;
    });
  }
}

export const messagesService = new MessagesService();

