// Event Deduplication Service
// Detects and prevents duplicate events from being imported

import { claude } from './claude';
import type { TimelineEvent } from '@/types';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number; // 0-100
  matchedEvent?: TimelineEvent;
  reason?: string;
}

export interface ExtractedEventWithSource {
  title: string;
  date: string;
  description: string;
  tags: string[];
  sourceText?: string;
}

class DeduplicationService {
  /**
   * Check if an extracted event is a duplicate of an existing event
   * Uses multiple strategies: exact match, fuzzy match, AI similarity
   */
  async checkDuplicate(
    newEvent: ExtractedEventWithSource,
    existingEvents: TimelineEvent[]
  ): Promise<DuplicateCheckResult> {
    // Strategy 1: Exact title + date match
    const exactMatch = this.findExactMatch(newEvent, existingEvents);
    if (exactMatch) {
      return {
        isDuplicate: true,
        confidence: 100,
        matchedEvent: exactMatch,
        reason: 'Exact match: same title and date'
      };
    }

    // Strategy 2: Fuzzy title match + close date
    const fuzzyMatch = this.findFuzzyMatch(newEvent, existingEvents);
    if (fuzzyMatch.match && fuzzyMatch.similarity >= 0.85) {
      return {
        isDuplicate: true,
        confidence: fuzzyMatch.similarity * 100,
        matchedEvent: fuzzyMatch.match,
        reason: `Similar title and close date (${(fuzzyMatch.similarity * 100).toFixed(0)}% match)`
      };
    }

    // Strategy 3: AI-powered similarity detection (for high-value dedup)
    if (claude.isEnabled() && fuzzyMatch.match && fuzzyMatch.similarity >= 0.60) {
      const aiResult = await this.checkAISimilarity(newEvent, fuzzyMatch.match);
      if (aiResult.isDuplicate) {
        return aiResult;
      }
    }

    return {
      isDuplicate: false,
      confidence: 0
    };
  }

  /**
   * Find exact match by title and date
   */
  private findExactMatch(
    newEvent: ExtractedEventWithSource,
    existingEvents: TimelineEvent[]
  ): TimelineEvent | null {
    return existingEvents.find(event =>
      event.title.toLowerCase().trim() === newEvent.title.toLowerCase().trim() &&
      event.date === newEvent.date
    ) || null;
  }

  /**
   * Find fuzzy match using string similarity and date proximity
   */
  private findFuzzyMatch(
    newEvent: ExtractedEventWithSource,
    existingEvents: TimelineEvent[]
  ): { match: TimelineEvent | null; similarity: number } {
    let bestMatch: TimelineEvent | null = null;
    let highestSimilarity = 0;

    for (const event of existingEvents) {
      // Calculate title similarity
      const titleSim = this.stringSimilarity(
        newEvent.title.toLowerCase(),
        event.title.toLowerCase()
      );

      // Calculate date proximity (within 7 days = 1.0, farther = lower)
      const dateSim = this.dateSimilarity(newEvent.date, event.date);

      // Weighted average (title more important than date)
      const overallSim = (titleSim * 0.7) + (dateSim * 0.3);

      if (overallSim > highestSimilarity) {
        highestSimilarity = overallSim;
        bestMatch = event;
      }
    }

    return { match: bestMatch, similarity: highestSimilarity };
  }

  /**
   * Calculate string similarity using Levenshtein-based approach
   * Returns 0-1 where 1 is identical
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate date similarity
   * Returns 1.0 for same day, decreasing with distance
   */
  private dateSimilarity(date1: string, date2: string): number {
    // Handle 'unknown' dates
    if (date1 === 'unknown' || date2 === 'unknown') return 0.5;

    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      const diffDays = Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));

      // Same day = 1.0, within week = high, exponential decay after
      if (diffDays === 0) return 1.0;
      if (diffDays <= 7) return 1.0 - (diffDays * 0.05);
      if (diffDays <= 30) return 0.65 - ((diffDays - 7) * 0.01);
      if (diffDays <= 90) return 0.42 - ((diffDays - 30) * 0.005);
      return Math.max(0, 0.12 - ((diffDays - 90) * 0.001));
    } catch {
      return 0;
    }
  }

  /**
   * Use AI to check if two events describe the same thing
   */
  private async checkAISimilarity(
    newEvent: ExtractedEventWithSource,
    existingEvent: TimelineEvent
  ): Promise<DuplicateCheckResult> {
    try {
      const response = await claude.chat({
        messages: [{
          role: 'user',
          content: `You are a duplicate detection system. Compare these two events and determine if they describe the same life event.

Event A (New):
Title: ${newEvent.title}
Date: ${newEvent.date}
Description: ${newEvent.description}
${newEvent.sourceText ? `Source: ${newEvent.sourceText.substring(0, 200)}...` : ''}

Event B (Existing):
Title: ${existingEvent.title}
Date: ${existingEvent.date}
Description: ${existingEvent.description || '(no description)'}

Consider:
- Are they describing the same specific event/moment?
- Are dates similar or identical?
- Is the core content the same (despite wording differences)?

Respond with ONLY a JSON object:
{
  "isDuplicate": true/false,
  "confidence": 0-100,
  "reasoning": "brief explanation"
}`
        }],
        maxTokens: 200,
        temperature: 0.1 // Low temperature for consistent decisions
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Extract JSON from response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          return {
            isDuplicate: result.isDuplicate,
            confidence: result.confidence,
            matchedEvent: existingEvent,
            reason: `AI analysis: ${result.reasoning}`
          };
        }
      }

      // If AI response parsing fails, fall back to not duplicate
      return { isDuplicate: false, confidence: 0 };

    } catch (error) {
      console.error('AI similarity check failed:', error);
      return { isDuplicate: false, confidence: 0 };
    }
  }

  /**
   * Batch check for duplicates in a list of extracted events
   * Returns filtered list with duplicates removed + report
   */
  async deduplicateEvents(
    extractedEvents: ExtractedEventWithSource[],
    existingEvents: TimelineEvent[],
    onProgress?: (current: number, total: number) => void
  ): Promise<{
    unique: ExtractedEventWithSource[];
    duplicates: Array<{
      event: ExtractedEventWithSource;
      matchedEvent: TimelineEvent;
      reason: string;
    }>;
  }> {
    const unique: ExtractedEventWithSource[] = [];
    const duplicates: Array<{
      event: ExtractedEventWithSource;
      matchedEvent: TimelineEvent;
      reason: string;
    }> = [];

    for (let i = 0; i < extractedEvents.length; i++) {
      const event = extractedEvents[i];

      if (onProgress) {
        onProgress(i + 1, extractedEvents.length);
      }

      const result = await this.checkDuplicate(event, existingEvents);

      if (result.isDuplicate && result.matchedEvent) {
        duplicates.push({
          event,
          matchedEvent: result.matchedEvent,
          reason: result.reason || 'Duplicate detected'
        });
      } else {
        unique.push(event);
      }
    }

    return { unique, duplicates };
  }
}

export const deduplicationService = new DeduplicationService();
