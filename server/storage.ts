import { 
  clubs, 
  events, 
  type Club, 
  type InsertClub, 
  type Event, 
  type InsertEvent 
} from "@shared/schema";
import crypto from 'crypto';

// Storage interface
export interface IStorage {
  // Club operations
  getClub(id: number): Promise<Club | undefined>;
  getClubByStravaId(stravaClubId: string): Promise<Club | undefined>;
  getClubs(approved?: boolean): Promise<Club[]>;
  createClub(club: InsertClub): Promise<Club>;
  updateClub(id: number, club: Partial<Club>): Promise<Club | undefined>;
  verifyClub(token: string): Promise<Club | undefined>;
  
  // Event operations
  getEvent(id: number): Promise<Event | undefined>;
  getEventByStravaId(stravaEventId: string): Promise<Event | undefined>;
  getEvents(filters?: EventFilters): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
}

// Event filter type
export type EventFilters = {
  clubIds?: number[];
  paceCategories?: string[];
  distanceRanges?: string[];
  beginnerFriendly?: boolean;
  startDate?: Date;
  endDate?: Date;
};

export class MemStorage implements IStorage {
  private clubs: Map<number, Club>;
  private events: Map<number, Event>;
  clubCurrentId: number;
  eventCurrentId: number;

  constructor() {
    this.clubs = new Map();
    this.events = new Map();
    this.clubCurrentId = 1;
    this.eventCurrentId = 1;
  }

  // Club operations
  async getClub(id: number): Promise<Club | undefined> {
    return this.clubs.get(id);
  }

  async getClubByStravaId(stravaClubId: string): Promise<Club | undefined> {
    return Array.from(this.clubs.values()).find(
      (club) => club.stravaClubId === stravaClubId
    );
  }

  async getClubs(approved?: boolean): Promise<Club[]> {
    if (approved !== undefined) {
      return Array.from(this.clubs.values()).filter(club => club.approved === approved);
    }
    return Array.from(this.clubs.values());
  }

  async createClub(insertClub: InsertClub): Promise<Club> {
    const id = this.clubCurrentId++;
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    const club: Club = { 
      ...insertClub, 
      id, 
      verified: false, 
      verificationToken,
      approved: false
    };
    
    this.clubs.set(id, club);
    return club;
  }

  async updateClub(id: number, clubData: Partial<Club>): Promise<Club | undefined> {
    const club = this.clubs.get(id);
    if (!club) return undefined;

    const updatedClub = { ...club, ...clubData };
    this.clubs.set(id, updatedClub);
    return updatedClub;
  }

  async verifyClub(token: string): Promise<Club | undefined> {
    const club = Array.from(this.clubs.values()).find(
      (club) => club.verificationToken === token
    );

    if (!club) return undefined;

    const verifiedClub: Club = {
      ...club,
      verified: true,
      verificationToken: null
    };

    this.clubs.set(club.id, verifiedClub);
    return verifiedClub;
  }

  // Event operations
  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventByStravaId(stravaEventId: string): Promise<Event | undefined> {
    return Array.from(this.events.values()).find(
      (event) => event.stravaEventId === stravaEventId
    );
  }

  async getEvents(filters?: EventFilters): Promise<Event[]> {
    let filteredEvents = Array.from(this.events.values());

    if (filters) {
      if (filters.clubIds && filters.clubIds.length > 0) {
        filteredEvents = filteredEvents.filter(event => 
          filters.clubIds!.includes(event.clubId)
        );
      }

      if (filters.paceCategories && filters.paceCategories.length > 0) {
        filteredEvents = filteredEvents.filter(event => 
          filters.paceCategories!.includes(event.paceCategory)
        );
      }

      if (filters.beginnerFriendly) {
        filteredEvents = filteredEvents.filter(event => event.beginnerFriendly);
      }

      if (filters.startDate) {
        filteredEvents = filteredEvents.filter(event => 
          new Date(event.startTime) >= filters.startDate!
        );
      }

      if (filters.endDate) {
        filteredEvents = filteredEvents.filter(event => 
          new Date(event.startTime) <= filters.endDate!
        );
      }

      // Simple distance filtering
      if (filters.distanceRanges && filters.distanceRanges.length > 0) {
        filteredEvents = filteredEvents.filter(event => {
          if (!event.distance) return false;
          
          const distanceKm = event.distance / 1000;
          
          return filters.distanceRanges!.some(range => {
            if (range === 'short') return distanceKm < 5;
            if (range === 'medium') return distanceKm >= 5 && distanceKm <= 10;
            if (range === 'long') return distanceKm > 10;
            return false;
          });
        });
      }
    }

    // Sort by start time
    return filteredEvents.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = this.eventCurrentId++;
    const event: Event = { ...insertEvent, id };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;

    const updatedEvent = { ...event, ...eventData };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    return this.events.delete(id);
  }
}

export const storage = new MemStorage();
