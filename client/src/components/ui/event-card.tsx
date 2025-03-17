import { Event } from '@/lib/types';
import { getPaceCategoryColor, getPaceCategoryLabel, formatDistance } from '@/lib/strava';
import { format } from 'date-fns';

interface EventCardProps {
  event: Event;
  clubName?: string;
  onClick: () => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, clubName, onClick }) => {
  const colorClass = `${getPaceCategoryColor(event.paceCategory)} bg-opacity-10`;
  const borderClass = `border-l-4 border-${event.paceCategory}`;
  
  return (
    <div 
      className={`${colorClass} ${borderClass} rounded p-3 mb-3 cursor-pointer transition hover:translate-y-[-2px]`}
      onClick={onClick}
    >
      <div className="flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <div className="flex gap-1 items-center">
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${getPaceCategoryColor(event.paceCategory)}`}>
              {getPaceCategoryLabel(event.paceCategory)}
            </span>
            {event.isIntervalTraining && (
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">
                Interval
              </span>
            )}
          </div>
          <span className="text-xs text-muted">
            {format(new Date(event.startTime), 'E, MMM d')}
          </span>
        </div>
        
        <h3 className="font-medium text-secondary">{event.title}</h3>
        <p className="text-sm text-muted">{clubName || 'Unknown Club'}</p>
        
        <div className="mt-2 text-sm">
          <div className="flex items-center text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {format(new Date(event.startTime), 'HH:mm')}
          </div>
          
          {event.location && (
            <div className="flex items-center text-muted mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{event.location}</span>
            </div>
          )}
          
          {event.distance && (
            <div className="flex items-center text-muted mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {formatDistance(event.distance)}
              {event.pace && ` • ${event.pace} min/km`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;
