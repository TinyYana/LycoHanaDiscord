CREATE TABLE "dynamic_voice_channels" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"guild_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_config" ADD COLUMN "dynamic_voice_trigger_channel_id" text;