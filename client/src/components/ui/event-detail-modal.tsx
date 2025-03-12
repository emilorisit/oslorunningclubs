import { useState, useEffect } from 'react';
import { Event } from '@/lib/types';
import { Dialog } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { getPaceCategoryColor, getPaceCategoryLabel, getPaceCategoryTextColor } from '@/lib/strava';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  eventDetails: {
    title: string;
    clubName: string;
    date: string;
    time: string;
    location: string;
    distance: string;
    pace: string;
    paceCategory: string;
    beginnerFriendly: boolean;
    description: string;
    stravaEventUrl: string;
  };
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event,
  eventDetails
}) => {
  if (!isOpen || !event) return null;
  
  const paceCategoryColor = getPaceCategoryColor(eventDetails.paceCategory);
  const paceCategoryLabel = getPaceCategoryLabel(eventDetails.paceCategory);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6 mx-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium text-white ${paceCategoryColor} mb-2`}>
                {paceCategoryLabel}
              </span>
              <h3 className="font-heading font-bold text-xl text-secondary">{eventDetails.title}</h3>
              <p className="text-muted">{eventDetails.clubName}</p>
            </div>
            <button 
              className="text-muted hover:text-secondary"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="border-t border-b border-border py-4 space-y-3">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{eventDetails.date}</span>
            </div>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{eventDetails.time}</span>
            </div>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{eventDetails.location}</span>
            </div>
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>{eventDetails.distance} • {eventDetails.pace}</span>
            </div>
          </div>
          
          <div className="mt-4">
            <p className="mb-4">{eventDetails.description}</p>
            
            {eventDetails.beginnerFriendly && (
              <div className="mb-4 p-2 bg-green-50 text-green-700 text-sm rounded-md border border-green-100">
                <span className="font-medium">Beginner friendly</span> - Perfect for those new to running or looking for a relaxed pace
              </div>
            )}
            
            <a 
              href={eventDetails.stravaEventUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block bg-primary hover:bg-opacity-90 text-white font-medium py-2 px-4 rounded"
            >
              View on Strava
            </a>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default EventDetailModal;
