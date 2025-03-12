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
  const CustomToolbar = ({ label, onNavigate, onView }: any) => {
    return (
      <div className="rbc-toolbar">
        <span className="rbc-btn-group">
          <button type="button" onClick={() => onNavigate('TODAY')}>
            Today
          </button>
          <button type="button" onClick={() => onNavigate('PREV')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={() => onNavigate('NEXT')}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </span>
        <span className="rbc-toolbar-label">{label}</span>
        <span className="rbc-btn-group">
          <button type="button" onClick={() => onView('month')} className={view === 'month' ? 'rbc-active' : ''}>
            Month
          </button>
          <button type="button" onClick={() => onView('week')} className={view === 'week' ? 'rbc-active' : ''}>
            Week
          </button>
          <button type="button" onClick={() => onView('agenda')} className={view === 'agenda' ? 'rbc-active' : ''}>
            List
          </button>
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
