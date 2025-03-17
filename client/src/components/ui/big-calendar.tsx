import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEventExtended, Club } from '@/lib/types';
import { getPaceCategoryColor } from '@/lib/strava';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

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
    
    return (
      <div 
        className={`rounded p-1 ${paceColorClass} calendar-event`}
        style={{ borderLeft: `4px solid ${clubColor}` }}
      >
        <div className="font-medium text-xs truncate">{event.title}</div>
        <div className="text-xs">
          {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
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
        <span className="rbc-toolbar-label">{label}</span>
        {/* Empty space to maintain toolbar layout */}
        <span className="rbc-btn-group invisible">
          <button type="button">Placeholder</button>
        </span>
      </div>
    );
  };

  // Set time range from 5 AM to 10 PM
  const minTime = new Date();
  minTime.setHours(5, 0, 0);
  
  const maxTime = new Date();
  maxTime.setHours(22, 0, 0);

  return (
    <div className="rounded-lg shadow overflow-hidden bg-white p-4 h-full">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 'calc(100vh - 230px)', minHeight: '500px' }}
        view={view}
        onView={onViewChange}
        date={date}
        onNavigate={onNavigate ? (date: Date) => onNavigate(date) : undefined}
        onSelectEvent={onEventClick}
        min={minTime}
        max={maxTime}
        components={{
          event: EventComponent,
          toolbar: CustomToolbar
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
          dayFormat: 'ddd D',
          monthHeaderFormat: 'MMMM YYYY',
          weekdayFormat: 'dddd'
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
