import type { EventCategory } from "@/lib/categories";

export type UserStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";

export type User = {
  id: string;
  nickname: string;
  status: UserStatus;
  role: UserRole;
  created_at: string;
};

export type Game = {
  id: string;
  title: string;
  min_players: number | null;
  max_players: number | null;
  geek_weight: number | null;
  owner_id: string | null;
  created_at: string;
};

export type MeetupEvent = {
  id: string;
  title: string;
  event_time: string; // ISO timestamp
  max_participants: number;
  creator_id: string;
  category: EventCategory;
  game_id: string | null; // 선택값
  created_at: string;
};

export type EventParticipant = {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
};

export type ParticipantWithUser = EventParticipant & {
  users: Pick<User, "nickname"> | null;
};

export type EventWithDetails = MeetupEvent & {
  games: Game | null;
  event_participants: ParticipantWithUser[];
};

export type CalendarViewMode = "week" | "month";
