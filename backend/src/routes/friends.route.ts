import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { acceptFriendRequest, cancelFriendRequest, rejectFriendRequest, removeFriend, getFriends, getPendingRequests, sendFriendRequest } from "../controllers/friends.controller";

const router = Router();

router.get("/", authMiddleware, getFriends);
router.get("/requests", authMiddleware, getPendingRequests);
router.post("/request", authMiddleware, sendFriendRequest);
router.patch("/:requestId/accept", authMiddleware, acceptFriendRequest);
router.patch("/:requestId/reject", authMiddleware, rejectFriendRequest);
router.delete("/request/:addresseeId", authMiddleware, cancelFriendRequest);
router.delete("/:friendId", authMiddleware, removeFriend);

export default router;
