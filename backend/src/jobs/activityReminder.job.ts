import cron from "node-cron";
import { db } from "../config/firebase";
import { Activity, ActivityStatus } from "../models/activity.model";
import { notificationsService } from "../services/notifications.service";
import { usersService } from "../services/users.service";
import { tallyMvpWinners } from "../util/mvp.util";

const ACTIVITIES_COLLECTION = "activities";
const LOCKS_COLLECTION = "_locks";

async function tryAcquireLock(jobName: string, windowMs: number): Promise<boolean> {
  const lockRef = db.collection(LOCKS_COLLECTION).doc(jobName);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(lockRef);
    const lastRunAt = doc.exists ? (doc.data()!.lastRunAt as number) : 0;

    if (now - lastRunAt < windowMs) return false;

    tx.set(lockRef, { lastRunAt: now });
    return true;
  });
}

async function checkActivities() {
  const now = new Date();

  const snapshot = await db
    .collection(ACTIVITIES_COLLECTION)
    .where("status", "in", ["open", "full"])
    .get();

  // Fetch creator roles in batch to avoid per-activity reads
  const creatorIds = [...new Set(snapshot.docs.map(d => d.data().createdBy as string))];
  const creatorDocs = await Promise.all(creatorIds.map(id => db.collection("users").doc(id).get()));
  const partnerCreators = new Set<string>(
    creatorDocs.filter(d => d.exists && d.data()?.role === "partner").map(d => d.id)
  );

  for (const doc of snapshot.docs) {
    const activity = { id: doc.id, ...doc.data() } as Activity & { date: any };

    // Atividades de parceiros não têm cancelamento automático nem notificações de aviso
    if (partnerCreators.has(activity.createdBy)) continue;

    const activityDate: Date = activity.date?.toDate ? activity.date.toDate() : new Date(activity.date);

    const msUntilActivity = activityDate.getTime() - now.getTime();
    const hoursUntilActivity = msUntilActivity / (1000 * 60 * 60);

    const isFull = activity.participantsList.length >= activity.maxParticipants;

    if (hoursUntilActivity > 23 && hoursUntilActivity <= 24 && !isFull) {
      const missing = activity.maxParticipants - activity.participantsList.length;
      const deadline = new Date(activityDate.getTime() - 3 * 60 * 60 * 1000);
      const deadlineStr = `${String(deadline.getHours()).padStart(2, "0")}:${String(deadline.getMinutes()).padStart(2, "0")}`;

      await notificationsService.createNotificationForMany(
        activity.participantsList,
        "activity_reminder",
        "notifications.msg.activityReminder",
        { title: activity.title, missing, deadline: deadlineStr },
        activity.id
      );
    }

    if (hoursUntilActivity > 0 && hoursUntilActivity <= 3 && !isFull) {
      await doc.ref.update({
        status: "cancelled" as ActivityStatus,
        updatedAt: now,
      });

      await notificationsService.createNotificationForMany(
        activity.participantsList,
        "activity_auto_cancelled",
        "notifications.msg.activityAutoCancelled",
        { title: activity.title },
        activity.id
      );
    }
  }
}

async function checkMvpVoting() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const snapshot = await db
    .collection("activities")
    .where("status", "==", "completed")
    .where("votingClosedAt", "==", null)
    .get();

  for (const doc of snapshot.docs) {
    const activity = { id: doc.id, ...doc.data() } as Activity & { date: any; updatedAt: any };
    const updatedAt: Date = activity.updatedAt?.toDate ? activity.updatedAt.toDate() : new Date(activity.updatedAt);

    if (updatedAt > cutoff) continue;

    const votes = activity.mvpVotes ?? {};
    const winners = tallyMvpWinners(votes);

    await doc.ref.update({ mvpWinners: winners, votingClosedAt: now, updatedAt: now });

    for (const winnerId of winners) {
      await usersService.incrementStat(winnerId, "mvpVotesReceived", 1);
    }

    await notificationsService.createNotificationForMany(
      activity.participantsList,
      "mvp_result",
      winners.length === 1
        ? "notifications.msg.mvpResult"
        : winners.length > 1
          ? "notifications.msg.mvpResultTie"
          : "notifications.msg.mvpResultNone",
      { title: activity.title },
      activity.id
    );
  }
}

export function startActivityReminderJob() {
  cron.schedule("0 * * * *", async () => {
    const acquired = await tryAcquireLock("activity-reminder-job", 55 * 60 * 1000).catch((err) => {
      console.error("Error acquiring activity reminder job lock:", err);
      return false;
    });

    if (!acquired) return;

    checkActivities().catch(err => console.error("Error in activity reminder job:", err));
    checkMvpVoting().catch(err => console.error("Error in MVP voting job:", err));
  });

  console.log("Activity reminder job started");
}
