import { useState, useEffect } from 'react';
import BigCalendar from './big-calendar';
import FilterSidebar from './filter-sidebar';
import EventDetailModal from './event-detail-modal';
import { StravaConnect } from './strava-connect';
import ClubColorLegend from './club-color-legend';
import { format } from 'date-fns';
import { CalendarView as CalendarViewType, Event, EventFilters, Club } from '@/lib/types';
import { useCalendar } from '@/hooks/use-calendar';
import { Button } from '@/components/ui/button';
import { isStravaAuthenticated, fetchClubs } from '@/lib/strava';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';
import { SiStrava } from 'react-icons/si';

export function CalendarView() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewMode, setViewMode] = useState<string>('month');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);

  const {
    events,
    isLoading: loading,
    error,
    filters,
    setFilters,
    getEventDetails,
    authRequired,
    authMessage,
    isAuthenticated
  } = useCalendar();
  
  const updateFilters = (newFilters: EventFilters) => {
    setFilters(newFilters);
  };
  
  const clearFilters = () => {
    setFilters({
      paceCategories: ['beginner', 'intermediate', 'advanced'],
      distanceRanges: ['short', 'medium', 'long'],
      clubIds: [],
      beginnerFriendly: false
    });
  };

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  // Fetch clubs for filtering
  useEffect(() => {
    const getClubs = async () => {
      try {
        setLoadingClubs(true);
        const clubsData = await fetchClubs();
        setClubs(clubsData);
      } catch (err) {
        console.error('Failed to fetch clubs:', err);
      } finally {
        setLoadingClubs(false);
      }
    };

    getClubs();
  }, []);

  const isConnectedToStrava = isStravaAuthenticated();

  return (
    <div className="flex flex-col md:flex-row w-full h-full">
      <FilterSidebar 
        filters={filters}
        clubs={clubs}
        onUpdateFilters={updateFilters}
        onClearFilters={clearFilters}
      />

      <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4">
        {/* Show auth error alert when API returns auth required */}
        {authRequired && (
          <Alert variant="destructive" className="mb-4 bg-red-50 border-red-300">
            <InfoIcon className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800 font-semibold">Authentication Required</AlertTitle>
            <AlertDescription className="text-red-700">
              <p className="mb-2">
                {authMessage || "Due to Strava API regulations, we can only show events from clubs you're a member of if you connect your Strava account."}
              </p>
              <div className="mt-4">
                <StravaConnect />
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Show general Strava info for unauthenticated users */}
        {!isAuthenticated && !authRequired && (
          <Alert variant="default" className="mb-4 bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 font-semibold">Connect with Strava to see your clubs' events</AlertTitle>
            <AlertDescription className="text-blue-700">
              <p className="mb-2">
                Due to Strava API regulations, we can only show events from clubs you're a member of if you connect your Strava account.
              </p>
              <p>
                You can click on any event to view details and access the Strava page where you can sign up for the event.
              </p>
              <div className="mt-4">
                <StravaConnect />
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold">
            Running Calendar
          </h2>
          <div className="flex space-x-2">
            <Button 
              variant={viewMode === 'month' ? 'default' : 'outline'} 
              onClick={() => setViewMode('month')}
              size="sm"
            >
              Month
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'default' : 'outline'} 
              onClick={() => setViewMode('week')}
              size="sm"
            >
              Week
            </Button>
            <Button 
              variant={viewMode === 'day' ? 'default' : 'outline'} 
              onClick={() => setViewMode('day')}
              size="sm"
            >
              Day
            </Button>
          </div>
        </div>
        
        {/* Add club color legend */}
        {!loading && clubs.length > 0 && (
          <div className="mb-4">
            <ClubColorLegend />
          </div>
        )}

        <div className="flex-1 relative min-h-[500px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 rounded-full border-t-transparent"></div>
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-50 p-4 rounded-md text-red-600">
                Error loading events. Please try again later.
              </div>
            </div>
          ) : null}
          
          {/* Empty state when auth required and no events */}
          {!loading && !error && events.length === 0 && authRequired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="bg-gray-50 rounded-lg p-8 max-w-md text-center">
                <SiStrava className="text-[#FC4C02] h-12 w-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Connect with Strava to See Events</h3>
                <p className="text-gray-600 mb-4">
                  Due to Strava API limitations, you need to connect your Strava account to see events from clubs you're a member of.
                </p>
                <StravaConnect showCard={false} />
              </div>
            </div>
          )}
          
          {/* Empty state when no events but authenticated */}
          {!loading && !error && events.length === 0 && isAuthenticated && !authRequired && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="bg-gray-50 rounded-lg p-8 max-w-md text-center">
                <h3 className="text-xl font-bold mb-2">No Events Found</h3>
                <p className="text-gray-600">
                  There are no events in this date range from clubs you're a member of. Try adjusting your filters or date range.
                </p>
              </div>
            </div>
          )}

          <BigCalendar 
            events={events} 
            onEventClick={handleEventClick}
            view={viewMode}
            onViewChange={setViewMode}
          />
        </div>
      </div>

      {showEventModal && selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          eventDetails={getEventDetails(selectedEvent)}
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
        />
      )}
    </div>
  );
}

export default CalendarView;