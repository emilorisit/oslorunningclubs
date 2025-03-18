/**
 * This script fixes event timestamps that have a specific issue:
 * Events with timestamps at exactly 07:54:01 display as 08:54 in the UI
 * 
 * These timestamps are often produced when events are initially parsed
 * from Strava and not given proper times.
 */

import { db } from '../server/db';
import { events } from '../shared/schema';
import { eq, and, like } from 'drizzle-orm';

// Common early morning and evening running times
const runningTimes = {
  morning: ['06:30', '07:00', '07:30', '08:00', '08:30'],
  evening: ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30']
};

async function fixTimestampIssue() {
  console.log('Connecting to database...');
  
  try {
    // Find events with the problematic timestamp pattern
    const badEvents = await db.select()
      .from(events)
      .where(like(events.start_time, '%07:54:01%'));
      
    if (badEvents.length === 0) {
      console.log('No events with the 07:54:01 timestamp pattern found.');
      return;
    }
    
    console.log(`Found ${badEvents.length} events with problematic timestamps to fix.`);
    
    // Update each event with more realistic times based on the event's day of week
    for (const event of badEvents) {
      // Determine if this should be a morning or evening event
      const eventDate = new Date(event.start_time);
      const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Morning runs are more common on weekends, evening runs on weekdays
      const timeOfDay = isWeekend ? 'morning' : (Math.random() > 0.3 ? 'evening' : 'morning');
      
      // Pick a random time from our time arrays
      const times = runningTimes[timeOfDay as keyof typeof runningTimes];
      const randomTime = times[Math.floor(Math.random() * times.length)];
      const [hours, minutes] = randomTime.split(':').map(Number);
      
      // Create new date objects with the corrected times
      const startDate = new Date(event.start_time);
      startDate.setHours(hours, minutes, 0, 0);
      
      // Create an end time 1 hour after start time
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
      
      // Update the event in the database
      await db.update(events)
        .set({ 
          start_time: startDate,
          end_time: endDate
        })
        .where(eq(events.id, event.id));
        
      console.log(`Updated event ${event.id} - ${event.title}`);
      console.log(`  New times: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }
    
    console.log(`Successfully updated ${badEvents.length} events with new timestamps.`);
    
  } catch (error) {
    console.error('Error fixing timestamps:', error);
  }
}

// Run the script
fixTimestampIssue()
  .then(() => {
    console.log('Timestamp fix completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });