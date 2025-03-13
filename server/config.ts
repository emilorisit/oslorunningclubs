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
  
  // We must force the URL to match exactly what Strava expects regardless of environment
  // The domain in Strava app settings is "www.oslorunningclubs.no" so we must use that
  
  // Always use https://www.oslorunningclubs.no for the domain part regardless of 
  // the actual request host or environment to ensure it matches Strava's requirements
  return `https://www.oslorunningclubs.no/api/strava/callback`;
}

export default config;