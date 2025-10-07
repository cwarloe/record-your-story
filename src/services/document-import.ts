// Document Import Service
// Handles parsing and AI analysis of uploaded documents (journals, text files, etc.)

import { claude } from './claude';

export interface ParsedDocument {
  filename: string;
  content: string;
  fileType: 'txt' | 'docx' | 'pdf' | 'json' | 'unknown';
  size: number;
  lastModified: Date;
}

export interface ExtractedEvent {
  title: string;
  date: string; // YYYY-MM-DD or 'unknown'
  description: string;
  tags: string[];
  confidence: number; // 0-100
  sourceText: string; // Original text snippet
}

export interface DocumentAnalysisResult {
  events: ExtractedEvent[];
  summary: string;
  totalEvents: number;
  error?: string;
}

class DocumentImportService {
  /**
   * Parse uploaded file and extract text content
   */
  async parseFile(file: File): Promise<ParsedDocument> {
    const fileType = this.detectFileType(file.name);

    return {
      filename: file.name,
      content: await this.extractText(file, fileType),
      fileType,
      size: file.size,
      lastModified: new Date(file.lastModified)
    };
  }

  /**
   * Detect file type from extension
   */
  private detectFileType(filename: string): ParsedDocument['fileType'] {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'txt':
        return 'txt';
      case 'docx':
      case 'doc':
        return 'docx';
      case 'pdf':
        return 'pdf';
      case 'json':
        return 'json';
      default:
        return 'unknown';
    }
  }

  /**
   * Extract text from file based on type
   */
  private async extractText(file: File, fileType: ParsedDocument['fileType']): Promise<string> {
    switch (fileType) {
      case 'txt':
      case 'json':
        return await file.text();

      case 'docx':
        // For now, just read as text - DOCX parsing would need mammoth.js library
        // TODO: Add mammoth.js for proper DOCX parsing
        return await file.text();

      case 'pdf':
        // For now, just read as text - PDF parsing would need pdf.js library
        // TODO: Add pdf.js for proper PDF parsing
        return await file.text();

      default:
        return await file.text();
    }
  }

  /**
   * Analyze document with AI to extract life events
   */
  async analyzeDocument(document: ParsedDocument): Promise<DocumentAnalysisResult> {
    if (!claude.isEnabled()) {
      return {
        events: [],
        summary: '',
        totalEvents: 0,
        error: 'Claude AI not enabled. Add VITE_ANTHROPIC_API_KEY to enable document analysis.'
      };
    }

    try {
      const result = await claude.extractEventsFromDocument(
        document.content,
        document.filename
      );

      if (result.error) {
        return {
          events: [],
          summary: '',
          totalEvents: 0,
          error: result.error
        };
      }

      return {
        events: result.events || [],
        summary: result.summary || '',
        totalEvents: result.events?.length || 0
      };

    } catch (error: any) {
      console.error('Document analysis error:', error);
      return {
        events: [],
        summary: '',
        totalEvents: 0,
        error: error.message || 'Failed to analyze document'
      };
    }
  }

  /**
   * Parse Claude chat history JSON export
   */
  parseChatHistory(jsonContent: string): ExtractedEvent[] {
    try {
      const chats = JSON.parse(jsonContent);
      // This is a simplified parser - actual Claude export format may vary
      // TODO: Update based on actual Claude export format

      const events: ExtractedEvent[] = [];

      // Example parsing logic - adjust based on actual format
      if (Array.isArray(chats)) {
        chats.forEach((_chat: any) => {
          // Extract life events mentioned in conversations
          // This would need Claude AI to analyze the chat content
        });
      }

      return events;
    } catch (error) {
      console.error('Failed to parse chat history:', error);
      return [];
    }
  }

  /**
   * Batch process multiple documents
   */
  async processDocuments(
    files: File[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    allEvents: ExtractedEvent[];
    errors: string[];
  }> {
    const allEvents: ExtractedEvent[] = [];
    const errors: string[] = [];
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        if (onProgress) {
          onProgress(i + 1, files.length);
        }

        const parsed = await this.parseFile(file);
        const analysis = await this.analyzeDocument(parsed);

        if (analysis.error) {
          errors.push(`${file.name}: ${analysis.error}`);
          failed++;
        } else {
          allEvents.push(...analysis.events);
          processed++;
        }

      } catch (error: any) {
        errors.push(`${file.name}: ${error.message}`);
        failed++;
      }
    }

    return {
      success: processed > 0,
      processed,
      failed,
      allEvents,
      errors
    };
  }
}

export const documentImportService = new DocumentImportService();
