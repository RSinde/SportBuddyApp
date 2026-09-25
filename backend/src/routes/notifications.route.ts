import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getNotifications, markAsRead, markAllAsRead, markActivityMessagesAsRead } from "../controllers/notifications.controller";

const router = Router();

router.get("/", authMiddleware, getNotifications);
router.patch("/read-all", authMiddleware, markAllAsRead);
router.patch("/activity/:activityId/read", authMiddleware, markActivityMessagesAsRead);
router.patch("/:notificationId/read", authMiddleware, markAsRead);

export default router;
