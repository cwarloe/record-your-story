-- Record Your Story v2.0 Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Timelines table
CREATE TABLE IF NOT EXISTS public.timelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('personal', 'family', 'work', 'shared')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  mentions UUID[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'friends', 'family', 'public')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event photos table
CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  data TEXT NOT NULL, -- base64 encoded image
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event connections table (for linked events)
CREATE TABLE IF NOT EXISTS public.event_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id_1 UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_id_2 UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('manual', 'ai_suggested', 'same_event')),
  confidence_score NUMERIC(3, 2), -- 0.00 to 1.00
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_connection UNIQUE (event_id_1, event_id_2)
);

-- Event mentions table (for tagging users in events)
CREATE TABLE IF NOT EXISTS public.event_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_mention UNIQUE (event_id, mentioned_user_id)
);

-- Timeline sharing table (for collaboration)
CREATE TABLE IF NOT EXISTS public.shared_timelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit', 'admin')),
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_share UNIQUE (timeline_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_timeline ON public.events(timeline_id);
CREATE INDEX IF NOT EXISTS idx_events_author ON public.events(author_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date DESC);
CREATE INDEX IF NOT EXISTS idx_event_photos_event ON public.event_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_timelines_owner ON public.timelines(owner_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON public.event_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_event ON public.event_mentions(event_id);
CREATE INDEX IF NOT EXISTS idx_shared_timelines_user ON public.shared_timelines(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_timelines_timeline ON public.shared_timelines(timeline_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_timelines ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Timelines policies
CREATE POLICY "Users can view their own timelines and shared timelines"
  ON public.timelines FOR SELECT
  USING (
    auth.uid() = owner_id OR
    id IN (
      SELECT timeline_id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND accepted = TRUE
    )
  );

CREATE POLICY "Users can create timelines"
  ON public.timelines FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own timelines or shared timelines with edit permission"
  ON public.timelines FOR UPDATE
  USING (
    auth.uid() = owner_id OR
    id IN (
      SELECT timeline_id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND accepted = TRUE AND permission_level IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can delete their own timelines"
  ON public.timelines FOR DELETE
  USING (auth.uid() = owner_id);

-- Events policies
CREATE POLICY "Users can view events in their own or shared timelines"
  ON public.events FOR SELECT
  USING (
    auth.uid() = author_id OR
    auth.uid() = ANY(mentions) OR
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    timeline_id IN (
      SELECT timeline_id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND accepted = TRUE
    )
  );

CREATE POLICY "Users can create events in their own or shared timelines with edit permission"
  ON public.events FOR INSERT
  WITH CHECK (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    timeline_id IN (
      SELECT timeline_id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND accepted = TRUE AND permission_level IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can update their own events or events in shared timelines with edit permission"
  ON public.events FOR UPDATE
  USING (
    auth.uid() = author_id OR
    timeline_id IN (
      SELECT timeline_id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND accepted = TRUE AND permission_level IN ('edit', 'admin')
    )
  );

CREATE POLICY "Users can delete their own events or events in shared timelines with edit permission"
  ON public.events FOR DELETE
  USING (
    auth.uid() = author_id OR
    timeline_id IN (
      SELECT timeline_id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND accepted = TRUE AND permission_level IN ('edit', 'admin')
    )
  );

-- Event photos policies
CREATE POLICY "Users can view photos of events they have access to"
  ON public.event_photos FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE
        auth.uid() = author_id OR
        auth.uid() = ANY(mentions) OR
        timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can add photos to their own events"
  ON public.event_photos FOR INSERT
  WITH CHECK (
    event_id IN (SELECT id FROM public.events WHERE auth.uid() = author_id)
  );

CREATE POLICY "Users can delete photos from their own events"
  ON public.event_photos FOR DELETE
  USING (
    event_id IN (SELECT id FROM public.events WHERE auth.uid() = author_id)
  );

-- Event mentions policies
CREATE POLICY "Users can view mentions they're involved in"
  ON public.event_mentions FOR SELECT
  USING (
    auth.uid() = mentioned_user_id OR
    event_id IN (SELECT id FROM public.events WHERE auth.uid() = author_id)
  );

CREATE POLICY "Event authors can create mentions"
  ON public.event_mentions FOR INSERT
  WITH CHECK (
    event_id IN (SELECT id FROM public.events WHERE auth.uid() = author_id)
  );

CREATE POLICY "Mentioned users can update their mention status"
  ON public.event_mentions FOR UPDATE
  USING (auth.uid() = mentioned_user_id);

-- Event connections policies
CREATE POLICY "Users can view connections for their events"
  ON public.event_connections FOR SELECT
  USING (
    event_id_1 IN (SELECT id FROM public.events WHERE auth.uid() = author_id) OR
    event_id_2 IN (SELECT id FROM public.events WHERE auth.uid() = author_id)
  );

CREATE POLICY "Users can create connections for their events"
  ON public.event_connections FOR INSERT
  WITH CHECK (
    event_id_1 IN (SELECT id FROM public.events WHERE auth.uid() = author_id) OR
    event_id_2 IN (SELECT id FROM public.events WHERE auth.uid() = author_id)
  );

CREATE POLICY "Users can update connections for their events"
  ON public.event_connections FOR UPDATE
  USING (
    event_id_1 IN (SELECT id FROM public.events WHERE auth.uid() = author_id) OR
    event_id_2 IN (SELECT id FROM public.events WHERE auth.uid() = author_id)
  );

-- Shared timelines policies
CREATE POLICY "Users can view shares for their timelines or shares they're part of"
  ON public.shared_timelines FOR SELECT
  USING (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "Timeline owners can share their timelines"
  ON public.shared_timelines FOR INSERT
  WITH CHECK (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid())
  );

CREATE POLICY "Timeline owners and admins can update shares"
  ON public.shared_timelines FOR UPDATE
  USING (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    (user_id = auth.uid() AND permission_level = 'admin')
  );

CREATE POLICY "Timeline owners and admins can delete shares"
  ON public.shared_timelines FOR DELETE
  USING (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    (user_id = auth.uid() AND permission_level = 'admin')
  );

CREATE POLICY "Invited users can update their own share acceptance status"
  ON public.shared_timelines FOR UPDATE
  USING (user_id = auth.uid());

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update events.updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile automatically
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
