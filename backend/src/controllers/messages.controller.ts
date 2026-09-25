import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { messagesService } from "../services/messages.service";
import { usersService } from "../services/users.service";

type ActivityParams = { activityId: string };

export async function sendMessage(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { activityId } = req.params;
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      res.status(400).json({ message: "text is required" });
      return;
    }

    if (text.trim().length > 2000) {
      res.status(400).json({ message: "A mensagem é demasiado longa" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);

    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const message = await messagesService.sendMessage(activityId, user.id, { text: text.trim() });
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error sending message",
    });
  }
}

export async function getMessages(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { activityId } = req.params;

    const user = await usersService.getUserByFirebaseUid(req.user.uid);

    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    const messages = await messagesService.getMessages(activityId, user.id);
    res.status(200).json(messages);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error getting messages",
    });
  }
}

export async function getLastActivityMessage(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ message: "User not authenticated" }); return; }
    const { activityId } = req.params;
    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) { res.status(404).json({ message: "User profile not found" }); return; }
    const preview = await messagesService.getLastActivityMessage(activityId, user.id);
    res.status(200).json(preview);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Error getting last message" });
  }
}
