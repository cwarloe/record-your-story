// Google Photos Integration Service
import { supabase } from './supabase'

// Google OAuth2 configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly'
const GOOGLE_REDIRECT_URI = `${window.location.origin}/google-callback.html`

class GooglePhotosService {
  private accessToken: string | null = null

  /**
   * Initiate Google OAuth flow
   */
  async authorize(): Promise<void> {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in .env')
    }

    // Generate OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'token')
    authUrl.searchParams.set('scope', GOOGLE_SCOPES)
    authUrl.searchParams.set('include_granted_scopes', 'true')
    authUrl.searchParams.set('state', 'google-photos-import')

    // Open OAuth popup
    const width = 500
    const height = 600
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const popup = window.open(
      authUrl.toString(),
      'Google Photos Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    )

    // Wait for OAuth callback
    return new Promise((resolve, reject) => {
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          if (!this.accessToken) {
            reject(new Error('Authorization cancelled'))
          }
        }
      }, 500)

      // Listen for message from callback page
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'google_photos_auth_success') {
          this.accessToken = event.data.accessToken
          window.removeEventListener('message', messageHandler)
          clearInterval(checkClosed)
          popup?.close()
          resolve()
        } else if (event.data.type === 'google_oauth_error') {
          window.removeEventListener('message', messageHandler)
          clearInterval(checkClosed)
          popup?.close()
          reject(new Error(event.data.error || 'Authorization failed'))
        }
      }

      window.addEventListener('message', messageHandler)

      // Timeout after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', messageHandler)
        clearInterval(checkClosed)
        popup?.close()
        reject(new Error('Authorization timeout'))
      }, 5 * 60 * 1000)
    })
  }

  /**
   * Import photos from Google Photos
   */
  async importPhotos(
    timelineId: string,
    maxPhotos: number = 50,
    onProgress?: (imported: number, total: number) => void
  ): Promise<{
    success: boolean
    imported: number
    failed: number
    events?: any[]
    errors?: any[]
    error?: string
  }> {
    try {
      // Check if we have an access token
      if (!this.accessToken) {
        // Try to authorize first
        await this.authorize()
      }

      if (!this.accessToken) {
        return { success: false, imported: 0, failed: 0, error: 'Not authorized' }
      }

      // Get current session for Supabase auth
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        return { success: false, imported: 0, failed: 0, error: 'Not authenticated with Supabase' }
      }

      // Call Supabase Edge Function to import photos
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const functionUrl = `${supabaseUrl}/functions/v1/import-google-photos`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: this.accessToken,
          timelineId,
          maxPhotos,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          imported: 0,
          failed: 0,
          error: errorData.error || 'Failed to import photos'
        }
      }

      const result = await response.json()

      // Report progress
      if (onProgress && result.imported) {
        onProgress(result.imported, result.imported + (result.failed || 0))
      }

      return {
        success: true,
        imported: result.imported,
        failed: result.failed || 0,
        events: result.events,
        errors: result.errors,
      }

    } catch (error) {
      console.error('Google Photos import error:', error)
      return {
        success: false,
        imported: 0,
        failed: 0,
        error: error instanceof Error ? error.message : 'Import failed'
      }
    }
  }

  /**
   * Check if user is authorized
   */
  isAuthorized(): boolean {
    return !!this.accessToken
  }

  /**
   * Clear authorization
   */
  clearAuth(): void {
    this.accessToken = null
  }
}

export const googlePhotosService = new GooglePhotosService()
