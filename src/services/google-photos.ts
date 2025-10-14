// Google Photos Integration Service
import { supabase } from './supabase'

// Google OAuth2 configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly'
const GOOGLE_REDIRECT_URI = `${window.location.origin}/google-callback.html`

interface GoogleAuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
}

/**
 * Base64URL encode a Uint8Array
 */
function base64URLEncode(array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...array))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * SHA256 hash a string and return as Uint8Array
 */
async function sha256(message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hash)
}

class GooglePhotosService {
  private tokens: GoogleAuthTokens | null = null

  /**
   * Generate a random PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return base64URLEncode(array)
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = await sha256(verifier)
    return base64URLEncode(hash)
  }

  /**
   * Initiate Google OAuth flow using authorization code flow with PKCE
   */
  async authorize(): Promise<void> {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in .env')
    }

    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)

    // Store code verifier for later use
    sessionStorage.setItem('google_photos_code_verifier', codeVerifier)

    // Generate OAuth URL with authorization code flow
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', GOOGLE_SCOPES)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('state', 'google-photos-import')
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent') // Force consent screen

    // Use redirect for better reliability
    window.location.href = authUrl.toString()
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
      // Ensure we have valid tokens
      const tokens = await this.ensureValidTokens()
      if (!tokens) {
        return {
          success: false,
          imported: 0,
          failed: 0,
          error: 'Google Photos not authorized. Please authorize access first.'
        }
      }

      // Get current session for Supabase auth
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        return {
          success: false,
          imported: 0,
          failed: 0,
          error: 'Not authenticated with application. Please log in first.'
        }
      }

      // Call Supabase Edge Function to import photos
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        return {
          success: false,
          imported: 0,
          failed: 0,
          error: 'Application configuration error. Please contact support.'
        }
      }

      const functionUrl = `${supabaseUrl}/functions/v1/import-google-photos`

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          timelineId,
          maxPhotos,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to import photos'

        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage

          // Handle specific error cases
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please re-authorize Google Photos access.'
            this.clearAuth() // Clear invalid tokens
          } else if (response.status === 403) {
            errorMessage = 'Access denied. Please check your Google Photos permissions.'
          } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again later.'
          }
        } catch (parseError) {
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please re-authorize Google Photos access.'
            this.clearAuth()
          }
        }

        return {
          success: false,
          imported: 0,
          failed: 0,
          error: errorMessage
        }
      }

      const result = await response.json()

      // Report progress
      if (onProgress && result.imported) {
        onProgress(result.imported, result.imported + (result.failed || 0))
      }

      return {
        success: true,
        imported: result.imported || 0,
        failed: result.failed || 0,
        events: result.events,
        errors: result.errors,
      }

    } catch (error) {
      console.error('Google Photos import error:', error)

      let errorMessage = 'Import failed due to an unexpected error'

      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.'
        } else if (error.message.includes('authorize')) {
          errorMessage = error.message
        } else {
          errorMessage = `Import failed: ${error.message}`
        }
      }

      return {
        success: false,
        imported: 0,
        failed: 0,
        error: errorMessage
      }
    }
  }

  /**
   * Ensure we have valid tokens, refreshing if necessary
   */
  private async ensureValidTokens(): Promise<GoogleAuthTokens | null> {
    // Load tokens from storage if not in memory
    if (!this.tokens) {
      const stored = sessionStorage.getItem('google_photos_tokens')
      if (stored) {
        try {
          this.tokens = JSON.parse(stored)
        } catch (error) {
          console.warn('Failed to parse stored tokens, clearing storage')
          this.clearAuth()
          return null
        }
      }
    }

    // Check if tokens exist and are still valid (with 5 minute buffer)
    if (!this.tokens || Date.now() >= (this.tokens.expires_at - 300000)) {
      // Try to refresh tokens if we have a refresh token
      if (this.tokens?.refresh_token) {
        try {
          const refreshedTokens = await this.refreshTokens(this.tokens.refresh_token)
          this.tokens = refreshedTokens
          sessionStorage.setItem('google_photos_tokens', JSON.stringify(refreshedTokens))
          return refreshedTokens
        } catch (error) {
          console.error('Token refresh failed:', error)
          this.clearAuth()
          throw new Error('Authentication expired and refresh failed. Please authorize again.')
        }
      }

      if (!this.tokens) {
        throw new Error('Not authorized. Please authorize Google Photos access first.')
      }

      throw new Error('Authentication expired. Please authorize again.')
    }

    return this.tokens
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshTokens(refreshToken: string): Promise<GoogleAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Token refresh failed: ${errorData.error}`)
    }

    const data = await response.json()

    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Refresh token stays the same
      expires_at: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type || 'Bearer',
    }
  }

  /**
   * Check if user is authorized
   */
  isAuthorized(): boolean {
    return !!this.tokens && Date.now() < this.tokens.expires_at
  }

  /**
   * Clear authorization
   */
  clearAuth(): void {
    this.tokens = null
    sessionStorage.removeItem('google_photos_tokens')
    sessionStorage.removeItem('google_photos_code_verifier')
  }
}

export const googlePhotosService = new GooglePhotosService()
