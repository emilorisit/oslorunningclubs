import axios from 'axios';
import { resilientApi } from './resilient-api';

export class StravaService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Strava client credentials not found in environment variables');
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    // Make sure the parameter name is correct for Strava's requirements
    console.log('------- STRAVA AUTHORIZATION DEBUG -------');
    console.log('Original redirect URI:', redirectUri);
    
    // Strava is very particular about redirect URI format
    // For API calls, we must check if the redirect URI is correctly URL-encoded
    const encodedUri = encodeURIComponent(redirectUri);
    console.log('URL-encoded redirect URI:', encodedUri);
    
    // For testing purposes, let's try a specific redirect URI format for production
    // This is based on your domain "www.oslorunningclubs.no"
    let finalRedirectUri = redirectUri;
    
    // Always force the redirect URI to match exactly what Strava expects, regardless of environment
    // This ensures a consistent user experience and prevents redirect_uri mismatch errors
    finalRedirectUri = 'https://www.oslorunningclubs.no/api/strava/callback';
    console.log('Using fixed redirect URI that matches Strava app settings:', finalRedirectUri);
    
    // Removed test request that was causing deployment issues
    // We'll skip the test call during initialization for better deployment compatibility
    console.log('Skipping test request to Strava during initialization');
    
    // Build the params with the potentially modified redirect URI
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: finalRedirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all,profile:read_all',
      state,
    });
    
    // For debugging, check the actual parameter values
    console.log('Client ID:', this.clientId);
    console.log('Final redirect URI used:', finalRedirectUri);
    console.log('Response type:', 'code');
    console.log('Scope:', 'read,activity:read_all,profile:read_all');
    console.log('State:', state);
    
    const fullUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    console.log('Full authorization URL:', fullUrl);
    console.log('----------------------------------------');
    
    return fullUrl;
  }

  async exchangeToken(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    try {
      console.log('------- STRAVA TOKEN EXCHANGE DEBUG -------');
      console.log('Exchanging authorization code for token');
      console.log('Code (first few chars):', code.substring(0, 5) + '...');
      
      // Prepare token request parameters
      const tokenParams = {
        client_id: this.clientId,
        client_secret: this.clientSecret.substring(0, 3) + '...',  // Partially mask for logs
        code,
        grant_type: 'authorization_code',
      };
      
      console.log('Token request params (masked):', JSON.stringify({
        client_id: this.clientId,
        client_secret: '***masked***',
        code: code.substring(0, 5) + '...',
        grant_type: 'authorization_code',
      }, null, 2));
      
      // Make the token exchange request using resilient API
      console.log('Making POST request to https://www.strava.com/oauth/token');
      const responseData = await resilientApi.post('https://www.strava.com/oauth/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
      });
      
      // Create response-like object for compatibility
      const response = { data: responseData, status: 200 };
      
      console.log('Token exchange successful');
      console.log('Response status:', response.status);
      console.log('Access token (first few chars):', response.data.access_token.substring(0, 5) + '...');
      console.log('----------------------------------------');
      
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(response.data.expires_at * 1000),
      };
    } catch (error: any) {
      console.error('------- STRAVA TOKEN EXCHANGE ERROR -------');
      
      // Handle error appropriately based on type
      if (error.response) {
        // Axios error with response data
        console.error('Token exchange failed, Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        
        // Check for specific error conditions
        if (error.response.data && error.response.data.errors) {
          console.error('Specific errors:', error.response.data.errors);
        }
        
        // Check for redirect_uri issues specifically
        const errorData = error.response.data || {};
        if (
          errorData.message && 
          (errorData.message.includes('redirect') || errorData.message.includes('url'))
        ) {
          console.error('REDIRECT URI ISSUE DETECTED:', errorData.message);
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error('Token exchange failed, no response from server');
        console.error('Request details:', error.request);
      } else {
        // Something else happened
        console.error('Token exchange general error:', error.message);
      }
      
      console.error('----------------------------------------');
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    try {
      console.log('------- STRAVA TOKEN REFRESH DEBUG -------');
      console.log('Refreshing token, first few chars:', refreshToken.substring(0, 5) + '...');
      
      // Check if client ID and secret are available
      if (!this.clientId || !this.clientSecret) {
        console.error('Missing Strava API credentials');
        throw new Error('Missing Strava API credentials');
      }
      
      // Prepare refresh token request
      const params = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      };
      
      console.log('Refresh request params (masked):', JSON.stringify({
        client_id: this.clientId,
        client_secret: '***masked***',
        refresh_token: refreshToken.substring(0, 5) + '...',
        grant_type: 'refresh_token',
      }));
      
      // Using resilient API client for token refresh
      const response = {
        data: await resilientApi.post('https://www.strava.com/oauth/token', params)
      };
      
      console.log('Token refresh successful, received new tokens');
      
      // Verify we have the expected fields
      if (!response.data.access_token || !response.data.refresh_token || !response.data.expires_at) {
        console.error('Token refresh response missing expected fields:', response.data);
        throw new Error('Invalid token refresh response');
      }
      
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(response.data.expires_at * 1000),
      };
    } catch (error: any) {
      console.error('------- STRAVA TOKEN REFRESH ERROR -------');
      
      // Handle error appropriately based on type
      if (error.response) {
        // Axios error with response data
        console.error('Token refresh failed, Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('Token refresh error:', error.message || error);
      }
      
      throw error;
    }
  }

  async getClubEvents(clubId: string, accessToken: string) {
    try {
      console.log(`Fetching events for Strava club ${clubId}`);
      
      // Add detailed logging of request
      console.log(`Making request to https://www.strava.com/api/v3/clubs/${clubId}/group_events`);
      
      // Using resilient API client with automatic retries
      const data = await resilientApi.get(
        `/clubs/${clubId}/group_events`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      // Create response-like object for compatibility
      const response = { data };
      
      // Avoid logging sensitive data
      console.log(`Successfully retrieved ${response.data.length || 0} events from Strava API`);
      
      // Filter out events older than 28 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 28);
      console.log(`Filtering events older than ${cutoffDate.toISOString()}`);
      
      const filteredEvents = response.data.filter((event: any) => {
        // Try all possible date formats from Strava
        let eventDate: Date | null = null;
        
        if (event.start_date_local) {
          eventDate = new Date(event.start_date_local);
        } else if (event.start_date) {
          eventDate = new Date(event.start_date);
        } else if (event.scheduled_time) {
          eventDate = new Date(event.scheduled_time * 1000);
        }
        
        // If no valid date, we can't determine if it's old - exclude it
        if (!eventDate || isNaN(eventDate.getTime())) {
          console.log(`Skipping event ${event.id} - no valid date`);
          return false;
        }
        
        // Keep the event if it's newer than the cutoff date
        const isRecent = eventDate >= cutoffDate;
        
        if (!isRecent) {
          console.log(`Filtering out old event: ${event.id} (${event.title}) at ${eventDate.toISOString()}`);
        }
        
        return isRecent;
      });
      
      console.log(`After filtering: ${filteredEvents.length} events (removed ${response.data.length - filteredEvents.length} old events)`);
      
      return filteredEvents;
    } catch (error: any) {
      if (error.response) {
        console.error('Error fetching club events, API response:', error.response.data);
      } else {
        console.error('Error fetching club events:', error.message);
      }
      throw error;
    }
  }

  async getClubDetails(clubId: string, accessToken: string) {
    try {
      console.log(`Fetching details for Strava club ${clubId}`);
      // Using resilient API client with automatic retries
      return await resilientApi.get(
        `/clubs/${clubId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (error: any) {
      if (error.response) {
        console.error('Error fetching club details, API response:', error.response.data);
      } else {
        console.error('Error fetching club details:', error.message);
      }
      throw error;
    }
  }

  async getUserClubs(accessToken: string) {
    try {
      console.log('Fetching user clubs from Strava');
      // Using resilient API client with automatic retries
      return await resilientApi.get(
        '/athlete/clubs',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    } catch (error: any) {
      if (error.response) {
        console.error('Error fetching user clubs, API response:', error.response.data);
      } else {
        console.error('Error fetching user clubs:', error.message);
      }
      throw error;
    }
  }
}

export const stravaService = new StravaService();