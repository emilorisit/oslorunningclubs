import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stravaService } from "./strava";
import { z } from "zod";
import { clubSubmissionSchema, insertEventSchema, type InsertClub, type Club } from "@shared/schema";
import axios from "axios";
import NodeCache from "node-cache";
import nodemailer from "nodemailer";
import * as crypto from 'node:crypto';
import config, { getStravaCallbackUrl } from "./config";

// Simple in-memory cache for Strava API responses
const stravaCache = new NodeCache({ stdTTL: 900 }); // 15 minutes TTL

// Nodemailer test account (for dev purposes)
// In production, use environment variables for real email configuration
let transporter: nodemailer.Transporter;

// Extract the Strava club ID from a URL
function extractStravaClubId(url: string): string | null {
  const match = url.match(/strava\.com\/clubs\/([^/]+)/);
  return match ? match[1] : null;
}

// Get a fresh access token using the global refresh token or from a specific club
async function getStravaAccessToken(clubId?: number) {
  try {
    // If a clubId is provided, try to use that club's tokens
    if (clubId !== undefined) {
      const club = await storage.getClub(clubId);
      if (club?.stravaRefreshToken) {
        const tokens = await stravaService.refreshToken(club.stravaRefreshToken);
        
        // Update the club's tokens for future use
        await storage.updateClubStravaTokens(clubId, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt
        });
        
        return tokens;
      }
    }
    
    // Try to find any approved club with valid tokens
    const approvedClubs = await storage.getClubs(true);
    for (const club of approvedClubs) {
      if (club.stravaRefreshToken) {
        try {
          const tokens = await stravaService.refreshToken(club.stravaRefreshToken);
          
          // Update the club's tokens for future use
          await storage.updateClubStravaTokens(club.id, {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt
          });
          
          return tokens;
        } catch (tokenError) {
          console.error(`Failed to refresh token for club ${club.id}:`, tokenError);
          // Continue to the next club
        }
      }
    }
    
    // Fall back to global token if available
    if (process.env.STRAVA_REFRESH_TOKEN) {
      const tokens = await stravaService.refreshToken(process.env.STRAVA_REFRESH_TOKEN);
      
      // Update environment variables with new tokens
      process.env.STRAVA_ACCESS_TOKEN = tokens.accessToken;
      process.env.STRAVA_REFRESH_TOKEN = tokens.refreshToken;
      
      return tokens;
    }
    
    throw new Error('No Strava refresh token available');
  } catch (error) {
    console.error('Failed to get Strava access token:', error);
    throw error;
  }
}

// Fetch events for a Strava club
async function fetchStravaClubEvents(accessToken: string, clubId: string) {
  try {
    // Call the Strava service to get events
    return await stravaService.getClubEvents(clubId, accessToken);
  } catch (error) {
    console.error(`Error fetching events for club ${clubId}:`, error);
    throw error;
  }
}

// Map a Strava event to our Event model
function mapStravaEventToEvent(stravaEvent: any, clubId: number) {
  // Handle start date - ensure it's a valid Date object
  let startTime: Date;
  try {
    startTime = stravaEvent.start_date instanceof Date ? 
      stravaEvent.start_date : 
      new Date(stravaEvent.start_date);
      
    // Validate that we have a valid date
    if (isNaN(startTime.getTime())) {
      throw new Error("Invalid start date format");
    }
  } catch (error) {
    console.error("Error parsing start date:", error);
    // Fallback to current date if parsing fails
    startTime = new Date();
  }
  
  // Calculate end time - wrap in try/catch to handle any errors
  let endTime: Date | undefined;
  try {
    endTime = calculateEndTime(stravaEvent, startTime);
    // Validate that we have a valid date
    if (endTime && isNaN(endTime.getTime())) {
      console.warn("Generated an invalid end date, setting to undefined");
      endTime = undefined;
    }
  } catch (error) {
    console.error("Error calculating end time:", error);
    // Leave undefined if calculation fails
    endTime = undefined;
  }
  
  // Extract pace from description
  const paceMatch = extractPaceFromDescription(stravaEvent.description || '');
  
  // Determine pace category based on the extracted pace
  const paceCategory = paceMatch ? 
    Number(paceMatch.split(':')[0]) >= 6 ? 'beginner' :
    Number(paceMatch.split(':')[0]) >= 5 ? 'intermediate' :
    'advanced' : 'beginner';
  
  return {
    stravaEventId: stravaEvent.id.toString(),
    clubId,
    title: stravaEvent.title,
    description: stravaEvent.description,
    startTime, // Valid Date object
    endTime,   // Valid Date object or undefined
    location: stravaEvent.location,
    distance: stravaEvent.distance,
    pace: paceMatch,
    paceCategory: paceCategory,
    beginnerFriendly: (stravaEvent.description || '').toLowerCase().includes('beginner'),
    stravaEventUrl: `https://www.strava.com/clubs/${clubId}/group_events/${stravaEvent.id}`,
  };
}

// Calculate end time based on start time and duration
function calculateEndTime(stravaEvent: any, startTimeInput?: Date) {
  // Use provided startTime or create a new one from stravaEvent.start_date
  const startTime = startTimeInput || new Date(stravaEvent.start_date);
  
  // Default duration to 1 hour if not specified
  const durationInSeconds = stravaEvent.estimated_duration || 3600;
  
  // Return a new Date object for the end time
  return new Date(startTime.getTime() + durationInSeconds * 1000);
}

// Extract pace from event description (e.g., "5:30/km" or "5:30 min/km")
function extractPaceFromDescription(description: string) {
  const match = description.match(/(\d{1,2}:\d{2})(?:\/km| min\/km)/);
  return match ? match[1] : null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize nodemailer
  try {
    // For development, create a test account
    if (process.env.NODE_ENV !== "production") {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } else {
      // For production, use environment variables
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  } catch (error) {
    console.error("Failed to initialize nodemailer:", error);
  }

  // ---- Club Routes ----
  
  // Get all approved clubs
  app.get("/api/clubs", async (req: Request, res: Response) => {
    try {
      const sortBy = req.query.sortBy as string;
      
      if (sortBy === 'score') {
        const clubs = await storage.getClubsSortedByScore();
        res.json(clubs);
      } else {
        const clubs = await storage.getClubs(true);
        res.json(clubs);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clubs" });
    }
  });

  // Submit a new club
  app.post("/api/clubs", async (req: Request, res: Response) => {
    try {
      const validatedData = clubSubmissionSchema.parse(req.body);
      
      // Check if the Strava club URL is valid
      const stravaClubId = extractStravaClubId(validatedData.stravaClubUrl);
      if (!stravaClubId) {
        return res.status(400).json({ message: "Invalid Strava club URL" });
      }
      
      // Check if club already exists
      const existingClub = await storage.getClubByStravaId(stravaClubId);
      if (existingClub) {
        return res.status(409).json({ message: "Club already exists in our system" });
      }
      
      // Create new club with Strava ID
      const club = await storage.createClub({
        ...validatedData,
        stravaClubId
      });
      
      // Send verification email
      if (transporter) {
        const verificationUrl = `${req.protocol}://${req.get('host')}/api/clubs/verify/${club.verificationToken}`;
        
        await transporter.sendMail({
          from: '"Oslo Running Calendar" <noreply@oslorunningcalendar.com>',
          to: club.adminEmail,
          subject: "Verify your club submission",
          html: `
            <h1>Verify your club submission</h1>
            <p>Thank you for submitting your club to the Oslo Running Calendar!</p>
            <p>Please click the following link to verify your submission:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>If you did not submit this club, please ignore this email.</p>
          `,
        });
      }
      
      res.status(201).json({ 
        message: "Club submitted successfully. Please check your email to verify your submission." 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Validation error", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to submit club" });
      }
    }
  });

  // Verify a club submission
  app.get("/api/clubs/verify/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const club = await storage.verifyClub(token);
      
      if (!club) {
        return res.status(404).json({ message: "Invalid verification token" });
      }
      
      // Redirect to a thank you page
      res.redirect("/club-verification-success");
    } catch (error) {
      res.status(500).json({ message: "Failed to verify club" });
    }
  });

  // ---- Event Routes ----
  
  // Get all events with optional filtering
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      console.log('Executing getEvents query (attempt 1/6)...');
      
      // Check if user is authenticated by looking for access token
      // or if they want to apply their own filter
      const userAuthenticated = stravaCache.get('recent_access_token') as string;
      const userWantsSpecificClubs = req.query.clubIds && (req.query.clubIds as string).length > 0;
      
      let userClubIds: number[] = [];
      
      // If user is authenticated and not already filtering by specific clubs,
      // get their Strava clubs to filter events
      if (userAuthenticated && !userWantsSpecificClubs) {
        try {
          const userClubs = await stravaService.getUserClubs(userAuthenticated);
          console.log(`Found ${userClubs.length} clubs for authenticated user`);
          
          // Get DB club IDs from Strava club IDs
          for (const stravaClub of userClubs) {
            const club = await storage.getClubByStravaId(stravaClub.id.toString());
            if (club) {
              userClubIds.push(club.id);
            }
          }
          
          console.log(`User has access to these club IDs: ${userClubIds.join(', ')}`);
        } catch (err) {
          console.error('Failed to get user clubs for filtering:', err);
          // If we can't get user clubs, we'll fall back to default behavior
        }
      }
      
      // Apply filters based on request parameters
      const filters = {
        // If user is authenticated and not specifying clubs, use their clubs
        // Otherwise use the clubs specified in the request, if any
        clubIds: userAuthenticated && !userWantsSpecificClubs && userClubIds.length > 0 
          ? userClubIds 
          : req.query.clubIds 
            ? (req.query.clubIds as string).split(',').map(Number) 
            : undefined,
        paceCategories: req.query.paceCategories ? (req.query.paceCategories as string).split(',') : undefined,
        distanceRanges: req.query.distanceRanges ? (req.query.distanceRanges as string).split(',') : undefined,
        beginnerFriendly: req.query.beginnerFriendly === 'true',
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };
      
      // If user is not authenticated and not explicitly filtering by clubs,
      // we'll show no events because they should only see events they have access to
      if (!userAuthenticated && !userWantsSpecificClubs) {
        console.log('User not authenticated and no specific club filter - returning no events');
        return res.json([]);
      }
      
      const events = await storage.getEvents(filters);
      console.log(`Successfully retrieved ${events.length} events`);
      
      // Transform snake_case column names to camelCase
      const transformedEvents = events.map(event => {
        // Create a new object with transformed keys
        return {
          id: event.id,
          stravaEventId: event.stravaEventId || (event as any).strava_event_id,
          clubId: event.clubId || (event as any).club_id,
          title: event.title,
          description: event.description,
          startTime: event.startTime || (event as any).start_time,
          endTime: event.endTime || (event as any).end_time,
          location: event.location,
          distance: event.distance,
          pace: event.pace,
          paceCategory: event.paceCategory || (event as any).pace_category,
          beginnerFriendly: event.beginnerFriendly || (event as any).beginner_friendly,
          stravaEventUrl: event.stravaEventUrl || (event as any).strava_event_url
        };
      });
      
      res.json(transformedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // ---- Strava API Integration ----

  // Start OAuth flow
  app.get("/api/strava/auth", async (req: Request, res: Response) => {
    try {
      // Get the club_id from the query parameters
      const clubId = req.query.club_id ? parseInt(req.query.club_id as string) : undefined;
      
      // Generate a random state to protect against CSRF attacks
      // If club_id is provided, encode it in the state as JSON
      let stateData: any = { timestamp: Date.now() };
      if (clubId) {
        stateData.clubId = clubId;
      }
      
      // Base64 encode the state data
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
      
      // Use a dynamic redirect URI based on the current host or production domain
      // This allows it to work both locally and in production
      const redirectUri = getStravaCallbackUrl(req);
      
      // Extended debugging information for redirect URL issues
      console.log('------- Strava Auth Debug Info -------');
      console.log('Strava client ID:', process.env.STRAVA_CLIENT_ID);
      console.log('Using redirect URI:', redirectUri);
      console.log('Request origin:', req.headers.origin || 'Not available');
      console.log('Request host:', req.headers.host);
      console.log('Is production?', config.isProduction);
      console.log('--------------------------------------');
      
      // Get the authorization URL from Strava service
      const authUrl = stravaService.getAuthorizationUrl(redirectUri, state);
      
      // Return the URL to the client
      res.json({ 
        url: authUrl,
        state,
        redirectUri,
        clientId: process.env.STRAVA_CLIENT_ID
      });
    } catch (error) {
      console.error('Error generating Strava auth URL:', error);
      res.status(500).json({ message: "Failed to initialize Strava authentication" });
    }
  });

  // Strava Configuration Diagnostic Tool
  app.get("/api/strava/diagnostic", async (req: Request, res: Response) => {
    try {
      const redirectUri = getStravaCallbackUrl(req);
      const encodedUri = encodeURIComponent(redirectUri);
      
      // Collection of diagnostics to help with debugging
      const diagnostics = {
        stravaClientId: process.env.STRAVA_CLIENT_ID || 'Not configured',
        stravaClientSecret: process.env.STRAVA_CLIENT_SECRET ? 'Configured (hidden)' : 'Not configured',
        redirectUri: redirectUri,
        encodedRedirectUri: encodedUri,
        environment: process.env.NODE_ENV || 'Not set',
        isProduction: config.isProduction,
        baseUrl: config.baseUrl,
        apiBaseUrl: config.apiBaseUrl,
        serverHostname: req.hostname,
        serverProtocol: req.protocol,
        fullServerUrl: `${req.protocol}://${req.get('host')}`,
        headers: {
          host: req.headers.host,
          origin: req.headers.origin,
          referer: req.headers.referer
        }
      };
      
      res.json({
        message: "Strava configuration diagnostic information",
        diagnostics,
        time: new Date().toISOString(),
        recommendedStravaSettings: {
          callbackDomain: "www.oslorunningclubs.no",
          requiredScopes: ["read", "activity:read"]
        },
        commonIssues: [
          "Strava requires exact match between the redirect_uri in API calls and app settings",
          "The callback domain in Strava app settings should not include http:// or https:// prefixes",
          "The callback domain should not include any trailing paths or parameters"
        ]
      });
    } catch (error) {
      console.error('Diagnostic tool error:', error);
      res.status(500).json({ message: "Error generating diagnostic information" });
    }
  });

  // OAuth callback
  app.get("/api/strava/callback", async (req: Request, res: Response) => {
    try {
      console.log('------- STRAVA CALLBACK RECEIVED -------');
      console.log('Host:', req.headers.host);
      console.log('URL:', req.url);
      console.log('Query parameters:', req.query);
      
      // Handle error cases from Strava
      if (req.query.error) {
        console.error('Strava authorization error:', req.query.error);
        console.log('Error details (if available):', req.query.error_description || 'No details provided');
        return res.redirect('/auth-error?reason=' + encodeURIComponent(req.query.error as string));
      }
      
      const { code, state } = req.query;
      
      if (!code || !state) {
        console.error('Missing required parameters in Strava callback');
        console.log('Received parameters:', req.query);
        return res.redirect('/auth-error?reason=missing_parameters');
      }
      
      console.log('Valid code and state received in callback');
      console.log('----------------------------------------');

      // Log the incoming code for debugging (mask it partially for security)
      console.log(`Received auth code: ${(code as string).substring(0, 5)}...`);
      
      // Exchange the authorization code for access and refresh tokens
      const tokenData = await stravaService.exchangeToken(code as string);
      console.log('Token exchange successful, received tokens');
      
      // Try to get some basic user info from Strava to verify the token works
      // This would be implemented in a full version
      
      // Extract club_id from state if it's present
      let clubId: number | undefined;
      try {
        // Decode the state parameter
        const stateString = Buffer.from(state as string, 'base64').toString();
        const stateData = JSON.parse(stateString);
        
        if (stateData && stateData.clubId) {
          clubId = stateData.clubId;
        }
      } catch (err) {
        console.error('Failed to parse state parameter:', err);
      }
      
      // If a club ID was extracted, associate tokens with that club
      if (clubId !== undefined) {
        // Verify the club exists
        const club = await storage.getClub(clubId);
        if (club) {
          // Update the club with the new tokens
          await storage.updateClubStravaTokens(clubId, {
            accessToken: tokenData.accessToken,
            refreshToken: tokenData.refreshToken,
            expiresAt: tokenData.expiresAt
          });
          
          console.log(`Updated Strava tokens for club ${clubId}`);
        } else {
          console.error(`Club with ID ${clubId} not found`);
        }
      }
      
      // Store the token for global use (for admin sync operations)
      // In a production environment, you would store these in a secure database
      process.env.STRAVA_ACCESS_TOKEN = tokenData.accessToken;
      process.env.STRAVA_REFRESH_TOKEN = tokenData.refreshToken;
      
      // Store the access token in the cache for temporary use
      stravaCache.set('recent_access_token', tokenData.accessToken, 3600); // Cache for 1 hour
      
      // Redirect to success page
      res.redirect('/auth-success');
    } catch (error: any) {
      console.error('OAuth callback error:');
      if (error.response) {
        console.error('API response error:', error.response.data);
        // Provide more specific error reason if available
        const reason = error.response.data?.message || 'token_exchange_failed';
        res.redirect(`/auth-error?reason=${encodeURIComponent(reason)}`);
      } else {
        console.error('General error:', error.message || error);
        // Redirect to error page with generic message
        res.redirect('/auth-error?reason=token_exchange_failed');
      }
    }
  });

  // Fetch latest club events from Strava
  app.get("/api/strava/sync", async (req: Request, res: Response) => {
    try {
      if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
        return res.status(500).json({ message: "Strava API credentials not configured" });
      }
      
      // Get all approved clubs
      const approvedClubs = await storage.getClubs(true);
      
      if (approvedClubs.length === 0) {
        return res.status(200).json({ message: "No approved clubs to sync" });
      }
      
      let accessToken = '';
      
      try {
        // Get Strava access token
        const tokenResponse = await getStravaAccessToken();
        
        if (!tokenResponse) {
          return res.status(500).json({ message: "Failed to obtain Strava access token" });
        }
        
        accessToken = tokenResponse.accessToken;
      } catch (error) {
        console.error('Failed to get Strava access token:', error);
        return res.status(500).json({ message: "Failed to obtain Strava access token" });
      }
      
      // Fetch events for each club
      const results = [];
      
      for (const club of approvedClubs) {
        try {
          const events = await fetchStravaClubEvents(accessToken, club.stravaClubId);
          
          for (const event of events) {
            // Check if event already exists
            const existingEvent = await storage.getEventByStravaId(event.id.toString());
            
            if (!existingEvent) {
              // Map Strava event to our event model
              const newEvent = mapStravaEventToEvent(event, club.id);
              
              // Validate and store the event
              const validatedEvent = insertEventSchema.parse(newEvent);
              const createdEvent = await storage.createEvent(validatedEvent);
              
              // Update club statistics
              const clubEvents = await storage.getEvents({ clubIds: [club.id] });
              
              // Calculate stats
              const lastEvent = clubEvents.sort((a, b) => 
                new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
              )[0];
              
              // Update club statistics
              // This is a simple simulation - in a real app, you would get this from Strava API
              // We're using a random number between 5-30 as average participants count
              const avgParticipants = Math.floor(Math.random() * 25) + 5;
              
              await storage.updateClubStatistics(club.id, {
                eventsCount: clubEvents.length,
                lastEventDate: new Date(lastEvent.startTime),
                avgParticipants,
                participantsCount: avgParticipants * clubEvents.length
              });
              
              results.push({
                clubId: club.id,
                clubName: club.name,
                eventId: event.id,
                action: "added"
              });
            }
          }
        } catch (error) {
          console.error(`Failed to sync events for club ${club.name}:`, error);
          results.push({
            clubId: club.id,
            clubName: club.name,
            error: "Failed to sync events"
          });
        }
      }
      
      res.json({
        message: "Sync completed",
        results
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync Strava events" });
    }
  });

  const httpServer = createServer(app);

  // Get user's Strava clubs
  app.get("/api/strava/user-clubs", async (req: Request, res: Response) => {
    try {
      
      // Get access token - either from cache (recent login) or from environment
      let accessToken = stravaCache.get('recent_access_token') as string;
      
      if (!accessToken && process.env.STRAVA_ACCESS_TOKEN) {
        // Try to refresh the token
        try {
          if (process.env.STRAVA_REFRESH_TOKEN) {
            const tokens = await stravaService.refreshToken(process.env.STRAVA_REFRESH_TOKEN);
            accessToken = tokens.accessToken;
            
            // Update environment variables
            process.env.STRAVA_ACCESS_TOKEN = tokens.accessToken;
            process.env.STRAVA_REFRESH_TOKEN = tokens.refreshToken;
          }
        } catch (err) {
          console.error('Failed to refresh token:', err);
          return res.status(401).json({ message: "Authentication required. Please connect with Strava again." });
        }
      }
      
      if (!accessToken) {
        return res.status(401).json({ message: "Authentication required. Please connect with Strava again." });
      }
      
      // Fetch the user's clubs from Strava
      const clubs = await stravaService.getUserClubs(accessToken);
      
      res.json(clubs);
    } catch (error) {
      console.error('Error fetching user clubs:', error);
      res.status(500).json({ message: "Failed to fetch clubs from Strava" });
    }
  });
  
  // Add multiple clubs from Strava
  app.post("/api/strava/add-clubs", async (req: Request, res: Response) => {
    try {
      const { clubs } = req.body;
      
      if (!Array.isArray(clubs) || clubs.length === 0) {
        return res.status(400).json({ message: "No clubs provided" });
      }
      
      // Get access token
      let accessToken = stravaCache.get('recent_access_token') as string;
      
      if (!accessToken && process.env.STRAVA_ACCESS_TOKEN) {
        accessToken = process.env.STRAVA_ACCESS_TOKEN;
      }
      
      if (!accessToken) {
        return res.status(401).json({ message: "Authentication required. Please connect with Strava again." });
      }
      
      const results = [];
      
      // Process each club
      for (const clubData of clubs) {
        try {
          // Check if club already exists
          let existingClub = await storage.getClubByStravaId(clubData.id.toString());
          
          if (existingClub) {
            results.push({ 
              id: existingClub.id, 
              name: existingClub.name, 
              status: 'existing',
              message: 'Club already exists in the system'
            });
            continue;
          }
          
          // Prepare club data
          const newClub: InsertClub = {
            name: clubData.name,
            stravaClubId: clubData.id.toString(),
            stravaClubUrl: clubData.url || `https://www.strava.com/clubs/${clubData.id}`,
            adminEmail: "auto-added@example.com", // This would be the user's email in a full implementation
            paceCategories: ['beginner', 'intermediate', 'advanced'], // Default all categories
            distanceRanges: ['short', 'medium', 'long'], // Default all ranges
            meetingFrequency: 'weekly' // Default frequency
          };
          
          // Save the club
          const club = await storage.createClub(newClub);
          
          // Set verified status (automatically done for Strava-connected clubs)
          await storage.updateClub(club.id, { 
            verified: true as boolean // Type assertion to match Club type
          });
          
          // Add Strava tokens to the club
          await storage.updateClubStravaTokens(club.id, {
            accessToken: accessToken,
            refreshToken: process.env.STRAVA_REFRESH_TOKEN || '',
            expiresAt: new Date(Date.now() + 3600 * 1000) // Arbitrary expiration
          });
          
          results.push({ 
            id: club.id, 
            name: club.name, 
            status: 'added',
            message: 'Club added successfully'
          });
        } catch (err) {
          console.error(`Error adding club ${clubData.id}:`, err);
          results.push({ 
            id: clubData.id, 
            name: clubData.name, 
            status: 'error',
            message: 'Failed to add club'
          });
        }
      }
      
      res.status(201).json({ 
        message: "Clubs processed", 
        results 
      });
    } catch (error) {
      console.error('Error adding clubs:', error);
      res.status(500).json({ message: "Failed to add clubs" });
    }
  });

  return httpServer;
}


