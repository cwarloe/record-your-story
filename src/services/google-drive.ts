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

interface GoogleDriveAuth {
  accessToken: string;
  expiresAt: number;
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
    this.redirectUri = `${window.location.origin}/google-callback`;
  }

  isEnabled(): boolean {
    return !!this.clientId;
  }

  /**
   * Start OAuth flow for Google Drive access
   */
  async authorize(): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Google Drive not configured. Add VITE_GOOGLE_DRIVE_CLIENT_ID to enable.');
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', this.clientId);
    authUrl.searchParams.set('redirect_uri', this.redirectUri);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', this.scopes.join(' '));
    authUrl.searchParams.set('include_granted_scopes', 'true');
    authUrl.searchParams.set('state', 'google_drive_import');

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

      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'google_drive_auth_success') {
          clearInterval(checkClosed);
          popup.close();

          // Store access token
          const auth: GoogleDriveAuth = {
            accessToken: event.data.accessToken,
            expiresAt: Date.now() + (event.data.expiresIn * 1000)
          };
          localStorage.setItem('google_drive_auth', JSON.stringify(auth));

          resolve();
        } else if (event.data.type === 'google_drive_auth_error') {
          clearInterval(checkClosed);
          popup.close();
          reject(new Error(event.data.error));
        }
      });
    });
  }

  /**
   * Get stored access token if still valid
   */
  private getAccessToken(): string | null {
    const authJson = localStorage.getItem('google_drive_auth');
    if (!authJson) return null;

    try {
      const auth: GoogleDriveAuth = JSON.parse(authJson);
      if (Date.now() >= auth.expiresAt) {
        localStorage.removeItem('google_drive_auth');
        return null;
      }
      return auth.accessToken;
    } catch {
      return null;
    }
  }

  /**
   * Revoke access and clear stored token
   */
  async revokeAccess(): Promise<void> {
    const token = this.getAccessToken();
    if (token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Failed to revoke token:', error);
      }
    }
    localStorage.removeItem('google_drive_auth');
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * List documents from Google Drive
   */
  async listDocuments(options: {
    mimeTypes?: string[];
    maxResults?: number;
    query?: string;
  } = {}): Promise<GoogleDriveFile[]> {
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated. Please authorize Google Drive access first.');
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
        'Authorization': `Bearer ${accessToken}`
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
    const accessToken = this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    // Get file metadata first
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
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
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!exportResponse.ok) {
        throw new Error('Failed to export Google Doc');
      }

      content = await exportResponse.text();
    } else {
      // Regular files - download directly
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const downloadResponse = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
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
