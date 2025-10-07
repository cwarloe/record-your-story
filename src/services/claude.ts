import Anthropic from '@anthropic-ai/sdk';

// Claude API configuration
const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';

class ClaudeService {
  private client: Anthropic | null = null;
  private enabled: boolean = false;

  constructor() {
    if (ANTHROPIC_API_KEY) {
      this.client = new Anthropic({
        apiKey: ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true // Client-side usage
      });
      this.enabled = true;
      console.log('✅ Claude AI enabled');
    } else {
      console.warn('⚠️  Claude AI disabled - no API key found');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Analyze transcript and suggest event details
  async suggestEventFromTranscript(transcript: string): Promise<{
    title?: string;
    description?: string;
    date?: string;
    tags?: string[];
    error?: string;
  }> {
    if (!this.enabled || !this.client) {
      return { error: 'Claude AI not enabled. Add VITE_ANTHROPIC_API_KEY to enable.' };
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyze this story/memory transcript and extract structured event information.

Transcript:
${transcript}

Please provide:
1. A concise event title (3-10 words)
2. A well-formatted description (2-4 sentences, preserve key details)
3. Inferred date if mentioned (YYYY-MM-DD format, or "unknown")
4. Relevant tags (3-5 tags: people, places, activities, emotions)

Respond in JSON format:
{
  "title": "Event title here",
  "description": "Description here",
  "date": "YYYY-MM-DD or unknown",
  "tags": ["tag1", "tag2", "tag3"]
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Extract JSON from response (might have markdown code blocks)
        const text = content.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return result;
        }
      }

      return { error: 'Failed to parse Claude response' };
    } catch (error: any) {
      console.error('Claude API error:', error);
      return { error: error.message || 'Failed to analyze transcript' };
    }
  }

  // Enhance existing event description
  async enhanceEvent(title: string, description: string): Promise<{
    improvedTitle?: string;
    improvedDescription?: string;
    suggestedTags?: string[];
    error?: string;
  }> {
    if (!this.enabled || !this.client) {
      return { error: 'Claude AI not enabled' };
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Improve this timeline event:

Title: ${title}
Description: ${description}

Please:
1. Suggest a more engaging title (if improvement possible)
2. Enhance the description (add context, improve flow, preserve facts)
3. Suggest relevant tags (people, places, themes, emotions)

Respond in JSON:
{
  "improvedTitle": "Better title or original if good",
  "improvedDescription": "Enhanced description",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const text = content.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return { error: 'Failed to parse response' };
    } catch (error: any) {
      console.error('Claude API error:', error);
      return { error: error.message };
    }
  }

  // Generate timeline summary
  async summarizeTimeline(events: Array<{ title: string; date: string; tags: string[] }>): Promise<{
    summary?: string;
    insights?: string[];
    error?: string;
  }> {
    if (!this.enabled || !this.client) {
      return { error: 'Claude AI not enabled' };
    }

    try {
      const eventsText = events.map(e =>
        `- ${e.date}: ${e.title} [${e.tags.join(', ')}]`
      ).join('\n');

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyze this timeline and create a narrative summary:

Events:
${eventsText}

Provide:
1. A cohesive narrative summary (3-5 sentences)
2. Key insights/patterns (3-5 bullet points)

Respond in JSON:
{
  "summary": "Narrative summary here",
  "insights": ["insight 1", "insight 2", "insight 3"]
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const text = content.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return { error: 'Failed to parse response' };
    } catch (error: any) {
      console.error('Claude API error:', error);
      return { error: error.message };
    }
  }

  // Suggest related events for connection
  async suggestConnections(
    currentEvent: { id: string; title: string; description: string; date: string; tags: string[] },
    allEvents: Array<{ id: string; title: string; date: string; tags: string[] }>
  ): Promise<{
    connections?: Array<{ eventId: string; reason: string; confidence: number }>;
    error?: string;
  }> {
    if (!this.enabled || !this.client) {
      return { error: 'Claude AI not enabled' };
    }

    try {
      const otherEvents = allEvents.filter(e => e.id !== currentEvent.id);
      const eventsText = otherEvents.map(e =>
        `ID: ${e.id}\nTitle: ${e.title}\nDate: ${e.date}\nTags: ${e.tags.join(', ')}`
      ).join('\n\n');

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Analyze this event and suggest which other events it's related to:

CURRENT EVENT:
Title: ${currentEvent.title}
Description: ${currentEvent.description}
Date: ${currentEvent.date}
Tags: ${currentEvent.tags.join(', ')}

OTHER EVENTS:
${eventsText}

Find up to 5 related events based on:
- Shared themes, people, or locations
- Temporal proximity
- Cause-and-effect relationships
- Similar tags or topics

Respond in JSON with confidence scores (0-100):
{
  "connections": [
    {
      "eventId": "event-id-here",
      "reason": "Brief explanation of connection",
      "confidence": 85
    }
  ]
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const text = content.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return { error: 'Failed to parse response' };
    } catch (error: any) {
      console.error('Claude API error:', error);
      return { error: error.message };
    }
  }

  // Generic chat method for custom prompts
  async chat(options: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    if (!this.enabled || !this.client) {
      throw new Error('Claude AI not enabled');
    }

    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
        messages: options.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      });

      return { content: response.content as Array<{ type: string; text: string }> };
    } catch (error: any) {
      console.error('Claude chat error:', error);
      throw error;
    }
  }

  // Extract life events from document/journal
  async extractEventsFromDocument(
    documentText: string,
    filename: string
  ): Promise<{
    events?: Array<{
      title: string;
      date: string;
      description: string;
      tags: string[];
      confidence: number;
      sourceText: string;
    }>;
    summary?: string;
    error?: string;
  }> {
    if (!this.enabled || !this.client) {
      return { error: 'Claude AI not enabled' };
    }

    try {
      // Limit document size to avoid token limits
      const maxLength = 15000; // ~15k chars
      const truncatedText = documentText.length > maxLength
        ? documentText.substring(0, maxLength) + '\n...[truncated]'
        : documentText;

      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Analyze this document and extract life events, journal entries, or significant moments.

DOCUMENT: ${filename}

CONTENT:
${truncatedText}

Extract each distinct life event, journal entry, or significant moment. For each event:
1. Create a clear, descriptive title
2. Extract or infer the date (YYYY-MM-DD format, or "unknown")
3. Preserve the authentic voice and emotional tone in the description
4. Identify relevant tags (people, places, emotions, themes)
5. Assign confidence score (0-100) based on how clearly this is a life event
6. Include the original text snippet

IMPORTANT:
- Preserve emotional language - don't sanitize or make bland
- Keep personal voice authentic
- Multiple entries in one document should be split out
- Look for date markers ("March 2015", "last summer", "today", etc.)
- Each paragraph/section might be a separate event

Respond in JSON:
{
  "events": [
    {
      "title": "Event title",
      "date": "YYYY-MM-DD or unknown",
      "description": "Full description preserving original voice",
      "tags": ["tag1", "tag2"],
      "confidence": 85,
      "sourceText": "Original text snippet..."
    }
  ],
  "summary": "Brief overview of what this document contains"
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const text = content.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return { error: 'Failed to parse response' };
    } catch (error: any) {
      console.error('Claude API error:', error);
      return { error: error.message };
    }
  }
}

export const claude = new ClaudeService();
