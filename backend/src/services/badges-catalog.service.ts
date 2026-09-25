import { db } from "../config/firebase";
import {
  BadgeDefinition,
  CreateBadgeDto,
  UpdateBadgeDto,
  createBadgeObject,
} from "../models/badge.model";

const BADGES_COLLECTION = "badges";
const CACHE_TTL_MS = 5 * 60 * 1000;

export class BadgesCatalogService {
  private badgesRef = db.collection(BADGES_COLLECTION);
  private cache: BadgeDefinition[] | null = null;
  private cacheExpiresAt = 0;

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  async listBadges(): Promise<BadgeDefinition[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }

    const snapshot = await this.badgesRef.get();
    const badges = snapshot.docs.map((doc) => doc.data() as BadgeDefinition);

    this.cache = badges;
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;

    return badges;
  }

  async getBadgeById(badgeId: string): Promise<BadgeDefinition | null> {
    const doc = await this.badgesRef.doc(badgeId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as BadgeDefinition;
  }

  async createBadge(data: CreateBadgeDto): Promise<BadgeDefinition> {
    const docRef = this.badgesRef.doc();
    const badge = createBadgeObject(docRef.id, data);

    await docRef.set(badge);
    this.invalidateCache();

    return badge;
  }

  /**
   * Creates or overwrites a badge with a fixed, caller-chosen ID.
   * Safe to call repeatedly with the same ID (e.g. from a seed script) —
   * it preserves the original `createdAt` and only bumps `updatedAt`.
   */
  async upsertBadge(
    badgeId: string,
    data: CreateBadgeDto
  ): Promise<BadgeDefinition> {
    const existing = await this.getBadgeById(badgeId);
    const badge = createBadgeObject(badgeId, data, existing?.createdAt);

    await this.badgesRef.doc(badgeId).set(badge);
    this.invalidateCache();

    return badge;
  }

  async updateBadge(
    badgeId: string,
    data: UpdateBadgeDto
  ): Promise<BadgeDefinition> {
    const badge = await this.getBadgeById(badgeId);

    if (!badge) {
      throw new Error("Badge not found");
    }

    const now = new Date();
    const definedData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );
    const changes = { ...definedData, updatedAt: now };

    await this.badgesRef.doc(badgeId).update(changes);
    this.invalidateCache();

    return { ...badge, ...changes };
  }

  async deleteBadge(badgeId: string): Promise<void> {
    const badge = await this.getBadgeById(badgeId);

    if (!badge) {
      throw new Error("Badge not found");
    }

    await this.badgesRef.doc(badgeId).delete();
    this.invalidateCache();
  }

  
  async syncCatalog(
    definitions: ({ id: string } & CreateBadgeDto)[]
  ): Promise<void> {
    const existing = await this.listBadges();
    const validIds = new Set(definitions.map((definition) => definition.id));

    for (const { id, ...data } of definitions) {
      await this.upsertBadge(id, data);
    }

    const staleBadges = existing.filter((badge) => !validIds.has(badge.id));
    for (const badge of staleBadges) {
      await this.deleteBadge(badge.id);
    }
  }
}

export const badgesCatalogService = new BadgesCatalogService();
