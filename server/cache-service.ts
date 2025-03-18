import NodeCache from 'node-cache';
import { Event } from '../shared/schema';
import { EventFilters } from './storage';

/**
 * Cache service for optimizing data access
 * Provides caching for frequently accessed data with automatic invalidation
 */
export class CacheService {
  private eventCache: NodeCache;
  private clubCache: NodeCache;
  private defaultTTL = 300; // 5 minutes default TTL

  constructor(options?: { eventTTL?: number; clubTTL?: number }) {
    this.eventCache = new NodeCache({
      stdTTL: options?.eventTTL || this.defaultTTL,
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false // For better performance with large datasets
    });

    this.clubCache = new NodeCache({
      stdTTL: options?.clubTTL || this.defaultTTL * 2, // Clubs change less frequently
      checkperiod: 120,
      useClones: false
    });

    console.log(`Cache service initialized with TTL: events=${options?.eventTTL || this.defaultTTL}s, clubs=${options?.clubTTL || this.defaultTTL * 2}s`);
  }

  /**
   * Generate a cache key for event filters
   */
  private generateEventCacheKey(filters?: EventFilters): string {
    if (!filters) return 'events:all';

    // Create a normalized filters object with only the properties that matter
    const normalizedFilters: Record<string, any> = {};
    
    if (filters.clubIds && filters.clubIds.length > 0) {
      normalizedFilters.clubIds = [...filters.clubIds].sort();
    }
    
    if (filters.paceCategories && filters.paceCategories.length > 0) {
      normalizedFilters.paceCategories = [...filters.paceCategories].sort();
    }
    
    if (filters.distanceRanges && filters.distanceRanges.length > 0) {
      normalizedFilters.distanceRanges = [...filters.distanceRanges].sort();
    }
    
    if (filters.beginnerFriendly) {
      normalizedFilters.beginnerFriendly = true;
    }
    
    if (filters.isIntervalTraining !== undefined) {
      normalizedFilters.isIntervalTraining = filters.isIntervalTraining;
    }
    
    // Date filters are important for cache keys
    if (filters.startDate) {
      // Only use the date part for cache keys to increase cache hits
      normalizedFilters.startDate = new Date(filters.startDate).toISOString().split('T')[0];
    }
    
    if (filters.endDate) {
      normalizedFilters.endDate = new Date(filters.endDate).toISOString().split('T')[0];
    }
    
    return `events:${JSON.stringify(normalizedFilters)}`;
  }

  /**
   * Store events in cache with automatic invalidation
   */
  cacheEvents(events: Event[], filters?: EventFilters): void {
    const cacheKey = this.generateEventCacheKey(filters);
    this.eventCache.set(cacheKey, events);
    console.log(`Cached ${events.length} events with key: ${cacheKey}`);
  }

  /**
   * Get events from cache if available
   * @returns null if not in cache, otherwise the cached events
   */
  getCachedEvents(filters?: EventFilters): Event[] | null {
    const cacheKey = this.generateEventCacheKey(filters);
    const cachedEvents = this.eventCache.get<Event[]>(cacheKey);
    
    if (cachedEvents) {
      console.log(`Cache hit for ${cacheKey} (${cachedEvents.length} events)`);
      return cachedEvents;
    }
    
    console.log(`Cache miss for ${cacheKey}`);
    return null;
  }

  /**
   * Invalidate all event cache entries
   * Call this when events are created, updated, or deleted
   */
  invalidateEventCache(): void {
    console.log('Invalidating all event cache entries');
    this.eventCache.flushAll();
  }

  /**
   * Invalidate event cache entries for a specific club
   */
  invalidateClubEvents(clubId: number): void {
    console.log(`Invalidating event cache for club ${clubId}`);
    
    // Get all cache keys
    const keys = this.eventCache.keys();
    
    // Find any keys that might contain this club's events
    const keysToDelete = keys.filter(key => {
      // All events key always includes club events
      if (key === 'events:all') return true;
      
      // Check if the key contains this clubId
      try {
        // Extract the JSON part from the key (remove "events:")
        const filterJson = key.substring(7);
        const filters = JSON.parse(filterJson);
        
        // If no clubIds filter or if this clubId is in the filter
        return !filters.clubIds || filters.clubIds.includes(clubId);
      } catch (error) {
        // If we can't parse the key, better safe than sorry - invalidate it
        return true;
      }
    });
    
    // Delete the matching keys
    keysToDelete.forEach(key => {
      this.eventCache.del(key);
    });
    
    console.log(`Invalidated ${keysToDelete.length} cache entries for club ${clubId}`);
  }

  /**
   * Cache club data
   */
  cacheClubs(clubs: any[], sortByScore: boolean = false): void {
    const cacheKey = sortByScore ? 'clubs:sorted' : 'clubs:all';
    this.clubCache.set(cacheKey, clubs);
    console.log(`Cached ${clubs.length} clubs with key: ${cacheKey}`);
  }

  /**
   * Get cached clubs if available
   */
  getCachedClubs(sortByScore: boolean = false): any[] | null {
    const cacheKey = sortByScore ? 'clubs:sorted' : 'clubs:all';
    const cachedClubs = this.clubCache.get<any[]>(cacheKey);
    
    if (cachedClubs) {
      console.log(`Cache hit for ${cacheKey} (${cachedClubs.length} clubs)`);
      return cachedClubs;
    }
    
    console.log(`Cache miss for ${cacheKey}`);
    return null;
  }

  /**
   * Invalidate all club cache entries
   */
  invalidateClubCache(): void {
    console.log('Invalidating all club cache entries');
    this.clubCache.flushAll();
  }
}

// Export singleton instance
export const cacheService = new CacheService();