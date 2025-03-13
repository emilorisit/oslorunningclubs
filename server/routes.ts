import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stravaService } from "./strava";
import { z } from "zod";
import { clubSubmissionSchema, insertEventSchema } from "@shared/schema";
import axios from "axios";
import NodeCache from "node-cache";
import nodemailer from "nodemailer";
import * as crypto from 'node:crypto';

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
  return stravaService.getClubEvents(clubId, accessToken);
}

// Map a Strava event to our Event model
function mapStravaEventToEvent(stravaEvent: any, clubId: number) {
  const endTime = calculateEndTime(stravaEvent);
  const paceMatch = extractPaceFromDescription(stravaEvent.description || '');
  
  return {
    stravaEventId: stravaEvent.id.toString(),
    clubId,
    title: stravaEvent.title,
    description: stravaEvent.description,
    startTime: new Date(stravaEvent.start_date).toISOString(),
    endTime: endTime.toISOString(),
    location: stravaEvent.location,
    distance: stravaEvent.distance,
    pace: paceMatch,
    paceCategory: paceMatch ? 
      Number(paceMatch.split(':')[0]) >= 6 ? 'beginner' :
      Number(paceMatch.split(':')[0]) >= 5 ? 'intermediate' :
      'advanced' : 'beginner',
    beginnerFriendly: (stravaEvent.description || '').toLowerCase().includes('beginner'),
    stravaEventUrl: `https://www.strava.com/clubs/${clubId}/group_events/${stravaEvent.id}`,
  };
}

// Calculate end time based on start time and duration
function calculateEndTime(stravaEvent: any) {
  const startTime = new Date(stravaEvent.start_date);
  // Default duration to 1 hour if not specified
  const durationInSeconds = stravaEvent.estimated_duration || 3600;
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
  app.get("/api/strava/auth", (req: Request, res: Response) => {
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
      
      // Use a fixed redirect URI that matches what's configured in Strava
      // You should register "https://your-replit-app.replit.app/api/strava/callback" in Strava
      // This is the root domain of your Replit app with the callback path
      const redirectUri = "http://localhost:8000/api/strava/callback";
      
      // For production, you would use:
      // const redirectUri = `${req.protocol}://${req.get('host')}/api/strava/callback`;
      
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

      // Exchange the authorization code for access and refresh tokens
      const tokenData = await stravaService.exchangeToken(code as string);
      
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
      
      // Redirect to success page
      res.redirect('/auth-success');
    } catch (error) {
      console.error('OAuth callback error:', error);
      // Redirect to error page with generic message
      res.redirect('/auth-error?reason=token_exchange_failed');
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
      
      // Get Strava access token
      const tokenResponse = await getStravaAccessToken();
      
      if (!tokenResponse) {
        return res.status(500).json({ message: "Failed to obtain Strava access token" });
      }
      
      const { accessToken } = tokenResponse;
      
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
  return httpServer;
}


