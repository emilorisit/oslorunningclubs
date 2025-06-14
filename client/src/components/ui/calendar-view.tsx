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
import { isStravaAuthenticated, fetchClubs, deleteAllEventsAndSync, triggerStravaSync } from '@/lib/strava';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, Menu, ListIcon, CalendarIcon, CalendarDaysIcon, Calendar as CalendarIconSingle, RefreshCcw } from 'lucide-react';
import { SiStrava } from 'react-icons/si';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

export function CalendarView() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewMode, setViewMode] = useState<string>('agenda');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSync, setIsSync] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const {
    events,
    isLoading: loading,
    error,
    filters,
    setFilters,
    getEventDetails,
    authRequired,
    authMessage,
    isAuthenticated,
    currentDate,
    setCurrentDate,
    view,
    setView
  } = useCalendar();
  
  // Keep viewMode state in sync with calendar view
  useEffect(() => {
    if (viewMode !== view) {
      setView(viewMode as CalendarViewType);
    }
  }, [viewMode, view, setView]);
  
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
        
        {/* Show sync button for authenticated users */}
        {isAuthenticated && events.length === 0 && (
          <Alert variant="default" className="mb-4 bg-green-50 border-green-200">
            <InfoIcon className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 font-semibold">No Events Found</AlertTitle>
            <AlertDescription className="text-green-700">
              <p className="mb-2">
                You're authenticated with Strava, but we don't see any events yet. This could be because:
              </p>
              <ul className="mb-2 list-disc list-inside">
                <li>Your Strava clubs don't have any upcoming events</li>
                <li>We need to sync your events from Strava</li>
              </ul>
              <Button 
                variant="default" 
                className="mt-2 bg-green-600 hover:bg-green-700"
                disabled={isSync}
                onClick={async () => {
                  setIsSync(true);
                  try {
                    const result = await triggerStravaSync();
                    toast({
                      title: "Sync Initiated",
                      description: "Starting to sync events from Strava. This may take a moment.",
                    });
                    // Refresh the calendar view after a short delay
                    setTimeout(() => location.reload(), 2000);
                  } catch (err) {
                    console.error("Sync error:", err);
                    toast({
                      title: "Sync Failed",
                      description: "Failed to sync events from Strava. Please try again.",
                      variant: "destructive"
                    });
                  } finally {
                    setIsSync(false);
                  }
                }}
              >
                {isSync ? 
                  <><RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> Syncing...</> : 
                  <><RefreshCcw className="mr-2 h-4 w-4" /> Sync Events from Strava</>
                }
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between items-center mb-2">
          <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
            Running Calendar
          </h2>
          <div className="flex space-x-1 sm:space-x-2">
            {isMobile ? (
              // Mobile view with icons
              <>
                <Button 
                  variant={viewMode === 'month' ? 'default' : 'outline'} 
                  onClick={() => setViewMode('month')}
                  size="sm"
                  className="p-1 sm:p-2"
                  title="Month View"
                >
                  <CalendarDaysIcon className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === 'week' ? 'default' : 'outline'} 
                  onClick={() => setViewMode('week')}
                  size="sm"
                  className="p-1 sm:p-2"
                  title="Week View"
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === 'day' ? 'default' : 'outline'} 
                  onClick={() => setViewMode('day')}
                  size="sm"
                  className="p-1 sm:p-2"
                  title="Day View"
                >
                  <CalendarIconSingle className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === 'agenda' ? 'default' : 'outline'} 
                  onClick={() => setViewMode('agenda')}
                  size="sm"
                  className="p-1 sm:p-2"
                  title="List View"
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
              </>
            ) : (
              // Desktop view with text
              <>
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
                <Button 
                  variant={viewMode === 'agenda' ? 'default' : 'outline'} 
                  onClick={() => setViewMode('agenda')}
                  size="sm"
                >
                  List
                </Button>
              </>
            )}
          </div>
        </div>
        
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
            date={currentDate}
            onNavigate={setCurrentDate}
          />
        </div>
        
        {/* Club color legend - moved below the calendar, only shown for authenticated users */}
        {!loading && events.length > 0 && isAuthenticated && (
          <div className="mt-4">
            <ClubColorLegend isAuthenticated={isAuthenticated} visibleEvents={events} />
          </div>
        )}
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