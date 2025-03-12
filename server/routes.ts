import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { clubSubmissionSchema, insertEventSchema } from "@shared/schema";
import axios from "axios";
import NodeCache from "node-cache";
import nodemailer from "nodemailer";

// Simple in-memory cache for Strava API responses
const stravaCache = new NodeCache({ stdTTL: 900 }); // 15 minutes TTL

// Nodemailer test account (for dev purposes)
// In production, use environment variables for real email configuration
let transporter: nodemailer.Transporter;

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
      const clubs = await storage.getClubs(true);
      res.json(clubs);
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
      
      const { access_token } = tokenResponse;
      
      // Fetch events for each club
      const results = [];
      
      for (const club of approvedClubs) {
        try {
          const events = await fetchStravaClubEvents(access_token, club.stravaClubId);
          
          for (const event of events) {
            // Check if event already exists
            const existingEvent = await storage.getEventByStravaId(event.id.toString());
            
            if (!existingEvent) {
              // Map Strava event to our event model
              const newEvent = mapStravaEventToEvent(event, club.id);
              
              // Validate and store the event
              const validatedEvent = insertEventSchema.parse(newEvent);
              await storage.createEvent(validatedEvent);
              
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

// ---- Helper Functions ----

// Extract Strava club ID from URL
function extractStravaClubId(url: string): string | null {
  try {
    const clubUrlPattern = /strava\.com\/clubs\/([a-zA-Z0-9_-]+)/;
    const match = url.match(clubUrlPattern);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

// Get Strava access token
async function getStravaAccessToken() {
  const cacheKey = "strava_access_token";
  
  // Check cache first
  const cachedToken = stravaCache.get(cacheKey);
  if (cachedToken) {
    return cachedToken as { access_token: string, expires_at: number };
  }
  
  try {
    const response = await axios.post('https://www.strava.com/oauth/token', {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'client_credentials'
    });
    
    const tokenData = {
      access_token: response.data.access_token,
      expires_at: response.data.expires_at
    };
    
    // Cache the token
    stravaCache.set(cacheKey, tokenData, (tokenData.expires_at - Math.floor(Date.now() / 1000)));
    
    return tokenData;
  } catch (error) {
    console.error('Failed to get Strava access token:', error);
    return null;
  }
}

// Fetch Strava club events
async function fetchStravaClubEvents(accessToken: string, clubId: string) {
  const cacheKey = `strava_club_events_${clubId}`;
  
  // Check cache first
  const cachedEvents = stravaCache.get(cacheKey);
  if (cachedEvents) {
    return cachedEvents as any[];
  }
  
  try {
    const response = await axios.get(`https://www.strava.com/api/v3/clubs/${clubId}/group_events`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    // Cache the events
    stravaCache.set(cacheKey, response.data, 900); // Cache for 15 minutes
    
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch events for club ${clubId}:`, error);
    return [];
  }
}

// Map Strava event to our event model
function mapStravaEventToEvent(stravaEvent: any, clubId: number) {
  // Default pace category based on description or route
  let paceCategory = 'intermediate';
  let beginnerFriendly = false;
  
  const description = stravaEvent.description?.toLowerCase() || '';
  
  if (description.includes('beginner') || description.includes('easy') || description.includes('slow')) {
    paceCategory = 'beginner';
    beginnerFriendly = true;
  } else if (description.includes('advanced') || description.includes('fast') || description.includes('race pace')) {
    paceCategory = 'advanced';
  }
  
  // Extract distance from route if available
  let distance = null;
  if (stravaEvent.route && stravaEvent.route.distance) {
    distance = stravaEvent.route.distance;
  }
  
  return {
    stravaEventId: stravaEvent.id.toString(),
    clubId,
    title: stravaEvent.title,
    description: stravaEvent.description,
    startTime: new Date(stravaEvent.upcoming_occurrences[0]),
    endTime: calculateEndTime(stravaEvent),
    location: stravaEvent.address || stravaEvent.location || 'Oslo, Norway',
    distance,
    pace: extractPaceFromDescription(description),
    paceCategory,
    beginnerFriendly,
    stravaEventUrl: `https://www.strava.com/clubs/${clubId}/group_event/${stravaEvent.id}`
  };
}

// Calculate end time (start time + duration if available, otherwise +1 hour)
function calculateEndTime(stravaEvent: any) {
  const startTime = new Date(stravaEvent.upcoming_occurrences[0]);
  
  if (stravaEvent.duration) {
    const endTime = new Date(startTime);
    endTime.setSeconds(endTime.getSeconds() + stravaEvent.duration);
    return endTime;
  }
  
  // Default to 1 hour if no duration
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + 1);
  return endTime;
}

// Attempt to extract pace information from event description
function extractPaceFromDescription(description: string) {
  // Look for common pace patterns like "5:30/km" or "5:30 min/km"
  const paceRegex = /(\d+[:\.]\d+)[\s]*(min\/km|\/km)/i;
  const match = description.match(paceRegex);
  
  if (match) {
    return match[1];
  }
  
  return null;
}
