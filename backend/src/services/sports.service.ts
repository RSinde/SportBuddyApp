import { db } from "../config/firebase";
import {
  Sport,
  CreateSportDto,
  UpdateSportDto,
  createSportObject,
} from "../models/sport.model";

const SPORTS_COLLECTION = "sports";

export class SportsService {
  private sportsRef = db.collection(SPORTS_COLLECTION);

  async createSport(data: CreateSportDto): Promise<Sport> {
    const duplicateSnapshot = await this.sportsRef
      .where("name", "==", data.name)
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      throw new Error(`Sport '${data.name}' already exists`);
    }

    const docRef = this.sportsRef.doc();
    const sport = createSportObject(docRef.id, data);
    await docRef.set(sport);

    return sport;
  }

  async getSportById(sportId: string): Promise<Sport | null> {
    const doc = await this.sportsRef.doc(sportId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as Sport;
  }

  async listSports(): Promise<Sport[]> {
    const snapshot = await this.sportsRef.orderBy("name", "asc").get();
    return snapshot.docs.map(doc => doc.data() as Sport);
  }

  async updateSport(sportId: string, data: UpdateSportDto): Promise<Sport> {
    const sport = await this.getSportById(sportId);

    if (!sport) {
      throw new Error("Sport not found");
    }

    const now = new Date();
    const changes = { ...data, updatedAt: now };

    await this.sportsRef.doc(sportId).update(changes);

    return { ...sport, ...changes };
  }

  async deleteSport(sportId: string): Promise<void> {
    const sport = await this.getSportById(sportId);

    if (!sport) {
      throw new Error("Sport not found");
    }

    await this.sportsRef.doc(sportId).delete();
  }
}

export const sportsService = new SportsService();
