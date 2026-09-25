import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { sendMessage, getMessages, getLastActivityMessage } from "../controllers/messages.controller";

const router = Router({ mergeParams: true });

router.get("/last", authMiddleware, getLastActivityMessage);
router.get("/", authMiddleware, getMessages);
router.post("/", authMiddleware, sendMessage);

export default router;
