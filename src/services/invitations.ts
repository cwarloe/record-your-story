// Email Invitations Service
import { supabase } from './supabase'

export interface InvitationRequest {
  email: string
  senderName: string
  eventTitle: string
  timelineId: string
  invitationType: 'view' | 'collaborate'
}

class InvitationService {
  /**
   * Send an email invitation to a non-user
   */
  async sendInvitation(invitation: InvitationRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        return { success: false, error: 'Not authenticated' }
      }

      // Get Supabase function URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const functionUrl = `${supabaseUrl}/functions/v1/send-invitation`

      // Call Supabase Edge Function
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invitation),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return { success: false, error: errorData.error || 'Failed to send invitation' }
      }

      const result = await response.json()
      return { success: true }

    } catch (error) {
      console.error('Invitation error:', error)
      return { success: false, error: 'Failed to send invitation' }
    }
  }

  /**
   * Accept a timeline invitation (called after user signs up with invitation token)
   */
  async acceptInvitation(invitationToken: string): Promise<{
    success: boolean
    timelineId?: string
    permissionLevel?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('accept_timeline_invitation', {
        invitation_token_param: invitationToken
      })

      if (error) {
        console.error('Accept invitation error:', error)
        return { success: false, error: error.message }
      }

      if (data.error) {
        return { success: false, error: data.error }
      }

      return {
        success: true,
        timelineId: data.timeline_id,
        permissionLevel: data.permission_level
      }

    } catch (error) {
      console.error('Accept invitation error:', error)
      return { success: false, error: 'Failed to accept invitation' }
    }
  }

  /**
   * Get pending invitations for current user's email
   */
  async getPendingInvitations(): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('timeline_invitations')
        .select(`
          *,
          timelines:timeline_id (
            id,
            name,
            type
          ),
          inviter:invited_by (
            id,
            email
          )
        `)
        .eq('invited_email', user.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())

      if (error) {
        console.error('Get invitations error:', error)
        return []
      }

      return data || []

    } catch (error) {
      console.error('Get invitations error:', error)
      return []
    }
  }

  /**
   * Get invitations sent by current user
   */
  async getSentInvitations(timelineId?: string): Promise<any[]> {
    try {
      let query = supabase
        .from('timeline_invitations')
        .select(`
          *,
          timelines:timeline_id (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false })

      if (timelineId) {
        query = query.eq('timeline_id', timelineId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Get sent invitations error:', error)
        return []
      }

      return data || []

    } catch (error) {
      console.error('Get sent invitations error:', error)
      return []
    }
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(invitationId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('timeline_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }

    } catch (error) {
      console.error('Decline invitation error:', error)
      return { success: false, error: 'Failed to decline invitation' }
    }
  }

  /**
   * Check if email is already a user
   */
  async isExistingUser(email: string): Promise<boolean> {
    try {
      // Query users table by email
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .limit(1)

      if (error) {
        console.error('Check user error:', error)
        return false
      }

      return (data && data.length > 0)

    } catch (error) {
      console.error('Check user error:', error)
      return false
    }
  }

  /**
   * Share timeline with existing user (alternative to email invitation)
   */
  async shareWithExistingUser(
    timelineId: string,
    userEmail: string,
    permissionLevel: 'view' | 'edit' | 'admin'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Find user by email
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail.toLowerCase())
        .limit(1)

      if (userError || !users || users.length === 0) {
        return { success: false, error: 'User not found' }
      }

      const userId = users[0].id

      // Get current user for invited_by
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { success: false, error: 'Not authenticated' }
      }

      // Create share
      const { error: shareError } = await supabase
        .from('shared_timelines')
        .insert({
          timeline_id: timelineId,
          user_id: userId,
          permission_level: permissionLevel,
          invited_by: user.id,
          accepted: false // They need to accept the share
        })

      if (shareError) {
        // Check if already shared
        if (shareError.code === '23505') { // Unique violation
          return { success: false, error: 'Timeline already shared with this user' }
        }
        return { success: false, error: shareError.message }
      }

      return { success: true }

    } catch (error) {
      console.error('Share with user error:', error)
      return { success: false, error: 'Failed to share timeline' }
    }
  }
}

export const invitationService = new InvitationService()
