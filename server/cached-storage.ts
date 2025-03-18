import { IStorage, EventFilters } from './storage';
import { dbStorage } from './db-storage';
import { cacheService } from './cache-service';
import { 
  Club, 
  Event, 
  User, 
  UserPreference, 
  HiddenEvent,
  InsertClub,
  InsertEvent,
  InsertUser,
  InsertUserPreference
} from '../shared/schema';

/**
 * Cache-aware storage implementation that wraps the database storage
 * Provides transparent caching for frequently accessed data
 */
export class CachedStorage implements IStorage {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    console.log('Initialized cached storage layer');
  }

  // ---- Club operations with caching ----

  async getClub(id: number): Promise<Club | undefined> {
    return this.storage.getClub(id);
  }

  async getClubByStravaId(stravaClubId: string): Promise<Club | undefined> {
    return this.storage.getClubByStravaId(stravaClubId);
  }

  async getClubs(): Promise<Club[]> {
    // Try to get clubs from cache first
    const cachedClubs = cacheService.getCachedClubs();
    if (cachedClubs) {
      return cachedClubs;
    }

    // Cache miss - get from database
    const clubs = await this.storage.getClubs();
    
    // Cache for future requests
    cacheService.cacheClubs(clubs);
    
    return clubs;
  }

  async getClubsSortedByScore(): Promise<Club[]> {
    // Try to get sorted clubs from cache
    const cachedClubs = cacheService.getCachedClubs(true);
    if (cachedClubs) {
      return cachedClubs;
    }

    // Cache miss - get from database
    const clubs = await this.storage.getClubsSortedByScore();
    
    // Cache for future requests
    cacheService.cacheClubs(clubs, true);
    
    return clubs;
  }

  async createClub(club: InsertClub): Promise<Club> {
    const newClub = await this.storage.createClub(club);
    
    // Invalidate club cache after creating a new club
    cacheService.invalidateClubCache();
    
    return newClub;
  }

  async updateClub(id: number, club: Partial<Club>): Promise<Club | undefined> {
    const updatedClub = await this.storage.updateClub(id, club);
    
    // Invalidate club cache and any events for this club
    cacheService.invalidateClubCache();
    cacheService.invalidateClubEvents(id);
    
    return updatedClub;
  }

  async verifyClub(token: string): Promise<Club | undefined> {
    const club = await this.storage.verifyClub(token);
    
    if (club) {
      // Invalidate club cache after verification
      cacheService.invalidateClubCache();
    }
    
    return club;
  }

  async updateClubStravaTokens(
    clubId: number,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    }
  ): Promise<Club | undefined> {
    return this.storage.updateClubStravaTokens(clubId, tokens);
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
    const updatedClub = await this.storage.updateClubStatistics(clubId, stats);
    
    // Invalidate club cache since statistics have changed
    cacheService.invalidateClubCache();
    
    return updatedClub;
  }

  async calculateClubScore(clubId: number): Promise<number> {
    const score = await this.storage.calculateClubScore(clubId);
    
    // Invalidate club cache since scores have changed
    cacheService.invalidateClubCache();
    
    return score;
  }

  // ---- Event operations with caching ----

  async getEvent(id: number): Promise<Event | undefined> {
    return this.storage.getEvent(id);
  }

  async getEventByStravaId(stravaEventId: string): Promise<Event | undefined> {
    return this.storage.getEventByStravaId(stravaEventId);
  }

  async getEvents(filters?: EventFilters): Promise<Event[]> {
    // Try to get events from cache first
    const cachedEvents = cacheService.getCachedEvents(filters);
    if (cachedEvents) {
      return cachedEvents;
    }

    // Cache miss - get from database
    const events = await this.storage.getEvents(filters);
    
    // Cache for future requests
    cacheService.cacheEvents(events, filters);
    
    return events;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const newEvent = await this.storage.createEvent(event);
    
    // Invalidate event cache for this club
    cacheService.invalidateClubEvents(newEvent.clubId);
    
    // Also invalidate the general event cache since this is a new event
    cacheService.invalidateEventCache();
    
    return newEvent;
  }

  async updateEvent(id: number, event: Partial<Event>): Promise<Event | undefined> {
    const existingEvent = await this.storage.getEvent(id);
    const updatedEvent = await this.storage.updateEvent(id, event);
    
    if (updatedEvent) {
      // Invalidate event cache for this club
      cacheService.invalidateClubEvents(updatedEvent.clubId);
      
      // If the event was moved to a different club, invalidate that club's cache too
      if (event.clubId && existingEvent && existingEvent.clubId !== event.clubId) {
        cacheService.invalidateClubEvents(existingEvent.clubId);
      }
    }
    
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const event = await this.storage.getEvent(id);
    const success = await this.storage.deleteEvent(id);
    
    if (success && event) {
      // Invalidate event cache for this club
      cacheService.invalidateClubEvents(event.clubId);
      
      // Also invalidate the general event cache
      cacheService.invalidateEventCache();
    }
    
    return success;
  }

  // ---- User operations ----

  async getUser(id: number): Promise<User | undefined> {
    return this.storage.getUser(id);
  }

  async getUserByStravaId(stravaUserId: string): Promise<User | undefined> {
    return this.storage.getUserByStravaId(stravaUserId);
  }

  async createUser(user: InsertUser): Promise<User> {
    return this.storage.createUser(user);
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    return this.storage.updateUser(id, user);
  }

  async updateUserLogin(id: number): Promise<boolean> {
    return this.storage.updateUserLogin(id);
  }

  // ---- User preferences operations ----

  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    return this.storage.getUserPreferences(userId);
  }

  async createUserPreferences(preferences: InsertUserPreference): Promise<UserPreference> {
    return this.storage.createUserPreferences(preferences);
  }

  async updateUserPreferences(id: number, preferences: Partial<UserPreference>): Promise<UserPreference | undefined> {
    return this.storage.updateUserPreferences(id, preferences);
  }

  // ---- Hidden events operations ----

  async getHiddenEvents(userId: number): Promise<HiddenEvent[]> {
    return this.storage.getHiddenEvents(userId);
  }

  async hideEvent(userId: number, eventId: number): Promise<boolean> {
    const result = await this.storage.hideEvent(userId, eventId);
    
    // Invalidate user-specific event caches
    // This is a simple approach - we could be more targeted if needed
    cacheService.invalidateEventCache();
    
    return result;
  }

  async unhideEvent(userId: number, eventId: number): Promise<boolean> {
    const result = await this.storage.unhideEvent(userId, eventId);
    
    // Invalidate user-specific event caches
    cacheService.invalidateEventCache();
    
    return result;
  }

  async getVisibleEvents(userId: number, filters?: EventFilters): Promise<Event[]> {
    // This one is complex to cache effectively since it's user-specific
    // For now, we'll just pass through to the database
    return this.storage.getVisibleEvents(userId, filters);
  }
}

// Create and export a singleton instance of CachedStorage
export const cachedStorage = new CachedStorage(dbStorage);