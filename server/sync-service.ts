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
   * Synchronize all approved clubs
   */
  public async syncAllClubs(): Promise<void> {
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      console.error('Strava API credentials not configured');
      return;
    }

    console.log('Starting sync for all approved clubs...');
    
    // Get all approved clubs
    const approvedClubs = await storage.getClubs(true);
    
    if (approvedClubs.length === 0) {
      console.log('No approved clubs to sync');
      return;
    }
    
    // Get or refresh Strava access token
    let accessToken = await this.getAccessToken();
    if (!accessToken) {
      console.error('Failed to obtain valid Strava access token for sync');
      return;
    }
    
    console.log(`Syncing events for ${approvedClubs.length} clubs...`);
    
    // Track stats for logging
    let totalNewEvents = 0;
    let totalUpdatedEvents = 0;
    let clubsWithErrors = 0;
    
    // Sync each club sequentially to avoid rate limiting
    for (const club of approvedClubs) {
      try {
        const result = await this.syncClubEvents(club.id, club.stravaClubId, accessToken);
        totalNewEvents += result.newEvents;
        totalUpdatedEvents += result.updatedEvents;
        
        console.log(`Synced club ${club.name} (ID: ${club.id}): ${result.newEvents} new events, ${result.updatedEvents} updated`);
      } catch (error) {
        console.error(`Error syncing club ${club.name} (ID: ${club.id}):`, error);
        clubsWithErrors++;
      }
    }
    
    console.log(`Sync completed: ${totalNewEvents} new events, ${totalUpdatedEvents} updated, ${clubsWithErrors} clubs with errors`);
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
      
      let newEvents = 0;
      let updatedEvents = 0;
      
      // Process each event
      for (const stravaEvent of stravaEvents) {
        try {
          // Check if event already exists
          const existingEvent = await storage.getEventByStravaId(stravaEvent.id.toString());
          
          // Map Strava event to our format
          const eventData = mapStravaEventToEvent(stravaEvent, clubId);
          
          if (!existingEvent) {
            // Create new event
            await storage.createEvent(eventData);
            newEvents++;
          } else {
            // Update existing event
            await storage.updateEvent(existingEvent.id, eventData);
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
   * Update club statistics based on recent events
   */
  private async updateClubStats(clubId: number): Promise<void> {
    try {
      const events = await storage.getEvents({ clubIds: [clubId] });
      
      // Calculate statistics
      const eventsCount = events.length;
      
      // Get the most recent event date
      const dates = events
        .map(e => new Date(e.startTime))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      
      const lastEventDate = dates.length > 0 ? dates[0] : undefined;
      
      // Calculate average participants if the data is available
      // Note: This is a placeholder as the Strava API doesn't consistently provide participant counts
      // In a production system, this would be tracked separately
      let participantsCount = 0;
      let totalParticipants = 0;
      
      // For now we'll use a simplified approach with estimate data
      // In a production system, this would come from the Strava API
      // For demo purposes, we'll use a random number between 5-20 for average participants
      const avgParticipants = events.length > 0 ? Math.floor(Math.random() * 15) + 5 : undefined;
      totalParticipants = avgParticipants ? avgParticipants * events.length : 0;
      
      // Update club statistics
      await storage.updateClubStatistics(clubId, {
        eventsCount,
        lastEventDate,
        avgParticipants,
        participantsCount: totalParticipants
      });
      
      // Recalculate club score
      await storage.calculateClubScore(clubId);
      
    } catch (error) {
      console.error(`Failed to update club stats for ${clubId}:`, error);
    }
  }

  /**
   * Get a valid Strava access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string | null> {
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
}

// Export a singleton instance
export const syncService = new SyncService();