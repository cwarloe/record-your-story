// Supabase Edge Function for sending timeline invitation emails
// Deploy with: supabase functions deploy send-timeline-invitation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimelineInvitationRequest {
  email: string
  senderName: string
  timelineName: string
  timelineId: string
  invitationType: 'view' | 'collaborate'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sendgridKey = Deno.env.get('SENDGRID_API_KEY')

    if (!sendgridKey) {
      throw new Error('SendGrid API key not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const invitation: TimelineInvitationRequest = await req.json()

    // Create invitation token (for signup/acceptance link)
    const invitationToken = crypto.randomUUID()

    // Store invitation in database
    const { error: dbError } = await supabase
      .from('timeline_invitations')
      .insert({
        timeline_id: invitation.timelineId,
        invited_email: invitation.email,
        invited_by: user.id,
        invitation_token: invitationToken,
        invitation_type: invitation.invitationType,
        status: 'pending',
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to create invitation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate signup/acceptance link
    const baseUrl = req.headers.get('origin') || 'https://record-your-story.app'
    const invitationLink = `${baseUrl}?timeline-invite=${invitationToken}`

    // Send email via SendGrid
    const emailBody = {
      personalizations: [
        {
          to: [{ email: invitation.email }],
          subject: `${invitation.senderName} invited you to collaborate on "${invitation.timelineName}"`,
        },
      ],
      from: {
        email: 'invitations@record-your-story.app',
        name: 'Record Your Story',
      },
      content: [
        {
          type: 'text/html',
          value: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #6c5b7b 0%, #564a63 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background: #f8f8f8; padding: 30px; border-radius: 0 0 8px 8px; }
                  .button { display: inline-block; background: #6c5b7b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>📖 Record Your Story</h1>
                  </div>
                  <div class="content">
                    <h2>You've been invited!</h2>
                    <p><strong>${invitation.senderName}</strong> wants to share their timeline <strong>"${invitation.timelineName}"</strong> with you.</p>

                    <p>Record Your Story is a personal timeline app that helps you preserve and share your life's most important moments.</p>

                    ${invitation.invitationType === 'collaborate'
                      ? '<p>You\'re invited to collaborate on this timeline - you can add your own memories and perspectives!</p>'
                      : '<p>You can view this timeline and all its events.</p>'
                    }

                    <div style="text-align: center;">
                      <a href="${invitationLink}" class="button">Accept Invitation & Join</a>
                    </div>

                    <p style="margin-top: 30px; font-size: 14px; color: #666;">
                      If you already have an account, this link will automatically add you to the shared timeline.
                      If not, you'll be guided through a quick sign-up process.
                    </p>
                  </div>
                  <div class="footer">
                    <p>Record Your Story - Preserve your memories, share your legacy</p>
                    <p style="font-size: 12px;">This invitation was sent by ${invitation.senderName} (${user.email})</p>
                  </div>
                </div>
              </body>
            </html>
          `,
        },
      ],
    }

    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    })

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text()
      console.error('SendGrid error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Timeline invitation sent successfully',
        invitationToken
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})