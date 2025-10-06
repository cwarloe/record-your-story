-- Migration: v2.1.0 - Add Collaboration Tables
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/jzrljyzosqrjkaupufsb/sql

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shared_timelines_user ON public.shared_timelines(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_timelines_timeline ON public.shared_timelines(timeline_id);

-- Enable RLS
ALTER TABLE public.shared_timelines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view shares for their timelines or shares they're part of"
  ON public.shared_timelines FOR SELECT
  USING (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "Timeline owners can create shares"
  ON public.shared_timelines FOR INSERT
  WITH CHECK (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid())
  );

CREATE POLICY "Timeline owners and admins can update shares"
  ON public.shared_timelines FOR UPDATE
  USING (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    (user_id = auth.uid() AND id IN (
      SELECT id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND permission_level = 'admin'
    ))
  );

CREATE POLICY "Timeline owners and admins can delete shares"
  ON public.shared_timelines FOR DELETE
  USING (
    timeline_id IN (SELECT id FROM public.timelines WHERE owner_id = auth.uid()) OR
    (user_id = auth.uid() AND id IN (
      SELECT id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND permission_level = 'admin'
    ))
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration v2.1.0 completed successfully! Collaboration tables created.';
END $$;
