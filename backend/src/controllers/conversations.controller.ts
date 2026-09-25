import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { messagesService } from "../services/messages.service";
import { usersService } from "../services/users.service";

type ConversationParams = { conversationId: string };

export async function getOrCreateConversation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { otherUserId } = req.body;
    if (!otherUserId) {
      res.status(400).json({ message: "otherUserId is required" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const conversationId = await messagesService.getOrCreateConversation(user.id, otherUserId);
    res.status(200).json({ conversationId });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error creating conversation",
    });
  }
}

export async function getConversations(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const conversations = await messagesService.getConversations(user.id);
    res.status(200).json(conversations);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error getting conversations",
    });
  }
}

export async function sendDirectMessage(
  req: AuthenticatedRequest<ConversationParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { conversationId } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      res.status(400).json({ message: "text is required" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const message = await messagesService.sendDirectMessage(conversationId, user.id, text.trim());
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error sending message",
    });
  }
}

export async function getDirectMessages(
  req: AuthenticatedRequest<ConversationParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { conversationId } = req.params;

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const messages = await messagesService.getDirectMessages(conversationId, user.id);
    res.status(200).json(messages);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error getting messages",
    });
  }
}
