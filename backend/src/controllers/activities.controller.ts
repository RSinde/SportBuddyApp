import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { activitiesService } from "../services/activities.service";
import { usersService } from "../services/users.service";
import { friendsService } from "../services/friends.service";
import { Activity, ActivityStatus, CreateActivityDto, SkillLevel } from "../models/activity.model";
import { parseCreateActivityDto } from "../util/activityValidation.util";
import { requireAdmin } from "../util/admin.util";

type ActivityParams = {
  activityId: string;
};

export async function getMyActivities(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { sportId, status, date } = req.query;

    const activities = await activitiesService.getMyActivities(req.user.uid, {
      sportId: sportId as string | undefined,
      status: status as ActivityStatus | undefined,
      date: date ? new Date(date as string) : undefined,
    });

    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error getting user activities",
    });
  }
}

export async function getUserActivities(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { userId } = req.params as { userId: string };
    const activities = await activitiesService.getUserActivities(userId, 5);
    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error getting user activities",
    });
  }
}

export async function getFriendsActivities(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const friends = await friendsService.getFriends(req.user.uid);
    const friendIds = friends.map((friend) => friend.userId);

    const activities = await activitiesService.getFriendsActivities(friendIds);

    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Error getting friends' activities",
    });
  }
}

export async function getFriendsFeed(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }
    const friends = await friendsService.getFriends(req.user.uid);
    const friendIds = friends.map((f) => f.userId);
    const friendNames = new Map(
      await Promise.all(friends.map(async (f) => {
        const u = await usersService.getUserById(f.userId);
        return [f.userId, u?.name ?? ''] as [string, string];
      }))
    );
    const feed = await activitiesService.getFriendsFeed(friendIds, friendNames);
    res.status(200).json(feed);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : "Error getting feed" });
  }
}

export async function listActivities(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const sportId =
      typeof req.query.sportId === "string" ? req.query.sportId : undefined;

    const difficultyLevel =
      typeof req.query.difficultyLevel === "string"
        ? (req.query.difficultyLevel as SkillLevel)
        : undefined;

    const status =
      typeof req.query.status === "string"
        ? (req.query.status as ActivityStatus)
        : undefined;

    const lat =
      typeof req.query.lat === "string" ? Number(req.query.lat) : undefined;

    const lng =
      typeof req.query.lng === "string" ? Number(req.query.lng) : undefined;

    const radiusKm =
      typeof req.query.radiusKm === "string"
        ? Number(req.query.radiusKm)
        : undefined;

    const createdBy =
      typeof req.query.createdBy === "string" ? req.query.createdBy : undefined;

    const verifiedOnly = req.query.verifiedOnly === "true";

    const activities = await activitiesService.listActivities({
      sportId,
      difficultyLevel,
      status,
      lat,
      lng,
      radiusKm,
      createdBy,
      verifiedOnly,
    });

    res.status(200).json(activities);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Error listing activities",
    });
  }
}

export async function createActivity(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "User not authenticated",
      });
      return;
    }

    const data = parseCreateActivityDto(req.body);

    const activity = await activitiesService.createActivity(req.user.uid, data);

    res.status(201).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Error creating activity",
    });
  }
}

export async function getActivityById(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    const { activityId } = req.params;

    const activity = await activitiesService.getActivityById(activityId);

    if (!activity) {
      res.status(404).json({
        message: "Activity not found",
      });
      return;
    }

    res.status(200).json(activity);
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Error getting activity",
    });
  }
}

export async function updateActivity(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "User not authenticated",
      });
      return;
    }

    const { activityId } = req.params;

    // A data não é editável: mudanças de horário combinam-se no chat.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { date: _date, ...updateData } = req.body;

    const activity = await activitiesService.updateActivity(
      activityId,
      req.user.uid,
      updateData,
      req.user.role
    );

    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Error updating activity",
    });
  }
}

export async function listAdminActivities(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const status =
      typeof req.query.status === "string"
        ? (req.query.status as ActivityStatus)
        : undefined;

    const createdBy =
      typeof req.query.createdBy === "string"
        ? req.query.createdBy
        : undefined;

    const activities = await activitiesService.listAllActivities({
      status,
      createdBy,
    });

    res.status(200).json(activities);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Error listing admin activities",
    });
  }
}

export async function deleteActivityAsAdmin(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    const isAdmin = requireAdmin(req, res);
    if (!isAdmin) return;

    const { activityId } = req.params;
    await activitiesService.deleteActivityAsAdmin(activityId);

    res.status(200).json({ message: "Activity deleted successfully" });
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Error deleting activity",
    });
  }
}

export async function cancelActivity(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "User not authenticated",
      });
      return;
    }

    const { activityId } = req.params;

    const activity = await activitiesService.cancelActivity(
      activityId,
      req.user.uid
    );

    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Error cancelling activity",
    });
  }
}

export async function joinActivity(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "User not authenticated",
      });
      return;
    }

    const { activityId } = req.params;

    const activity = await activitiesService.joinActivity(
      activityId,
      req.user.uid
    );

    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Error joining activity",
    });
  }
}

export async function leaveActivity(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "User not authenticated",
      });
      return;
    }

    const { activityId } = req.params;

    const activity = await activitiesService.leaveActivity(
      activityId,
      req.user.uid
    );

    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Error leaving activity",
    });
  }
}

export async function removeParticipant(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "User not authenticated",
      });
      return;
    }

    const { activityId } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
      res.status(400).json({
        message: "participantId is required",
      });
      return;
    }

    const activity = await activitiesService.removeParticipant(
      activityId,
      req.user.uid,
      participantId
    );

    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error ? error.message : "Error removing participant",
    });
  }
}

export async function admitFromWaitlist(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        message: "User not authenticated",
      });
      return;
    }

    const { activityId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        message: "userId is required",
      });
      return;
    }

    const activity = await activitiesService.admitFromWaitlist(
      activityId,
      req.user.uid,
      userId
    );

    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Error admitting user from waitlist",
    });
  }
}

export async function rejectFromWaitlist(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { activityId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ message: "userId is required" });
      return;
    }

    const activity = await activitiesService.rejectFromWaitlist(
      activityId,
      req.user.uid,
      userId
    );

    res.status(200).json(activity);
  } catch (error) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Error rejecting user from waitlist",
    });
  }
}

export async function voteMvp(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { activityId } = req.params;
    const { votedForId } = req.body;

    if (!votedForId) {
      res.status(400).json({ message: "votedForId is required" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    await activitiesService.voteMvp(activityId, user.id, votedForId);
    res.status(200).json({ message: "Vote registered successfully" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error voting for MVP",
    });
  }
}

export async function rateActivity(
  req: AuthenticatedRequest<ActivityParams>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { activityId } = req.params;
    const { rating } = req.body as { rating?: number };

    if (typeof rating !== "number") {
      res.status(400).json({ message: "rating is required" });
      return;
    }

    const user = await usersService.getUserByFirebaseUid(req.user.uid);
    if (!user) {
      res.status(404).json({ message: "User profile not found" });
      return;
    }

    await activitiesService.rateActivity(activityId, user.id, rating);
    res.status(200).json({ message: "Rating registered successfully" });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Error rating activity",
    });
  }
}
