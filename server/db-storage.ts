import { 
  type Club, 
  type InsertClub, 
  type Event, 
  type InsertEvent,
  type User,
  type InsertUser,
  type UserPreference,
  type InsertUserPreference,
  type HiddenEvent,
  type InsertHiddenEvent
} from "@shared/schema";
import { IStorage, EventFilters } from "./storage";
import { db } from "./db";
import { eq, and, inArray, gte, lte, desc, asc, sql, isNull, not } from "drizzle-orm";
import { clubs, events, users, userPreferences, hiddenEvents } from "../shared/schema";
import crypto from 'crypto';

export class DbStorage implements IStorage {
  // Club operations
  async getClub(id: number): Promise<Club | undefined> {
    const result = await db.select().from(clubs).where(eq(clubs.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async getClubByStravaId(stravaClubId: string): Promise<Club | undefined> {
    const result = await db.select().from(clubs).where(eq(clubs.stravaClubId, stravaClubId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async getClubs(approved?: boolean): Promise<Club[]> {
    if (approved !== undefined) {
      return db.select().from(clubs).where(eq(clubs.approved, approved));
    }
    return db.select().from(clubs);
  }

  async getClubsSortedByScore(): Promise<Club[]> {
    // Get clubs sorted by score
    return db.select().from(clubs)
      .where(eq(clubs.approved, true))
      .orderBy(desc(clubs.clubScore));
  }

  async createClub(club: InsertClub): Promise<Club> {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    const result = await db.insert(clubs).values({
      ...club,
      verified: false,
      verificationToken,
      approved: false
    }).returning();
    
    return result[0];
  }

  async updateClub(id: number, club: Partial<Club>): Promise<Club | undefined> {
    const result = await db.update(clubs)
      .set(club)
      .where(eq(clubs.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async verifyClub(token: string): Promise<Club | undefined> {
    // Find club by verification token
    const clubsToVerify = await db.select().from(clubs)
      .where(eq(clubs.verificationToken, token));
    
    if (clubsToVerify.length === 0) {
      return undefined;
    }
    
    // Update club to verified status
    const result = await db.update(clubs)
      .set({ 
        verified: true,
        verificationToken: null
      })
      .where(eq(clubs.id, clubsToVerify[0].id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async updateClubStravaTokens(
    clubId: number, 
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    }
  ): Promise<Club | undefined> {
    const result = await db.update(clubs)
      .set({ 
        stravaAccessToken: tokens.accessToken,
        stravaRefreshToken: tokens.refreshToken,
        stravaTokenExpiresAt: tokens.expiresAt
      })
      .where(eq(clubs.id, clubId))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async updateClubStatistics(
    clubId: number, 
    stats: {
      avgParticipants?: number;
      participantsCount?: number;
      eventsCount?: number;
      lastEventDate?: Date;
    }
  ): Promise<Club | undefined> {
    // First get the club to preserve any undefined values
    const existingClub = await this.getClub(clubId);
    if (!existingClub) return undefined;
    
    const updateData: Partial<Club> = {};
    
    if (stats.avgParticipants !== undefined) {
      updateData.avgParticipants = stats.avgParticipants;
    }
    
    if (stats.participantsCount !== undefined) {
      updateData.participantsCount = stats.participantsCount;
    }
    
    if (stats.eventsCount !== undefined) {
      updateData.eventsCount = stats.eventsCount;
    }
    
    if (stats.lastEventDate !== undefined) {
      updateData.lastEventDate = stats.lastEventDate;
    }
    
    // Calculate the club score
    const clubScore = await this.calculateClubScore(clubId);
    updateData.clubScore = clubScore;
    
    // Update the club with new statistics
    const result = await db.update(clubs)
      .set(updateData)
      .where(eq(clubs.id, clubId))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async calculateClubScore(clubId: number): Promise<number> {
    // Get the club
    const club = await this.getClub(clubId);
    if (!club) return 0;
    
    // Calculate score based on:
    // 1. Number of events (higher is better)
    // 2. Average participants (higher is better)
    // 3. Recency of last event (more recent is better)
    
    const eventsScore = club.eventsCount || 0;
    const participantsScore = club.avgParticipants || 0;
    
    // Calculate recency score (higher for more recent events)
    let recencyScore = 0;
    if (club.lastEventDate) {
      const now = new Date();
      const lastEventDate = new Date(club.lastEventDate);
      const daysSinceLastEvent = Math.floor((now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // More recent events get higher scores (max 100)
      recencyScore = Math.max(0, 100 - daysSinceLastEvent);
    }
    
    // Calculate final score (weighted sum)
    const score = eventsScore * 5 + participantsScore * 10 + recencyScore;
    return Math.round(score);
  }

  // Event operations
  async getEvent(id: number): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async getEventByStravaId(stravaEventId: string): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.stravaEventId, stravaEventId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async getEvents(filters?: EventFilters): Promise<Event[]> {
    // Build SQL query parameters using conditions
    let queryConditions: any[] = [];
    
    if (filters) {
      if (filters.clubIds && filters.clubIds.length > 0) {
        queryConditions.push(`"clubId" IN (${filters.clubIds.join(',')})`);
      }
      
      if (filters.paceCategories && filters.paceCategories.length > 0) {
        const pacesFormatted = filters.paceCategories.map(p => `'${p}'`).join(',');
        queryConditions.push(`"paceCategory" IN (${pacesFormatted})`);
      }
      
      if (filters.beginnerFriendly) {
        queryConditions.push(`"beginnerFriendly" = true`);
      }
      
      if (filters.startDate) {
        queryConditions.push(`"startTime" >= '${filters.startDate.toISOString()}'`);
      }
      
      if (filters.endDate) {
        queryConditions.push(`"startTime" <= '${filters.endDate.toISOString()}'`);
      }
      
      // Handle distance ranges
      if (filters.distanceRanges && filters.distanceRanges.length > 0) {
        const distanceConditions = [];
        
        for (const range of filters.distanceRanges) {
          if (range === 'short') {
            distanceConditions.push(`("distance" IS NOT NULL AND "distance" < 5000)`);
          } else if (range === 'medium') {
            distanceConditions.push(`("distance" IS NOT NULL AND "distance" >= 5000 AND "distance" <= 10000)`);
          } else if (range === 'long') {
            distanceConditions.push(`("distance" IS NOT NULL AND "distance" > 10000)`);
          }
        }
        
        if (distanceConditions.length > 0) {
          queryConditions.push(`(${distanceConditions.join(' OR ')})`);
        }
      }
    }
    
    // Construct the final SQL query
    let sqlQuery = `SELECT * FROM "events"`;
    
    if (queryConditions.length > 0) {
      sqlQuery += ` WHERE ${queryConditions.join(' AND ')}`;
    }
    
    sqlQuery += ` ORDER BY "startTime" ASC`;
    
    // Execute the raw SQL query
    const result = await db.execute(sql.raw(sqlQuery));
    
    return result.rows as Event[];
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const result = await db.insert(events)
      .values(event)
      .returning();
    
    return result[0];
  }

  async updateEvent(id: number, event: Partial<Event>): Promise<Event | undefined> {
    const result = await db.update(events)
      .set(event)
      .where(eq(events.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events)
      .where(eq(events.id, id))
      .returning();
    
    return result.length > 0;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async getUserByStravaId(stravaUserId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.stravaUserId, stravaUserId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users)
      .values(user)
      .returning();
    
    return result[0];
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  async updateUserLogin(id: number): Promise<boolean> {
    const result = await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return result.length > 0;
  }

  // User preferences operations
  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  }

  async createUserPreferences(preferences: InsertUserPreference): Promise<UserPreference> {
    const result = await db.insert(userPreferences)
      .values(preferences)
      .returning();
    
    return result[0];
  }

  async updateUserPreferences(id: number, preferences: Partial<UserPreference>): Promise<UserPreference | undefined> {
    const result = await db.update(userPreferences)
      .set(preferences)
      .where(eq(userPreferences.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : undefined;
  }

  // Hidden events operations
  async getHiddenEvents(userId: number): Promise<HiddenEvent[]> {
    return db.select().from(hiddenEvents).where(eq(hiddenEvents.userId, userId));
  }

  async hideEvent(userId: number, eventId: number): Promise<boolean> {
    try {
      await db.insert(hiddenEvents)
        .values({ userId, eventId })
        .onConflictDoNothing();
      
      return true;
    } catch (error) {
      console.error('Error hiding event:', error);
      return false;
    }
  }

  async unhideEvent(userId: number, eventId: number): Promise<boolean> {
    const result = await db.delete(hiddenEvents)
      .where(
        and(
          eq(hiddenEvents.userId, userId),
          eq(hiddenEvents.eventId, eventId)
        )
      )
      .returning();
    
    return result.length > 0;
  }

  async getVisibleEvents(userId: number, filters?: EventFilters): Promise<Event[]> {
    // Get all hidden event IDs for this user
    const hiddenEventRows = await this.getHiddenEvents(userId);
    const hiddenEventIds = hiddenEventRows.map(row => row.eventId);
    
    // Get events with filters
    let allEvents = await this.getEvents(filters);
    
    // Filter out hidden events
    if (hiddenEventIds.length > 0) {
      allEvents = allEvents.filter(event => !hiddenEventIds.includes(event.id));
    }
    
    return allEvents;
  }
}

// Export a singleton instance
export const dbStorage = new DbStorage();