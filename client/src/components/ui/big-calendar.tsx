import React, { useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEventExtended, Club } from '@/lib/types';
import { getPaceCategoryColor } from '@/lib/strava';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useIsMobile } from '@/hooks/use-mobile';

// Set locale to Norwegian with Monday as first day of week
moment.locale('nb', {
  week: {
    dow: 1, // Monday is the first day of the week
    doy: 4  // The week that contains Jan 4th is the first week of the year
  }
});
const localizer = momentLocalizer(moment);

// Club color mapping
const clubColorMap: Record<number, string> = {
  // Default color palette for clubs - will be dynamically assigned
};

// Set of predefined colors for clubs
const clubColors = [
  '#E53935', // Red
  '#8E24AA', // Purple
  '#3949AB', // Indigo
  '#1E88E5', // Blue
  '#00ACC1', // Cyan
  '#43A047', // Green
  '#FFB300', // Amber
  '#F4511E', // Deep Orange
  '#6D4C41', // Brown
  '#546E7A', // Blue Grey
  '#EC407A', // Pink
  '#7CB342', // Light Green
  '#039BE5', // Light Blue
  '#00897B', // Teal
  '#5E35B1', // Deep Purple
];

interface BigCalendarProps {
  events: CalendarEventExtended[];
  view: string;
  onViewChange: (view: string) => void;
  date?: Date;
  onNavigate?: (date: Date) => void;
  onEventClick: (event: CalendarEventExtended) => void;
}

const BigCalendar: React.FC<BigCalendarProps> = ({
  events,
  view,
  onViewChange,
  date,
  onNavigate,
  onEventClick
}) => {
  const isMobile = useIsMobile();
  
  // Fetch clubs to assign colors
  const { data: clubs = [] } = useQuery({
    queryKey: ['/api/clubs'],
    queryFn: async () => {
      const response = await axios.get('/api/clubs');
      return response.data;
    }
  });

  // Assign colors to clubs dynamically
  clubs.forEach((club: Club, index: number) => {
    if (!clubColorMap[club.id]) {
      clubColorMap[club.id] = clubColors[index % clubColors.length];
    }
  });

  // Custom event component to style events based on club
  const EventComponent = ({ event }: { event: CalendarEventExtended }) => {
    const clubId = event.clubId;
    const paceColorClass = `${getPaceCategoryColor(event.paceCategory)} bg-opacity-10`;
    const clubColor = clubColorMap[clubId] || '#888888'; // Default gray if no club
    
    // Format time in 24-hour format (Norwegian style)
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('nb-NO', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    };
    
    return (
      <div 
        className={`rounded p-1 ${paceColorClass} calendar-event`}
        style={{ 
          borderLeft: `4px solid ${clubColor}`,
          fontSize: isMobile ? '0.7rem' : 'inherit' 
        }}
      >
        <div className={`font-medium truncate ${isMobile ? 'text-xs' : ''}`}>{event.title}</div>
        <div className={`${isMobile ? 'text-xs' : ''}`}>
          {formatTime(new Date(event.start))}
        </div>
      </div>
    );
  };

  // Mobile-optimized event component for month view
  const MonthEventComponent = ({ event }: { event: CalendarEventExtended }) => {
    const clubId = event.clubId;
    const clubColor = clubColorMap[clubId] || '#888888';
    
    return (
      <div 
        className="rounded-sm overflow-hidden"
        style={{ 
          borderLeft: `4px solid ${clubColor}`,
          height: '100%',
          fontSize: '0.65rem',
          lineHeight: 1,
          padding: '1px 2px',
          backgroundColor: `${clubColor}20`
        }}
      >
        <div className="font-medium truncate">{event.title}</div>
      </div>
    );
  };

  // Custom toolbar component
  const CustomToolbar = ({ label }: any) => {
    return (
      <div className="rbc-toolbar">
        {/* Empty space to maintain toolbar layout */}
        <span className="rbc-btn-group invisible">
          <button type="button">Placeholder</button>
        </span>
        <span className={`rbc-toolbar-label ${isMobile ? 'text-sm' : ''}`}>{label}</span>
        {/* Empty space to maintain toolbar layout */}
        <span className="rbc-btn-group invisible">
          <button type="button">Placeholder</button>
        </span>
      </div>
    );
  };

  // Custom time slot wrapper for agenda/day/week view
  const TimeSlotWrapper = ({ children }: any) => {
    return (
      <div className={isMobile ? 'text-xs' : ''}>
        {children}
      </div>
    );
  };

  // Custom time gutter header
  const TimeGutterHeader = () => {
    return (
      <div className={isMobile ? 'text-xs font-semibold' : ''}>
        {isMobile ? 'Time' : 'Time'}
      </div>
    );
  };

  // Set time range from 5 AM to 10 PM
  const minTime = new Date();
  minTime.setHours(5, 0, 0);
  
  const maxTime = new Date();
  maxTime.setHours(22, 0, 0);

  // Determine minimum calendar height based on screen size
  const calendarHeight = isMobile 
    ? 'calc(100vh - 180px)' 
    : 'calc(100vh - 230px)';

  // Add mobile-specific styles
  useEffect(() => {
    // Add custom CSS for mobile view
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      /* Mobile-specific styles */
      @media (max-width: 640px) {
        .rbc-toolbar .rbc-toolbar-label {
          font-size: 1rem;
          padding: 5px 0;
        }
        
        .rbc-header {
          font-size: 0.7rem;
          padding: 4px 3px !important;
        }
        
        .rbc-date-cell {
          font-size: 0.7rem;
          padding-right: 3px !important;
        }
        
        .rbc-time-header-content .rbc-header {
          font-size: 0.7rem;
        }
        
        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid #f0f0f0;
        }
        
        .rbc-timeslot-group {
          min-height: 40px;
        }
        
        .rbc-time-view .rbc-time-gutter,
        .rbc-time-view .rbc-time-header-gutter {
          width: 40px;
        }
        
        .rbc-time-content {
          font-size: 0.7rem;
        }
        
        .rbc-agenda-view table.rbc-agenda-table {
          font-size: 0.7rem;
        }
        
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          padding: 3px 5px;
        }
        
        .rbc-agenda-view table.rbc-agenda-table .rbc-agenda-time-cell {
          width: 60px;
        }
        
        .rbc-agenda-view table.rbc-agenda-table .rbc-agenda-date-cell,
        .rbc-agenda-view table.rbc-agenda-table .rbc-agenda-event-cell {
          white-space: normal;
        }
      }
    `;
    document.head.appendChild(styleEl);
    
    // Clean up on unmount
    return () => {
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);
  
  return (
    <div className="rounded-lg shadow overflow-hidden bg-white p-1 sm:p-4 h-full">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ 
          height: calendarHeight, 
          minHeight: isMobile ? '400px' : '500px',
          fontSize: isMobile ? '0.8rem' : 'inherit'
        }}
        view={view}
        onView={onViewChange}
        date={date}
        onNavigate={onNavigate ? (date: Date) => onNavigate(date) : undefined}
        onSelectEvent={onEventClick}
        min={minTime}
        max={maxTime}
        views={{
          month: true,
          week: true,
          day: true,
          agenda: isMobile ? true : false
        }}
        components={{
          event: view === 'month' && isMobile ? MonthEventComponent : EventComponent,
          toolbar: CustomToolbar,
          timeSlotWrapper: TimeSlotWrapper,
          timeGutterHeader: TimeGutterHeader
        }}
        eventPropGetter={(event: CalendarEventExtended) => {
          const clubId = event.clubId;
          const clubColor = clubColorMap[clubId] || '#888888';
          
          return {
            className: `event-${event.paceCategory}`,
            style: {
              backgroundColor: `${clubColor}20`, // Add transparency
              color: '#333'
            }
          };
        }}
        formats={{
          dayFormat: isMobile ? 'dd D' : 'ddd D', // Shorter day format on mobile
          monthHeaderFormat: isMobile ? 'MMM YYYY' : 'MMMM YYYY', // Shorter month format on mobile
          weekdayFormat: isMobile ? 'dd' : 'dddd', // Shorter weekday format on mobile
          timeGutterFormat: 'HH:mm', // 24-hour format
          agendaTimeFormat: 'HH:mm',  // 24-hour format
          agendaTimeRangeFormat: ({ start, end }: { start: Date, end: Date }) => {
            return `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`;
          },
          agendaDateFormat: 'ddd DD.MM', // Shorter date format for agenda view
        }}
        dayPropGetter={(date: Date) => {
          const isToday = moment(date).isSame(moment(), 'day');
          if (isToday) {
            return {
              className: 'rbc-today',
              style: { 
                backgroundColor: 'rgba(255, 90, 54, 0.05)'
              }
            };
          }
          return {};
        }}
      />
    </div>
  );
};

export default BigCalendar;
