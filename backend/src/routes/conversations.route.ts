import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getOrCreateConversation, getConversations, sendDirectMessage, getDirectMessages } from "../controllers/conversations.controller";

const router = Router();

router.post("/", authMiddleware, getOrCreateConversation);
router.get("/", authMiddleware, getConversations);
router.post("/:conversationId/messages", authMiddleware, sendDirectMessage);
router.get("/:conversationId/messages", authMiddleware, getDirectMessages);

export default router;
