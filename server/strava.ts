import axios from 'axios';
import { storage } from './storage';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export class StravaService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.STRAVA_CLIENT_ID || '';
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Strava credentials not configured');
    }
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all,group:read',
      state: state,
    });

    return `${STRAVA_AUTH_URL}?${params.toString()}`;
  }

  async exchangeToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }> {
    const response = await axios.post(STRAVA_TOKEN_URL, {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      grant_type: 'authorization_code',
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
    };
  }

  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }> {
    const response = await axios.post(STRAVA_TOKEN_URL, {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_at: response.data.expires_at,
    };
  }

  async getClubEvents(clubId: string, accessToken: string) {
    try {
      const response = await axios.get(
        `${STRAVA_API_BASE}/clubs/${clubId}/group_events`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Unauthorized - Token might be expired');
      }
      throw error;
    }
  }

  async getClubDetails(clubId: string, accessToken: string) {
    try {
      const response = await axios.get(`${STRAVA_API_BASE}/clubs/${clubId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Unauthorized - Token might be expired');
      }
      throw error;
    }
  }
}

export const stravaService = new StravaService();