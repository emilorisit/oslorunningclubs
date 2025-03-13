import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  stravaEventUrl: text("strava_event_url").notNull(),
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

// Types
export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// Extended schemas for validation
export const clubSubmissionSchema = insertClubSchema.extend({
  paceCategories: z.array(z.enum(['beginner', 'intermediate', 'advanced'])),
  distanceRanges: z.array(z.enum(['short', 'medium', 'long'])),
  meetingFrequency: z.enum(['weekly', 'twice_a_week', 'multiple_times_per_week', 'monthly', 'irregular']),
  stravaClubUrl: z.string().url().includes('strava.com/clubs/'),
  adminEmail: z.string().email(),
  website: z.string().url().optional().or(z.literal(''))
});
