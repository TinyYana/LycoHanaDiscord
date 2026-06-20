CREATE TABLE "guild_config" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"welcome_channel_id" text,
	"welcome_enabled" boolean DEFAULT false NOT NULL,
	"leave_log_channel_id" text,
	"log_channel_id" text,
	"active_member_role_id" text,
	"activity_threshold_high" integer,
	"activity_threshold_low" integer,
	"activity_weights" jsonb NOT NULL,
	"exempt_role_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_daily" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"chat_count" integer DEFAULT 0 NOT NULL,
	"voice_seconds" integer DEFAULT 0 NOT NULL,
	"image_count" integer DEFAULT 0 NOT NULL,
	"music_count" integer DEFAULT 0 NOT NULL,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "activity_daily_guild_id_user_id_date_pk" PRIMARY KEY("guild_id","user_id","date")
);
--> statement-breakpoint
CREATE TABLE "role_menu_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_id" integer NOT NULL,
	"role_id" text NOT NULL,
	"label" text NOT NULL,
	"emoji" text
);
--> statement-breakpoint
CREATE TABLE "role_menus" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text,
	"title" text NOT NULL,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embed_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"moderator_id" text,
	"reason" text,
	"message_ref" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "honeypot_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"action" text DEFAULT 'timeout' NOT NULL,
	"timeout_seconds" integer,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "honeypot_channels_channel_id_unique" UNIQUE("channel_id")
);
--> statement-breakpoint
ALTER TABLE "role_menu_options" ADD CONSTRAINT "role_menu_options_menu_id_role_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."role_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "embed_templates_guild_name_unique" ON "embed_templates" USING btree ("guild_id","name");