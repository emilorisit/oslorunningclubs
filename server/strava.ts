import axios from 'axios';

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
    // Make sure it's properly URL-encoded
    const encodedUri = encodeURIComponent(redirectUri);
    console.log('URL-encoded redirect URI:', encodedUri);
    
    // Use the original URI in the params object since URLSearchParams
    // will handle the encoding properly
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri, // Strava expects 'redirect_uri' not 'redirect_url'
      response_type: 'code',
      scope: 'read,activity:read',
      state,
    });
    
    // For debugging, check the actual parameter values
    console.log('Client ID:', this.clientId);
    console.log('Response type:', 'code');
    console.log('Scope:', 'read,activity:read');
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
      
      // Make the token exchange request
      console.log('Making POST request to https://www.strava.com/oauth/token');
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
      });
      
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
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(response.data.expires_at * 1000),
    };
  }

  async getClubEvents(clubId: string, accessToken: string) {
    try {
      const response = await axios.get(
        `https://www.strava.com/api/v3/clubs/${clubId}/group_events`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      return response.data;
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
      const response = await axios.get(
        `https://www.strava.com/api/v3/clubs/${clubId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      return response.data;
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
      const response = await axios.get(
        'https://www.strava.com/api/v3/athlete/clubs',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      return response.data;
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