import { db } from "../config/firebase";
import {
  Notification,
  NotificationParams,
  NotificationType,
  createNotificationObject,
} from "../models/notification.model";

const NOTIFICATIONS_COLLECTION = "notifications";

export class NotificationsService {
  private notificationsRef = db.collection(NOTIFICATIONS_COLLECTION);

  async createNotification(
    userId: string,
    type: NotificationType,
    messageKey: string,
    messageParams?: NotificationParams,
    activityId?: string,
    relatedUserId?: string
  ): Promise<Notification> {
    const docRef = this.notificationsRef.doc();
    const notification = createNotificationObject(docRef.id, userId, type, messageKey, messageParams, activityId, relatedUserId);
    await docRef.set(notification);
    return notification;
  }

  async createNotificationForMany(
    userIds: string[],
    type: NotificationType,
    messageKey: string,
    messageParams: NotificationParams | undefined,
    activityId: string
  ): Promise<void> {
    const batch = db.batch();

    for (const userId of userIds) {
      const docRef = this.notificationsRef.doc();
      const notification = createNotificationObject(docRef.id, userId, type, messageKey, messageParams, activityId);
      batch.set(docRef, notification);
    }

    await batch.commit();
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const snapshot = await this.notificationsRef
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      } as Notification;
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const doc = await this.notificationsRef.doc(notificationId).get();

    if (!doc.exists) {
      throw new Error("Notification not found");
    }

    const notification = doc.data() as Notification;

    if (notification.userId !== userId) {
      throw new Error("Cannot mark another user's notification as read");
    }

    await this.notificationsRef.doc(notificationId).update({ read: true });

    return {
      ...notification,
      createdAt: (notification.createdAt as any)?.toDate
        ? (notification.createdAt as any).toDate()
        : notification.createdAt,
      read: true,
    };
  }

  async markAllAsRead(userId: string): Promise<void> {
    const snapshot = await this.notificationsRef
      .where("userId", "==", userId)
      .where("read", "==", false)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
    await batch.commit();
  }

  async markActivityMessagesAsRead(userId: string, activityId: string): Promise<void> {
    const snapshot = await this.notificationsRef
      .where("userId", "==", userId)
      .where("activityId", "==", activityId)
      .where("type", "==", "new_message")
      .where("read", "==", false)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
    await batch.commit();
  }
}

export const notificationsService = new NotificationsService();
