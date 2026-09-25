import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

export function requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ message: "User not authenticated" });
    return false;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }

  // If the auth token explicitly carries role-like claims, they must also
  // indicate admin to avoid trusting stale or contradictory client auth state.
  if (req.user.hasRoleClaim && !req.user.hasAdminToken) {
    res.status(403).json({ message: "Admin token required" });
    return false;
  }

  return true;
}
