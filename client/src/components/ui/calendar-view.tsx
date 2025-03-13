import { useState } from 'react';
import BigCalendar from './big-calendar';
import FilterSidebar from './filter-sidebar';
import EventDetailModal from './event-detail-modal';
import { StravaConnect } from './strava-connect';
import { format } from 'date-fns';
import { CalendarView as CalendarViewType, Event, EventFilters } from '@/lib/types';
import { useCalendar } from '@/hooks/use-calendar';
import { Button } from '@/components/ui/button';
import { isStravaAuthenticated } from '@/lib/strava';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

export function CalendarView() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewMode, setViewMode] = useState<CalendarViewType>('month');

  const {
    events,
    loading,
    error,
    filters,
    updateFilters,
    clearFilters
  } = useCalendar();

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const isConnectedToStrava = isStravaAuthenticated();

  return (
    <div className="flex flex-col md:flex-row w-full h-full">
      <FilterSidebar 
        filters={filters}
        onUpdateFilters={updateFilters}
        onClearFilters={clearFilters}
      />

      <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4">
        {!isConnectedToStrava && (
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
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
        />
      )}
    </div>
  );
}

export default CalendarView;