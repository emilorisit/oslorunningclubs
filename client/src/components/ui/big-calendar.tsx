import { Calendar, Views, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { CalendarEventExtended } from '@/lib/types';
import { getPaceCategoryColor } from '@/lib/strava';

const localizer = momentLocalizer(moment);

interface BigCalendarProps {
  events: CalendarEventExtended[];
  view: string;
  onView: (view: string) => void;
  date: Date;
  onNavigate: (date: Date) => void;
  onSelectEvent: (event: CalendarEventExtended) => void;
}

const BigCalendar: React.FC<BigCalendarProps> = ({
  events,
  view,
  onView,
  date,
  onNavigate,
  onSelectEvent
}) => {
  // Custom event component to style events based on pace category
  const EventComponent = ({ event }: { event: CalendarEventExtended }) => {
    const colorClass = `${getPaceCategoryColor(event.paceCategory)} bg-opacity-10`;
    const borderClass = `border-l-4 border-${event.paceCategory}`;
    
    return (
      <div className={`rounded p-1 ${colorClass} ${borderClass} calendar-event`}>
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

  return (
    <div className="rounded-lg shadow overflow-hidden bg-white p-4 h-full">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 'calc(100vh - 230px)', minHeight: '500px' }}
        view={view as any}
        onView={(newView) => onView(newView)}
        date={date}
        onNavigate={onNavigate}
        onSelectEvent={onSelectEvent}
        components={{
          event: EventComponent,
          toolbar: CustomToolbar
        }}
        eventPropGetter={(event: CalendarEventExtended) => {
          return {
            className: `event-${event.paceCategory}`
          };
        }}
        formats={{
          dayFormat: 'ddd D',
          monthHeaderFormat: 'MMMM YYYY',
          weekdayFormat: 'dddd'
        }}
        dayPropGetter={(date) => {
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
