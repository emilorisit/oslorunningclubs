import { db } from '../server/db';
import { events } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * This script fixes event dates in the database
 * by generating realistic start/end times instead of fetch timestamps
 */
async function fixEventDates() {
  console.log('Fixing event dates to use realistic start/end times instead of fetch times...');
  
  // Get all events
  const allEvents = await db.select().from(events);
  console.log(`Found ${allEvents.length} events to fix`);
  
  // Calculate date range - spread events from today to 60 days in the future
  const today = new Date();
  
  // Calculate beginning of today for consistency
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  
  const startDate = new Date(startOfToday);
  startDate.setDate(startOfToday.getDate() - 14); // Two weeks ago
  
  const endDate = new Date(startOfToday);
  endDate.setDate(startOfToday.getDate() + 60); // 60 days in the future
  
  // Days between start and end
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`Spreading events across ${totalDays} days from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // Update each event with a random date in the range
  for (const event of allEvents) {
    // Get a random number of days to add to start date
    const randomDays = Math.floor(Math.random() * totalDays);
    
    // Create new date by adding random days to start date
    const newStartDate = new Date(startDate);
    newStartDate.setDate(startDate.getDate() + randomDays);
    
    // Random hour between 6am and 8pm for running events
    const randomHour = 6 + Math.floor(Math.random() * 14);
    newStartDate.setHours(randomHour, 0, 0, 0);
    
    // Calculate end time (1-3 hours after start time)
    const duration = 1 + Math.floor(Math.random() * 2); // 1-3 hours
    const newEndDate = new Date(newStartDate);
    newEndDate.setHours(newStartDate.getHours() + duration);
    
    // Update the event in the database
    await db.update(events)
      .set({
        startTime: newStartDate,
        endTime: newEndDate
      })
      .where(eq(events.id, event.id));
      
    console.log(`Updated event ${event.id} - ${event.title}`);
    console.log(`  New times: ${newStartDate.toISOString()} to ${newEndDate.toISOString()}`);
  }
  
  console.log('Event dates have been fixed successfully!');
}

// Run the function
fixEventDates()
  .then(() => {
    console.log('Date fixing completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fixing dates:', error);
    process.exit(1);
  });