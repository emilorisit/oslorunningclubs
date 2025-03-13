import { useState } from 'react';
import BigCalendar from './big-calendar';
import FilterSidebar from './filter-sidebar';
import EventDetailModal from './event-detail-modal';
import { StravaConnect } from './strava-connect';
import { format } from 'date-fns';
import { CalendarView as CalendarViewType, Event, EventFilters } from '@/lib/types';
import { useCalendar } from '@/hooks/use-calendar';

const CalendarView = () => {
  const {
    view,
    setView,
    currentDate,
    setCurrentDate,
    events,
    isLoading,
    filters,
    setFilters,
    clubs,
    selectedEvent,
    setSelectedEvent,
    getEventDetails,
    goToToday,
    goToPrevious,
    goToNext
  } = useCalendar();

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleViewChange = (newView: string) => {
    if (newView === 'agenda') {
      setView('list');
    } else {
      setView(newView as CalendarViewType);
    }
  };

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  const handleFilterChange = (newFilters: EventFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Calendar Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="font-heading font-semibold text-2xl text-secondary">Running Events</h2>
          <p className="text-muted">Find upcoming running events from Strava clubs in Oslo</p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button 
            onClick={goToToday}
            className="bg-white border border-border rounded-md px-4 py-2 text-secondary flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Today
          </button>
          <div className="flex">
            <button 
              onClick={goToPrevious}
              className="bg-white border border-border rounded-l-md px-3 py-2 text-secondary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={goToNext}
              className="bg-white border-t border-b border-r border-border rounded-r-md px-3 py-2 text-secondary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View Tabs */}
      <div className="mb-6 border-b border-border">
        <nav className="flex -mb-px space-x-8">
          <button 
            onClick={() => setView('month')} 
            className={`py-4 px-1 text-sm font-medium ${view === 'month' ? 'active-tab border-b-2 border-primary text-primary' : 'text-muted hover:text-secondary'}`}
          >
            Month
          </button>
          <button 
            onClick={() => setView('week')} 
            className={`py-4 px-1 text-sm font-medium ${view === 'week' ? 'active-tab border-b-2 border-primary text-primary' : 'text-muted hover:text-secondary'}`}
          >
            Week
          </button>
          <button 
            onClick={() => setView('list')} 
            className={`py-4 px-1 text-sm font-medium ${view === 'list' ? 'active-tab border-b-2 border-primary text-primary' : 'text-muted hover:text-secondary'}`}
          >
            List
          </button>
        </nav>
      </div>

      {/* Calendar Body */}
      <div className="flex flex-col lg:flex-row">
        {/* Filters */}
        <FilterSidebar 
          filters={filters}
          clubs={clubs}
          onChange={handleFilterChange}
        />
        
        {/* Calendar */}
        {isLoading ? (
          <div className="flex-grow flex items-center justify-center p-12">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-primary mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-secondary">Loading events...</p>
            </div>
          </div>
        ) : (
          <div className="flex-grow">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 18v-6M15 15h-6" />
                </svg>
                <h3 className="text-xl font-semibold text-secondary mb-2">No Events to Display</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  Connect with Strava to see events from running clubs you're a member of, or use the filters to view public events.
                </p>
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                  <StravaConnect showCard={false} title="Connect with Strava to see events" description="View all your running club events by connecting your account" />
                </div>
              </div>
            ) : (
              <BigCalendar
                events={events}
                view={view === 'list' ? 'agenda' : view}
                onView={handleViewChange}
                date={currentDate}
                onNavigate={(date) => setCurrentDate(date)}
                onSelectEvent={handleSelectEvent}
              />
            )}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          event={selectedEvent}
          eventDetails={getEventDetails(selectedEvent)}
        />
      )}
    </div>
  );
};

export default CalendarView;
