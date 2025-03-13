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
  getClubsSortedByScore(): Promise<Club[]>;
  createClub(club: InsertClub): Promise<Club>;
  updateClub(id: number, club: Partial<Club>): Promise<Club | undefined>;
  verifyClub(token: string): Promise<Club | undefined>;
  updateClubStravaTokens(clubId: number, tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<Club | undefined>;
  updateClubStatistics(clubId: number, stats: {
    avgParticipants?: number;
    participantsCount?: number;
    eventsCount?: number;
    lastEventDate?: Date;
  }): Promise<Club | undefined>;
  calculateClubScore(clubId: number): Promise<number>;
  
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
    
    // Initialize with some test data
    this.initializeTestData();
  }
  
  private async initializeTestData() {
    // Only add test data if no clubs exist yet
    if (this.clubs.size > 0) return;
    
    // Create some example clubs
    const testClubs = [
      {
        name: "Oslo Running Club",
        stravaClubId: "123456",
        stravaClubUrl: "https://www.strava.com/clubs/oslorc",
        adminEmail: "admin@oslorc.no",
        website: "https://www.oslorc.no",
        paceCategories: ["beginner", "intermediate", "advanced"],
        distanceRanges: ["short", "medium", "long"],
        meetingFrequency: "weekly",
        verified: true,
        approved: true,
        lastEventDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        avgParticipants: 25,
        eventsCount: 14,
        participantsCount: 350,
        clubScore: 330
      },
      {
        name: "The Trail Runners",
        stravaClubId: "234567",
        stravaClubUrl: "https://www.strava.com/clubs/trailrunnersoslo",
        adminEmail: "admin@trailrunners.no",
        website: "https://www.trailrunners.no",
        paceCategories: ["intermediate", "advanced"],
        distanceRanges: ["medium", "long"],
        meetingFrequency: "twice_a_week",
        verified: true,
        approved: true,
        lastEventDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        avgParticipants: 15,
        eventsCount: 8,
        participantsCount: 120,
        clubScore: 210
      },
      {
        name: "Beginner Friendly Runners",
        stravaClubId: "345678",
        stravaClubUrl: "https://www.strava.com/clubs/beginnerfriendly",
        adminEmail: "admin@bfr.no",
        website: null,
        paceCategories: ["beginner"],
        distanceRanges: ["short", "medium"],
        meetingFrequency: "weekly",
        verified: true,
        approved: true,
        lastEventDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        avgParticipants: 30,
        eventsCount: 6,
        participantsCount: 180,
        clubScore: 280
      },
      {
        name: "Nordmarka Forest Runners",
        stravaClubId: "456789",
        stravaClubUrl: "https://www.strava.com/clubs/nordmarkarunners",
        adminEmail: "admin@nordmarka.no",
        website: "https://www.nordmarkarunners.no",
        paceCategories: ["intermediate", "advanced"],
        distanceRanges: ["medium", "long"],
        meetingFrequency: "weekly",
        verified: true,
        approved: true,
        lastEventDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        avgParticipants: 12,
        eventsCount: 22,
        participantsCount: 264,
        clubScore: 195
      }
    ];
    
    for (const clubData of testClubs) {
      const club: Club = {
        id: this.clubCurrentId++,
        name: clubData.name,
        stravaClubId: clubData.stravaClubId,
        stravaClubUrl: clubData.stravaClubUrl,
        adminEmail: clubData.adminEmail,
        website: clubData.website,
        paceCategories: clubData.paceCategories,
        distanceRanges: clubData.distanceRanges,
        meetingFrequency: clubData.meetingFrequency,
        verified: clubData.verified,
        verificationToken: null,
        approved: clubData.approved,
        stravaAccessToken: null,
        stravaRefreshToken: null,
        stravaTokenExpiresAt: null,
        lastEventDate: clubData.lastEventDate,
        avgParticipants: clubData.avgParticipants,
        participantsCount: clubData.participantsCount,
        eventsCount: clubData.eventsCount,
        clubScore: clubData.clubScore
      };
      
      this.clubs.set(club.id, club);
    }
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

  async createClub(insertClub: InsertClub, options?: { autoVerify?: boolean }): Promise<Club> {
    const id = this.clubCurrentId++;
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    const club: Club = {
      name: insertClub.name,
      stravaClubId: insertClub.stravaClubId,
      stravaClubUrl: insertClub.stravaClubUrl,
      adminEmail: insertClub.adminEmail,
      website: insertClub.website || null,
      paceCategories: insertClub.paceCategories,
      distanceRanges: insertClub.distanceRanges,
      meetingFrequency: insertClub.meetingFrequency,
      id,
      verified: options?.autoVerify || false,
      verificationToken,
      approved: false,
      stravaAccessToken: null,
      stravaRefreshToken: null,
      stravaTokenExpiresAt: null,
      lastEventDate: null,
      avgParticipants: 0,
      participantsCount: 0,
      eventsCount: 0,
      clubScore: 0
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

  async updateClubStravaTokens(
    clubId: number,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    }
  ): Promise<Club | undefined> {
    const club = this.clubs.get(clubId);
    if (!club) return undefined;

    const updatedClub: Club = {
      ...club,
      stravaAccessToken: tokens.accessToken,
      stravaRefreshToken: tokens.refreshToken,
      stravaTokenExpiresAt: tokens.expiresAt
    };

    this.clubs.set(clubId, updatedClub);
    return updatedClub;
  }

  // Club statistics operations
  async getClubsSortedByScore(): Promise<Club[]> {
    const clubs = Array.from(this.clubs.values())
      .filter(club => club.approved) // Only include approved clubs
      .sort((a, b) => {
        // Sort by club score (descending)
        return (b.clubScore || 0) - (a.clubScore || 0);
      });
    
    return clubs;
  }
  
  async updateClubStatistics(
    clubId: number, 
    stats: {
      avgParticipants?: number;
      participantsCount?: number;
      eventsCount?: number;
      lastEventDate?: Date;
    }
  ): Promise<Club | undefined> {
    const club = this.clubs.get(clubId);
    if (!club) return undefined;
    
    const updatedClub: Club = {
      ...club,
      avgParticipants: stats.avgParticipants !== undefined ? stats.avgParticipants : club.avgParticipants,
      participantsCount: stats.participantsCount !== undefined ? stats.participantsCount : club.participantsCount,
      eventsCount: stats.eventsCount !== undefined ? stats.eventsCount : club.eventsCount,
      lastEventDate: stats.lastEventDate || club.lastEventDate
    };
    
    // Calculate new score
    const score = await this.calculateClubScore(clubId);
    updatedClub.clubScore = score;
    
    this.clubs.set(clubId, updatedClub);
    return updatedClub;
  }
  
  async calculateClubScore(clubId: number): Promise<number> {
    const club = this.clubs.get(clubId);
    if (!club) return 0;
    
    // Get all events for this club
    const clubEvents = Array.from(this.events.values())
      .filter(event => event.clubId === clubId);
    
    // Calculate score based on:
    // 1. Number of events (higher is better)
    // 2. Average participants (higher is better)
    // 3. Recency of last event (more recent is better)
    
    const eventsScore = club.eventsCount || clubEvents.length;
    const participantsScore = club.avgParticipants || 0;
    
    // Calculate recency score (higher for more recent events)
    let recencyScore = 0;
    if (club.lastEventDate) {
      const now = new Date();
      const lastEventDate = new Date(club.lastEventDate);
      const daysSinceLastEvent = Math.floor((now.getTime() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // More recent events get higher scores (max 100)
      recencyScore = Math.max(0, 100 - daysSinceLastEvent);
    }
    
    // Calculate final score (weighted sum)
    const score = eventsScore * 5 + participantsScore * 10 + recencyScore;
    return Math.round(score);
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
          event.paceCategory && filters.paceCategories!.includes(event.paceCategory)
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
    const event: Event = {
      ...insertEvent,
      id,
      description: insertEvent.description || null,
      endTime: insertEvent.endTime || null,
      location: insertEvent.location || null,
      distance: insertEvent.distance || null,
      pace: insertEvent.pace || null,
      paceCategory: insertEvent.paceCategory || null,
      beginnerFriendly: insertEvent.beginnerFriendly || false
    };
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
