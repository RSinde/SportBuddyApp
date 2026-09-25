import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  listActivities,
  listAdminActivities,
  getMyActivities,
  getUserActivities,
  getFriendsActivities,
  getFriendsFeed,
  createActivity,
  getActivityById,
  updateActivity,
  cancelActivity,
  joinActivity,
  leaveActivity,
  removeParticipant,
  admitFromWaitlist,
  rejectFromWaitlist,
  deleteActivityAsAdmin,
  voteMvp,
  rateActivity,
} from "../controllers/activities.controller";

const router = Router();

router.get("/", authMiddleware, listActivities);
router.get("/admin/all", authMiddleware, listAdminActivities);

router.get("/me", authMiddleware, getMyActivities);
router.get("/friends", authMiddleware, getFriendsActivities);
router.get("/friends/feed", authMiddleware, getFriendsFeed);
router.get("/user/:userId", authMiddleware, getUserActivities);

router.post("/", authMiddleware, createActivity);

router.get("/:activityId", authMiddleware, getActivityById);

router.post("/:activityId/join", authMiddleware, joinActivity);

router.post("/:activityId/leave", authMiddleware, leaveActivity);

router.patch("/:activityId", authMiddleware, updateActivity);
router.delete("/:activityId/admin", authMiddleware, deleteActivityAsAdmin);

router.patch("/:activityId/cancel", authMiddleware, cancelActivity);

router.patch("/:activityId/remove-participant",authMiddleware,
  removeParticipant);

router.patch("/:activityId/admit-from-waitlist",authMiddleware,
  admitFromWaitlist);

router.patch("/:activityId/reject-from-waitlist",authMiddleware,
  rejectFromWaitlist);

router.post("/:activityId/vote-mvp", authMiddleware, voteMvp);
router.post("/:activityId/rate", authMiddleware, rateActivity);

export default router;
