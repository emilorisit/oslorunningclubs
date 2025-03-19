import { serial, text, timestamp, boolean, integer, pgTable, json, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Club model
export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  stravaClubId: text("strava_club_id").notNull().unique(),
  stravaClubUrl: text("strava_club_url").notNull(),
  adminEmail: text("admin_email").notNull(),
  website: text("website"),
  paceCategories: text("pace_categories").array().notNull(),
  distanceRanges: text("distance_ranges").array().notNull(),
  meetingFrequency: text("meeting_frequency").notNull(),
  verified: boolean("verified").default(false),
  verificationToken: text("verification_token"),
  approved: boolean("approved").default(false),
  stravaAccessToken: text("strava_access_token").default(""),
  stravaRefreshToken: text("strava_refresh_token").default(""),
  stravaTokenExpiresAt: timestamp("strava_token_expires_at").default(new Date(0)),
  lastEventDate: timestamp("last_event_date"),
  avgParticipants: integer("avg_participants").default(0),
  participantsCount: integer("participants_count").default(0),
  eventsCount: integer("events_count").default(0),
  clubScore: integer("club_score").default(0),
});

// Event model
// Raw events table for storing unprocessed Strava data
export const rawEvents = pgTable("raw_events", {
  id: serial("id").primaryKey(),
  stravaEventId: text("strava_event_id").notNull().unique(),
  clubId: integer("club_id").notNull(),
  rawData: json("raw_data").notNull(),
  retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processingError: text("processing_error"),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  stravaEventId: text("strava_event_id").notNull().unique(),
  clubId: integer("club_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  location: text("location"),
  distance: integer("distance"), // in meters
  pace: text("pace"),
  paceCategory: text("pace_category"), // beginner, intermediate, advanced
  beginnerFriendly: boolean("beginner_friendly").default(false),
  isIntervalTraining: boolean("is_interval_training").default(false),
  stravaEventUrl: text("strava_event_url").notNull(),
});

// User model - minimal, storing only Strava ID and tokens
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  stravaUserId: text("strava_user_id").notNull().unique(),
  stravaAccessToken: text("strava_access_token").notNull(),
  stravaRefreshToken: text("strava_refresh_token").notNull(),
  stravaTokenExpiresAt: timestamp("strava_token_expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login").defaultNow(),
});

// User preferences for personalized views
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  clubFilters: text("club_filters").array(),
  paceFilters: text("pace_filters").array(),
  distanceFilters: text("distance_filters").array(),
  beginnerFriendlyFilter: boolean("beginner_friendly_filter"),
  calendarView: text("calendar_view").default("month"), // month, week, list
});

// Junction table for users hiding specific events
export const hiddenEvents = pgTable("hidden_events", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.eventId] })
}));

// Logs table
export const logs = pgTable('logs', {
  id: serial('id').primaryKey(),
  level: text('level').notNull(),
  message: text('message').notNull(),
  metadata: json('metadata'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  source: text('source'),
});

// Insert schemas
export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  verified: true,
  verificationToken: true,
  approved: true
});

export const insertEventSchema = createInsertSchema(events).omit({ 
  id: true 
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true
});

export const insertHiddenEventSchema = createInsertSchema(hiddenEvents);

// Types
export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferencesSchema>;
export type HiddenEvent = typeof hiddenEvents.$inferSelect;
export type InsertHiddenEvent = z.infer<typeof insertHiddenEventSchema>;
export type Log = typeof logs.$inferSelect;

// Raw Strava event type for the first layer
export interface RawStravaEvent {
  id: string | number;
  title: string;
  description?: string;
  start_date?: string;
  start_date_local?: string;
  scheduled_time?: number;
  end_date?: string;
  end_date_local?: string;
  location?: string;
  distance?: number;
  club_id?: string;
  url?: string;
  _raw?: any; // Store complete raw data for debugging
  _retrieved: Date;
}


// Extended schemas for validation
export const clubSubmissionSchema = insertClubSchema.extend({
  paceCategories: z.array(z.enum(['beginner', 'intermediate', 'advanced'])),
  distanceRanges: z.array(z.enum(['short', 'medium', 'long'])),
  meetingFrequency: z.enum(['weekly', 'twice_a_week', 'multiple_times_per_week', 'monthly', 'irregular']),
  stravaClubUrl: z.string().url().includes('strava.com/clubs/'),
  adminEmail: z.string().email(),
  website: z.string().url().optional().or(z.literal(''))
});