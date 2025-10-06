// Supabase Edge Function for Google Photos import
// Deploy with: supabase functions deploy import-google-photos

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportRequest {
  accessToken: string  // Google OAuth access token (obtained client-side)
  timelineId: string
  maxPhotos?: number   // Limit number of photos to import
}

interface PhotoMetadata {
  url: string
  filename: string
  mimeType: string
  creationTime: string
  width: number
  height: number
  description?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    const { accessToken, timelineId, maxPhotos = 50 }: ImportRequest = await req.json()

    if (!accessToken || !timelineId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user owns this timeline
    const { data: timeline, error: timelineError } = await supabase
      .from('timelines')
      .select('id')
      .eq('id', timelineId)
      .eq('owner_id', user.id)
      .single()

    if (timelineError || !timeline) {
      return new Response(
        JSON.stringify({ error: 'Timeline not found or unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch photos from Google Photos API
    const photosResponse = await fetch(
      `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=${maxPhotos}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!photosResponse.ok) {
      const errorText = await photosResponse.text()
      console.error('Google Photos API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch photos from Google Photos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const photosData = await photosResponse.json()
    const mediaItems = photosData.mediaItems || []

    // Process each photo and create events
    const createdEvents = []
    const errors = []

    for (const item of mediaItems) {
      try {
        // Extract metadata
        const metadata: PhotoMetadata = {
          url: item.baseUrl,
          filename: item.filename,
          mimeType: item.mimeType,
          creationTime: item.mediaMetadata?.creationTime || new Date().toISOString(),
          width: parseInt(item.mediaMetadata?.width || '0'),
          height: parseInt(item.mediaMetadata?.height || '0'),
          description: item.description,
        }

        // Download photo to convert to base64
        const photoResponse = await fetch(`${item.baseUrl}=d`) // =d for download
        const photoBlob = await photoResponse.arrayBuffer()
        const base64Photo = btoa(String.fromCharCode(...new Uint8Array(photoBlob)))
        const photoData = `data:${metadata.mimeType};base64,${base64Photo}`

        // Create event from photo
        const eventDate = new Date(metadata.creationTime).toISOString().split('T')[0]
        const eventTitle = metadata.description || metadata.filename.replace(/\.[^/.]+$/, '') // Remove extension

        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            title: eventTitle,
            date: eventDate,
            description: `Imported from Google Photos: ${metadata.filename}`,
            author_id: user.id,
            timeline_id: timelineId,
            visibility: 'private',
            tags: ['imported', 'google-photos'],
          })
          .select()
          .single()

        if (eventError) {
          errors.push({ filename: metadata.filename, error: eventError.message })
          continue
        }

        // Save photo to event
        const { error: photoError } = await supabase
          .from('event_photos')
          .insert({
            event_id: event.id,
            photo_data: photoData,
            photo_order: 0,
          })

        if (photoError) {
          errors.push({ filename: metadata.filename, error: photoError.message })
          // Delete the event if photo save failed
          await supabase.from('events').delete().eq('id', event.id)
          continue
        }

        createdEvents.push({
          eventId: event.id,
          title: eventTitle,
          date: eventDate,
          filename: metadata.filename,
        })

      } catch (error) {
        errors.push({ filename: item.filename, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported: createdEvents.length,
        failed: errors.length,
        events: createdEvents,
        errors: errors.length > 0 ? errors : undefined,
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
