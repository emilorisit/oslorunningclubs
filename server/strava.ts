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
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read',
      state,
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeToken(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(response.data.expires_at * 1000),
    };
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
    } catch (error) {
      console.error('Error fetching club events:', error);
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
    } catch (error) {
      console.error('Error fetching club details:', error);
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
    } catch (error) {
      console.error('Error fetching user clubs:', error);
      throw error;
    }
  }
}

export const stravaService = new StravaService();