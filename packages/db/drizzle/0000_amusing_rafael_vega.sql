CREATE TABLE `guild_config` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`welcome_channel_id` text,
	`welcome_enabled` integer DEFAULT false NOT NULL,
	`leave_log_channel_id` text,
	`log_channel_id` text,
	`active_member_role_id` text,
	`activity_threshold_high` integer,
	`activity_threshold_low` integer,
	`activity_weights` text NOT NULL,
	`exempt_role_ids` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `activity_daily` (
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`chat_count` integer DEFAULT 0 NOT NULL,
	`voice_seconds` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`music_count` integer DEFAULT 0 NOT NULL,
	`interaction_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`guild_id`, `user_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `role_menu_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`menu_id` integer NOT NULL,
	`role_id` text NOT NULL,
	`label` text NOT NULL,
	`emoji` text,
	FOREIGN KEY (`menu_id`) REFERENCES `role_menus`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `role_menus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text,
	`title` text NOT NULL,
	`available_from` integer,
	`available_until` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `embed_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `embed_templates_guild_name_unique` ON `embed_templates` (`guild_id`,`name`);--> statement-breakpoint
CREATE TABLE `moderation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`moderator_id` text,
	`reason` text,
	`message_ref` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `honeypot_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`action` text DEFAULT 'timeout' NOT NULL,
	`timeout_seconds` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `honeypot_channels_channel_id_unique` ON `honeypot_channels` (`channel_id`);