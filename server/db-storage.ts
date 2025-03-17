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
import { 
  eq, 
  and, 
  or, 
  inArray, 
  gte, 
  lte, 
  lt, 
  gt, 
  desc, 
  asc, 
  sql, 
  isNull, 
  not, 
  SQL 
} from "drizzle-orm";
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

  async getClubs(): Promise<Club[]> {
    return db.select().from(clubs);
  }

  async getClubsSortedByScore(): Promise<Club[]> {
    // Get clubs sorted by score, without filtering by approved
    return db.select().from(clubs)
      .orderBy(desc(clubs.clubScore));
  }

  async createClub(club: InsertClub): Promise<Club> {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Since we're not using verified/approved flags anymore, we set them to true by default
    // but keep verificationToken for backward compatibility
    const result = await db.insert(clubs).values({
      ...club,
      verified: true,
      verificationToken,
      approved: true
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
    // We set both verified and approved to true since we're removing gates
    const result = await db.update(clubs)
      .set({ 
        verified: true,
        approved: true,
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
    
    // Ensure all numeric values are valid numbers (not NaN or undefined)
    if (stats.avgParticipants !== undefined) {
      updateData.avgParticipants = isNaN(stats.avgParticipants) ? 0 : stats.avgParticipants;
    }
    
    if (stats.participantsCount !== undefined) {
      updateData.participantsCount = isNaN(stats.participantsCount) ? 0 : stats.participantsCount;
    }
    
    if (stats.eventsCount !== undefined) {
      updateData.eventsCount = isNaN(stats.eventsCount) ? 0 : stats.eventsCount;
    }
    
    if (stats.lastEventDate !== undefined) {
      updateData.lastEventDate = stats.lastEventDate;
    }
    
    // Calculate the club score
    const clubScore = await this.calculateClubScore(clubId);
    updateData.clubScore = isNaN(clubScore) ? 0 : clubScore;
    
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
    
    // Get events from the last two months only for activity score calculation
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    // Query events for this club from the last two months
    const recentEvents = await db.select()
      .from(events)
      .where(
        and(
          eq(events.clubId, clubId),
          gte(events.startTime, twoMonthsAgo)
        )
      );
    
    // Use the count of recent events instead of total events count
    const recentEventsCount = recentEvents.length;
    
    // Calculate score based on:
    // 1. Number of recent events (last 2 months) - weighted more heavily
    // 2. Recency of last event - weighted more heavily
    // 3. Average participants - weighted less
    
    // Calculate recency score with higher weight for more recent events
    let recencyScore = 0;
    if (club.lastEventDate) {
      const now = new Date();
      const lastEventDate = new Date(club.lastEventDate);
      const daysSinceLastEvent = Math.floor((now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // More recent events get much higher scores (max 150)
      // Exponential decay to prioritize very recent activity
      recencyScore = Math.max(0, 150 - Math.pow(daysSinceLastEvent, 1.2));
    }
    
    // Calculate event frequency for recent events (events per week)
    let frequencyBonus = 0;
    if (recentEventsCount > 1) {
      // Estimate weekly events (improved approach for 2-month window)
      // 8.7 weeks in 2 months (average)
      const weeksInTwoMonths = 8.7;
      const eventsPerWeek = recentEventsCount / weeksInTwoMonths;
      
      // Bonus points for clubs that host regular weekly events
      // Higher frequency = higher bonus (capped at 150)
      frequencyBonus = Math.min(150, Math.round(eventsPerWeek * 40));
    }
    
    const participantsScore = club.avgParticipants || 0;
    
    // Calculate final score (weighted sum with adjusted weights)
    // Recent events count and recency are weighted higher
    const score = (recentEventsCount * 15) + (participantsScore * 5) + recencyScore + frequencyBonus;
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
    try {
      // Start with a simple query
      let query = db.select().from(events);
      
      // Apply filters if they exist
      if (filters) {
        const conditions = [];
        
        // Club IDs filter
        if (filters.clubIds && filters.clubIds.length > 0) {
          conditions.push(inArray(events.clubId, filters.clubIds));
        }
        
        // Pace categories filter - only apply if the filter doesn't contain all possible categories
        // This prevents filtering when all categories are selected (effectively no filter)
        if (filters.paceCategories && filters.paceCategories.length > 0 && 
            filters.paceCategories.length < 3) { // Assuming max 3 categories: beginner, intermediate, advanced
          // Use OR condition for pace categories
          const paceConditions = [];
          for (const category of filters.paceCategories) {
            paceConditions.push(eq(events.paceCategory, category));
          }
          if (paceConditions.length > 0) {
            conditions.push(or(...paceConditions));
          }
        }
        
        // Beginner friendly filter
        if (filters.beginnerFriendly) {
          conditions.push(eq(events.beginnerFriendly, true));
        }
        
        // Interval training filter
        if (filters.isIntervalTraining !== undefined) {
          conditions.push(eq(events.isIntervalTraining, filters.isIntervalTraining));
        }
        
        // Start date filter
        if (filters.startDate) {
          conditions.push(gte(events.startTime, filters.startDate));
        }
        
        // End date filter
        if (filters.endDate) {
          conditions.push(lte(events.startTime, filters.endDate));
        }
        
        // Distance ranges filter - only apply if not all ranges are selected
        // This prevents filtering when all ranges are selected (effectively no filter)
        if (filters.distanceRanges && filters.distanceRanges.length > 0 && 
            filters.distanceRanges.length < 3) { // Assuming max 3 ranges: short, medium, long
          const distanceConditions = [];
          
          for (const range of filters.distanceRanges) {
            if (range === 'short') {
              distanceConditions.push(sql`(${events.distance} IS NOT NULL AND ${events.distance} < 5000)`);
            } else if (range === 'medium') {
              distanceConditions.push(sql`(${events.distance} IS NOT NULL AND ${events.distance} >= 5000 AND ${events.distance} <= 10000)`);
            } else if (range === 'long') {
              distanceConditions.push(sql`(${events.distance} IS NOT NULL AND ${events.distance} > 10000)`);
            }
          }
          
          // Add distance conditions only if there are any
          if (distanceConditions.length > 0) {
            conditions.push(or(...distanceConditions));
          }
        }
        
        // Apply all conditions if any exist
        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }
      }
      
      // Add sorting
      query = query.orderBy(asc(events.startTime)) as any;
      
      // Execute query with retry logic for cloud-hosted database
      let retries = 0;
      const maxRetries = 5;
      
      while (retries <= maxRetries) {
        try {
          console.log(`Executing getEvents query (attempt ${retries + 1}/${maxRetries + 1})...`);
          const result = await query;
          console.log(`Successfully retrieved ${result.length} events`);
          return result;
        } catch (e: any) {
          // Check if it's a connection error (common with serverless databases)
          const isConnectionError = e.message && (
            e.message.includes('ECONNREFUSED') || 
            e.message.includes('connection') || 
            e.message.includes('timeout') ||
            e.message.includes('Connection terminated') ||
            e.message.includes('connect') ||
            e.message.includes('socket') ||
            e.code === 'ECONNREFUSED' ||
            e.code === 'ETIMEDOUT'
          );
          
          if ((isConnectionError) && retries < maxRetries) {
            // Wait with exponential backoff before retrying
            retries++;
            const delay = 500 * Math.pow(2, retries); // Increased base delay
            console.warn(`Database connection issue in getEvents. Retrying (${retries}/${maxRetries}) after ${delay}ms...`);
            console.warn(`Error details: ${e.message}, ${e.code}`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // If it's not a connection error or we've exhausted retries, throw the error
            console.error("Error in getEvents:", e);
            if (e instanceof Error) {
              console.error("Error message:", e.message);
              console.error("Error stack:", e.stack);
            }
            throw e;
          }
        }
      }
      
      // This line is needed to satisfy TypeScript (it won't actually be reached)
      throw new Error("Maximum retries reached");
    } catch (error) {
      console.error("Error in getEvents:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      throw error;
    }
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