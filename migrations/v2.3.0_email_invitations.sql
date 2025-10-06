-- Migration v2.3.0: Email Invitations for Non-Users
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/jzrljyzosqrjkaupufsb/sql

-- Timeline invitations table
CREATE TABLE IF NOT EXISTS public.timeline_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitation_token TEXT NOT NULL UNIQUE,
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('view', 'collaborate')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  CONSTRAINT unique_timeline_email UNIQUE (timeline_id, invited_email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.timeline_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.timeline_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_invitations_timeline ON public.timeline_invitations(timeline_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.timeline_invitations(status);

-- Enable RLS
ALTER TABLE public.timeline_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view invitations they sent
CREATE POLICY "Users can view invitations they sent"
  ON public.timeline_invitations
  FOR SELECT
  USING (invited_by = auth.uid());

-- Users can create invitations for timelines they own
CREATE POLICY "Users can create invitations for their timelines"
  ON public.timeline_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.timelines
      WHERE id = timeline_id AND owner_id = auth.uid()
    )
  );

-- Users can view invitations sent to their email
CREATE POLICY "Users can view invitations to their email"
  ON public.timeline_invitations
  FOR SELECT
  USING (invited_email = auth.email());

-- Users can update invitations sent to their email (accept/decline)
CREATE POLICY "Users can update their own invitations"
  ON public.timeline_invitations
  FOR UPDATE
  USING (invited_email = auth.email())
  WITH CHECK (invited_email = auth.email());

-- Function to automatically accept invitation and create timeline share
CREATE OR REPLACE FUNCTION accept_timeline_invitation(invitation_token_param TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record RECORD;
  result JSON;
BEGIN
  -- Get invitation
  SELECT * INTO invitation_record
  FROM public.timeline_invitations
  WHERE invitation_token = invitation_token_param
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid or expired invitation');
  END IF;

  -- Check if user's email matches invitation
  IF auth.email() != invitation_record.invited_email THEN
    RETURN json_build_object('error', 'Invitation was sent to a different email address');
  END IF;

  -- Create timeline share
  INSERT INTO public.shared_timelines (timeline_id, user_id, permission_level, invited_by, accepted)
  VALUES (
    invitation_record.timeline_id,
    auth.uid(),
    CASE WHEN invitation_record.invitation_type = 'collaborate' THEN 'edit' ELSE 'view' END,
    invitation_record.invited_by,
    TRUE
  )
  ON CONFLICT (timeline_id, user_id) DO UPDATE
  SET permission_level = EXCLUDED.permission_level,
      accepted = TRUE;

  -- Mark invitation as accepted
  UPDATE public.timeline_invitations
  SET status = 'accepted',
      accepted_at = NOW()
  WHERE id = invitation_record.id;

  RETURN json_build_object(
    'success', TRUE,
    'timeline_id', invitation_record.timeline_id,
    'permission_level', CASE WHEN invitation_record.invitation_type = 'collaborate' THEN 'edit' ELSE 'view' END
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_timeline_invitation(TEXT) TO authenticated;

COMMENT ON TABLE public.timeline_invitations IS 'Email invitations for non-users to join timelines';
COMMENT ON FUNCTION accept_timeline_invitation IS 'Accepts a timeline invitation and creates share access';
