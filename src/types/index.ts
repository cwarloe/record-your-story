// Core domain types for Record Your Story v2.0

export type UserId = string;
export type EventId = string;
export type TimelineId = string;

export interface User {
  id: UserId;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface TimelineEvent {
  id: EventId;
  title: string;
  date: string;
  description?: string;
  tags: string[];
  author_id: UserId;
  timeline_id: TimelineId;

  // v2.0 features
  mentions?: UserId[];  // People tagged in this event
  visibility: 'private' | 'friends' | 'family' | 'public';

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface EventPhoto {
  id: string;
  event_id: EventId;
  data: string;  // base64
  order: number;
  created_at: string;
}

export interface Timeline {
  id: TimelineId;
  name: string;
  owner_id: UserId;
  type: 'personal' | 'family' | 'work' | 'shared';
  created_at: string;
}

export interface EventConnection {
  id: string;
  event_id_1: EventId;
  event_id_2: EventId;
  connection_type: 'manual' | 'ai_suggested' | 'same_event';
  confidence_score?: number;  // For AI suggestions
  approved: boolean;
  created_at: string;
}

export interface EventMention {
  id: string;
  event_id: EventId;
  mentioned_user_id: UserId;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

// UI State types
export interface AppState {
  currentUser: User | null;
  currentTimeline: Timeline | null;
  events: TimelineEvent[];
  loading: boolean;
  error: string | null;
}

export interface SearchFilters {
  query: string;
  dateFrom?: string;
  dateTo?: string;
  tags: string[];
  timeline_id?: TimelineId;
}
