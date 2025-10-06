# 🤖 AI Features (v2.3.0) - Implementation Guide

## Overview

This document describes the AI-powered features built on **Claude 3.5 Sonnet** (Anthropic) and **Web Speech API** (browser).

## Status: Foundation Ready ✅

- ✅ Claude SDK installed (`@anthropic-ai/sdk`)
- ✅ Claude service created (`src/services/claude.ts`)
- ✅ API key configured (`.env`)
- ✅ Three core AI methods implemented
- ⏳ UI integration pending (see below)

---

## Claude Service API

Located in: `src/services/claude.ts`

### 1. **suggestEventFromTranscript**
Analyze voice/text transcript → extract event structure

**Input:** Transcript string
**Output:**
```typescript
{
  title?: string;        // "Summer Vacation in Paris"
  description?: string;  // Well-formatted 2-4 sentences
  date?: string;         // "2023-06-15" or "unknown"
  tags?: string[];       // ["travel", "paris", "family", "vacation"]
  error?: string;
}
```

**Use Case:** Voice-to-event creation (record story → auto-fill form)

---

### 2. **enhanceEvent**
Improve existing event title/description

**Input:** Current title + description
**Output:**
```typescript
{
  improvedTitle?: string;
  improvedDescription?: string;
  suggestedTags?: string[];
  error?: string;
}
```

**Use Case:** "🤖 AI Enhance" button to improve writing quality

---

### 3. **summarizeTimeline**
Generate narrative from multiple events

**Input:** Array of events with title, date, tags
**Output:**
```typescript
{
  summary?: string;      // 3-5 sentence narrative
  insights?: string[];   // Key patterns/themes
  error?: string;
}
```

**Use Case:** "Summarize 2023" feature, life story generation

---

## Implementation Checklist

### Phase 1: Voice-to-Event 🎤
**Priority: HIGH (Most marketable feature)**

**UI Changes:**
1. Add "🎤 Record Story" button to event modal (next to description)
2. Implement Web Speech API:
```typescript
const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

recognition.onresult = (event: any) => {
  let transcript = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    transcript += event.results[i][0].transcript;
  }
  // Live transcription display
};
```

3. **Flow:**
   - User clicks 🎤 Record
   - Speaks their story: "Last summer we went to Paris..."
   - Real-time transcription appears
   - Click Stop → Call `claude.suggestEventFromTranscript(transcript)`
   - Auto-fill form with AI suggestions
   - User reviews/edits → Save

**Files to Edit:**
- `src/main.ts`: Add recording UI, Speech API integration
- `src/style.css`: Style recording indicator (pulsing red dot)

---

### Phase 2: AI Enhance Button 🤖
**Priority: MEDIUM (Quick win)**

**UI Changes:**
1. Add "🤖 AI Enhance" button below description editor
2. On click:
   - Get current title + description
   - Call `claude.enhanceEvent(title, description)`
   - Show suggestions in modal
   - User accepts/rejects

**UX Flow:**
```
User writes: "went to beach"
AI suggests: "Beach Day with Family"
           + "Spent a wonderful day at the beach..."
           + Tags: beach, family, summer, outdoor
```

---

### Phase 3: Timeline Intelligence 📊
**Priority: MEDIUM (Differentiator)**

**Features:**
1. **Timeline Summary Button**
   - Add to timeline header: "📊 Summarize"
   - Filter events by date range (e.g., "2023")
   - Call `claude.summarizeTimeline(filteredEvents)`
   - Show modal with narrative + insights

2. **Smart Connections**
   - AI suggests related events based on content
   - "These events might be connected..."
   - One-click to create connections

---

## API Key Management

### Local Development
API key in `.env` file (already configured):
```bash
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Production (Render)
Add environment variable in Render dashboard:
```
VITE_ANTHROPIC_API_KEY=<your-api-key-here>
```
(Use the same key from Knowledge Harvest project)

---

## Graceful Degradation

Claude service already handles missing API key:
```typescript
if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️  Claude AI disabled - no API key found');
}
```

When disabled:
- AI buttons show tooltip: "Enable AI features by adding Claude API key"
- Core app functionality unchanged
- No errors thrown

---

## Cost Considerations

**Claude 3.5 Sonnet Pricing:**
- $3 per 1M input tokens
- $15 per 1M output tokens

**Typical Event Creation:**
- Input: ~200 tokens (transcript)
- Output: ~150 tokens (suggestions)
- Cost: ~$0.003 per event (~0.3¢)

**Budget-Friendly:**
- 1000 events = $3
- Perfect for proof-of-concept
- Can add rate limiting later

---

## Testing AI Features

### Test Voice-to-Event:
1. Record: "Last summer my family and I went to Paris for two weeks. We visited the Eiffel Tower, ate amazing croissants, and took a boat tour on the Seine. It was an unforgettable trip."

**Expected Output:**
```json
{
  "title": "Family Vacation in Paris",
  "description": "Last summer, my family and I spent two unforgettable weeks in Paris. We visited iconic landmarks like the Eiffel Tower, enjoyed delicious French croissants, and took a memorable boat tour along the Seine River.",
  "date": "unknown",
  "tags": ["paris", "family", "travel", "vacation", "france"]
}
```

### Test Enhance Event:
**Input:**
- Title: "went to beach"
- Description: "had fun at beach with friends"

**Expected Output:**
```json
{
  "improvedTitle": "Beach Day with Friends",
  "improvedDescription": "Spent a wonderful sunny day at the beach with close friends. We enjoyed swimming in the ocean, playing beach volleyball, and relaxing in the warm sand. It was a perfect day of fun and laughter.",
  "suggestedTags": ["beach", "friends", "summer", "outdoor", "fun"]
}
```

---

## Next Steps for Full Implementation

1. **Implement Voice Recording UI** (2-3 hours)
   - Record button with visual indicator
   - Real-time transcript display
   - Speech API integration
   - Call Claude suggest method

2. **Add AI Enhance Button** (1 hour)
   - Button in event modal
   - Show suggestions modal
   - Accept/reject flow

3. **Timeline Summary Feature** (1-2 hours)
   - Filter events by date range
   - Generate summary button
   - Display narrative modal

4. **Polish & Error Handling** (1 hour)
   - Loading states
   - Error messages
   - Rate limiting (if needed)

**Total Estimated Time:** 5-7 hours to complete all AI features

---

## Browser Compatibility

**Web Speech API:**
- ✅ Chrome/Edge (full support)
- ✅ Safari (partial support)
- ❌ Firefox (not supported)

**Fallback:** Show "Voice recording not supported in this browser" message

---

## Security Notes

- ✅ API key in `.env` (not committed to git)
- ✅ `.env` in `.gitignore`
- ⚠️  API key exposed in browser (client-side)
  - Consider server-side proxy for production
  - Or use per-user API keys

---

## Marketing Copy (When Features Complete)

### Tagline
**"Your memories, powered by AI"**

### Key Features
- 🎤 **Voice-to-Event**: Just speak your story, AI does the rest
- 🤖 **Smart Writing Assistant**: AI enhances your descriptions
- 📊 **Timeline Intelligence**: Generate life story narratives
- 🔗 **Auto-Connections**: AI finds related memories

### Value Proposition
"Record Your Story uses AI to make documenting your life effortless. No more struggling with what to write - just speak naturally, and our AI assistant creates beautiful, structured timeline events for you."

---

Ready to implement! All foundation code is in place. 🚀
