CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`status` text DEFAULT 'PREPARING' NOT NULL,
	`host_id` text NOT NULL,
	`selected_game_id` text,
	`started_at` integer,
	`created_at` integer NOT NULL,
	`loser_id` text,
	`submission_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_room_code_unique` ON `sessions` (`room_code`);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`loser_id` text NOT NULL,
	`status` text NOT NULL,
	`mode` text DEFAULT 'mock' NOT NULL,
	`scheduled_at` integer NOT NULL,
	`claimed_at` integer,
	`completed_at` integer,
	`sungin_nb` text,
	`erp_ref_no` text,
	`error_log` text,
	`screenshot_dir` text,
	`attendee_names` text NOT NULL,
	`title_override` text,
	`purpose_kind` text DEFAULT 'lunch' NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`user_id` text PRIMARY KEY NOT NULL,
	`ciphertext` blob NOT NULL,
	`iv` blob NOT NULL,
	`auth_tag` blob NOT NULL,
	`updated_at` integer NOT NULL
);
