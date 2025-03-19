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

// Simple logger implementation (replace with a proper logging library in production)
const logger = {
  error: (message: string, context?: any, moduleName?: string) => {
    const logMessage = `[${moduleName || 'unknown'}] ${message}`;
    console.error(logMessage, context);
  }
};


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
      logger.error('Failed initial Strava token refresh:', { error: err.message }, 'sync-service');
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
      logger.error('Error during initial club sync:', { error: err.message }, 'sync-service');
    });

    // Set up recurring sync
    this.syncInterval = setInterval(() => {
      this.syncAllClubs().catch(err => {
        logger.error('Error during scheduled club sync:', { error: err.message }, 'sync-service');
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

      // Find all events with start time before the cutoff date
      // The storage.getEvents with endDate filter handles this efficiently
      const filters = {
        endDate: cutoffDate
      };

      const oldEvents = await storage.getEvents(filters);
      console.log(`Found ${oldEvents.length} events older than ${cutoffDate.toISOString()}`);

      if (oldEvents.length === 0) {
        console.log('No old events to clean up');
        return;
      }

      // Delete each old event
      let deletedCount = 0;
      for (const event of oldEvents) {
        try {
          await storage.deleteEvent(event.id);
          deletedCount++;

          // Log progress every 10 events
          if (deletedCount % 10 === 0) {
            console.log(`Deleted ${deletedCount}/${oldEvents.length} old events`);
          }
        } catch (err: any) {
          logger.error(`Error deleting event ${event.id}:`, { error: err.message }, 'sync-service');
        }
      }

      console.log(`Successfully deleted ${deletedCount} old events`);
    } catch (error: any) {
      logger.error('Error cleaning up old events:', { error: error.message }, 'sync-service');
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
        } catch (error: any) {
          logger.error(`Error syncing club ${club.name} (ID: ${club.id}):`, { error: error.message }, 'sync-service');
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

    } catch (error: any) {
      logger.error('Error during sync operation:', { error: error.message }, 'sync-service');
      this.recordSyncError(`Sync operation failed: ${error}`);
    }
  }

  /**
   * Record a sync error for tracking and display to users
   */
  private recordSyncError(errorMessage: string): void {
    // Get existing errors or initialize an empty array
    const syncErrors = (syncCache.get('sync_errors') as Array<any>) || [];

    // Format the error entry with timestamp
    const errorEntry = {
      timestamp: new Date(),
      message: errorMessage,
      formattedTime: new Date().toLocaleString()
    };

    // Add the new error to the beginning of the array
    syncErrors.unshift(errorEntry);

    // Keep only the most recent 10 errors to prevent unlimited growth
    const trimmedErrors = syncErrors.slice(0, 10);

    // Store in cache for later retrieval via the API
    syncCache.set('sync_errors', trimmedErrors);

    // Also store the most recent error separately for quick access
    syncCache.set('last_error', errorEntry);

    // Log to console with distinctive formatting for easy spotting in logs
    logger.error(`[SYNC ERROR] ${errorMessage}`, undefined, 'sync-service');

    // Update the overall sync status to indicate problems
    const syncStatus = (syncCache.get('sync_status') as Record<string, any>) || {};
    syncCache.set('sync_status', {
      ...syncStatus,
      hasErrors: true,
      lastErrorTime: new Date(),
      errorCount: (syncStatus.errorCount || 0) + 1
    });
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

      // Validate inputs
      if (!stravaClubId) {
        logger.error(`Cannot sync events: Invalid Strava Club ID for club ${clubId}`, undefined, 'sync-service');
        this.recordSyncError(`Cannot sync events: Missing Strava Club ID for club ${clubId}`);
        return { newEvents: 0, updatedEvents: 0 };
      }

      if (!accessToken) {
        logger.error(`Cannot sync events: No valid access token for club ${clubId}`, undefined, 'sync-service');
        this.recordSyncError(`Cannot sync events: Missing access token for club ${clubId}`);
        return { newEvents: 0, updatedEvents: 0 };
      }

      // Fetch events from Strava with detailed error handling
      let stravaEvents;
      try {
        stravaEvents = await stravaService.getClubEvents(stravaClubId, accessToken);
        console.log(`Successfully retrieved Strava events response for club ${clubId}`);
      } catch (apiError: any) {
        logger.error(`Strava API error for club ${clubId}:`, { error: apiError.message || apiError }, 'sync-service');

        // Detailed error reporting for API issues
        if (apiError.response) {
          console.error(`Strava API status: ${apiError.response.status}`);
          console.error(`Strava API error data:`, apiError.response.data);

          // Handle specific error codes
          if (apiError.response.status === 401) {
            this.recordSyncError(`Authentication failed with Strava API for club ${clubId}: Token may be expired or invalid`);
          } else if (apiError.response.status === 404) {
            this.recordSyncError(`Club not found on Strava: Club ID ${stravaClubId} may be invalid or no longer exists`);
          } else {
            this.recordSyncError(`Strava API error (${apiError.response.status}) for club ${clubId}: ${JSON.stringify(apiError.response.data)}`);
          }
        } else {
          this.recordSyncError(`Strava API connection error for club ${clubId}: ${apiError.message || 'Unknown error'}`);
        }

        return { newEvents: 0, updatedEvents: 0 };
      }

      if (!stravaEvents || !Array.isArray(stravaEvents)) {
        logger.error(`No events returned for club ${clubId} or invalid response format`, undefined, 'sync-service');
        this.recordSyncError(`Invalid events data structure from Strava for club ${clubId}`);
        return { newEvents: 0, updatedEvents: 0 };
      }

      console.log(`Found ${stravaEvents.length} events for club ${clubId}`);

      // Process events directly from Strava response
      console.log(`Processing ${stravaEvents.length} events for club ${clubId}`);
      
      // Store raw events for audit/debugging
      for (const event of stravaEvents) {
        await db.insert(schema.rawEvents)
          .values({
            stravaEventId: event.id.toString(),
            clubId: clubId,
            rawData: event,
            retrievedAt: new Date(),
            processedAt: new Date() // Mark as processed immediately
          })
          .onConflictDoNothing();
      }
      
      // Create processing objects directly from Strava events
      const rawEventsForProcessing: RawStravaEvent[] = stravaEvents.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        start_date: event.start_date,
        start_date_local: event.start_date_local,
        scheduled_time: event.scheduled_time,
        end_date: event.end_date,
        end_date_local: event.end_date_local,
        location: event.location,
        distance: event.distance,
        club_id: stravaClubId,
        url: event.url,
        _raw: event,
        _retrieved: new Date()
      }));

      console.log(`Transformed ${rawEventsForProcessing.length} raw events for processing`);
        id: event.id,
        title: event.title,
        description: event.description,
        start_date: event.start_date,
        start_date_local: event.start_date_local,
        scheduled_time: event.scheduled_time,
        end_date: event.end_date,
        end_date_local: event.end_date_local,
        location: event.location,
        distance: event.distance,
        club_id: stravaClubId,
        url: event.url,
        _raw: event,
        _retrieved: new Date()
      }));

      // Log raw layer
      logger.info(`Retrieved ${rawEvents.length} raw events from Strava for club ${clubId}`, {
        clubId,
        rawEventCount: rawEvents.length,
        sampleEvent: rawEvents[0] ? {
          id: rawEvents[0].id,
          title: rawEvents[0].title,
          timestamps: {
            start_date: rawEvents[0].start_date,
            start_date_local: rawEvents[0].start_date_local,
            scheduled_time: rawEvents[0].scheduled_time
          }
        } : null
      }, 'sync-service');

      // Layer 2: Process and validate events
      let newEvents = 0;
      let updatedEvents = 0;
      let skippedEvents = 0;
      let parseErrors = 0;

      // Process each event with improved error handling
      for (const stravaEvent of stravaEvents) {
        try {
          // Validate event data
          if (!stravaEvent || !stravaEvent.id) {
            logger.error(`Invalid event data from Strava for club ${clubId}:`, { error: stravaEvent }, 'sync-service');
            this.recordSyncError(`Skipped invalid event data from Strava for club ${clubId}`);
            continue;
          }

          // Check if event already exists
          const eventId = stravaEvent.id.toString();
          console.log(`Looking up event with Strava ID: ${eventId}`);

          let existingEvent;
          try {
            existingEvent = await storage.getEventByStravaId(eventId);
          } catch (lookupError: any) {
            logger.error(`Error checking for existing event ${eventId}:`, { error: lookupError.message }, 'sync-service');
            this.recordSyncError(`Database error when checking event existence for Strava ID ${eventId}`);
            continue;
          }

          // Layer 2: Transform raw event to our format
          let eventData;
          try {
            // Find corresponding raw event
            const rawEvent = rawEvents.find(re => re.id.toString() === eventId);
            if (!rawEvent) {
              logger.error(`Raw event not found for ID ${eventId}`, { eventId }, 'sync-service');
              parseErrors++;
              continue;
            }

            // Log transition between layers
            logger.info(`Processing raw event ${eventId}`, {
              eventId,
              rawData: {
                title: rawEvent.title,
                hasStartDate: !!rawEvent.start_date,
                hasStartDateLocal: !!rawEvent.start_date_local,
                hasScheduledTime: !!rawEvent.scheduled_time
              }
            }, 'sync-service');

            eventData = mapStravaEventToEvent(stravaEvent, clubId, stravaClubId);
            
            // Log successful transformation
            logger.info(`Successfully transformed event ${eventId}`, {
              eventId,
              result: {
                title: eventData.title,
                startTime: eventData.startTime,
                hasValidDate: !!eventData.startTime
              }
            }, 'sync-service');
          } catch (mappingError: any) {
            parseErrors++;
            logger.error(`Error mapping event ${eventId} data:`, { 
              error: mappingError.message,
              rawEvent: rawEvents.find(re => re.id.toString() === eventId)
            }, 'sync-service');
            this.recordSyncError(`Failed to process event ${eventId} data: ${mappingError.message || 'Data mapping error'}`);
            continue;
          }

          // Validate mapped data has required fields
          if (!eventData.title || !eventData.startTime) {
            logger.error(`Event ${eventId} has missing required fields:`, { error: eventData }, 'sync-service');
            this.recordSyncError(`Event ${eventId} missing required data: title or start time`);
            continue;
          }

          // Extract the date components for better debugging
          let startDateTime, endDateTime;
          try {
            startDateTime = eventData.startTime instanceof Date ? 
              eventData.startTime.toISOString() : 
              new Date(eventData.startTime).toISOString();

            endDateTime = eventData.endTime instanceof Date ? 
              eventData.endTime.toISOString() : 
              (eventData.endTime ? new Date(eventData.endTime).toISOString() : 'undefined');
          } catch (dateError: any) {
            logger.error(`Error parsing event dates for ${eventId}:`, { error: dateError.message }, 'sync-service');
            this.recordSyncError(`Invalid date format for event ${eventId}`);
            continue;
          }

          console.log(`Processing event ${eventId} - ${eventData.title}`);
          console.log(`  Start time: ${startDateTime}`);
          console.log(`  End time: ${endDateTime}`);

          if (!existingEvent) {
            // Create new event with error handling
            try {
              const newEvent = await storage.createEvent(eventData);
              newEvents++;
              console.log(`Created new event ${newEvent.id} with start time ${startDateTime}`);
            } catch (createError: any) {
              logger.error(`Failed to create event ${eventId} in database:`, { error: createError.message }, 'sync-service');
              this.recordSyncError(`Database error creating event ${eventId}: ${createError.message || 'Unknown error'}`);
              continue;
            }
          } else {
            // Update existing event while preserving any manually-adjusted times
            try {
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
            } catch (updateError: any) {
              logger.error(`Failed to update event ${existingEvent.id} in database:`, { error: updateError.message }, 'sync-service');
              this.recordSyncError(`Database error updating event ${existingEvent.id}: ${updateError.message || 'Unknown error'}`);
              continue;
            }
          }
        } catch (eventError: any) {
          logger.error(`Unexpected error processing event for club ${clubId}:`, { error: eventError.message }, 'sync-service');
          this.recordSyncError(`Unexpected error during event sync: ${eventError.message || 'Unknown error'}`);
        }
      }

      // Update club stats
      if (newEvents > 0 || updatedEvents > 0) {
        await this.updateClubStats(clubId);
      }

      return { newEvents, updatedEvents };
    } catch (error: any) {
      logger.error(`Failed to sync events for club ${clubId}:`, { error: error.message }, 'sync-service');
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
    const hour = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();

    // Check if time is exactly on the hour with 0 minutes (common default)
    const isExactHour = minutes === 0 && (hour === 0 || hour === 12);

    // Check if date is at midnight (00:00) which often indicates a date-only value
    const isMidnight = hour === 0 && minutes === 0;

    // Check for the problematic 07:54:01 pattern (and related timestamps)
    // This specific pattern has been identified as a Strava default time
    const is754Pattern = hour === 7 && minutes === 54 && seconds > 0;

    // Log any identified default times for debugging
    if (isExactHour || isMidnight || is754Pattern) {
      console.log(`Detected default Strava time pattern: ${dateObj.toISOString()} (pattern: ${
        isExactHour ? 'exact hour' : (isMidnight ? 'midnight' : '07:54:xx')
      })`);
    }

    return isExactHour || isMidnight || is754Pattern;
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

    } catch (error: any) {
      logger.error(`Failed to update club stats for ${clubId}:`, { error: error.message }, 'sync-service');
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
    } catch (error: any) {
      logger.error('Failed to get Strava access token:', { error: error.message }, 'sync-service');
      return null;
    }
  }

  /**
   * Refresh the Strava access token
   */
  private async refreshStravaToken(): Promise<string | null> {
    try {
      // Check if we have a refresh token in the environment
      if (!process.env.STRAVA_REFRESH_TOKEN) {
        logger.error('No Strava refresh token available for auto-sync', undefined, 'sync-service');
        this.recordSyncError('Missing Strava refresh token. Please authenticate with Strava first.');
        return null;
      }

      // Check if the refresh token is valid (not empty or malformed)
      const refreshToken = process.env.STRAVA_REFRESH_TOKEN?.trim();
      if (!refreshToken || refreshToken.length < 10 || !/^[a-zA-Z0-9]+$/.test(refreshToken)) {
        logger.error('Invalid Strava refresh token format', undefined, 'sync-service');
        this.recordSyncError('Strava refresh token appears invalid. Please re-authenticate with Strava.');
        return null;
      }

      console.log('Attempting to refresh Strava access token...');

      // Attempt to refresh the token with detailed error handling
      let tokens;
      try {
        tokens = await stravaService.refreshToken(refreshToken);
      } catch (refreshError: any) {
        // Enhanced error logging for different token refresh scenarios
        if (refreshError.response) {
          const status = refreshError.response.status;
          const errorData = refreshError.response.data || {};

          logger.error(`Strava token refresh failed with status ${status}:`, { error: errorData }, 'sync-service');

          if (status === 401) {
            this.recordSyncError('Strava refresh token is no longer valid. Please re-authenticate with Strava.');
          } else if (status === 400 && errorData.error === 'invalid_grant') {
            this.recordSyncError('Strava refresh token was rejected. Please re-authenticate with Strava.');
          } else {
            this.recordSyncError(`Strava API error during token refresh: ${JSON.stringify(errorData)}`);
          }
        } else if (refreshError.request) {
          logger.error('No response received from Strava API during token refresh', undefined, 'sync-service');
          this.recordSyncError('Connection error with Strava API during token refresh. Please try again later.');
        } else {
          logger.error('Error creating request to refresh Strava token:', { error: refreshError.message }, 'sync-service');
          this.recordSyncError(`Failed to create request for Strava token refresh: ${refreshError.message}`);
        }

        return null;
      }

      // Validate the response contains the expected tokens
      if (!tokens || !tokens.accessToken || !tokens.refreshToken || !tokens.expiresAt) {
        logger.error('Received invalid token data from Strava:', { error: tokens }, 'sync-service');
        this.recordSyncError('Received incomplete token data from Strava API');
        return null;
      }

      // Cache the new tokens
      syncCache.set('access_token', tokens.accessToken);
      syncCache.set('refresh_token', tokens.refreshToken);

      // Convert expiresAt to milliseconds timestamp and cache it
      const expiryTime = tokens.expiresAt.getTime();
      syncCache.set('token_expiry', expiryTime);

      // Also update environment variables for other components
      process.env.STRAVA_ACCESS_TOKEN = tokens.accessToken;
      process.env.STRAVA_REFRESH_TOKEN = tokens.refreshToken;

      // Calculate and log human-readable expiry time
      const expiresInMinutes = Math.round((expiryTime - Date.now()) / (60 * 1000));
      console.log(`Strava token refreshed successfully! Expires in ${expiresInMinutes} minutes (${tokens.expiresAt.toISOString()})`);

      return tokens.accessToken;
    } catch (error: any) {
      logger.error('Unexpected error refreshing Strava token:', { error: error.message }, 'sync-service');
      this.recordSyncError(`Unexpected error during Strava token refresh: ${error.message || 'Unknown error'}`);
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
            
            // Create some test events for this club if authorized
            const testEventsCreated = await this.createTestEventsForClub(club.id, club.name);
            if (testEventsCreated > 0) {
              clubsWithEvents++;
              totalEvents += testEventsCreated;
              console.log(`Created ${testEventsCreated} test events for club ${club.name}`);
            }
          }

          clubsProcessed++;
        } catch (error: any) {
          logger.error(`Error processing club ${club.name} (ID: ${club.id}):`, { error: error.message }, 'sync-service');
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
    } catch (error: any) {
      logger.error('Error processing existing events:', { error: error.message }, 'sync-service');
      this.recordSyncError(`Error processing existing events: ${error}`);
    }
  }


  /**
   * Create some test events for a club when no events exist
   * This helps provide a better user experience when Strava API isn't available
   */
  private async createTestEventsForClub(clubId: number, clubName: string): Promise<number> {
    try {
      // Do not create test events, return 0 to indicate no events were created
      console.log(`Skipping test event creation for club ${clubName} (ID: ${clubId}) - waiting for Strava sync`);
      return 0;
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0-6 (Sunday-Saturday)
      
      // Define event types for test events
      const eventTypes = [
        { name: 'Easy Run', distance: 5000, time: '17:30', pace: '5:30' },
        { name: 'Speed Workout', distance: 8000, time: '18:00', pace: '4:45' },
        { name: 'Long Run', distance: 15000, time: '09:00', pace: '5:15' },
        { name: 'Recovery Run', distance: 6000, time: '07:00', pace: '6:00' }
      ];
      
      // Add events for Monday, Wednesday, Thursday and Saturday
      const daysToAdd = [
        1, // Monday
        3, // Wednesday
        4, // Thursday
        6  // Saturday
      ].map(day => {
        // Calculate days to add for next occurrence of this day
        const diff = day - dayOfWeek;
        return diff < 0 ? diff + 7 : diff;
      });
      
      // Create events for the next 4 weeks
      let eventsCreated = 0;
      
      for (let week = 0; week < 4; week++) {
        for (const dayOffset of daysToAdd) {
          // Skip some days randomly to make the schedule look natural
          if (Math.random() < 0.3 && week > 0) continue;
          
          const eventDate = new Date(now);
          eventDate.setDate(now.getDate() + dayOffset + (week * 7));
          
          // Select a random event type
          const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
          
          // Make weekend runs longer
          const isWeekend = eventDate.getDay() === 0 || eventDate.getDay() === 6;
          const distance = isWeekend ? eventType.distance * 1.5 : eventType.distance;
          
          // Set the event time
          const [hours, minutes] = eventType.time.split(':').map(Number);
          eventDate.setHours(hours, minutes, 0, 0);
          
          // Calculate end time (1 hour later for regular runs, 1.5 hours for long runs)
          const endDate = new Date(eventDate);
          endDate.setMinutes(endDate.getMinutes() + (isWeekend ? 90 : 60));
          
          // Determine pace category
          let paceCategory = 'intermediate';
          const paceParts = eventType.pace.split(':').map(Number);
          const paceValue = paceParts[0] + (paceParts[1] / 60);
          
          if (paceValue < 5.0) paceCategory = 'advanced';
          if (paceValue > 5.5) paceCategory = 'beginner';
          
          // Create the mock event
          const eventId = `test-${clubId}-${week}-${dayOffset}`;
          try {
            await storage.createEvent({
              stravaEventId: eventId,
              clubId: clubId,
              title: `${eventType.name} with ${clubName}`,
              description: `Join us for a ${(distance/1000).toFixed(1)}km run session. Pace: ${eventType.pace} min/km.`,
              startTime: eventDate,
              endTime: endDate,
              location: 'Oslo City Centre',
              distance: distance,
              pace: eventType.pace,
              paceCategory: paceCategory as any,
              beginnerFriendly: paceCategory === 'beginner',
              isIntervalTraining: eventType.name.toLowerCase().includes('speed'),
              stravaEventUrl: `https://www.strava.com/clubs/${clubId}`
            });
            
            eventsCreated++;
          } catch (err) {
            console.error(`Failed to create test event ${eventId}:`, err);
          }
        }
      }
      
      // Update club stats if we created events
      if (eventsCreated > 0) {
        await this.updateClubStats(clubId);
      }
      
      return eventsCreated;
    } catch (error: any) {
      logger.error(`Error creating test events for club ${clubId}:`, { error: error.message }, 'sync-service');
      return 0;
    }
  }
}

// Export a singleton instance
export const syncService = new SyncService();