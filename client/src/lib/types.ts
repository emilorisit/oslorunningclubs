export type PaceCategory = 'beginner' | 'intermediate' | 'advanced';
export type DistanceRange = 'short' | 'medium' | 'long';
export type MeetingFrequency = 'weekly' | 'twice_a_week' | 'multiple_times_per_week' | 'monthly' | 'irregular';

export interface Club {
  id: number;
  name: string;
  stravaClubId: string;
  stravaClubUrl: string;
  adminEmail: string;
  website?: string;
  paceCategories: PaceCategory[];
  distanceRanges: DistanceRange[];
  meetingFrequency: MeetingFrequency;
  verified: boolean;
  approved: boolean;
  lastEventDate?: Date | string | null;
  avgParticipants?: number;
  participantsCount?: number;
  eventsCount?: number;
  clubScore?: number;
}

export interface Event {
  id: number;
  stravaEventId: string;
  clubId: number;
  title: string;
  description?: string;
  startTime: string | Date;
  endTime?: string | Date;
  location?: string;
  distance?: number;
  pace?: string;
  paceCategory: PaceCategory;
  beginnerFriendly: boolean;
  stravaEventUrl: string;
  club?: Club;
}

export interface EventFilters {
  clubIds?: number[];
  paceCategories?: PaceCategory[];
  distanceRanges?: DistanceRange[];
  beginnerFriendly?: boolean;
  isIntervalTraining?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export type CalendarView = 'month' | 'week' | 'list' | 'agenda';

export interface CalendarEventExtended extends Event {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
}
