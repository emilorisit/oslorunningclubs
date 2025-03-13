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
  if (config.isProduction) {
    return `${config.baseUrl}/api/strava/callback`;
  } else {
    return `${req.protocol}://${req.get('host')}/api/strava/callback`;
  }
}

export default config;