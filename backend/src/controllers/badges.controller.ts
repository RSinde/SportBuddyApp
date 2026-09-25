import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { badgesCatalogService } from "../services/badges-catalog.service";
import { requireAdmin } from "../util/admin.util";
import { BadgeCriteriaType, CreateBadgeDto, UpdateBadgeDto } from "../models/badge.model";

type BadgeParams = {
  badgeId: string;
};

const VALID_CRITERIA_TYPES: BadgeCriteriaType[] = [
  "activitiesJoined",
  "activitiesJoinedBySport",
  "mvpVotesReceived",
];

export async function listBadges(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const badges = await badgesCatalogService.listBadges();
    res.status(200).json(badges);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error listing badges",
    });
  }
}

export async function createBadge(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const data: CreateBadgeDto = {
      name: req.body.name,
      description: req.body.description,
      icon: req.body.icon,
      criteriaType: req.body.criteriaType,
      threshold: req.body.threshold,
      sportId: req.body.sportId,
    };

    if (!data.name || !data.description || !data.icon || !data.criteriaType) {
      res.status(400).json({
        message: "name, description, icon and criteriaType are required",
      });
      return;
    }

    if (!VALID_CRITERIA_TYPES.includes(data.criteriaType)) {
      res.status(400).json({
        message: `criteriaType must be one of: ${VALID_CRITERIA_TYPES.join(", ")}`,
      });
      return;
    }

    if (typeof data.threshold !== "number" || data.threshold <= 0) {
      res.status(400).json({ message: "threshold must be a positive number" });
      return;
    }

    if (data.criteriaType === "activitiesJoinedBySport" && !data.sportId) {
      res.status(400).json({
        message: "sportId is required for criteriaType 'activitiesJoinedBySport'",
      });
      return;
    }

    const badge = await badgesCatalogService.createBadge(data);
    res.status(201).json(badge);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error creating badge",
    });
  }
}

export async function updateBadge(
  req: AuthenticatedRequest<BadgeParams>,
  res: Response
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const { badgeId } = req.params;

    const data: UpdateBadgeDto = {
      name: req.body.name,
      description: req.body.description,
      icon: req.body.icon,
      criteriaType: req.body.criteriaType,
      threshold: req.body.threshold,
      sportId: req.body.sportId,
    };

    if (
      data.criteriaType !== undefined &&
      !VALID_CRITERIA_TYPES.includes(data.criteriaType)
    ) {
      res.status(400).json({
        message: `criteriaType must be one of: ${VALID_CRITERIA_TYPES.join(", ")}`,
      });
      return;
    }

    if (
      data.threshold !== undefined &&
      (typeof data.threshold !== "number" || data.threshold <= 0)
    ) {
      res.status(400).json({ message: "threshold must be a positive number" });
      return;
    }

    const existing = await badgesCatalogService.getBadgeById(badgeId);

    if (!existing) {
      res.status(404).json({ message: "Badge not found" });
      return;
    }

    const effectiveCriteriaType = data.criteriaType ?? existing.criteriaType;
    const effectiveSportId =
      data.sportId !== undefined ? data.sportId : existing.sportId;

    if (effectiveCriteriaType === "activitiesJoinedBySport" && !effectiveSportId) {
      res.status(400).json({
        message: "sportId is required for criteriaType 'activitiesJoinedBySport'",
      });
      return;
    }

    const badge = await badgesCatalogService.updateBadge(badgeId, data);
    res.status(200).json(badge);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error updating badge",
    });
  }
}

export async function deleteBadge(
  req: AuthenticatedRequest<BadgeParams>,
  res: Response
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const { badgeId } = req.params;
    await badgesCatalogService.deleteBadge(badgeId);

    res.status(200).json({ message: "Badge deleted successfully" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error deleting badge",
    });
  }
}
