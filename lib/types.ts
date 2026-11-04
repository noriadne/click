export type User = {
  id: string;
  nickname: string;
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
  game_id: string;
  created_at: string;
};

export type EventParticipant = {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
};

export type EventWithDetails = MeetupEvent & {
  games: Game | null;
  event_participants: EventParticipant[];
};

export type CalendarViewMode = "week" | "month";
