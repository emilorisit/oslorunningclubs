import { db } from '../server/db';
import { events, hiddenEvents } from '../shared/schema';

/**
 * This script deletes all events from the database
 */
async function deleteAllEvents() {
  console.log('Starting to delete all events...');
  
  try {
    // First delete from hidden_events table (foreign key constraints)
    console.log('Deleting records from hidden_events table...');
    await db.delete(hiddenEvents);
    
    // Then delete from events table
    console.log('Deleting records from events table...');
    const deletedCount = await db.delete(events);
    
    console.log(`Successfully deleted all events from the database!`);
    
    return { success: true, message: 'All events deleted successfully' };
  } catch (error) {
    console.error('Error deleting events:', error);
    return { success: false, error };
  }
}

// Execute the function when run directly
if (require.main === module) {
  deleteAllEvents()
    .then((result) => {
      console.log(result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { deleteAllEvents };