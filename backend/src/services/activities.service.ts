import { Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import {
  Activity,
  ActivityStatus,
  CreateActivityDto,
  FeedItem,
  createActivityObject,
  SkillLevel,
} from "../models/activity.model";
import { UserRole } from "../models/user.model";
import { isWithinRadiusKm, isValidCoordinates } from "../util/geo.util";
import { tallyMvpWinners } from "../util/mvp.util";
import { usersService } from "./users.service";
import { sportsService } from "./sports.service";
import { notificationsService } from "./notifications.service";

const ACTIVITIES_COLLECTION = "activities";
const NOTIFICATIONS_COLLECTION = "notifications";

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : (value as Date);
}

// Sem `date`: a data não é editável depois da atividade ser criada.
export type UpdateActivityDto = {
  title?: string;
  description?: string;
  maxParticipants?: number;
  difficultyLevel?: Activity["difficultyLevel"];
  requiresApproval?: boolean;
};

export type ListActivitiesFilters = {
  status?: ActivityStatus;
  sportId?: string;
  difficultyLevel?: SkillLevel;
  createdBy?: string;
  verifiedOnly?: boolean;
  lat?: number;
  lng?: number;
  radiusKm?: number;
};

export type AdminListActivitiesFilters = {
  status?: ActivityStatus;
  createdBy?: string;
};

export type MyActivitiesFilters = {
  sportId?: string;
  status?: ActivityStatus;
  date?: Date;
};

function normalizeActivity(data: FirebaseFirestore.DocumentData): Activity {
  return {
    ...data,
    date: data.date?.toDate ? data.date.toDate() : data.date,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    lastMessageAt: data.lastMessageAt?.toDate ? data.lastMessageAt.toDate() : data.lastMessageAt,
    votingClosedAt: data.votingClosedAt?.toDate
      ? data.votingClosedAt.toDate().toISOString()
      : (data.votingClosedAt ?? null),
  } as Activity;
}

export class ActivitiesService {
  private activitiesRef = db.collection(ACTIVITIES_COLLECTION);

  async createActivity(createdBy: string, data: CreateActivityDto): Promise<Activity> {
    const creator = await usersService.getUserById(createdBy);

    if (!creator) {
      throw new Error("User profile not found");
    }

    if (creator.status !== "active") {
      throw new Error("Only active users can create activities");
    }

    const sport = await sportsService.getSportById(data.sportId);

    if (!sport) {
      throw new Error("Sport not found");
    }

    const docRef = this.activitiesRef.doc();
    const activity = createActivityObject(docRef.id, createdBy, data, creator.name, creator.role === "partner");

    await docRef.set(activity);

    if (creator.role === "partner") {
      const followerIds: string[] = (await db.collection("users").doc(createdBy).get()).data()?.followers ?? [];
      if (followerIds.length > 0) {
        notificationsService.createNotificationForMany(
          followerIds,
          "new_activity_from_followed",
          "notifications.msg.newActivityFromFollowed",
          { name: creator.name, title: data.title },
          docRef.id
        ).catch(() => {});
      }
    }

    return activity;
  }

  async getActivityById(activityId: string): Promise<Activity | null> {
    const doc = await this.activitiesRef.doc(activityId).get();

    if (!doc.exists) {
      return null;
    }

    const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

    if (
      activity.status !== "completed" &&
      activity.status !== "cancelled" &&
      new Date(activity.date) < new Date()
    ) {
      return this.completeActivityIfDue(activityId, activity);
    }

    return activity;
  }

  private async completeActivityIfDue(activityId: string, fallback: Activity): Promise<Activity> {
    const docRef = this.activitiesRef.doc(activityId);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) return null;

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (
        activity.status === "completed" ||
        activity.status === "cancelled" ||
        new Date(activity.date) >= new Date()
      ) {
        return { activity, didComplete: false };
      }

      const now = new Date();
      tx.update(docRef, { status: "completed" as ActivityStatus, updatedAt: now });

      return { activity: { ...activity, status: "completed" as ActivityStatus, updatedAt: now }, didComplete: true };
    });

    if (!result) return fallback;

    if (result.didComplete) {
      const participants = result.activity.participantsList.filter(id => id !== result.activity.createdBy);
      await Promise.all([
        usersService.incrementStat(result.activity.createdBy, "activitiesCreated", 1),
        ...participants.map(id => usersService.incrementStat(id, "activitiesJoined", 1)),
      ]);

      if (result.activity.createdByVerified && participants.length > 0) {
        notificationsService.createNotificationForMany(
          participants,
          "activity_rating_open",
          "notifications.msg.activityRatingOpen",
          { title: result.activity.title },
          result.activity.id
        ).catch(() => {});
      }
    }

    return result.activity;
  }

  async listActivities(filters: ListActivitiesFilters = {}): Promise<Activity[]> {
    const statusFilter = filters.status ? [filters.status] : ["open", "full"];
    const isPastQuery = filters.status === "completed" || filters.status === "cancelled";

    let query: FirebaseFirestore.Query = this.activitiesRef
      .where("status", "in", statusFilter);

    if (!isPastQuery) {
      query = query.where("date", ">", new Date());
    }

    if (filters.sportId) {
      query = query.where("sportId", "==", filters.sportId);
    }

    if (filters.difficultyLevel) {
      query = query.where("difficultyLevel", "==", filters.difficultyLevel);
    }

    if (filters.createdBy) {
      query = query.where("createdBy", "==", filters.createdBy);
    }

    if (filters.verifiedOnly) {
      query = query.where("createdByVerified", "==", true);
    }

    const snapshot = await query.get();

    let activities = snapshot.docs.map((doc) => normalizeActivity({ id: doc.id, ...doc.data() }));

    if (
      filters.lat !== undefined &&
      filters.lng !== undefined &&
      filters.radiusKm !== undefined
    ) {
      const center = {
        lat: filters.lat,
        lng: filters.lng,
      };

      if (!isValidCoordinates(center)) {
        throw new Error("Invalid coordinates");
      }

      activities = activities.filter((activity) => {
        const activityCoordinates = {
          lat: activity.location.lat,
          lng: activity.location.lng,
        };

        if (!isValidCoordinates(activityCoordinates)) {
          return false;
        }

        return isWithinRadiusKm(
          center,
          activityCoordinates,
          filters.radiusKm!
        );
      });
    }

    return activities;
  }

  async getFriendsActivities(friendIds: string[]): Promise<Activity[]> {
    if (friendIds.length === 0) return [];

    const now = new Date();
    const chunks: string[][] = [];
    for (let i = 0; i < friendIds.length; i += 10) {
      chunks.push(friendIds.slice(i, i + 10));
    }

    const snapshots = await Promise.all(
      chunks.map((ids) =>
        this.activitiesRef.where("participantsList", "array-contains-any", ids).get()
      )
    );

    const seen = new Set<string>();
    const activities: Activity[] = [];

    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);

        const activity = normalizeActivity({ id: doc.id, ...doc.data() });
        const isUpcoming = (activity.status === "open" || activity.status === "full") && new Date(activity.date) > now;

        if (isUpcoming) {
          activities.push(activity);
        }
      }
    }

    return activities.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async getFriendsFeed(friendIds: string[], friendNames: Map<string, string>): Promise<FeedItem[]> {
    if (friendIds.length === 0) return [];

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // últimos 30 dias
    const chunks: string[][] = [];
    for (let i = 0; i < friendIds.length; i += 10) chunks.push(friendIds.slice(i, i + 10));

    const [participantSnaps, createdSnaps] = await Promise.all([
      Promise.all(chunks.map((ids) =>
        this.activitiesRef.where("participantsList", "array-contains-any", ids).get()
      )),
      Promise.all(chunks.map((ids) =>
        this.activitiesRef.where("createdBy", "in", ids).get()
      )),
    ]);

    const seen = new Set<string>();
    const items: FeedItem[] = [];

    const process = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      if (seen.has(doc.id)) return;
      seen.add(doc.id);
      const a = normalizeActivity({ id: doc.id, ...doc.data() });
      const createdAt = typeof a.createdAt === 'string' ? new Date(a.createdAt) : a.createdAt as Date;
      if (createdAt < since) return;

      // 'created' event
      if (friendIds.includes(a.createdBy)) {
        items.push({ type: 'created', userId: a.createdBy, userName: friendNames.get(a.createdBy) ?? '', activityId: a.id, activityTitle: a.title, timestamp: createdAt.toISOString() });
      }

      // 'joined' events for participants who didn't create
      for (const uid of a.participantsList) {
        if (uid !== a.createdBy && friendIds.includes(uid)) {
          const joinedTimestamp = a.joinedAt?.[uid] ?? createdAt.toISOString();
          items.push({ type: 'joined', userId: uid, userName: friendNames.get(uid) ?? '', activityId: a.id, activityTitle: a.title, timestamp: joinedTimestamp });
        }
      }

      // 'mvp' events
      if (a.status === 'completed' && a.mvpWinners?.length) {
        for (const uid of a.mvpWinners) {
          if (friendIds.includes(uid)) {
            items.push({ type: 'mvp', userId: uid, userName: friendNames.get(uid) ?? '', activityId: a.id, activityTitle: a.title, timestamp: typeof a.votingClosedAt === 'string' ? a.votingClosedAt : createdAt.toISOString() });
          }
        }
      }
    };

    for (const snapshot of [...participantSnaps, ...createdSnaps]) {
      for (const doc of snapshot.docs) process(doc);
    }

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 30);
  }

  async getMyActivities(userId: string, filters: MyActivitiesFilters = {}): Promise<Activity[]> {
    let participantQuery: FirebaseFirestore.Query = this.activitiesRef
      .where("participantsList", "array-contains", userId)
      .orderBy("date", "asc");

    let waitlistQuery: FirebaseFirestore.Query = this.activitiesRef
      .where("waitlist", "array-contains", userId)
      .orderBy("date", "asc");

    if (filters.sportId) {
      participantQuery = participantQuery.where("sportId", "==", filters.sportId);
      waitlistQuery = waitlistQuery.where("sportId", "==", filters.sportId);
    }

    if (filters.status) {
      participantQuery = participantQuery.where("status", "==", filters.status);
      waitlistQuery = waitlistQuery.where("status", "==", filters.status);
    }

    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      participantQuery = participantQuery.where("date", ">=", start).where("date", "<=", end);
      waitlistQuery = waitlistQuery.where("date", ">=", start).where("date", "<=", end);
    }

    const [participantSnap, waitlistSnap] = await Promise.all([
      participantQuery.get(),
      waitlistQuery.get(),
    ]);

    const seen = new Set<string>();
    const activities: Activity[] = [];

    for (const doc of [...participantSnap.docs, ...waitlistSnap.docs]) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        activities.push(normalizeActivity({ id: doc.id, ...doc.data() }));
      }
    }

    return activities.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async getUserActivities(userId: string, limit = 5): Promise<Activity[]> {
    const snap = await this.activitiesRef
      .where("participantsList", "array-contains", userId)
      .orderBy("date", "asc")
      .get();
    return snap.docs
      .map(doc => normalizeActivity({ id: doc.id, ...doc.data() }))
      .filter(a => a.status === "completed")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  async updateActivity(
    activityId: string,
    requesterId: string,
    data: UpdateActivityDto,
    requesterRole?: UserRole
  ): Promise<Activity> {
    const activity = await this.getActivityById(activityId);

    if (!activity) {
      throw new Error("Activity not found");
    }

    if (activity.createdBy !== requesterId && requesterRole !== "admin") {
      throw new Error("Only the activity creator or an admin can update it");
    }

    if (activity.status === "cancelled" || activity.status === "completed") {
      throw new Error("Cannot update a cancelled or completed activity");
    }

    const now = new Date();
    const changes: Record<string, unknown> = { updatedAt: now };
    if (data.title !== undefined) {
      const title = data.title.trim();
      if (!title) throw new Error("O título não pode ficar vazio");
      if (title.length > 100) throw new Error("O título é demasiado longo");
      changes.title = title;
    }
    if (data.description !== undefined) {
      const description = data.description.trim();
      if (!description) throw new Error("A descrição não pode ficar vazia");
      if (description.length > 1000) throw new Error("A descrição é demasiado longa");
      changes.description = description;
    }
    // A data não é editável depois de criada — combinam mudanças no chat.
    if (data.difficultyLevel !== undefined) changes.difficultyLevel = data.difficultyLevel;
    if (data.requiresApproval !== undefined) changes.requiresApproval = data.requiresApproval;
    if (data.maxParticipants !== undefined) {
      if (data.maxParticipants < 2) throw new Error("maxParticipants must be at least 2");
      if (data.maxParticipants < activity.participantsList.length) throw new Error(`Cannot set maxParticipants below current participant count (${activity.participantsList.length})`);
      changes.maxParticipants = data.maxParticipants;
      const newStatus: ActivityStatus = activity.participantsList.length >= data.maxParticipants ? "full" : "open";
      if (newStatus !== activity.status) changes.status = newStatus;
    }

    await this.activitiesRef.doc(activityId).update(changes);

    return { ...activity, ...changes } as Activity;
  }

  async listAllActivities(
    filters: AdminListActivitiesFilters = {}
  ): Promise<Activity[]> {
    let query: FirebaseFirestore.Query = this.activitiesRef.orderBy(
      "date",
      "desc"
    );

    if (filters.status) {
      query = query.where("status", "==", filters.status);
    }

    if (filters.createdBy) {
      query = query.where("createdBy", "==", filters.createdBy);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) =>
      normalizeActivity({ id: doc.id, ...doc.data() })
    );
  }

  async deleteActivityAsAdmin(activityId: string): Promise<void> {
    const activity = await this.getActivityById(activityId);

    if (!activity) {
      throw new Error("Activity not found");
    }

    if (activity.status === "completed") {
      throw new Error("Cannot delete a completed activity");
    }

    const notificationsSnapshot = await db
      .collection(NOTIFICATIONS_COLLECTION)
      .where("activityId", "==", activityId)
      .get();

    if (!notificationsSnapshot.empty) {
      const batch = db.batch();
      notificationsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    await db.recursiveDelete(this.activitiesRef.doc(activityId));
  }

  async cancelActivity(activityId: string, requesterId: string): Promise<Activity> {
    const activity = await this.getActivityById(activityId);

    if (!activity) {
      throw new Error("Activity not found");
    }

    if (activity.createdBy !== requesterId) {
      throw new Error("Only the activity creator can cancel it");
    }

    if (activity.status === "cancelled") {
      throw new Error("Activity is already cancelled");
    }

    if (activity.status === "completed") {
      throw new Error("Cannot cancel a completed activity");
    }

    const now = new Date();

    await this.activitiesRef.doc(activityId).update({
      status: "cancelled" as ActivityStatus,
      updatedAt: now,
    });

    const participants = activity.participantsList.filter(id => id !== requesterId);
    if (participants.length > 0) {
      await notificationsService.createNotificationForMany(
        participants,
        "activity_cancelled",
        "notifications.msg.activityCancelled",
        { title: activity.title },
        activityId
      );
    }

    return { ...activity, status: "cancelled", updatedAt: now };
  }

  async removeParticipant(activityId: string, requesterId: string, participantId: string): Promise<Activity> {
    const docRef = this.activitiesRef.doc(activityId);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);

      if (!doc.exists) throw new Error("Activity not found");

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (activity.createdBy !== requesterId) {
        throw new Error("Only the activity creator can remove participants");
      }

      if (activity.status === "cancelled" || activity.status === "completed") {
        throw new Error("Cannot remove participants from a cancelled or completed activity");
      }

      if (participantId === activity.createdBy) {
        throw new Error("Cannot remove the activity creator");
      }

      if (!activity.participantsList.includes(participantId)) {
        throw new Error("User is not a participant of this activity");
      }

      let updatedParticipants = activity.participantsList.filter(id => id !== participantId);
      let updatedWaitlist = [...activity.waitlist];
      let promoted: string | undefined;

      if (!activity.requiresApproval && updatedWaitlist.length > 0) {
        promoted = updatedWaitlist.shift()!;
        updatedParticipants = [...updatedParticipants, promoted];
      }

      const isFull = updatedParticipants.length >= activity.maxParticipants;
      const newStatus: ActivityStatus = isFull ? "full" : "open";
      const now = new Date();

      tx.update(docRef, { participantsList: updatedParticipants, waitlist: updatedWaitlist, status: newStatus, updatedAt: now });

      return { activity, updatedParticipants, updatedWaitlist, newStatus, now, promoted };
    });

    await notificationsService.createNotification(
      participantId,
      "participant_removed",
      "notifications.msg.participantRemoved",
      { title: result.activity.title },
      activityId
    );

    return { ...result.activity, participantsList: result.updatedParticipants, waitlist: result.updatedWaitlist, status: result.newStatus, updatedAt: result.now };
  }

  async joinActivity(activityId: string, userId: string): Promise<Activity> {
    const docRef = this.activitiesRef.doc(activityId);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);

      if (!doc.exists) throw new Error("Activity not found");

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (activity.status === "cancelled" || activity.status === "completed") {
        throw new Error("Cannot join a cancelled or completed activity");
      }

      if (activity.createdBy === userId) {
        throw new Error("Não podes pedir para entrar na tua própria atividade");
      }

      if (activity.participantsList.includes(userId)) {
        throw new Error("User is already a participant");
      }

      if (activity.waitlist.includes(userId)) {
        throw new Error("User is already in the waitlist");
      }

      const now = new Date();

      if (activity.requiresApproval || activity.status === "full") {
        const updatedWaitlist = [...activity.waitlist, userId];
        tx.update(docRef, { waitlist: updatedWaitlist, updatedAt: now });
        return { activity, updatedWaitlist, now, joined: false };
      }

      const updatedParticipants = [...activity.participantsList, userId];
      const isFull = updatedParticipants.length >= activity.maxParticipants;
      const newStatus: ActivityStatus = isFull ? "full" : "open";
      tx.update(docRef, { participantsList: updatedParticipants, status: newStatus, updatedAt: now, [`joinedAt.${userId}`]: now.toISOString() });
      return { activity, updatedParticipants, newStatus, now, joined: true };
    });

    if (result.joined) {
      await notificationsService.createNotification(
        result.activity.createdBy,
        "activity_joined",
        "notifications.msg.activityJoined",
        { title: result.activity.title },
        activityId
      );

      if (result.newStatus === "full") {
        await notificationsService.createNotification(
          result.activity.createdBy,
          "activity_full",
          "notifications.msg.activityFull",
          { title: result.activity.title },
          activityId
        );
      }

      return { ...result.activity, participantsList: result.updatedParticipants!, status: result.newStatus!, updatedAt: result.now };
    }

    await notificationsService.createNotification(
      result.activity.createdBy,
      "activity_join_request",
      "notifications.msg.activityJoinRequest",
      { title: result.activity.title },
      activityId
    );

    return { ...result.activity, waitlist: result.updatedWaitlist!, updatedAt: result.now };
  }

  async leaveActivity(activityId: string, userId: string): Promise<Activity> {
    const docRef = this.activitiesRef.doc(activityId);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);

      if (!doc.exists) throw new Error("Activity not found");

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (activity.status === "cancelled" || activity.status === "completed") {
        throw new Error("Cannot leave a cancelled or completed activity");
      }

      if (activity.createdBy === userId) {
        throw new Error("Activity creator cannot leave — cancel the activity instead");
      }

      const inWaitlist = activity.waitlist.includes(userId);
      const inParticipants = activity.participantsList.includes(userId);

      if (!inWaitlist && !inParticipants) {
        throw new Error("User is not part of this activity");
      }

      const now = new Date();

      if (inWaitlist) {
        const updatedWaitlist = activity.waitlist.filter(id => id !== userId);
        tx.update(docRef, { waitlist: updatedWaitlist, updatedAt: now });
        return { activity, updatedWaitlist, now, leftParticipants: false, promoted: undefined };
      }

      let updatedParticipants = activity.participantsList.filter(id => id !== userId);
      let updatedWaitlist = [...activity.waitlist];
      let promoted: string | undefined;

      if (!activity.requiresApproval && updatedWaitlist.length > 0) {
        promoted = updatedWaitlist.shift()!;
        updatedParticipants = [...updatedParticipants, promoted];
      }

      const isFull = updatedParticipants.length >= activity.maxParticipants;
      const newStatus: ActivityStatus = isFull ? "full" : "open";
      const { [userId]: _removed, ...remainingJoinedAt } = activity.joinedAt ?? {};
      tx.update(docRef, { participantsList: updatedParticipants, waitlist: updatedWaitlist, status: newStatus, updatedAt: now, joinedAt: remainingJoinedAt });
      return { activity, updatedParticipants, updatedWaitlist, newStatus, now, leftParticipants: true, promoted };
    });

    if (result.leftParticipants) {
      await notificationsService.createNotification(
        result.activity.createdBy,
        "activity_left",
        "notifications.msg.activityLeft",
        { title: result.activity.title },
        activityId
      );

      return { ...result.activity, participantsList: result.updatedParticipants!, waitlist: result.updatedWaitlist!, status: result.newStatus!, updatedAt: result.now };
    }

    return { ...result.activity, waitlist: result.updatedWaitlist!, updatedAt: result.now };
  }

  async admitFromWaitlist(activityId: string, requesterId: string, userId: string): Promise<Activity> {
    const docRef = this.activitiesRef.doc(activityId);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);

      if (!doc.exists) throw new Error("Activity not found");

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (activity.createdBy !== requesterId) {
        throw new Error("Only the activity creator can admit participants from the waitlist");
      }

      if (activity.status === "cancelled" || activity.status === "completed") {
        throw new Error("Cannot admit participants to a cancelled or completed activity");
      }

      if (!activity.waitlist.includes(userId)) {
        throw new Error("User is not in the waitlist");
      }

      const updatedWaitlist = activity.waitlist.filter(id => id !== userId);
      const updatedParticipants = [...activity.participantsList, userId];
      const isFull = updatedParticipants.length >= activity.maxParticipants;
      const newStatus: ActivityStatus = isFull ? "full" : "open";
      const now = new Date();

      tx.update(docRef, { participantsList: updatedParticipants, waitlist: updatedWaitlist, status: newStatus, updatedAt: now, [`joinedAt.${userId}`]: now.toISOString() });

      return { activity, updatedParticipants, updatedWaitlist, newStatus, now };
    });

    await notificationsService.createNotification(
      userId,
      "waitlist_admitted",
      "notifications.msg.waitlistAdmitted",
      { title: result.activity.title },
      activityId
    );

    return { ...result.activity, participantsList: result.updatedParticipants, waitlist: result.updatedWaitlist, status: result.newStatus, updatedAt: result.now };
  }

  async rejectFromWaitlist(activityId: string, requesterId: string, userId: string): Promise<Activity> {
    const docRef = this.activitiesRef.doc(activityId);

    return await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);

      if (!doc.exists) throw new Error("Activity not found");

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (activity.createdBy !== requesterId) {
        throw new Error("Only the activity creator can reject participants from the waitlist");
      }

      if (activity.status === "cancelled" || activity.status === "completed") {
        throw new Error("Cannot reject participants from a cancelled or completed activity");
      }

      if (!activity.waitlist.includes(userId)) {
        throw new Error("User is not in the waitlist");
      }

      const updatedWaitlist = activity.waitlist.filter(id => id !== userId);
      const now = new Date();

      tx.update(docRef, { waitlist: updatedWaitlist, updatedAt: now });

      return { ...activity, waitlist: updatedWaitlist, updatedAt: now };
    });
  }

  async voteMvp(activityId: string, voterId: string, votedForId: string): Promise<void> {
    const docRef = this.activitiesRef.doc(activityId);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error("Activity not found");

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (activity.status !== "completed") throw new Error("MVP voting is only available for completed activities");
      if (activity.votingClosedAt) throw new Error("MVP voting is closed");
      if (!activity.participantsList.includes(voterId)) throw new Error("Only participants can vote");
      if (!activity.participantsList.includes(votedForId)) throw new Error("You can only vote for a participant");
      if (voterId === votedForId) throw new Error("You cannot vote for yourself");
      if (activity.mvpVotes[voterId]) throw new Error("You have already voted");

      const updatedVotes = { ...activity.mvpVotes, [voterId]: votedForId };
      const now = new Date();
      const allVoted = activity.participantsList.every(id => updatedVotes[id] !== undefined);

      if (allVoted) {
        const winners = tallyMvpWinners(updatedVotes);
        tx.update(docRef, { mvpVotes: updatedVotes, mvpWinners: winners, votingClosedAt: now, updatedAt: now });
        return { activity, closed: true as const, winners };
      }

      tx.update(docRef, { mvpVotes: updatedVotes, updatedAt: now });
      return { activity, closed: false as const };
    });

    if (result.closed) {
      for (const winnerId of result.winners) {
        await usersService.incrementStat(winnerId, "mvpVotesReceived", 1);
      }

      await notificationsService.createNotificationForMany(
        result.activity.participantsList,
        "mvp_result",
        result.winners.length === 1
          ? "notifications.msg.mvpResult"
          : "notifications.msg.mvpResultTie",
        { title: result.activity.title },
        activityId
      );
    }
  }

  async rateActivity(activityId: string, raterId: string, rating: number): Promise<void> {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("A avaliação tem de ser um número inteiro entre 1 e 5");
    }

    const docRef = this.activitiesRef.doc(activityId);

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new Error("Activity not found");

      const activity = normalizeActivity({ id: doc.id, ...doc.data()! });

      if (activity.status !== "completed") {
        throw new Error("Só é possível avaliar atividades terminadas");
      }
      if (!activity.createdByVerified) {
        throw new Error("Só é possível avaliar atividades de empresas");
      }
      if (!activity.participantsList.includes(raterId)) {
        throw new Error("Só participantes podem avaliar a atividade");
      }
      if (activity.ratings?.[raterId] !== undefined) {
        throw new Error("Já avaliaste esta atividade");
      }

      const updatedRatings = { ...(activity.ratings ?? {}), [raterId]: rating };
      const values = Object.values(updatedRatings);
      const ratingAverage = values.reduce((sum, r) => sum + r, 0) / values.length;
      const now = new Date();

      tx.update(docRef, {
        ratings: updatedRatings,
        ratingAverage,
        ratingCount: values.length,
        updatedAt: now,
      });

      return { activity };
    });

    await usersService.addRatingToUser(result.activity.createdBy, rating);
  }
}

export const activitiesService = new ActivitiesService();
