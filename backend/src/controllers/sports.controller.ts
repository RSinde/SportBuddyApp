import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { sportsService } from "../services/sports.service";
import { CreateSportDto, UpdateSportDto } from "../models/sport.model";
import { requireAdmin } from "../util/admin.util";

type SportParams = {
  sportId: string;
};

export async function listSports(_req: Request, res: Response): Promise<void> {
  try {
    const sports = await sportsService.listSports();

    res.status(200).json(sports);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error listing sports",
    });
  }
}

export async function getSportById(
  req: Request<SportParams>,
  res: Response,
): Promise<void> {
  try {
    const { sportId } = req.params;

    const sport = await sportsService.getSportById(sportId);

    if (!sport) {
      res.status(404).json({ message: "Sport not found" });
      return;
    }

    res.status(200).json(sport);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error getting sport",
    });
  }
}

export async function createSport(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const data: CreateSportDto = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
    };

    if (!data.name || !data.description || !data.category) {
      res.status(400).json({ message: "name, description and category are required" });
      return;
    }

    const validCategories = ["team", "individual"];
    if (!validCategories.includes(data.category)) {
      res.status(400).json({ message: "category must be 'team' or 'individual'" });
      return;
    }

    const sport = await sportsService.createSport(data);
    res.status(201).json(sport);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error creating sport",
    });
  }
}

export async function updateSport(
  req: AuthenticatedRequest<SportParams>,
  res: Response,
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const { sportId } = req.params;
    const data: UpdateSportDto = req.body;

    const sport = await sportsService.updateSport(sportId, data);
    res.status(200).json(sport);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error updating sport",
    });
  }
}

export async function deleteSport(
  req: AuthenticatedRequest<SportParams>,
  res: Response,
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const { sportId } = req.params;
    await sportsService.deleteSport(sportId);

    res.status(200).json({ message: "Sport deleted successfully" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error deleting sport",
    });
  }
}
