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
    
    // Get all clubs to map club IDs to Strava club IDs
    const clubsResult = await db.execute(
      sql`SELECT id, name, strava_club_id FROM clubs`
    );
    
    // Extract rows from the result
    const clubs = clubsResult.rows || [];
    
    console.log(`Found ${clubs.length} clubs to process`);
    
    // Process each club
    for (const club of clubs) {
      const clubId = club.id;
      const clubName = club.name;
      const stravaClubId = club.strava_club_id;
      
      console.log(`Processing club: ${clubName} (ID: ${clubId}, Strava ID: ${stravaClubId})`);
      
      // Find all events for this club with the incorrect URL format
      const incorrectPattern = `https://www.strava.com/clubs/${clubId}/group_events/`;
      
      const events = await db.execute(
        sql`SELECT id, strava_event_url 
            FROM events 
            WHERE club_id = ${clubId} 
            AND strava_event_url LIKE ${incorrectPattern + '%'}`
      );
      
      console.log(`Found ${events.length} events with incorrect URLs for club ${clubName}`);
      
      // Process events in batches to avoid overloading the database
      const batchSize = 50;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(events.length / batchSize)}`);
        
        // Update each event in the batch
        for (const event of batch) {
          const oldUrl = event.strava_event_url;
          // Replace the club ID with the Strava club ID in the URL
          const newUrl = oldUrl.replace(
            `https://www.strava.com/clubs/${clubId}/group_events/`,
            `https://www.strava.com/clubs/${stravaClubId}/group_events/`
          );
          
          await db.execute(
            sql`UPDATE events 
                SET strava_event_url = ${newUrl} 
                WHERE id = ${event.id}`
          );
        }
      }
      
      console.log(`Completed URL updates for club ${clubName}`);
    }
    
    console.log('Event URL fix script completed successfully!');
    
  } catch (error) {
    console.error('Error fixing event URLs:', error);
  } finally {
    // Ensure we exit
    process.exit(0);
  }
}

// Execute the script
fixEventUrls().catch(error => {
  console.error('Unhandled error during script execution:', error);
  process.exit(1);
});