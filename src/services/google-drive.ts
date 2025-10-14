// Google Drive Integration Service
// Handles OAuth authentication and document fetching from Google Drive

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: string;
  webViewLink: string;
}

interface GoogleDriveTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
}

class GoogleDriveService {
  private clientId: string = '';
  private redirectUri: string = '';
  private scopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file'
  ];

  constructor() {
    // Get OAuth credentials from environment
    this.clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || '';
    // Always use .html extension for consistency
    this.redirectUri = `${window.location.origin}/google-callback.html`;
  }

  isEnabled(): boolean {
    return !!this.clientId;
  }

  /**
   * Generate a random PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hash = await this.sha256(verifier);
    return this.base64URLEncode(hash);
  }

  /**
   * Base64URL encode a Uint8Array
   */
  private base64URLEncode(array: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...array));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * SHA256 hash a string and return as Uint8Array
   */
  private async sha256(message: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash);
  }

  /**
   * Start OAuth flow for Google Drive access using authorization code flow with PKCE
   */
  async authorize(): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Google Drive not configured. Add VITE_GOOGLE_DRIVE_CLIENT_ID to enable.');
    }

    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store code verifier for later use
    sessionStorage.setItem('google_drive_code_verifier', codeVerifier);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', this.scopes.join(' '));
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', 'google_drive_import');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl.toString(),
      'Google Drive Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    // Wait for OAuth callback
    return new Promise((resolve, reject) => {
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          reject(new Error('Authorization cancelled'));
        }
      }, 500);

      window.addEventListener('message', async (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'google_drive_auth_success') {
          clearInterval(checkClosed);
          popup.close();

          try {
            // Exchange authorization code for tokens
            const tokens = await this.exchangeCodeForTokens(event.data.code, codeVerifier);

          // Store tokens securely
          sessionStorage.setItem('google_drive_tokens', JSON.stringify(tokens));

          resolve();
          } catch (error) {
            reject(error);
          }
        } else if (event.data.type === 'google_drive_auth_error') {
          clearInterval(checkClosed);
          popup.close();
          reject(new Error(event.data.error));
        }
      });
    });
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<GoogleDriveTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token exchange failed: ${errorData.error}`);
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type || 'Bearer',
    };
  }

  /**
   * Get stored access token if still valid
   */
  private async getValidTokens(): Promise<GoogleDriveTokens | null> {
    const tokensJson = sessionStorage.getItem('google_drive_tokens');
    if (!tokensJson) return null;

    try {
      const tokens: GoogleDriveTokens = JSON.parse(tokensJson);

      // Check if token is expired (with 5 minute buffer)
      if (Date.now() >= (tokens.expires_at - 300000)) {
        // Try to refresh the token
        if (tokens.refresh_token) {
          try {
            const refreshedTokens = await this.refreshTokens(tokens.refresh_token);
            sessionStorage.setItem('google_drive_tokens', JSON.stringify(refreshedTokens));
            return refreshedTokens;
          } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearTokens();
            throw new Error('Authentication expired and refresh failed. Please authorize again.');
          }
        } else {
          this.clearTokens();
          throw new Error('Authentication expired. Please authorize again.');
        }
      }

      return tokens;
    } catch (error) {
      if (error instanceof Error && error.message.includes('authorize')) {
        throw error;
      }
      console.warn('Failed to parse stored tokens, clearing storage');
      this.clearTokens();
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshTokens(refreshToken: string): Promise<GoogleDriveTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token refresh failed: ${errorData.error}`);
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Refresh token stays the same
      expires_at: Date.now() + (data.expires_in * 1000),
      token_type: data.token_type || 'Bearer',
    };
  }

  /**
   * Clear stored tokens
   */
  private clearTokens(): void {
    sessionStorage.removeItem('google_drive_tokens');
    sessionStorage.removeItem('google_drive_code_verifier');
  }

  /**
   * Revoke access and clear stored token
   */
  async revokeAccess(): Promise<void> {
    const tokens = await this.getValidTokens();
    if (tokens?.access_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Failed to revoke token:', error);
      }
    }
    this.clearTokens();
  }

  /**
   * Check if user is currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getValidTokens();
    return !!tokens;
  }

  /**
   * List documents from Google Drive
   */
  async listDocuments(options: {
    mimeTypes?: string[];
    maxResults?: number;
    query?: string;
  } = {}): Promise<GoogleDriveFile[]> {
    const tokens = await this.getValidTokens();
    if (!tokens) {
      throw new Error('Google Drive not authorized. Please authorize access first.');
    }

    // Build query
    const queryParts: string[] = [];

    // Filter by mime types (documents, text files, etc.)
    if (options.mimeTypes && options.mimeTypes.length > 0) {
      const mimeQuery = options.mimeTypes.map(type => `mimeType='${type}'`).join(' or ');
      queryParts.push(`(${mimeQuery})`);
    } else {
      // Default: text and document files
      queryParts.push(
        "(mimeType='text/plain' or " +
        "mimeType='application/vnd.google-apps.document' or " +
        "mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or " +
        "mimeType='application/pdf')"
      );
    }

    // Only show non-trashed files
    queryParts.push("trashed=false");

    // Custom query filter
    if (options.query) {
      queryParts.push(`name contains '${options.query}'`);
    }

    const q = queryParts.join(' and ');
    const pageSize = options.maxResults || 20;

    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('pageSize', pageSize.toString());
    url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,size,webViewLink)');
    url.searchParams.set('orderBy', 'modifiedTime desc');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Drive API error:', error);
      throw new Error('Failed to list documents from Google Drive');
    }

    const data = await response.json();
    return data.files || [];
  }

  /**
   * Download document content as text
   */
  async downloadDocument(fileId: string): Promise<{
    content: string;
    fileName: string;
    mimeType: string;
  }> {
    const tokens = await this.getValidTokens();
    if (!tokens) {
      throw new Error('Not authenticated');
    }

    // Get file metadata first
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    if (!metadataResponse.ok) {
      throw new Error('Failed to get file metadata');
    }

    const metadata = await metadataResponse.json();
    const mimeType: string = metadata.mimeType;
    const fileName: string = metadata.name;

    let content: string;

    // Handle Google Docs (need to export)
    if (mimeType === 'application/vnd.google-apps.document') {
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      const exportResponse = await fetch(exportUrl, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });

      if (!exportResponse.ok) {
        throw new Error('Failed to export Google Doc');
      }

      content = await exportResponse.text();
    } else {
      // Regular files - download directly
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const downloadResponse = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });

      if (!downloadResponse.ok) {
        throw new Error('Failed to download file');
      }

      content = await downloadResponse.text();
    }

    return {
      content,
      fileName,
      mimeType
    };
  }

  /**
   * Import multiple documents and analyze with AI
   */
  async importDocuments(
    fileIds: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<File[]> {
    const files: File[] = [];

    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i];

      if (onProgress) {
        onProgress(i + 1, fileIds.length);
      }

      try {
        const { content, fileName, mimeType } = await this.downloadDocument(fileId);

        // Convert to File object for document-import service
        const blob = new Blob([content], { type: mimeType || 'text/plain' });
        const file = new File([blob], fileName, { type: mimeType || 'text/plain' });

        files.push(file);
      } catch (error) {
        console.error(`Failed to import ${fileId}:`, error);
        // Continue with other files
      }
    }

    return files;
  }
}

export const googleDrive = new GoogleDriveService();
