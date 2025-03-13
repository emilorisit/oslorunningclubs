import { useState, useEffect } from 'react';
import { formatDistance, formatPace } from '@/lib/strava';
import { CalendarView, Event, CalendarEventExtended, EventFilters, Club } from '@/lib/types';
import { addMonths, subMonths, addWeeks, subWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export function useCalendar() {
  // State
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [filters, setFilters] = useState<EventFilters>({
    paceCategories: ['beginner', 'intermediate', 'advanced'],
    distanceRanges: ['short', 'medium', 'long'],
    clubIds: [],
    beginnerFriendly: false
  });

  // Derived state for date range
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // Update date range when view or current date changes
  useEffect(() => {
    let start: Date;
    let end: Date;

    if (view === 'month') {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    } else if (view === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
      end = endOfWeek(currentDate, { weekStartsOn: 1 }); // End on Sunday
    } else {
      // For list view, show the current month by default
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }

    setDateRange({ start, end });
  }, [view, currentDate]);

  // Fetch events
  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/events', filters, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (filters.clubIds && filters.clubIds.length > 0) {
        params.append('clubIds', filters.clubIds.join(','));
      }
      
      if (filters.paceCategories && filters.paceCategories.length > 0) {
        params.append('paceCategories', filters.paceCategories.join(','));
      }
      
      if (filters.distanceRanges && filters.distanceRanges.length > 0) {
        params.append('distanceRanges', filters.distanceRanges.join(','));
      }
      
      if (filters.beginnerFriendly) {
        params.append('beginnerFriendly', 'true');
      }
      
      params.append('startDate', dateRange.start.toISOString());
      params.append('endDate', dateRange.end.toISOString());
      
      const response = await axios.get<Event[]>(`/api/events?${params.toString()}`);
      return response.data;
    }
  });

  // Fetch clubs for filter
  const { data: clubs = [] } = useQuery({
    queryKey: ['/api/clubs'],
    queryFn: async () => {
      const response = await axios.get('/api/clubs');
      return response.data;
    }
  });

  // Navigation functions
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrevious = () => {
    if (view === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else if (view === 'week') {
      setCurrentDate(prev => subWeeks(prev, 1));
    }
  };

  const goToNext = () => {
    if (view === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else if (view === 'week') {
      setCurrentDate(prev => addWeeks(prev, 1));
    }
  };

  // Format events for react-big-calendar
  const calendarEvents: CalendarEventExtended[] = events.map(event => {
    // Handle both camelCase and snake_case property names
    const startTime = (event as any).startTime || (event as any).start_time;
    const endTime = (event as any).endTime || (event as any).end_time;
    
    return {
      ...event,
      title: event.title,
      start: new Date(startTime),
      end: endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 60 * 60 * 1000), // Default 1 hour
      allDay: false
    };
  });

  // Format event details for display
  const getEventDetails = (event: Event) => {
    // Handle both camelCase and snake_case property names
    const startTime = (event as any).startTime || (event as any).start_time;
    const endTime = (event as any).endTime || (event as any).end_time;
    const clubId = (event as any).clubId || (event as any).club_id;
    const paceCategory = (event as any).paceCategory || (event as any).pace_category;
    const beginnerFriendly = (event as any).beginnerFriendly || (event as any).beginner_friendly;
    const stravaEventUrl = (event as any).stravaEventUrl || (event as any).strava_event_url;
    
    return {
      title: event.title,
      clubName: clubs.find((c: Club) => c.id === clubId)?.name || 'Unknown Club',
      date: new Date(startTime).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: `${new Date(startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${endTime ? new Date(endTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}`,
      location: event.location || 'Location not specified',
      distance: event.distance ? formatDistance(event.distance) : 'Unknown distance',
      pace: event.pace ? formatPace(event.pace) : 'Pace not specified',
      paceCategory: paceCategory,
      beginnerFriendly: beginnerFriendly,
      description: event.description || 'No description available',
      stravaEventUrl: stravaEventUrl
    };
  };

  return {
    view,
    setView,
    currentDate,
    dateRange,
    events: calendarEvents,
    rawEvents: events,
    isLoading,
    error,
    filters,
    setFilters,
    clubs,
    selectedEvent,
    setSelectedEvent,
    getEventDetails,
    goToToday,
    goToPrevious,
    goToNext,
    refetch
  };
}
