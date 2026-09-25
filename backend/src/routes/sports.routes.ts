import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  listSports,
  getSportById,
  createSport,
  updateSport,
  deleteSport,
} from "../controllers/sports.controller";

const router = Router();

router.get("/", listSports);

router.get("/:sportId", getSportById);

router.post("/", authMiddleware, createSport);

router.patch("/:sportId", authMiddleware, updateSport);

router.delete("/:sportId", authMiddleware, deleteSport);

export default router;
