import { db } from '../server/db';
import { events } from '../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * This script updates event times to follow more realistic patterns
 * across the week with varied start times based on event type
 */
async function updateEventTimes() {
  console.log('Updating event times to follow realistic patterns...');
  
  // Get all events
  const allEvents = await db.select().from(events);
  console.log(`Found ${allEvents.length} events to update`);
  
  // Define common running club event times
  // Most clubs have set schedules for their runs
  const schedulePatterns = [
    // Weekday evenings (most common)
    { dayOfWeek: 1, // Monday
      timeRanges: [
        { startHour: 17, startMin: 30, endHour: 18, endMin: 30 }, // 5:30pm - 6:30pm
        { startHour: 18, startMin: 0, endHour: 19, endMin: 0 }    // 6:00pm - 7:00pm
      ]
    },
    { dayOfWeek: 2, // Tuesday
      timeRanges: [
        { startHour: 17, startMin: 0, endHour: 18, endMin: 0 },   // 5:00pm - 6:00pm 
        { startHour: 18, startMin: 0, endHour: 19, endMin: 30 }   // 6:00pm - 7:30pm (intervals)
      ]
    },
    { dayOfWeek: 3, // Wednesday
      timeRanges: [
        { startHour: 6, startMin: 30, endHour: 7, endMin: 30 },   // 6:30am - 7:30am (morning run)
        { startHour: 17, startMin: 30, endHour: 19, endMin: 0 }   // 5:30pm - 7:00pm
      ]
    },
    { dayOfWeek: 4, // Thursday
      timeRanges: [
        { startHour: 17, startMin: 30, endHour: 18, endMin: 30 }, // 5:30pm - 6:30pm
        { startHour: 18, startMin: 0, endHour: 19, endMin: 0 }    // 6:00pm - 7:00pm
      ]
    },
    { dayOfWeek: 5, // Friday
      timeRanges: [
        { startHour: 16, startMin: 30, endHour: 17, endMin: 30 }, // 4:30pm - 5:30pm (early finish)
        { startHour: 18, startMin: 0, endHour: 19, endMin: 0 }    // 6:00pm - 7:00pm (social)
      ]
    },
    { dayOfWeek: 6, // Saturday
      timeRanges: [
        { startHour: 8, startMin: 0, endHour: 10, endMin: 0 },    // 8:00am - 10:00am (long run)
        { startHour: 9, startMin: 0, endHour: 10, endMin: 30 }    // 9:00am - 10:30am
      ]
    },
    { dayOfWeek: 0, // Sunday
      timeRanges: [
        { startHour: 9, startMin: 0, endHour: 11, endMin: 0 },    // 9:00am - 11:00am (long run)
        { startHour: 10, startMin: 0, endHour: 11, endMin: 30 }   // 10:00am - 11:30am
      ]
    }
  ];
  
  // Date range calculation - maintain the existing dates but adjust times
  const today = new Date();
  
  // Calculate beginning of today for consistency
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  
  // Spread events starting 2 weeks ago to 8 weeks in the future
  const startDate = new Date(startOfToday);
  startDate.setDate(startOfToday.getDate() - 14); // Two weeks ago
  
  const endDate = new Date(startOfToday);
  endDate.setDate(startOfToday.getDate() + 56); // 8 weeks in the future
  
  // Update each event with a realistic schedule time based on day of week
  for (const event of allEvents) {
    // Generate a random date within the range if no original date exists
    const originalDate = event.startTime || new Date();
    
    // Keep the original date but adjust the time based on day of week
    const newDate = new Date(originalDate);
    const dayOfWeek = newDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Find schedule patterns for this day of week
    const dayPattern = schedulePatterns.find(p => p.dayOfWeek === dayOfWeek);
    
    if (dayPattern) {
      // Select a random time range from the available options for this day
      const randomTimeIndex = Math.floor(Math.random() * dayPattern.timeRanges.length);
      const timeRange = dayPattern.timeRanges[randomTimeIndex];
      
      // Apply the time to the date
      newDate.setHours(timeRange.startHour, timeRange.startMin, 0, 0);
      
      // Calculate end time based on pattern
      const newEndDate = new Date(newDate);
      newEndDate.setHours(timeRange.endHour, timeRange.endMin, 0, 0);
      
      // Check if interval training - make it a later evening session if so
      if (event.isIntervalTraining) {
        // Interval sessions often start in the evening
        if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Weekday
          newDate.setHours(18, 0, 0, 0);
          newEndDate.setHours(19, 30, 0, 0);
        }
      }
      
      // Add a slight randomization to prevent all events from starting exactly on the hour
      const minuteAdjustment = [-5, -2, 0, 2, 5][Math.floor(Math.random() * 5)];
      newDate.setMinutes(newDate.getMinutes() + minuteAdjustment);
      
      // Update the event in the database
      await db.update(events)
        .set({
          startTime: newDate,
          endTime: newEndDate
        })
        .where(eq(events.id, event.id));
        
      console.log(`Updated event ${event.id} - ${event.title}`);
      console.log(`  New times: ${newDate.toISOString()} to ${newEndDate.toISOString()}`);
    }
  }
  
  console.log('Event times have been updated successfully!');
}

// Run the function
updateEventTimes()
  .then(() => {
    console.log('Time update completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error updating times:', error);
    process.exit(1);
  });