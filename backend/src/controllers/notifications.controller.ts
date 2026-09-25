import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { notificationsService } from "../services/notifications.service";
import { usersService } from "../services/users.service";

type NotificationParams = { notificationId: string };
type ActivityParams = { activityId: string };

export async function getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    const notifications = await notificationsService.getNotifications(user.id);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error getting notifications",
    });
  }
}

export async function markAsRead(
  req: AuthenticatedRequest<NotificationParams>,
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

    const { notificationId } = req.params;
    const notification = await notificationsService.markAsRead(notificationId, user.id);
    res.status(200).json(notification);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error marking notification as read",
    });
  }
}

export async function markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
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

    await notificationsService.markAllAsRead(user.id);
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error marking notifications as read",
    });
  }
}

export async function markActivityMessagesAsRead(
  req: AuthenticatedRequest<ActivityParams>,
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

    const { activityId } = req.params;
    await notificationsService.markActivityMessagesAsRead(user.id, activityId);
    res.status(200).json({ message: "Activity message notifications marked as read" });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error marking notifications as read",
    });
  }
}
