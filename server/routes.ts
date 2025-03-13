import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stravaService } from "./strava";
import { z } from "zod";
import { clubSubmissionSchema, insertEventSchema, type InsertClub } from "@shared/schema";
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
  // Check if NODE_ENV is not production or if accessToken is empty (indicating demo mode)
  const isDemoMode = process.env.NODE_ENV !== 'production' || !accessToken;
  
  if (isDemoMode) {
    console.log(`Using demo mode for club ${clubId}`);
    
    // Generate random date within the next two weeks
    const getRandomFutureDate = () => {
      const now = new Date();
      const daysToAdd = Math.floor(Math.random() * 14) + 1; // Between 1-14 days
      return new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
    };
    
    // Return mock events for demo mode
    return [
      {
        id: `demo-${clubId}-1`,
        title: "Weekend Long Run",
        description: "Join us for a relaxed long run through Nordmarka. Pace: 5:30-6:00 min/km. All levels welcome!",
        club_id: parseInt(clubId),
        start_date: getRandomFutureDate(),
        location: "Sognsvann T-bane, Oslo",
        distance: 12000, // 12km
      },
      {
        id: `demo-${clubId}-2`,
        title: "Interval Training",
        description: "Track session at Bislett Stadium. 8x400m with 2min rest. Pace: 4:00-4:30 min/km.",
        club_id: parseInt(clubId),
        start_date: getRandomFutureDate(),
        location: "Bislett Stadium, Oslo",
        distance: 8000, // 8km
      }
    ];
  }
  
  try {
    // Call the Strava service to get events
    return await stravaService.getClubEvents(clubId, accessToken);
  } catch (error) {
    console.error(`Error fetching events for club ${clubId}:`, error);
    
    // If in development and we get an error, return demo events
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Falling back to demo events for club ${clubId} due to error`);
      return fetchStravaClubEvents('', clubId); // Call recursively with empty token to trigger demo mode
    }
    
    throw error;
  }
}

// Map a Strava event to our Event model
function mapStravaEventToEvent(stravaEvent: any, clubId: number) {
  // For start_date field, handle both Date objects and strings
  const startTime = stravaEvent.start_date instanceof Date ? 
    stravaEvent.start_date : 
    new Date(stravaEvent.start_date);
  
  // Calculate end time using the startTime we just calculated
  const endTime = calculateEndTime(stravaEvent, startTime);
  
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
    startTime: startTime,
    endTime: endTime,
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
      const filters = {
        clubIds: req.query.clubIds ? (req.query.clubIds as string).split(',').map(Number) : undefined,
        paceCategories: req.query.paceCategories ? (req.query.paceCategories as string).split(',') : undefined,
        distanceRanges: req.query.distanceRanges ? (req.query.distanceRanges as string).split(',') : undefined,
        beginnerFriendly: req.query.beginnerFriendly === 'true',
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };
      
      const events = await storage.getEvents(filters);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // ---- Strava API Integration ----

  // Start OAuth flow
  app.get("/api/strava/auth", async (req: Request, res: Response) => {
    try {
      // Get the club_id from the query parameters
      const clubId = req.query.club_id ? parseInt(req.query.club_id as string) : undefined;
      
      // Check if we're using demo mode
      const demoMode = req.query.demo === 'true';
      
      // Generate a random state to protect against CSRF attacks
      // If club_id is provided, encode it in the state as JSON
      let stateData: any = { timestamp: Date.now() };
      if (clubId) {
        stateData.clubId = clubId;
      }
      
      // Base64 encode the state data
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
      
      // For demo mode, we'll bypass actual Strava auth and redirect to our success page
      if (demoMode) {
        console.log('Using demo mode for Strava');
        return res.json({ 
          url: `/auth-success?demo=true`,
          state,
          demoMode: true
        });
      }
      
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

  // OAuth callback
  app.get("/api/strava/callback", async (req: Request, res: Response) => {
    try {
      // Handle error cases from Strava
      if (req.query.error) {
        console.error('Strava authorization error:', req.query.error);
        return res.redirect('/auth-error?reason=' + encodeURIComponent(req.query.error as string));
      }
      
      const { code, state } = req.query;
      
      if (!code || !state) {
        console.error('Missing required parameters in Strava callback');
        return res.redirect('/auth-error?reason=missing_parameters');
      }

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
      // Check if we're using demo mode
      let useDemoMode = req.query.demo === 'true';
      
      if (!useDemoMode && (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET)) {
        return res.status(500).json({ message: "Strava API credentials not configured" });
      }
      
      // Get all approved clubs
      const approvedClubs = await storage.getClubs(true);
      
      if (approvedClubs.length === 0) {
        return res.status(200).json({ message: "No approved clubs to sync" });
      }
      
      let accessToken = '';
      
      // Skip token retrieval in demo mode
      if (!useDemoMode) {
        try {
          // Get Strava access token
          const tokenResponse = await getStravaAccessToken();
          
          if (!tokenResponse) {
            return res.status(500).json({ message: "Failed to obtain Strava access token" });
          }
          
          accessToken = tokenResponse.accessToken;
        } catch (error) {
          console.error('Failed to get Strava access token:', error);
          
          // Check if this is a development environment
          const isDevelopment = process.env.NODE_ENV !== 'production';
          if (isDevelopment) {
            console.log('Switching to demo mode due to token error in development');
            useDemoMode = true;
          } else {
            return res.status(500).json({ message: "Failed to obtain Strava access token" });
          }
        }
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
      // In demo mode, return mock clubs
      const demoMode = req.query.demo === 'true';
      
      if (demoMode) {
        return res.json([
          { 
            id: 123456, 
            name: "Oslo Running Club", 
            profile_medium: "https://dgalywyr863hv.cloudfront.net/pictures/clubs/123456/123456/1/medium.jpg",
            url: "https://www.strava.com/clubs/oslo-running-club",
            member_count: 150
          },
          { 
            id: 234567, 
            name: "Oslo Trail Runners", 
            profile_medium: "https://dgalywyr863hv.cloudfront.net/pictures/clubs/234567/234567/1/medium.jpg",
            url: "https://www.strava.com/clubs/oslo-trail-runners", 
            member_count: 87
          },
          { 
            id: 345678, 
            name: "Central Oslo Runners", 
            profile_medium: "https://dgalywyr863hv.cloudfront.net/pictures/clubs/345678/345678/1/medium.jpg",
            url: "https://www.strava.com/clubs/central-oslo-runners",
            member_count: 42
          }
        ]);
      }
      
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
          
          // Save the club with auto-verification since it's coming directly from Strava
          const club = await storage.createClub(newClub, { autoVerify: true });
          
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


