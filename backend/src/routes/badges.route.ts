import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  listBadges,
  createBadge,
  updateBadge,
  deleteBadge,
} from "../controllers/badges.controller";

const router = Router();

router.get("/", authMiddleware, listBadges);
router.post("/", authMiddleware, createBadge);
router.patch("/:badgeId", authMiddleware, updateBadge);
router.delete("/:badgeId", authMiddleware, deleteBadge);

export default router;
