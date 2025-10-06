# Google Photos Integration Setup

This guide explains how to set up Google Photos integration for Record Your Story.

## Overview

The Google Photos integration allows users to:
- Import photos directly from their Google Photos library
- Auto-create timeline events from photo metadata (date, description)
- Preserve photo EXIF data (location, camera info)
- Bulk import up to 100 photos at once

## Prerequisites

- Google Cloud Platform account
- Google Photos Library API enabled
- OAuth 2.0 credentials configured

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Record Your Story")
4. Click "Create"

### 2. Enable Google Photos Library API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Photos Library API"
3. Click on it and click "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure OAuth consent screen:
   - User Type: External
   - App name: Record Your Story
   - User support email: your@email.com
   - Developer contact: your@email.com
   - Scopes: Add `https://www.googleapis.com/auth/photoslibrary.readonly`
   - Test users: Add your email (for testing)
4. Create OAuth client ID:
   - Application type: Web application
   - Name: Record Your Story Web Client
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for local development)
     - `https://your-production-domain.com` (your live site)
   - Authorized redirect URIs:
     - `http://localhost:3000/google-callback` (for local development)
     - `https://your-production-domain.com/google-callback` (your live site)
5. Click "Create"
6. Copy the **Client ID** (you'll need this for your .env file)

### 4. Configure Environment Variable

Add the Google Client ID to your `.env` file:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### 5. Deploy Supabase Edge Function

Deploy the Google Photos import function:

```bash
cd record-your-story
supabase functions deploy import-google-photos
```

### 6. Test the Integration

1. Start your development server: `npm run dev`
2. Log into your application
3. Click "📷 Import Photos" button
4. Enter number of photos to import (start with 5-10)
5. Authorize with Google (popup window)
6. Wait for import to complete
7. Verify photos appear as events on your timeline

## How It Works

### User Flow

1. User clicks "📷 Import Photos"
2. Prompted for number of photos (1-100)
3. OAuth popup opens for Google authorization
4. User grants access to Google Photos Library (read-only)
5. Access token returned to frontend
6. Frontend calls Supabase Edge Function with token
7. Edge Function fetches photos from Google Photos API
8. For each photo:
   - Downloads photo data
   - Extracts metadata (date, description, dimensions)
   - Creates timeline event with photo date
   - Saves photo to event_photos table
9. Returns summary (imported count, failed count)
10. Frontend reloads timeline to show new events

### Technical Architecture

**Frontend** (`src/services/google-photos.ts`)
- Handles OAuth popup flow
- Manages access token
- Calls Supabase Edge Function

**Backend** (`supabase/functions/import-google-photos`)
- Validates user owns timeline
- Calls Google Photos Library API
- Creates events + saves photos
- Handles errors gracefully

**OAuth Callback** (`google-callback.html`)
- Parses OAuth response from URL fragment
- Sends access token to parent window
- Auto-closes after success

## Security Notes

- **Read-Only Access**: Only requests `photoslibrary.readonly` scope
- **User Consent**: User must explicitly authorize each time
- **No Token Storage**: Access tokens not persisted (expires in 1 hour)
- **RLS Policies**: Database ensures users can only import to their own timelines

## Troubleshooting

### "Google Client ID not configured"
- Ensure `VITE_GOOGLE_CLIENT_ID` is set in `.env`
- Restart dev server after changing `.env`

### "Authorization failed" or popup closes immediately
- Check Authorized JavaScript origins in Google Console
- Ensure redirect URI exactly matches (including http vs https)
- Check browser allows popups

### "Failed to fetch photos from Google Photos"
- Verify Photos Library API is enabled
- Check OAuth consent screen is configured
- Ensure test users added (if app not published)

### "Timeline not found or unauthorized"
- User must own the timeline they're importing to
- Check RLS policies on timelines table

### Photos import but events don't appear
- Check browser console for errors
- Verify event_photos table exists
- Ensure IndexedDB has space available

## Rate Limits

Google Photos API limits:
- 10,000 requests per day per project
- 10 queries per second

Our implementation:
- Max 100 photos per import (stays well under limits)
- Sequential processing (respects rate limits)

## Future Enhancements

Potential improvements:
- [ ] Filter by date range before import
- [ ] Filter by album
- [ ] Preserve photo location data (EXIF GPS)
- [ ] Import photo comments/captions
- [ ] Batch processing for >100 photos
- [ ] Progress bar during import
- [ ] Preview photos before import
- [ ] Duplicate detection

## Cost

Google Photos API is **free** for most use cases:
- No cost for read-only access
- No quota fees for reasonable usage
- Only costs if you exceed 10,000 requests/day

## Support

For issues with Google Photos integration:
1. Check browser console for errors
2. Review this setup guide
3. Verify all credentials are correct
4. Test with small number of photos first (5-10)
5. Open GitHub issue if problem persists
