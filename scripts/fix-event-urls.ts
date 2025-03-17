import { initializeDatabase, db } from '../server/db';
import { sql } from 'drizzle-orm';

/**
 * This script fixes event URLs in the database
 * by replacing the internal club ID with the actual Strava club ID
 * in the stravaEventUrl field.
 * 
 * Example:
 * - Before: https://www.strava.com/clubs/4/group_events/1749508
 * - After:  https://www.strava.com/clubs/1046872/group_events/1749508
 */
async function fixEventUrls() {
  console.log('Starting event URL fix script...');
  
  try {
    // Initialize the database connection
    await initializeDatabase();
    console.log('Database connected successfully');
    
    // Get all clubs with their Strava club IDs
    const clubsResult = await db.execute(sql`
      SELECT id, name, strava_club_id
      FROM clubs
    `);
    
    if (!clubsResult || !Array.isArray(clubsResult)) {
      console.error('Failed to retrieve clubs or invalid result format');
      return;
    }
    
    console.log(`Found ${clubsResult.length} clubs to process`);
    
    // Process each club
    for (const club of clubsResult) {
      const clubId = club.id;
      const clubName = club.name;
      const stravaClubId = club.strava_club_id;
      
      console.log(`Processing club: ${clubName} (ID: ${clubId}, Strava ID: ${stravaClubId})`);
      
      // Find all events for this club with the incorrect URL format
      const incorrectPattern = `https://www.strava.com/clubs/${clubId}/group_events/`;
      
      const eventsResult = await db.execute(sql`
        SELECT id, strava_event_url 
        FROM events 
        WHERE club_id = ${clubId} 
        AND strava_event_url LIKE ${incorrectPattern + '%'}
      `);
      
      if (!eventsResult || !Array.isArray(eventsResult)) {
        console.error(`Failed to retrieve events for club ${clubName} or invalid result format`);
        continue;
      }
      
      console.log(`Found ${eventsResult.length} events with incorrect URLs for club ${clubName}`);
      
      // Process events in batches to avoid overloading the database
      const batchSize = 50;
      for (let i = 0; i < eventsResult.length; i += batchSize) {
        const batch = eventsResult.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(eventsResult.length / batchSize)}`);
        
        // Update each event in the batch
        for (const event of batch) {
          const oldUrl = event.strava_event_url;
          
          if (!oldUrl) {
            console.warn(`Event ${event.id} has no URL, skipping`);
            continue;
          }
          
          // Replace the club ID with the Strava club ID in the URL
          const newUrl = oldUrl.replace(
            `https://www.strava.com/clubs/${clubId}/group_events/`,
            `https://www.strava.com/clubs/${stravaClubId}/group_events/`
          );
          
          console.log(`Updating event ${event.id}: ${oldUrl} -> ${newUrl}`);
          
          await db.execute(sql`
            UPDATE events 
            SET strava_event_url = ${newUrl} 
            WHERE id = ${event.id}
          `);
        }
      }
      
      console.log(`Completed URL updates for club ${clubName}`);
    }
    
    console.log('Event URL fix script completed successfully!');
    
  } catch (error) {
    console.error('Error fixing event URLs:', error);
  } finally {
    // Ensure we exit the process
    setTimeout(() => process.exit(0), 1000);
  }
}

// Execute the script
fixEventUrls().catch(error => {
  console.error('Unhandled error during script execution:', error);
  process.exit(1);
});