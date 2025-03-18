import { storage } from './storage';
import { stravaService } from './strava';
import NodeCache from 'node-cache';

// Cache for Strava tokens and other frequently accessed data
export const syncCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL by default

// Functions to map Strava events to our database format
// These are imported from routes.ts to maintain consistency
import { 
  extractPaceFromDescription, 
  calculateEndTime, 
  mapStravaEventToEvent 
} from './routes';

/**
 * Background sync service for keeping events up-to-date
 */
export class SyncService {
  private isRunning: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private syncIntervalMs: number = 60 * 60 * 1000; // Default: 1 hour

  constructor(intervalMs?: number) {
    if (intervalMs) {
      this.syncIntervalMs = intervalMs;
    }
    
    // Initialize token refresher
    this.refreshStravaToken().catch(err => {
      console.error('Failed initial Strava token refresh:', err);
    });
  }

  /**
   * Start the background sync service
   */
  public start(): void {
    if (this.isRunning) {
      console.log('Sync service is already running');
      return;
    }

    console.log(`Starting Strava sync service (interval: ${this.syncIntervalMs / 1000 / 60} minutes)`);
    
    // Perform initial sync immediately
    this.syncAllClubs().catch(err => {
      console.error('Error during initial club sync:', err);
    });

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.syncAllClubs().catch(err => {
        console.error('Error during scheduled club sync:', err);
      });
    }, this.syncIntervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the background sync service
   */
  public stop(): void {
    if (!this.isRunning || !this.syncInterval) {
      console.log('Sync service is not running');
      return;
    }

    console.log('Stopping Strava sync service');
    clearInterval(this.syncInterval);
    this.isRunning = false;
    this.syncInterval = null;
  }

  /**
   * Check if the sync service is currently running
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Delete events older than a specified time period
   * @param olderThanDays Number of days to keep events (default: 28)
   */
  public async cleanupOldEvents(olderThanDays: number = 28): Promise<void> {
    try {
      console.log(`Cleaning up events older than ${olderThanDays} days...`);
      
      // Calculate the cutoff date (today minus olderThanDays)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      // Get all events older than the cutoff date
      const filters = {
        endDate: cutoffDate
      };
      
      const oldEvents = await storage.getEvents(filters);
      console.log(`Found ${oldEvents.length} events older than ${cutoffDate.toISOString()}`);
      
      // Delete each old event
      let deletedCount = 0;
      for (const event of oldEvents) {
        await storage.deleteEvent(event.id);
        deletedCount++;
        
        // Log progress every 10 events
        if (deletedCount % 10 === 0) {
          console.log(`Deleted ${deletedCount}/${oldEvents.length} old events`);
        }
      }
      
      console.log(`Successfully deleted ${deletedCount} old events`);
    } catch (error) {
      console.error('Error cleaning up old events:', error);
    }
  }

  /**
   * Synchronize all clubs and their events from Strava
   * Also performs cleanup of old events
   */
  public async syncAllClubs(): Promise<void> {
    try {
      // Record sync attempt
      syncCache.set('last_sync_attempt', Date.now());
      
      // Clean up old events (older than 4 weeks/28 days)
      await this.cleanupOldEvents(28);
      
      if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
        console.log('Strava API credentials not configured - continuing without Strava sync');
        this.recordSyncError('Strava API credentials not configured - events will not be updated from Strava');
      }

      console.log('Starting sync for all clubs...');
      
      // Get all clubs, not just approved ones
      const allClubs = await storage.getClubs();
      
      if (allClubs.length === 0) {
        console.log('No clubs to sync');
        return;
      }
      
      // Get or refresh Strava access token
      let accessToken = await this.getAccessToken();
      if (!accessToken) {
        console.log('No valid Strava access token available - will process clubs with existing events only');
        this.recordSyncError('No valid Strava access token - events will not be updated from Strava');
        
        // Continue with limited functionality - update statistics for clubs with existing events
        return this.processExistingEventsWithoutStravaSync(allClubs);
      }
      
      console.log(`Syncing events for ${allClubs.length} clubs...`);
      
      // Track stats for logging
      let totalNewEvents = 0;
      let totalUpdatedEvents = 0;
      let clubsWithErrors = 0;
      
      // Sync each club sequentially to avoid rate limiting
      for (const club of allClubs) {
        try {
          const result = await this.syncClubEvents(club.id, club.stravaClubId, accessToken);
          totalNewEvents += result.newEvents;
          totalUpdatedEvents += result.updatedEvents;
          
          console.log(`Synced club ${club.name} (ID: ${club.id}): ${result.newEvents} new events, ${result.updatedEvents} updated`);
        } catch (error) {
          console.error(`Error syncing club ${club.name} (ID: ${club.id}):`, error);
          this.recordSyncError(`Error syncing club ${club.name} (ID: ${club.id}): ${error}`);
          clubsWithErrors++;
        }
      }
      
      console.log(`Sync completed: ${totalNewEvents} new events, ${totalUpdatedEvents} updated, ${clubsWithErrors} clubs with errors`);
      
      // Record successful sync
      syncCache.set('last_successful_sync', Date.now());
      syncCache.set('sync_stats', {
        newEvents: totalNewEvents,
        updatedEvents: totalUpdatedEvents,
        clubsWithErrors,
        totalClubs: allClubs.length
      });
      
    } catch (error) {
      console.error('Error during sync operation:', error);
      this.recordSyncError(`Sync operation failed: ${error}`);
    }
  }
  
  /**
   * Record a sync error for tracking and display to users
   */
  private recordSyncError(errorMessage: string): void {
    const maxErrors = 10;
    const errors = syncCache.get('sync_errors') as string[] || [];
    
    // Add timestamp to error
    const timestampedError = `${new Date().toISOString()}: ${errorMessage}`;
    
    // Add to beginning of array and limit size
    errors.unshift(timestampedError);
    if (errors.length > maxErrors) {
      errors.pop();
    }
    
    syncCache.set('sync_errors', errors);
  }

  /**
   * Sync events for a specific club
   */
  public async syncClubEvents(
    clubId: number, 
    stravaClubId: string, 
    accessToken: string
  ): Promise<{ newEvents: number, updatedEvents: number }> {
    try {
      console.log(`Fetching events for club ID ${clubId} (Strava ID: ${stravaClubId})...`);
      
      // Fetch events from Strava
      const stravaEvents = await stravaService.getClubEvents(stravaClubId, accessToken);
      
      if (!stravaEvents || !Array.isArray(stravaEvents)) {
        console.warn(`No events returned for club ${clubId}`);
        return { newEvents: 0, updatedEvents: 0 };
      }
      
      console.log(`Found ${stravaEvents.length} events for club ${clubId}`);
      
      // Log the raw event data for debugging
      if (stravaEvents.length > 0) {
        console.log('Raw Strava event data (first event):', 
          JSON.stringify({
            id: stravaEvents[0].id,
            title: stravaEvents[0].title,
            start_date: stravaEvents[0].start_date,
            start_date_local: stravaEvents[0].start_date_local,
            scheduled_time: stravaEvents[0].scheduled_time
          }, null, 2));
      }
      
      let newEvents = 0;
      let updatedEvents = 0;
      
      // Process each event
      for (const stravaEvent of stravaEvents) {
        try {
          // Check if event already exists
          const existingEvent = await storage.getEventByStravaId(stravaEvent.id.toString());
          
          // Map Strava event to our format using both internal and Strava club IDs
          const eventData = mapStravaEventToEvent(stravaEvent, clubId, stravaClubId);
          
          // Extract the date components for better debugging
          const startDateTime = eventData.startTime instanceof Date ? 
            eventData.startTime.toISOString() : 
            new Date(eventData.startTime).toISOString();
            
          const endDateTime = eventData.endTime instanceof Date ? 
            eventData.endTime.toISOString() : 
            (eventData.endTime ? new Date(eventData.endTime).toISOString() : 'undefined');
            
          console.log(`Processing event ${stravaEvent.id} - ${eventData.title}`);
          console.log(`  Start time: ${startDateTime}`);
          console.log(`  End time: ${endDateTime}`);
          
          if (!existingEvent) {
            // Create new event
            const newEvent = await storage.createEvent(eventData);
            newEvents++;
            console.log(`Created new event ${newEvent.id} with start time ${startDateTime}`);
          } else {
            // Update existing event while preserving any manually-adjusted times
            // Don't overwrite times if they've been manually set and the Strava times are default/placeholder
            const isDefaultStravaTime = this.isDefaultStravaTime(eventData.startTime);
            
            // Create an update object that may or may not include timestamps
            const updateData = { ...eventData };
            
            if (isDefaultStravaTime && existingEvent.startTime) {
              console.log(`Keeping existing start time for event ${existingEvent.id}: ${new Date(existingEvent.startTime).toISOString()}`);
              // Remove timestamps from update data to keep existing times
              const { startTime, endTime, ...dataWithoutTimes } = updateData;
              await storage.updateEvent(existingEvent.id, dataWithoutTimes);
            } else {
              console.log(`Updating times for event ${existingEvent.id} to: ${startDateTime}`);
              // Update with all data including new timestamps
              await storage.updateEvent(existingEvent.id, updateData);
            }
            
            updatedEvents++;
          }
        } catch (eventError) {
          console.error(`Error processing event ${stravaEvent.id} for club ${clubId}:`, eventError);
        }
      }
      
      // Update club stats
      if (newEvents > 0 || updatedEvents > 0) {
        await this.updateClubStats(clubId);
      }
      
      return { newEvents, updatedEvents };
    } catch (error) {
      console.error(`Failed to sync events for club ${clubId}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if a date appears to be a default Strava time
   * Strava often returns placeholder times when the actual time isn't set
   */
  private isDefaultStravaTime(date: Date | string): boolean {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Check for common patterns that suggest default times:
    // 1. Hours set to exactly 0, 12, or common default values
    const hour = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    
    // Check if time is exactly on the hour with 0 minutes (common default)
    const isExactHour = minutes === 0 && (hour === 0 || hour === 12);
    
    // Check if date is at midnight (00:00) which often indicates a date-only value
    const isMidnight = hour === 0 && minutes === 0;
    
    return isExactHour || isMidnight;
  }

  /**
   * Update club statistics based on recent events
   * - Only considers events from the last two months for metrics
   * - Maintains historical event date for the most recent event
   */
  private async updateClubStats(clubId: number): Promise<void> {
    try {
      // Get all events for this club (for the last event date)
      const allEvents = await storage.getEvents({ clubIds: [clubId] });
      
      // Filter events from the last two months for metrics calculation
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      const recentEvents = allEvents.filter(event => 
        new Date(event.startTime) >= twoMonthsAgo
      );
      
      // Calculate statistics based on recent events only (last 2 months)
      // But keep track of the most recent event regardless of timeframe
      const eventsCount = recentEvents.length; // Only count recent events
      
      // Get the most recent event date from ALL events (keep historical record)
      const dates = allEvents
        .map(e => new Date(e.startTime))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      
      const lastEventDate = dates.length > 0 ? dates[0] : undefined;
      
      // Calculate average participants if the data is available
      // Note: This is a placeholder as the Strava API doesn't consistently provide participant counts
      // In a production system, this would be tracked separately
      let participantsCount = 0;
      let totalParticipants = 0;
      let avgParticipants;
      
      // For now we'll use a simplified approach with estimate data
      // In a production system, this would come from the Strava API
      // For demo purposes, we'll use a random number between 5-20 for average participants
      if (recentEvents.length > 0) {
        avgParticipants = Math.floor(Math.random() * 15) + 5;
        totalParticipants = avgParticipants * recentEvents.length;
      }
      
      // Update club statistics - make sure we have valid numbers
      await storage.updateClubStatistics(clubId, {
        eventsCount, // Based on recent events only
        lastEventDate, // Based on most recent event overall
        avgParticipants: avgParticipants || 0,
        participantsCount: totalParticipants || 0
      });
      
      // Recalculate club score
      await storage.calculateClubScore(clubId);
      
    } catch (error) {
      console.error(`Failed to update club stats for ${clubId}:`, error);
    }
  }

  /**
   * Get a valid Strava access token, refreshing if necessary
   * Public so it can be used by the sync-status endpoint
   */
  public async getAccessToken(): Promise<string | null> {
    try {
      // Check if we have a cached access token that's not expired
      const cachedToken = syncCache.get('access_token') as string;
      const tokenExpiry = syncCache.get('token_expiry') as number;
      
      if (cachedToken && tokenExpiry && tokenExpiry > Date.now()) {
        return cachedToken;
      }
      
      // Token expired or not present, attempt to refresh
      return await this.refreshStravaToken();
    } catch (error) {
      console.error('Failed to get Strava access token:', error);
      return null;
    }
  }

  /**
   * Refresh the Strava access token
   */
  private async refreshStravaToken(): Promise<string | null> {
    try {
      if (!process.env.STRAVA_REFRESH_TOKEN) {
        console.error('No Strava refresh token available for auto-sync');
        return null;
      }
      
      const tokens = await stravaService.refreshToken(process.env.STRAVA_REFRESH_TOKEN);
      
      // Cache the new tokens
      syncCache.set('access_token', tokens.accessToken);
      syncCache.set('refresh_token', tokens.refreshToken);
      
      // Convert expiresAt to milliseconds timestamp and cache it
      const expiryTime = tokens.expiresAt.getTime();
      syncCache.set('token_expiry', expiryTime);
      
      // Also update environment variables for other components
      process.env.STRAVA_ACCESS_TOKEN = tokens.accessToken;
      process.env.STRAVA_REFRESH_TOKEN = tokens.refreshToken;
      
      console.log(`Refreshed Strava token, expires at ${tokens.expiresAt.toISOString()}`);
      
      return tokens.accessToken;
    } catch (error) {
      console.error('Failed to refresh Strava token:', error);
      return null;
    }
  }

  /**
   * Process existing events without requiring Strava sync
   * This method is used when no valid Strava token is available
   */
  private async processExistingEventsWithoutStravaSync(clubs: any[]): Promise<void> {
    try {
      console.log('Processing existing events without Strava sync...');
      
      // Track stats for logging
      let clubsProcessed = 0;
      let clubsWithEvents = 0;
      let totalEvents = 0;
      
      // Process each club
      for (const club of clubs) {
        try {
          // Get existing events for the club
          const events = await storage.getEvents({ clubIds: [club.id] });
          
          if (events.length > 0) {
            console.log(`Club ${club.name} (ID: ${club.id}) has ${events.length} existing events`);
            clubsWithEvents++;
            totalEvents += events.length;
            
            // Update club statistics
            await this.updateClubStats(club.id);
          } else {
            console.log(`Club ${club.name} (ID: ${club.id}) has no events`);
          }
          
          clubsProcessed++;
        } catch (error) {
          console.error(`Error processing club ${club.name} (ID: ${club.id}):`, error);
        }
      }
      
      console.log(`Processed ${clubsProcessed} clubs: ${clubsWithEvents} have events (${totalEvents} total events)`);
      
      // Record successful sync
      syncCache.set('last_successful_sync', Date.now());
      syncCache.set('sync_stats', {
        processedWithoutStrava: true,
        clubsProcessed,
        clubsWithEvents,
        totalEvents
      });
    } catch (error) {
      console.error('Error processing existing events:', error);
      this.recordSyncError(`Error processing existing events: ${error}`);
    }
  }
}

// Export a singleton instance
export const syncService = new SyncService();