import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stravaService } from "./strava";
import { syncService, syncCache } from "./sync-service"; 
import { z } from "zod";
import { clubSubmissionSchema, insertEventSchema, type InsertClub, type Club, events, hiddenEvents } from "@shared/schema";
import axios from "axios";
import NodeCache from "node-cache";
import nodemailer from "nodemailer";
import * as crypto from 'node:crypto';
import config, { getStravaCallbackUrl } from "./config";
import { db } from "./db";

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
    
    // Try to find any club with valid tokens
    const allClubs = await storage.getClubs();
    for (const club of allClubs) {
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
export function mapStravaEventToEvent(stravaEvent: any, clubId: number, stravaClubId?: string) {
  // Log the raw event data for debugging
  console.log(`Processing Strava event ${stravaEvent.id} for club ${clubId}:`, 
    JSON.stringify({
      id: stravaEvent.id,
      title: stravaEvent.title,
      start_date: stravaEvent.start_date,
      start_date_local: stravaEvent.start_date_local,
      scheduled_time: stravaEvent.scheduled_time
    })
  );
  
  // Handle start date - ensure it's a valid Date object
  let startTime: Date;
  try {
    // Strava API provides dates in multiple formats
    // First try start_date_local which is in ISO 8601 format with local timezone
    if (stravaEvent.start_date_local) {
      console.log(`Using start_date_local: ${stravaEvent.start_date_local}`);
      startTime = new Date(stravaEvent.start_date_local);
      
      if (!isNaN(startTime.getTime())) {
        console.log(`Successfully parsed start_date_local to: ${startTime.toISOString()}`);
      } else {
        console.warn(`Invalid start_date_local: ${stravaEvent.start_date_local}`);
        throw new Error("Invalid start_date_local");
      }
    }
    // Then try start_date which is in ISO 8601 format with UTC timezone
    else if (stravaEvent.start_date) {
      console.log(`Using start_date: ${stravaEvent.start_date}`);
      startTime = new Date(stravaEvent.start_date);
      
      if (!isNaN(startTime.getTime())) {
        console.log(`Successfully parsed start_date to: ${startTime.toISOString()}`);
      } else {
        console.warn(`Invalid start_date: ${stravaEvent.start_date}`);
        throw new Error("Invalid start_date");
      }
    }
    // Then try scheduled_time which is a UNIX timestamp
    else if (stravaEvent.scheduled_time) {
      console.log(`Using scheduled_time: ${stravaEvent.scheduled_time}`);
      // Convert UNIX timestamp to Date
      startTime = new Date(stravaEvent.scheduled_time * 1000);
      
      if (!isNaN(startTime.getTime())) {
        console.log(`Successfully parsed scheduled_time to: ${startTime.toISOString()}`);
      } else {
        console.warn(`Invalid scheduled_time: ${stravaEvent.scheduled_time}`);
        throw new Error("Invalid scheduled_time");
      }
    }
    // If all else fails, use the current time
    else {
      console.warn("No valid date fields found in Strava event");
      throw new Error("No valid date fields");
    }
    
    // Detect possibly problematic 07:54:01 timestamps 
    // but keep them as-is per user request
    if (
      startTime.getHours() === 7 && 
      startTime.getMinutes() === 54 && 
      (startTime.getSeconds() === 1 || startTime.getSeconds() > 0)
    ) {
      console.warn(`Detected 07:54:01.xxx timestamp pattern for event ${stravaEvent.id} - keeping original time`);
      // We're not modifying the timestamp as per user's request to save original time values
    }
    
  } catch (error) {
    console.error(`Error parsing start date for event ${stravaEvent.id}:`, error);
    
    // Last resort: try to extract date from title or description
    const dateFromText = extractDateFromText(stravaEvent.title, stravaEvent.description);
    if (dateFromText) {
      console.log(`Extracted date from text: ${dateFromText.toISOString()}`);
      startTime = dateFromText;
    } else {
      // If we can't extract a valid date from Strava data, reject the event
      console.error(`No valid date information available for event ${stravaEvent.id}`);
      throw new Error("Insufficient date information from Strava");
    }
  }
  
  // Calculate end time - wrap in try/catch to handle any errors
  let endTime: Date | undefined;
  try {
    // Use explicit end_date if available
    if (stravaEvent.end_date_local) {
      endTime = new Date(stravaEvent.end_date_local);
      console.log(`Using end_date_local: ${endTime.toISOString()}`);
    } 
    // Or end_date
    else if (stravaEvent.end_date) {
      endTime = new Date(stravaEvent.end_date);
      console.log(`Using end_date: ${endTime.toISOString()}`);
    }
    // Otherwise calculate from duration
    else {
      // Use our helper function to calculate end time based on start time and duration
      endTime = calculateEndTime(stravaEvent, startTime);
      console.log(`Calculated end time: ${endTime.toISOString()}`);
    }
    
    // Validate that we have a valid date
    if (endTime && isNaN(endTime.getTime())) {
      console.warn("Generated an invalid end date, creating one based on start time");
      // Default to start time + 1 hour
      endTime = new Date(startTime.getTime() + 3600 * 1000);
    }
  } catch (error) {
    console.error("Error calculating end time:", error);
    // Create a default end time (start time + 1 hour)
    endTime = new Date(startTime.getTime() + 3600 * 1000);
  }
  
  // Extract pace from description
  const paceMatch = extractPaceFromDescription(stravaEvent.description || '');
  
  // Determine pace category based on the extracted pace
  const paceCategory = paceMatch ? 
    Number(paceMatch.split(':')[0]) >= 6 ? 'beginner' :
    Number(paceMatch.split(':')[0]) >= 5 ? 'intermediate' :
    'advanced' : 'beginner';
  
  // Use the stravaClubId for the URL if provided, otherwise fall back to the internal clubId
  const clubIdForUrl = stravaClubId || clubId;
  
  return {
    stravaEventId: stravaEvent.id.toString(),
    clubId,
    title: stravaEvent.title,
    description: stravaEvent.description,
    startTime, // Valid Date object representing the event's start time
    endTime,   // Valid Date object representing the event's end time
    location: stravaEvent.location,
    distance: stravaEvent.distance,
    pace: paceMatch,
    paceCategory: paceCategory,
    beginnerFriendly: (stravaEvent.description || '').toLowerCase().includes('beginner'),
    isIntervalTraining: detectIntervalTraining(stravaEvent.description),
    stravaEventUrl: `https://www.strava.com/clubs/${clubIdForUrl}/group_events/${stravaEvent.id}`,
  };
}

// DEPRECATED - This helper function creates current dates which we no longer want to use
// Only keeping for reference purposes - should throw an error if called
function createFutureEventDate(): Date {
  throw new Error("createFutureEventDate is deprecated - we should only use actual dates from Strava");
  
  /* Original implementation (removed)
  const date = new Date();
  const daysToAdd = 1 + Math.floor(Math.random() * 14);
  date.setDate(date.getDate() + daysToAdd);
  const hour = 6 + Math.floor(Math.random() * 14);
  date.setHours(hour, 0, 0, 0);
  return date;
  */
}

// Extract date from title or description text
// This is a fallback method when no date fields are available from Strava
export function extractDateFromText(title?: string, description?: string): Date | null {
  const combinedText = [title || '', description || ''].join(' ');
  
  // Try to find common date formats in the text
  // Example: March 17, 2025 or 17/03/2025 or 17.03.2025
  
  // Check for month name + day + year (e.g., "March 17, 2025" or "17 March 2025")
  const monthNamePattern = /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+\d{1,2}(?:[,\s]+\d{4})?|\d{1,2}[,\s]+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[,\s]+\d{4})?/i;
  
  // Check for numeric formats (e.g., "17/03/2025" or "17.03.2025")
  const numericDatePattern = /\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4}\b|\b\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2}\b/;
  
  // Extract the date string if found
  const monthNameMatch = combinedText.match(monthNamePattern);
  const numericMatch = combinedText.match(numericDatePattern);
  
  let dateStr = monthNameMatch?.[0] || numericMatch?.[0];
  
  if (dateStr) {
    console.log(`Found date string in text: "${dateStr}"`);
    
    try {
      // Try to create a date from the extracted string
      const extractedDate = new Date(dateStr);
      
      // Validate it's a proper date
      if (!isNaN(extractedDate.getTime())) {
        console.log(`Successfully parsed date text to: ${extractedDate.toISOString()}`);
        
        // Set a reasonable time if only the date was extracted (default to 18:00)
        if (extractedDate.getHours() === 0 && extractedDate.getMinutes() === 0) {
          extractedDate.setHours(18, 0, 0, 0);
        }
        
        return extractedDate;
      }
    } catch (error) {
      console.warn(`Failed to parse extracted date string: ${dateStr}`, error);
    }
  }
  
  // Try to find day and time mentions (e.g., "this Tuesday at 6pm")
  const dayOfWeekPattern = /\b(?:mon(?:day)?|tues(?:day)?|wed(?:nesday)?|thurs(?:day)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
  const timePattern = /\b(?:\d{1,2}[:\.]\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m)\b/i;
  
  const dayMatch = combinedText.match(dayOfWeekPattern);
  const timeMatch = combinedText.match(timePattern);
  
  if (dayMatch) {
    console.log(`Found day of week in text: "${dayMatch[0]}"`);
    
    // Calculate the next occurrence of this day
    const today = new Date();
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayLower = dayMatch[0].toLowerCase();
    
    // Find which day was mentioned
    let targetDay = -1;
    for (let i = 0; i < daysOfWeek.length; i++) {
      if (daysOfWeek[i].startsWith(dayLower.substring(0, 3))) {
        targetDay = i;
        break;
      }
    }
    
    if (targetDay >= 0) {
      const result = new Date();
      const currentDay = result.getDay();
      
      // Calculate days to add to get to the target day
      // If today is the target day, schedule for next week
      const daysToAdd = (targetDay + 7 - currentDay) % 7 || 7;
      result.setDate(result.getDate() + daysToAdd);
      
      // Set default time or parse mentioned time
      if (timeMatch) {
        const timeStr = timeMatch[0];
        console.log(`Found time in text: "${timeStr}"`);
        
        // Extract hours and minutes from the time string
        const isPM = /p/i.test(timeStr);
        const isAM = /a/i.test(timeStr);
        
        // Extract numeric part
        const timeParts = timeStr.match(/\d{1,2}(?:[:.]\d{2})?/);
        if (timeParts) {
          // Check if it contains hours and minutes
          const hasMinutes = /[:.]\d{2}/.test(timeParts[0]);
          
          if (hasMinutes) {
            // Format like "6:30" or "18:30"
            const [hours, minutes] = timeParts[0].split(/[:.]/);
            let hour = parseInt(hours, 10);
            
            if (isPM && hour < 12) hour += 12;
            if (isAM && hour === 12) hour = 0;
            
            result.setHours(hour, parseInt(minutes, 10), 0, 0);
          } else {
            // Format like "6pm" or "6"
            let hour = parseInt(timeParts[0], 10);
            
            if (isPM && hour < 12) hour += 12;
            if (isAM && hour === 12) hour = 0;
            
            result.setHours(hour, 0, 0, 0);
          }
        }
      } else {
        // Default time (18:00)
        result.setHours(18, 0, 0, 0);
      }
      
      console.log(`Created date from day of week: ${result.toISOString()}`);
      return result;
    }
  } else if (timeMatch) {
    // Only time mentioned, use today's date with that time
    const timeStr = timeMatch[0];
    console.log(`Found only time in text: "${timeStr}"`);
    
    const result = new Date();
    
    // Extract hours and minutes from the time string
    const isPM = /p/i.test(timeStr);
    const isAM = /a/i.test(timeStr);
    
    // Extract numeric part
    const timeParts = timeStr.match(/\d{1,2}(?:[:.]\d{2})?/);
    if (timeParts) {
      // Check if it contains hours and minutes
      const hasMinutes = /[:.]\d{2}/.test(timeParts[0]);
      
      if (hasMinutes) {
        // Format like "6:30" or "18:30"
        const [hours, minutes] = timeParts[0].split(/[:.]/);
        let hour = parseInt(hours, 10);
        
        if (isPM && hour < 12) hour += 12;
        if (isAM && hour === 12) hour = 0;
        
        result.setHours(hour, parseInt(minutes, 10), 0, 0);
      } else {
        // Format like "6pm" or "6"
        let hour = parseInt(timeParts[0], 10);
        
        if (isPM && hour < 12) hour += 12;
        if (isAM && hour === 12) hour = 0;
        
        result.setHours(hour, 0, 0, 0);
      }
      
      // If the time is in the past, move to tomorrow
      if (result < new Date()) {
        result.setDate(result.getDate() + 1);
      }
      
      console.log(`Created date from time only: ${result.toISOString()}`);
      return result;
    }
  }
  
  return null;
}

// Calculate end time based on start time and duration
export function calculateEndTime(stravaEvent: any, startTimeInput?: Date) {
  // Use provided startTime or create a new one from stravaEvent.start_date
  const startTime = startTimeInput || new Date(stravaEvent.start_date);
  
  // Default duration to 1 hour if not specified
  const durationInSeconds = stravaEvent.estimated_duration || 3600;
  
  // Return a new Date object for the end time
  return new Date(startTime.getTime() + durationInSeconds * 1000);
}

// Extract pace from event description (e.g., "5:30/km" or "5:30 min/km")
// Export this function for use in the sync service
export function extractPaceFromDescription(description: string) {
  const match = description.match(/(\d{1,2}:\d{2})(?:\/km| min\/km)/);
  return match ? match[1] : null;
}

// Detect if the event is an interval training session from the description
export function detectIntervalTraining(description: string | null | undefined): boolean {
  if (!description) return false;
  const lowerDesc = description.toLowerCase();
  
  // Keywords that indicate interval training
  const intervalKeywords = [
    'interval', 
    'intervals',
    'fartlek',
    'repeats',
    'rep session',
    'tempo runs',
    'speed session',
    'track workout',
    'hiit',
    'high intensity interval',
    'sprint repeats',
    '400m repeats',
    '800m repeats',
    '1km repeats',
    'ladder workout',
    'pyramid workout'
  ];
  
  // Check if any of the keywords are present in the description
  return intervalKeywords.some(keyword => lowerDesc.includes(keyword));
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
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
  
  // Get all clubs
  app.get("/api/clubs", async (req: Request, res: Response) => {
    try {
      const sortBy = req.query.sortBy as string;
      
      if (sortBy === 'score') {
        const clubs = await storage.getClubsSortedByScore();
        res.json(clubs);
      } else {
        // Get all clubs instead of just approved ones
        const clubs = await storage.getClubs();
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
      
      // Check if user is authenticated by looking for access token in the Authorization header
      const authHeader = req.headers.authorization;
      let accessToken = null;
      let isAuthenticated = false;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        isAuthenticated = true;
        console.log('Found authorization header with access token');
      }
      
      // Per Strava API regulations, we can only show events from clubs the user is a member of
      // If user is not authenticated, return 403 with clear error message
      if (!isAuthenticated) {
        console.log('User is not authenticated with Strava. Returning authentication required error.');
        return res.status(403).json({
          message: "Authentication required. Due to Strava API regulations, we can only show events from clubs you're a member of if you connect your Strava account.",
          requiresAuth: true
        });
      }
      
      const userWantsSpecificClubs = req.query.clubIds && (req.query.clubIds as string).length > 0;
      let userClubIds: number[] = [];
      
      // Get the user's Strava clubs for filtering
      try {
        const userClubs = await stravaService.getUserClubs(accessToken!);
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
        return res.status(401).json({
          message: "Unable to verify your club memberships. Please reconnect your Strava account.",
          requiresAuth: true
        });
      }
      
      // If user has no clubs, return empty array
      if (userClubIds.length === 0) {
        console.log('User has no clubs. Returning empty array.');
        return res.json([]);
      }
      
      // Apply filters based on request parameters
      const filters = {
        // Use explicit club filter if provided, otherwise use user's clubs
        clubIds: userWantsSpecificClubs 
          ? (req.query.clubIds as string).split(',').map(Number).filter(id => userClubIds.includes(id))
          : userClubIds,
        paceCategories: req.query.paceCategories ? (req.query.paceCategories as string).split(',') : undefined,
        distanceRanges: req.query.distanceRanges ? (req.query.distanceRanges as string).split(',') : undefined,
        beginnerFriendly: req.query.beginnerFriendly === 'true',
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      console.log('Filters:', {
        ...filters,
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString()
      });
      
      console.log(`Filtering events for authenticated user's clubs: ${filters.clubIds.join(', ')}`);
      
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
      const testMode = req.query.test === 'true';
      const testApi = req.query.api === 'true';
      
      // Test the resilient API client if requested
      if (testApi) {
        console.log("Testing resilient API client with rate limiting and retry behavior");
        try {
          // Import the resilient API client
          const { resilientApi } = await import('./resilient-api');
          
          // Use a simpler test that doesn't require authentication
          const testUrl = 'https://httpbin.org/status/200,429,500,200';
          console.log(`Testing resilient API with endpoint: ${testUrl}`);
          const result = await resilientApi.get(testUrl);
          
          return res.json({
            status: "success",
            message: "Resilient API client test successful",
            apiClientInfo: {
              name: "strava-api",
              configured: true,
              working: true
            },
            endpoint: testUrl,
            responseData: result || "No response data",
            retryCapabilities: {
              maxRetries: 5,
              backoffEnabled: true
            }
          });
        } catch (err: any) {
          console.error("Resilient API test error:", err);
          return res.status(500).json({
            status: "error", 
            message: "Resilient API test failed",
            error: err.message
          });
        }
      }
      
      // Regular diagnostic mode
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
        },
        resilientApiInitialized: true
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
      
      // Convert expiry time to ISO string for client storage
      const expiryISO = tokenData.expiresAt.toISOString();
      
      // Redirect to success page with token info in query params (will be captured by client)
      res.redirect(`/auth-success?access_token=${tokenData.accessToken}&expires_at=${expiryISO}`);
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
      
      // Import the sync service
      const { syncService, syncCache } = require('./sync-service');
      
      // Check if the sync service is running
      const isActive = syncService.isActive();
      
      // Get all clubs
      const allClubs = await storage.getClubs();
      
      if (allClubs.length === 0) {
        return res.status(200).json({ 
          message: "No clubs to sync",
          syncServiceActive: isActive
        });
      }
      
      console.log(`Starting manual sync for ${allClubs.length} clubs...`);
      
      try {
        // Check if Strava credentials are configured
        const hasStravaCredentials = !!process.env.STRAVA_CLIENT_ID && 
                                    !!process.env.STRAVA_CLIENT_SECRET;
                                    
        // Check if we have a refresh token for syncing
        const hasStravaToken = !!process.env.STRAVA_REFRESH_TOKEN;
        
        // Trigger a sync for all clubs through the sync service
        await syncService.syncAllClubs();
        
        // Store the current time as last sync time
        syncCache.set('last_sync_time', Date.now());
        
        // Respond with appropriate message based on credentials
        if (!hasStravaCredentials || !hasStravaToken) {
          return res.json({
            message: "Sync completed in limited mode (no Strava credentials)",
            limitedMode: true,
            syncServiceActive: isActive,
            nextScheduledSync: syncService.isActive() ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null
          });
        } else {
          return res.json({
            message: `Sync completed successfully.`,
            syncServiceActive: isActive,
            nextScheduledSync: syncService.isActive() ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null
          });
        }
      } catch (syncError: any) {
        console.error('Error during sync:', syncError);
        return res.json({
          message: "Sync attempted but encountered errors. See server logs for details.",
          syncServiceActive: isActive,
          error: syncError.message || "Unknown error"
        });
      }
    } catch (error: any) {
      console.error('Error in sync endpoint:', error);
      return res.status(500).json({ 
        message: "Failed to sync Strava events", 
        error: error.message || "Unknown error" 
      });
    }
  });
  
  // Endpoint to check sync service status
  // Delete all events and refresh with new ones from Strava
  app.delete("/api/events/all", async (req: Request, res: Response) => {
    try {
      console.log('Starting to delete all events...');
      
      // First delete from hidden_events table (foreign key constraints)
      await db.delete(hiddenEvents);
      
      // Then delete from events table
      await db.delete(events);
      
      console.log('Successfully deleted all events from the database');
      
      // Trigger a sync for all clubs through the sync service
      console.log('Starting to sync events from Strava after deletion...');
      await syncService.syncAllClubs();
      
      console.log('Sync completed successfully');
      
      res.status(200).json({ 
        message: "All events deleted and new ones synced from Strava",
        success: true
      });
    } catch (error) {
      console.error('Error deleting events or syncing:', error);
      res.status(500).json({ 
        message: "Failed to delete events or sync with Strava", 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.get("/api/strava/sync-status", async (req: Request, res: Response) => {
    try {
      // Check if the sync service is active
      const isActive = syncService.isActive();
      
      // Get cache information
      const lastSyncAttempt = syncCache.get('last_sync_attempt');
      const lastSuccessfulSync = syncCache.get('last_successful_sync');
      const syncErrors = syncCache.get('sync_errors') || [];
      const syncStats = syncCache.get('sync_stats') || {};
      const tokenExpiryTime = syncCache.get('token_expiry');
      
      // Check token status and validity
      const hasAccessToken = !!process.env.STRAVA_ACCESS_TOKEN;
      const hasRefreshToken = !!process.env.STRAVA_REFRESH_TOKEN;
      
      // Test token validity by attempting to get a valid token
      let tokenValid = false;
      if (hasRefreshToken) {
        try {
          const accessToken = await syncService.getAccessToken();
          tokenValid = !!accessToken;
        } catch (error) {
          console.error("Error validating token during status check:", error);
        }
      }
      
      // Determine when the next sync is scheduled
      let nextSyncTime = null;
      if (lastSyncAttempt && isActive) {
        // Add sync interval to last sync time
        const syncIntervalMs = 60 * 60 * 1000; // 1 hour in milliseconds
        nextSyncTime = new Date(Number(lastSyncAttempt) + syncIntervalMs);
      }
      
      res.json({
        syncServiceActive: isActive,
        lastSyncAttempt: lastSyncAttempt ? new Date(Number(lastSyncAttempt)).toISOString() : null,
        lastSuccessfulSync: lastSuccessfulSync ? new Date(Number(lastSuccessfulSync)).toISOString() : null,
        nextSyncTime: nextSyncTime ? nextSyncTime.toISOString() : null,
        tokenStatus: {
          hasAccessToken,
          hasRefreshToken,
          tokenExpiryTime: tokenExpiryTime ? new Date(Number(tokenExpiryTime)).toISOString() : null,
          tokenValid
        },
        syncStats,
        recentErrors: Array.isArray(syncErrors) ? syncErrors.slice(0, 3) : [] // Return only most recent 3 errors
      });
    } catch (error: any) {
      console.error('Error checking sync status:', error);
      res.status(500).json({ 
        message: "Failed to check sync status",
        error: error.message || "Unknown error"
      });
    }
  });

  // Get user's Strava clubs
  app.get("/api/strava/user-clubs", async (req: Request, res: Response) => {
    try {
      // Check for Authorization header containing Bearer token
      const authHeader = req.headers.authorization;
      let accessToken: string | null = null;
      
      if (authHeader?.startsWith('Bearer ')) {
        // Extract token from Authorization header
        accessToken = authHeader.substring(7);
        console.log('Using access token from Authorization header');
      }
      
      // If no token in Authorization header, use cached token or environment variable
      if (!accessToken) {
        // Get access token - either from cache (recent login) or from environment
        accessToken = stravaCache.get('recent_access_token') as string;
        
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
      
      // Check for Authorization header containing Bearer token
      const authHeader = req.headers.authorization;
      let accessToken: string | null = null;
      
      if (authHeader?.startsWith('Bearer ')) {
        // Extract token from Authorization header
        accessToken = authHeader.substring(7);
        console.log('Using access token from Authorization header');
      }
      
      // If no token in Authorization header, use cached token or environment variable
      if (!accessToken) {
        accessToken = stravaCache.get('recent_access_token') as string;
        
        if (!accessToken && process.env.STRAVA_ACCESS_TOKEN) {
          accessToken = process.env.STRAVA_ACCESS_TOKEN;
        }
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
            // Even if club exists, sync its events
            try {
              await syncService.syncClubEvents(existingClub.id, existingClub.stravaClubId, accessToken);
              results.push({ 
                id: existingClub.id, 
                name: existingClub.name, 
                status: 'existing',
                message: 'Club already exists. Events were synced successfully.'
              });
            } catch (syncError) {
              console.error(`Error syncing events for existing club ${existingClub.id}:`, syncError);
              results.push({ 
                id: existingClub.id, 
                name: existingClub.name, 
                status: 'existing',
                message: 'Club already exists. Failed to sync events.'
              });
            }
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
          
          // Since we're removing verified/approved flags, we don't need to set verified status
          
          // Add Strava tokens to the club
          await storage.updateClubStravaTokens(club.id, {
            accessToken: accessToken,
            refreshToken: process.env.STRAVA_REFRESH_TOKEN || '',
            expiresAt: new Date(Date.now() + 3600 * 1000) // Arbitrary expiration
          });
          
          // Get the newly created club with all its data
          const newlyCreatedClub = await storage.getClub(club.id);
          if (!newlyCreatedClub) {
            results.push({ 
              id: club.id, 
              name: club.name, 
              status: 'added',
              message: 'Club added but could not retrieve for event sync'
            });
            continue;
          }
          
          // Immediately sync events for the newly added club
          try {
            await syncService.syncClubEvents(newlyCreatedClub.id, newlyCreatedClub.stravaClubId, accessToken);
            results.push({ 
              id: newlyCreatedClub.id, 
              name: newlyCreatedClub.name, 
              status: 'added',
              message: 'Club added and events synced successfully'
            });
          } catch (syncError) {
            console.error(`Error syncing events for new club ${club.id}:`, syncError);
            results.push({ 
              id: club.id, 
              name: club.name, 
              status: 'added',
              message: 'Club added but failed to sync events'
            });
          }
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


