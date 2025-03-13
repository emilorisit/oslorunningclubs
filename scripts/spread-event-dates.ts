import { db } from '../server/db';
import { events } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * This script spreads event dates across a range of days
 * instead of having all events on a single day.
 * This creates a more realistic calendar view.
 */
async function spreadEventDates() {
  console.log('Spreading event dates for better calendar visualization...');
  
  // Get all events
  const allEvents = await db.select().from(events);
  console.log(`Found ${allEvents.length} events to update`);
  
  // Calculate date range - spread events from 14 days ago to 60 days in the future
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 14); // Two weeks ago
  
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 60); // 60 days in the future
  
  // Days between start and end
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`Spreading events across ${totalDays} days from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  // Update each event with a random date in the range
  for (const event of allEvents) {
    // Get a random number of days to add to start date
    const randomDays = Math.floor(Math.random() * totalDays);
    
    // Create new date by adding random days to start date
    const newDate = new Date(startDate);
    newDate.setDate(startDate.getDate() + randomDays);
    
    // Random hour between 6am and 8pm
    const randomHour = 6 + Math.floor(Math.random() * 14);
    newDate.setHours(randomHour, 0, 0, 0);
    
    // Calculate end time (1-3 hours after start time)
    const duration = 1 + Math.floor(Math.random() * 2); // 1-3 hours
    const endTime = new Date(newDate);
    endTime.setHours(newDate.getHours() + duration);
    
    // Update the event in the database
    await db.update(events)
      .set({
        startTime: newDate,
        endTime: endTime
      })
      .where(eq(events.id, event.id));
      
    console.log(`Updated event ${event.id} - ${event.title}`);
  }
  
  console.log('Event dates have been spread successfully!');
}

// Run the function
spreadEventDates()
  .then(() => {
    console.log('Date spreading completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error spreading dates:', error);
    process.exit(1);
  });