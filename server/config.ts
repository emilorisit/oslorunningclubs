// Configuration for different environments
interface Config {
  baseUrl: string;
  apiBaseUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

const environment = process.env.NODE_ENV || 'development';

// Default configuration values
const config: Config = {
  baseUrl: '',
  apiBaseUrl: '',
  isDevelopment: environment === 'development',
  isProduction: environment === 'production'
};

// Set environment-specific values
if (environment === 'production') {
  config.baseUrl = 'https://www.oslorunningclubs.no';
  config.apiBaseUrl = 'https://www.oslorunningclubs.no/api';
} else {
  // In development, use the current host
  config.baseUrl = '';
  config.apiBaseUrl = '/api';
}

/**
 * Get the appropriate callback URL for Strava
 * @param req Express request object
 * @returns Full callback URL
 */
export function getStravaCallbackUrl(req: any): string {
  // NOTE: Strava has very strict requirements about redirect URLs
  // The redirect_uri parameter in API calls must EXACTLY match what you have
  // configured in your Strava application settings.
  
  // In production, use the exact domain that's registered with Strava
  if (config.isProduction) {
    // For Strava's web OAuth flow, this needs to be a standard HTTPS URL
    // Make sure this matches EXACTLY what's in your Strava application settings
    return `https://www.oslorunningclubs.no/api/strava/callback`;
  } else {
    // In development, use the local server URL
    return `${req.protocol}://${req.get('host')}/api/strava/callback`;
  }
}

export default config;