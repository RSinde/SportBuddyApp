import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { usersService } from "./users.service";
import { badgesCatalogService } from "./badges-catalog.service";
import { notificationsService } from "./notifications.service";
import { BadgeDefinition } from "../models/badge.model";
import { User } from "../models/user.model";

const USERS_COLLECTION = "users";

function meetsCriteria(user: User, badge: BadgeDefinition): boolean {
  switch (badge.criteriaType) {
    case "activitiesJoined":
      return user.stats.activitiesJoined >= badge.threshold;
    case "activitiesJoinedBySport":
      if (!badge.sportId) return false;
      return (
        (user.stats.bySport?.[badge.sportId]?.joined ?? 0) >= badge.threshold
      );
    case "mvpVotesReceived":
      return user.stats.mvpVotesReceived >= badge.threshold;
    default:
      return false;
  }
}

export type UserBadge = BadgeDefinition & {
  unlockedAt: string;
  isDisplayed: boolean;
};

export class BadgesService {
  async getUserBadges(userId: string): Promise<UserBadge[] | null> {
    const user = await usersService.getUserById(userId);

    if (!user) {
      return null;
    }

    const catalog = await badgesCatalogService.listBadges();
    const catalogById = new Map(catalog.map((badge) => [badge.id, badge]));

    return (user.stats.badges ?? [])
      .map((badgeId) => {
        const badge = catalogById.get(badgeId);
        if (!badge) return null;

        return {
          ...badge,
          unlockedAt: user.stats.badgesUnlockedAt?.[badgeId] ?? "",
          isDisplayed: user.displayedBadge === badgeId,
        };
      })
      .filter((badge): badge is UserBadge => badge !== null)
      .sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));
  }

  async checkAndAwardBadges(userId: string): Promise<BadgeDefinition[]> {
    const catalog = await badgesCatalogService.listBadges();
    const userRef = db.collection(USERS_COLLECTION).doc(userId);

    // Runs the read-check-write as one atomic unit so that two concurrent
    // triggers for the same user (e.g. joining two activities back to back)
    // can't both observe the badge as "not yet unlocked" and each send a
    // duplicate "badge earned" notification.
    const newlyUnlocked = await db.runTransaction(async (tx) => {
      const userDoc = await tx.get(userRef);

      if (!userDoc.exists) {
        return [];
      }

      const user = userDoc.data() as User;
      const unlockedIds = new Set(user.stats.badges);

      const newlyUnlocked = catalog.filter(
        (badge) => !unlockedIds.has(badge.id) && meetsCriteria(user, badge)
      );

      if (newlyUnlocked.length === 0) {
        return [];
      }

      const now = new Date().toISOString();
      const badgesUnlockedAtUpdates: Record<string, string> = {};
      for (const badge of newlyUnlocked) {
        badgesUnlockedAtUpdates[`stats.badgesUnlockedAt.${badge.id}`] = now;
      }

      tx.update(userRef, {
        "stats.badges": FieldValue.arrayUnion(
          ...newlyUnlocked.map((badge) => badge.id)
        ),
        ...badgesUnlockedAtUpdates,
      });

      return newlyUnlocked;
    });

    for (const badge of newlyUnlocked) {
      await notificationsService.createNotification(
        userId,
        "badge_earned",
        "notifications.msg.badgeEarned",
        { name: badge.name }
      );
    }

    return newlyUnlocked;
  }
}

export const badgesService = new BadgesService();
