import axios from 'axios';
import { apiRequest } from './queryClient';
import { Event, Club } from './types';
import { toast } from '@/hooks/use-toast';

/**
 * Fetch all events with optional filtering
 */
export async function fetchEvents(filters?: {
  clubIds?: number[];
  paceCategories?: string[];
  distanceRanges?: string[];
  beginnerFriendly?: boolean;
  startDate?: Date;
  endDate?: Date;
}) {
  // Build query parameters
  const params = new URLSearchParams();
  
  if (filters?.clubIds && filters.clubIds.length > 0) {
    params.append('clubIds', filters.clubIds.join(','));
  }
  
  if (filters?.paceCategories && filters.paceCategories.length > 0) {
    params.append('paceCategories', filters.paceCategories.join(','));
  }
  
  if (filters?.distanceRanges && filters.distanceRanges.length > 0) {
    params.append('distanceRanges', filters.distanceRanges.join(','));
  }
  
  if (filters?.beginnerFriendly) {
    params.append('beginnerFriendly', 'true');
  }
  
  if (filters?.startDate) {
    params.append('startDate', filters.startDate.toISOString());
  }
  
  if (filters?.endDate) {
    params.append('endDate', filters.endDate.toISOString());
  }
  
  const queryString = params.toString();
  const url = `/api/events${queryString ? `?${queryString}` : ''}`;
  
  const response = await axios.get<Event[]>(url);
  return response.data;
}

/**
 * Fetch all clubs
 * @param sortByScore - If true, clubs will be sorted by score
 */
export async function fetchClubs(sortByScore = false) {
  const endpoint = sortByScore ? '/api/clubs?sortBy=score' : '/api/clubs';
  const response = await axios.get<Club[]>(endpoint);
  return response.data;
}

/**
 * Start the Strava OAuth process
 * @param clubId - Optional club ID to associate the Strava connection with
 */
export async function connectWithStrava(clubId?: number, isDemoMode?: boolean) {
  // isDemoMode parameter is kept for backward compatibility but no longer used
  
  try {
    // Prepare the query parameters for the auth endpoint
    let endpoint = '/api/strava/auth';
    
    // If a club ID is provided, add it to the query parameters
    if (clubId) {
      endpoint += `?club_id=${clubId}`;
    }
    
    // Request the authorization URL from our backend
    const response = await apiRequest('GET', endpoint);
    const data = await response.json();
    
    if (!data.url) {
      toast({
        title: "Connection Error",
        description: "Unable to connect to Strava. Please try again later.",
        variant: "destructive"
      });
      return;
    }
    
    // The backend has already encoded the club_id in the state parameter
    let authUrl = data.url;
    
    // Redirect the user to Strava's authorization page
    window.location.href = authUrl;
  } catch (error) {
    console.error("Failed to start Strava authorization:", error);
    toast({
      title: "Connection Failed",
      description: "Could not connect to Strava. Please try again later.",
      variant: "destructive"
    });
  }
}

/**
 * Submit a new club
 */
export async function submitClub(clubData: {
  name: string;
  stravaClubUrl: string;
  adminEmail: string;
  website?: string;
  paceCategories: string[];
  distanceRanges: string[];
  meetingFrequency: string;
}) {
  try {
    const response = await apiRequest('POST', '/api/clubs', clubData);
    return await response.json();
  } catch (error) {
    console.error("Failed to submit club:", error);
    throw error;
  }
}

/**
 * Format a pace string (e.g. "5:30") for display
 */
export function formatPace(pace: string | null | undefined): string {
  if (!pace) return 'Unknown pace';
  return `${pace} min/km`;
}

/**
 * Format a distance in meters to a human-readable string
 */
export function formatDistance(distance: number | null | undefined): string {
  if (!distance) return 'Unknown distance';
  if (distance < 1000) return `${distance}m`;
  return `${(distance / 1000).toFixed(1)}km`;
}

/**
 * Get color class for pace category
 */
export function getPaceCategoryColor(category: string): string {
  switch (category) {
    case 'beginner':
      return 'bg-beginner';
    case 'intermediate':
      return 'bg-intermediate';
    case 'advanced':
      return 'bg-advanced';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get text color class for pace category
 */
export function getPaceCategoryTextColor(category: string): string {
  switch (category) {
    case 'beginner':
      return 'text-beginner';
    case 'intermediate':
      return 'text-intermediate';
    case 'advanced':
      return 'text-advanced';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get human-readable label for pace category
 */
export function getPaceCategoryLabel(category: string): string {
  switch (category) {
    case 'beginner':
      return 'Beginner';
    case 'intermediate':
      return 'Intermediate';
    case 'advanced':
      return 'Advanced';
    default:
      return 'Unknown';
  }
}

/**
 * Get human-readable label for distance range
 */
export function getDistanceRangeLabel(range: string): string {
  switch (range) {
    case 'short':
      return 'Short (< 5km)';
    case 'medium':
      return 'Medium (5-10km)';
    case 'long':
      return 'Long (> 10km)';
    default:
      return 'Unknown';
  }
}

/**
 * Get human-readable label for meeting frequency
 */
export function getMeetingFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'twice_a_week':
      return 'Twice a week';
    case 'multiple_times_per_week':
      return 'Multiple times per week';
    case 'monthly':
      return 'Monthly';
    case 'irregular':
      return 'Irregular schedule';
    default:
      return 'Unknown';
  }
}

/**
 * Format the last event date for display
 */
export function formatLastEventDate(date: string | Date | null | undefined): string {
  if (!date) return 'No events yet';
  
  const eventDate = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - eventDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format the average participants count
 */
export function formatAvgParticipants(count: number | undefined | null): string {
  if (!count) return 'No data';
  return `~${Math.round(count)} per event`;
}

/**
 * Trigger a manual sync with Strava
 */
export async function triggerStravaSync() {
  try {
    const response = await apiRequest('GET', '/api/strava/sync');
    return await response.json();
  } catch (error) {
    console.error("Failed to trigger Strava sync:", error);
    throw error;
  }
}

/**
 * Check the status of the Strava sync service
 */
export async function checkSyncStatus() {
  try {
    const response = await apiRequest('GET', '/api/strava/sync-status');
    return await response.json();
  } catch (error) {
    console.error("Failed to check sync status:", error);
    throw error;
  }
}
