# Record Your Story - Lessons Learned

**Project:** Record Your Story Timeline Application
**Version:** v2.7.2
**Last Updated:** October 12, 2025
**Status:** Production - Live on Render

---

## 📋 Quick Reference

This document catalogs project-specific lessons learned during Record Your Story development. For general lessons across all projects, see [../LESSONS_LEARNED.md](../LESSONS_LEARNED.md).

---

## 🎯 Project Overview

**Tech Stack:**
- Frontend: TypeScript + Vite + Vanilla JS
- Backend: Supabase (PostgreSQL + Auth + RLS)
- AI: Claude 3.5 Sonnet (Anthropic)
- Storage: LocalStorage + IndexedDB (hybrid)
- Rich Text: Quill.js
- Deployment: Render (static site)

**Development Timeline:**
- v1.0.0 (Oct 5, 2024) - MVP with vanilla JS
- v2.0.0 (Oct 5, 2024) - TypeScript migration + Supabase
- v2.7.2 (Oct 6, 2024) - Current with AI features

---

## 🐛 Critical Bugs & Root Causes

### 1. Login Blank Screen (v2.0.2) - HIGH SEVERITY
**Symptom:** White screen after successful Supabase authentication
**User Impact:** App completely unusable after login
**Frequency:** 100% reproduction on fresh accounts

**Root Cause Analysis:**
```typescript
// BROKEN CODE
async function showApp() {
  const user = supabase.getCurrentUser(); // Returns null on race condition
  const timelines = await supabase.getTimelines(); // Empty array for new users

  document.getElementById('app').innerHTML = `
    <h1>${user.email}</h1>  // ❌ Crashes if user is null
    <p>${timelines[0].name}</p>  // ❌ Crashes if timelines is empty
  `;
}
```

**Why It Happened:**
1. Async operations not awaited properly
2. No null checks for optional values
3. Assumed data always exists
4. No error boundary

**The Fix:**
```typescript
// FIXED CODE
async function showApp() {
  try {
    // Wait for user authentication
    const user = supabase.getCurrentUser();
    if (!user) {
      console.error('No authenticated user found');
      redirectToLogin();
      return;
    }

    // Wait for timeline data with null coalescing
    const timelines = await supabase.getTimelines() ?? [];

    // Create default timeline if none exist
    let currentTimeline = timelines[0];
    if (!currentTimeline) {
      currentTimeline = await createDefaultTimeline('My Story');
    }

    // Safe rendering with all values guaranteed
    document.getElementById('app')!.innerHTML = `
      <h1>${user.email}</h1>
      <p>${currentTimeline.name}</p>
    `;

  } catch (error) {
    console.error('Failed to initialize app:', error);
    showErrorUI('Failed to load your timeline. Please refresh the page.');
  }
}
```

**Preventive Checklist:**
- [ ] Add try-catch to all async initialization functions
- [ ] Use `??` (nullish coalescing) instead of `||` for optional values
- [ ] Create default data when none exists
- [ ] Provide error UI with recovery options
- [ ] Test with fresh account (empty state)

**Lesson:** Always assume async operations can fail and data might not exist.

---

### 2. LocalStorage Quota Exceeded (v1.0.0) - HIGH SEVERITY
**Symptom:** App crashed with "QuotaExceededError" when uploading 5+ photos
**User Impact:** Lost all photos, couldn't add more content
**Frequency:** Reproduced with ~6 photos at 1MB each

**Root Cause:**
```typescript
// BROKEN: Storing base64 images in LocalStorage (5MB limit)
const events = JSON.parse(localStorage.getItem('events') || '[]');
events.push({
  id: '123',
  title: 'Vacation',
  photos: [
    'data:image/jpeg;base64,/9j/4AAQSkZJRg...' // ~1.5MB per photo
  ]
});
localStorage.setItem('events', JSON.stringify(events)); // ❌ CRASHES
```

**Why LocalStorage Failed:**
- 5MB limit per domain
- Base64 encoding increases size by 33%
- Synchronous API blocks main thread
- No way to handle quota errors gracefully

**The Solution: Hybrid Storage**
```typescript
// STEP 1: Move photos to IndexedDB (unlimited)
const db = await openDB('RecordYourStory', 1, {
  upgrade(db) {
    db.createObjectStore('photos', { keyPath: 'id' });
  }
});

// STEP 2: Store photo in IndexedDB
async function savePhoto(eventId: string, photoBlob: Blob) {
  const photoId = `${eventId}-${Date.now()}`;
  await db.put('photos', {
    id: photoId,
    eventId,
    blob: photoBlob,
    timestamp: Date.now()
  });
  return photoId;
}

// STEP 3: Store only photo IDs in LocalStorage
const events = JSON.parse(localStorage.getItem('events') || '[]');
events.push({
  id: '123',
  title: 'Vacation',
  photoIds: ['123-1696524800000', '123-1696524801000'] // Just IDs
});
localStorage.setItem('events', JSON.stringify(events)); // ✅ Success

// STEP 4: Load photos on demand
async function loadEventPhotos(photoIds: string[]) {
  const photos = [];
  for (const id of photoIds) {
    const photo = await db.get('photos', id);
    if (photo) {
      photos.push(URL.createObjectURL(photo.blob));
    }
  }
  return photos;
}
```

**Migration Strategy:**
```typescript
// Migrated existing users from v1.0 to v1.1
async function migratePhotosToIndexedDB() {
  const events = JSON.parse(localStorage.getItem('events') || '[]');

  for (const event of events) {
    if (event.photos && event.photos.length > 0) {
      const photoIds = [];

      for (const base64Photo of event.photos) {
        // Convert base64 to Blob
        const blob = await fetch(base64Photo).then(r => r.blob());

        // Save to IndexedDB
        const photoId = await savePhoto(event.id, blob);
        photoIds.push(photoId);
      }

      // Update event with photo IDs
      event.photoIds = photoIds;
      delete event.photos; // Remove base64 data
    }
  }

  localStorage.setItem('events', JSON.stringify(events));
  localStorage.setItem('migration_v1.1', 'complete');
}
```

**Storage Comparison:**

| Method | Capacity | Speed | Use Case |
|--------|----------|-------|----------|
| LocalStorage | 5-10MB | Fast | Metadata, settings |
| SessionStorage | 5-10MB | Fast | Temporary UI state |
| IndexedDB | ~50% of disk | Medium | Photos, videos, files |
| Supabase Storage | Unlimited | Slow | Cloud sync, sharing |

**Lesson:** Never store large binary data in LocalStorage. Use IndexedDB for unlimited client-side storage.

---

### 3. Edit/Delete Buttons Not Working (v2.0.1) - MEDIUM SEVERITY
**Symptom:** Buttons visible but clicks do nothing
**User Impact:** Cannot edit or delete events
**Frequency:** 100% on initial page load

**Root Cause:**
```typescript
// Event listeners attached BEFORE DOM elements exist
function initApp() {
  attachEventListeners(); // ❌ Runs first
  renderTimeline();       // Creates buttons after
}

function attachEventListeners() {
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', handleEdit);
  });
  // querySelectorAll returns empty NodeList - buttons don't exist yet!
}
```

**Why This Is Tricky:**
- No error thrown (silent failure)
- Buttons render correctly (HTML exists)
- Console shows no warnings
- Only discovered through manual testing

**The Fix:**
```typescript
// SOLUTION 1: Attach listeners AFTER rendering
function initApp() {
  renderTimeline();       // ✅ Create buttons first
  attachEventListeners(); // ✅ Attach listeners second
}

// SOLUTION 2: Use event delegation (better for dynamic content)
function initApp() {
  // Single listener on parent (exists on page load)
  document.getElementById('timeline')!.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Check if clicked element is edit button
    if (target.classList.contains('edit-btn')) {
      const eventId = target.dataset.eventId;
      handleEdit(eventId);
    }

    // Check if clicked element is delete button
    if (target.classList.contains('delete-btn')) {
      const eventId = target.dataset.eventId;
      handleDelete(eventId);
    }
  });

  renderTimeline(); // Buttons work immediately
}
```

**Event Delegation Benefits:**
- Works with dynamically added content
- Only one event listener (better performance)
- No need to re-attach after re-renders
- Handles future buttons automatically

**Additional Fix: Use currentTarget Instead of target**
```typescript
// PROBLEM: e.target can be child element
<button class="edit-btn">
  <span>Edit</span> <!-- e.target might be this span -->
</button>

// ❌ BREAKS: span doesn't have dataset.eventId
const eventId = e.target.dataset.eventId;

// ✅ WORKS: currentTarget is always the button
const eventId = (e.currentTarget as HTMLElement).dataset.eventId;
```

**Lesson:** Attach event listeners after DOM elements exist, or use event delegation on parent elements.

---

### 4. Quill Editor Not Loading Content (v2.0.2) - MEDIUM SEVERITY
**Symptom:** Rich text editor appears blank when editing existing events
**User Impact:** Cannot see existing description, appears lost
**Frequency:** 100% when editing (create mode worked fine)

**Root Cause:**
```typescript
let quillInstance: Quill | null = null;

function openEventModal(eventId?: string) {
  showModal();

  // ❌ PROBLEM: Reusing stale Quill instance
  if (!quillInstance) {
    quillInstance = new Quill('#editor', options);
  }

  if (eventId) {
    const event = getEvent(eventId);
    // This doesn't update the editor!
    quillInstance.setContents(event.description);
  }
}
```

**Why Reusing Instances Failed:**
- Quill maintains internal state
- Previous content not fully cleared
- Delta format vs HTML format mismatch
- Editor needs clean slate for each modal open

**The Fix:**
```typescript
let quillInstance: Quill | null = null;

function openEventModal(eventId?: string) {
  showModal();

  // ✅ DESTROY previous instance
  if (quillInstance) {
    quillInstance = null; // Release reference
  }

  // ✅ ALWAYS create fresh instance
  quillInstance = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link']
      ]
    }
  });

  // ✅ Load content AFTER initialization
  if (eventId) {
    const event = getEvent(eventId);
    // Use root.innerHTML for HTML strings
    quillInstance.root.innerHTML = event.description || '';
  }
}
```

**Quill Content Format Gotchas:**
```typescript
// THREE ways to set content:

// 1. Delta format (Quill's native format)
quill.setContents([
  { insert: 'Hello ' },
  { insert: 'World', attributes: { bold: true } }
]);

// 2. HTML (what we store in database)
quill.root.innerHTML = '<p>Hello <strong>World</strong></p>';

// 3. Plain text (loses formatting)
quill.setText('Hello World');
```

**Lesson:** Destroy and recreate rich text editor instances for each modal open. Use appropriate content format (HTML vs Delta).

---

### 5. TypeScript Type Conflicts (v2.0.1) - LOW SEVERITY
**Symptom:** Compiler error: "Cannot redeclare block-scoped variable 'Event'"
**User Impact:** Build fails, cannot deploy
**Frequency:** Discovered during TypeScript migration

**Root Cause:**
```typescript
// ❌ CONFLICT: Event is a global DOM type
interface Event {
  id: string;
  title: string;
  date: string;
}

// This references DOM Event, not our interface!
function handleEvent(e: Event) {
  console.log(e.title); // ❌ Property 'title' does not exist on type 'Event'
}
```

**Conflicting Names:**
- `Event` - DOM event object
- `Response` - Fetch API response
- `Request` - Fetch API request
- `Error` - JavaScript error object
- `File` - File API
- `Image` - HTML Image element

**The Fix:**
```typescript
// ✅ Use specific, descriptive names
interface TimelineEvent {
  id: string;
  title: string;
  date: string;
}

interface APIResponse {
  data: any;
  error?: string;
}

// Clear which Event we mean
function handleEvent(e: TimelineEvent) {
  console.log(e.title); // ✅ Works perfectly
}

function handleDOMEvent(e: Event) {
  console.log(e.type); // ✅ DOM event
}
```

**Naming Convention:**
```typescript
// GOOD interface names:
TimelineEvent, UserProfile, APIResponse,
DatabaseConnection, AuthToken, PhotoUpload

// AVOID generic names that conflict:
Event, Response, Request, Data, Info, Item
```

**Lesson:** Avoid generic interface names that conflict with browser/DOM globals. Use specific, descriptive names.

---

### 6. Google OAuth Redirect URI Mismatch (v2.7.1) - MEDIUM SEVERITY
**Symptom:** OAuth popup shows "redirect_uri_mismatch" error
**User Impact:** Cannot connect Google Drive or Photos
**Frequency:** 100% on first OAuth attempt

**Root Cause:**
```typescript
// CODE: Redirect to /google-callback (no extension)
const redirectUri = `${window.location.origin}/google-callback`;

// GOOGLE CLOUD CONSOLE: Configured with .html
// ✅ http://localhost:5173/google-callback.html

// RESULT: Mismatch! OAuth fails
```

**Why This Happens:**
- Vite serves `google-callback.html` at `/google-callback.html`
- OAuth providers match URIs EXACTLY (including file extensions)
- Development vs production URLs differ
- Easy to test wrong environment

**The Solution:**
```typescript
// STEP 1: Add ALL variations to Google Cloud Console
Authorized redirect URIs:
✅ http://localhost:5173/google-callback.html
✅ http://localhost:5173/google-callback
✅ https://record-your-story.onrender.com/google-callback.html
✅ https://record-your-story.onrender.com/google-callback
✅ https://yourdomain.com/google-callback.html

// STEP 2: Use exact .html path in code
const redirectUri = `${window.location.origin}/google-callback.html`;

// STEP 3: Test in BOTH environments
// Development: http://localhost:5173
// Production: https://record-your-story.onrender.com
```

**OAuth Configuration Checklist:**
- [ ] Add localhost URL for development
- [ ] Add production URL
- [ ] Include .html extension in both
- [ ] Test in incognito mode (clears cached tokens)
- [ ] Check trailing slashes (some APIs sensitive)
- [ ] Verify case sensitivity (some APIs care)

**Debugging OAuth Issues:**
```typescript
// Add detailed logging
console.log('OAuth Configuration:', {
  clientId: GOOGLE_CLIENT_ID,
  redirectUri: redirectUri,
  currentOrigin: window.location.origin,
  fullUrl: window.location.href
});

// Check URL parameters after redirect
const params = new URLSearchParams(window.location.search);
console.log('OAuth callback params:', {
  code: params.get('code'),
  error: params.get('error'),
  errorDescription: params.get('error_description')
});
```

**Lesson:** OAuth redirect URIs must match EXACTLY (including .html). Add multiple variations to handle dev/prod environments.

---

## 🏗️ Architecture Decisions

### 1. V1 to V2 Migration - TypeScript Rewrite

**Decision:** Complete rewrite instead of gradual migration
**Reasoning:** V1 codebase too tightly coupled, no separation of concerns

**V1 Issues:**
```javascript
// 600+ lines in one file (app.js)
// Mixed UI, data, and business logic
let events = [];

function addEvent() {
  // DOM manipulation
  const title = document.getElementById('title').value;

  // Data manipulation
  events.push({ id: uuid(), title, date: new Date() });
  localStorage.setItem('events', JSON.stringify(events));

  // Business logic
  if (events.length > 100) {
    alert('Too many events!');
  }

  // More DOM manipulation
  renderTimeline();
}
```

**V2 Architecture:**
```typescript
// Separated into layers
src/
├── main.ts              // UI layer (event handlers, rendering)
├── services/
│   ├── supabase.ts      // Data layer (CRUD operations)
│   ├── claude.ts        // AI integration
│   └── google-drive.ts  // External APIs
└── types/
    └── index.ts         // Shared types

// Clean separation
class SupabaseService {
  async createEvent(event: TimelineEvent) {
    return this.client.from('events').insert(event);
  }
}

// UI layer just calls service
async function handleAddEvent() {
  const event = getFormData();
  await supabaseService.createEvent(event);
  renderTimeline();
}
```

**Migration Path:**
1. Preserved V1 in `/v1` folder (reference)
2. Created new `/src` with TypeScript
3. Migrated feature by feature
4. Tested both versions side-by-side
5. Switched users to V2 after 1 week

**Lessons:**
- ✅ Rewrite justified when coupling is too high
- ✅ Preserve old version for reference
- ✅ Separate concerns from day one
- ✅ Use TypeScript for large projects (worth the setup)

---

### 2. Hybrid Storage Strategy

**Decision:** LocalStorage + IndexedDB + Supabase (three-tier)

**Reasoning:**
- LocalStorage: Fast, synchronous, good for metadata
- IndexedDB: Unlimited, good for photos/files
- Supabase: Cloud sync, collaboration, backup

**Implementation:**
```typescript
// TIER 1: LocalStorage (fast access)
interface EventMetadata {
  id: string;
  title: string;
  date: string;
  tags: string[];
  photoIds: string[];  // References to IndexedDB
  userId: string;      // References to Supabase
}
localStorage.setItem('events', JSON.stringify(events));

// TIER 2: IndexedDB (large files)
interface PhotoStorage {
  id: string;
  eventId: string;
  blob: Blob;
  thumbnail?: Blob;
}
await db.put('photos', photo);

// TIER 3: Supabase (cloud sync)
await supabase.from('events').upsert(event);
await supabase.storage.from('photos').upload(path, file);
```

**Data Flow:**
```typescript
// CREATE: Write to all three
async function createEvent(event: TimelineEvent, photos: File[]) {
  // 1. Upload photos to IndexedDB (fast)
  const photoIds = await Promise.all(
    photos.map(p => savePhotoToIndexedDB(event.id, p))
  );

  // 2. Save metadata to LocalStorage (instant UI update)
  event.photoIds = photoIds;
  const events = getEventsFromLocalStorage();
  events.push(event);
  localStorage.setItem('events', JSON.stringify(events));

  // 3. Sync to Supabase (background, can fail)
  try {
    await supabase.from('events').insert(event);
    for (const photo of photos) {
      await supabase.storage.from('photos').upload(photo);
    }
  } catch (error) {
    console.warn('Cloud sync failed, will retry later', error);
  }
}

// READ: Try local first, fallback to cloud
async function getEvents(): Promise<TimelineEvent[]> {
  // Try LocalStorage first (instant)
  const localEvents = getEventsFromLocalStorage();
  if (localEvents.length > 0) {
    return localEvents;
  }

  // Fallback to Supabase (slower)
  const { data } = await supabase.from('events').select('*');

  // Cache in LocalStorage for next time
  localStorage.setItem('events', JSON.stringify(data));
  return data;
}
```

**Benefits:**
- ✅ Instant UI updates (LocalStorage)
- ✅ Unlimited photo storage (IndexedDB)
- ✅ Multi-device sync (Supabase)
- ✅ Works offline (local storage)
- ✅ Automatic backup (cloud)

**Trade-offs:**
- ⚠️ More complex synchronization logic
- ⚠️ Conflict resolution needed
- ⚠️ Must handle sync failures gracefully

**Lesson:** Use the right storage for each data type. Combine multiple storage methods for optimal UX.

---

### 3. AI API Key Exposure (Security Issue)

**Current State:** API key embedded in client bundle
**Risk Level:** MEDIUM (rate limiting mitigates)
**Timeline:** Move to Edge Functions in v3.0

**Problem:**
```typescript
// .env file (not in git) ✅
VITE_ANTHROPIC_API_KEY=sk-ant-api03-xxx

// But Vite embeds it in bundle ❌
const response = await fetch('https://api.anthropic.com/v1/messages', {
  headers: {
    'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY // Visible in bundle.js
  }
});
```

**How Users Can Extract Key:**
1. Open DevTools → Sources
2. Search for "sk-ant" in bundle.js
3. Copy API key
4. Make unlimited requests on our quota

**Current Mitigation:**
- Rate limiting per user (10 requests/minute)
- Usage monitoring and alerts
- Low-cost tier ($5/month covers ~1000 requests)
- Acceptable for MVP/beta

**Proper Solution (v3.0):**
```typescript
// CLIENT: Call our edge function (no key exposed)
const response = await supabase.functions.invoke('ai-request', {
  body: {
    prompt: 'Suggest event from transcript...',
    parameters: { transcript }
  }
});

// EDGE FUNCTION: Secure server-side
export async function handler(req: Request) {
  // API key never leaves server
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

  // Rate limiting per user
  const user = await getUserFromRequest(req);
  if (!checkRateLimit(user.id)) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  // Proxy to Anthropic
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    headers: { 'x-api-key': apiKey }
  });

  return response;
}
```

**Implementation Plan:**
- [ ] Create Supabase Edge Function
- [ ] Move API key to server environment
- [ ] Implement per-user rate limiting
- [ ] Add usage analytics
- [ ] Update client code to call edge function
- [ ] Test thoroughly
- [ ] Deploy to production
- [ ] Monitor usage and costs

**Lesson:** Never put API keys in client-side code for production. Use server-side proxies with rate limiting.

---

## ✅ Best Practices Established

### 1. Error Handling Pattern
```typescript
// TEMPLATE: Consistent error handling across app
async function performAction() {
  try {
    // Show loading state
    showLoadingSpinner();

    // Attempt operation
    const result = await someAsyncOperation();

    // Success feedback
    showToast('Action completed successfully', 'success');
    return result;

  } catch (error) {
    // Log for debugging
    console.error('Action failed:', error);

    // User-friendly message
    showToast('Action failed. Please try again.', 'error');

    // Optional: Report to monitoring service
    reportError(error);

  } finally {
    // Always cleanup
    hideLoadingSpinner();
  }
}
```

### 2. Toast Notification System
```typescript
// Replaced alert() with toast notifications
function showToast(message: string, type: 'success' | 'error' | 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Slide in
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto dismiss after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Usage throughout app
await supabase.createEvent(event);
showToast('Event created successfully!', 'success');
```

### 3. Defensive Null Checks
```typescript
// ALWAYS check for null/undefined before accessing properties
function renderEvent(event: TimelineEvent | null) {
  // Early return pattern
  if (!event) {
    console.warn('No event to render');
    return;
  }

  // Null coalescing for optional values
  const title = event.title ?? 'Untitled';
  const description = event.description ?? '';
  const tags = event.tags ?? [];

  // Optional chaining for nested properties
  const authorName = event.author?.name ?? 'Unknown';

  // Array length check before access
  const firstPhoto = event.photoIds?.length > 0
    ? event.photoIds[0]
    : null;
}
```

### 4. Undo/Redo System
```typescript
// Track all mutations for undo functionality
interface HistoryAction {
  type: 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT';
  event: TimelineEvent;
  previousEvent?: TimelineEvent;
  timestamp: number;
}

const historyStack: HistoryAction[] = [];
let historyIndex = -1;

function addToHistory(action: HistoryAction) {
  // Remove any redo actions after current index
  historyStack.splice(historyIndex + 1);

  // Add new action
  historyStack.push(action);
  historyIndex++;

  // Limit history size
  if (historyStack.length > 50) {
    historyStack.shift();
    historyIndex--;
  }
}

async function undo() {
  if (historyIndex < 0) return;

  const action = historyStack[historyIndex];
  historyIndex--;

  // Reverse the action
  switch (action.type) {
    case 'CREATE_EVENT':
      await supabase.deleteEvent(action.event.id);
      break;
    case 'UPDATE_EVENT':
      await supabase.updateEvent(action.previousEvent!);
      break;
    case 'DELETE_EVENT':
      await supabase.createEvent(action.event);
      break;
  }

  renderTimeline();
}
```

---

## 📊 Performance Optimizations

### 1. Debounced Search
```typescript
// Avoid excessive API calls during typing
let searchTimeout: number;

function handleSearchInput(query: string) {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(async () => {
    const results = await searchEvents(query);
    renderResults(results);
  }, 300); // Wait 300ms after last keystroke
}
```

### 2. Lazy Loading Photos
```typescript
// Don't load all photos immediately
async function renderTimeline(events: TimelineEvent[]) {
  for (const event of events) {
    // Render event card without photos first
    const card = createEventCard(event);
    container.appendChild(card);

    // Load photos in background
    if (event.photoIds && event.photoIds.length > 0) {
      loadEventPhotos(event.id, event.photoIds).then(photos => {
        updateEventPhotos(event.id, photos);
      });
    }
  }
}
```

### 3. Thumbnail Generation
```typescript
// Generate and cache thumbnails for large images
async function createThumbnail(blob: Blob, maxWidth = 200): Promise<Blob> {
  const img = await createImageBitmap(blob);

  const canvas = document.createElement('canvas');
  const scale = maxWidth / img.width;
  canvas.width = maxWidth;
  canvas.height = img.height * scale;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.7);
  });
}
```

---

## 🔮 Future Improvements (Backlog)

### High Priority
- [ ] Move AI API calls to Supabase Edge Functions
- [ ] Add unit tests (Vitest) for services
- [ ] Implement persistent undo history
- [ ] Add E2E tests (Playwright)
- [ ] Improve error recovery (retry logic)

### Medium Priority
- [ ] Add real-time collaboration sync
- [ ] Implement conflict resolution
- [ ] Add offline mode with sync queue
- [ ] Create mobile app (React Native)
- [ ] Add performance monitoring

### Low Priority
- [ ] Video upload support
- [ ] Audio recording
- [ ] Map view of events
- [ ] Timeline visualization improvements
- [ ] Export to PDF improvements

---

## 📝 Development Checklist

**Before Starting New Feature:**
- [ ] Review this document for relevant lessons
- [ ] Check if similar feature exists to learn from
- [ ] Design error handling strategy
- [ ] Plan for empty/null states
- [ ] Consider mobile UX

**During Development:**
- [ ] Use TypeScript strict mode
- [ ] Add try-catch to async operations
- [ ] Provide loading and error states
- [ ] Test with empty data
- [ ] Test with large datasets

**Before Committing:**
- [ ] Run `npm run build` locally
- [ ] Test in both Chrome and Edge
- [ ] Check console for errors/warnings
- [ ] Update CHANGELOG.md
- [ ] Test undo/redo if applicable

**Before Deploying:**
- [ ] Test on production Supabase instance
- [ ] Verify environment variables on Render
- [ ] Check OAuth redirect URIs
- [ ] Test authentication flow
- [ ] Monitor error logs after deploy

---

## 🎓 Team Knowledge

### Code Review Focus Areas
1. **Null safety:** Check for null/undefined handling
2. **Error handling:** Every async operation wrapped in try-catch
3. **Type safety:** No `any` types without good reason
4. **Performance:** Debounce user input, lazy load heavy resources
5. **Security:** No API keys in client code

### Common Mistakes to Watch For
- Attaching event listeners before DOM elements exist
- Reusing rich text editor instances
- Storing large data in LocalStorage
- Missing error handling on async operations
- Hardcoded URLs instead of environment variables

### Quick Wins
- Always provide user feedback (toasts, loading spinners)
- Test with empty state (new users)
- Add keyboard shortcuts for power users
- Use semantic HTML and ARIA labels
- Provide undo for destructive actions

---

## 🔗 Related Documentation

- [../LESSONS_LEARNED.md](../LESSONS_LEARNED.md) - General lessons across all projects
- [CHANGELOG.md](CHANGELOG.md) - Full version history
- [COLLABORATION.md](COLLABORATION.md) - Multi-user architecture
- [AI_FEATURES.md](AI_FEATURES.md) - AI integration guide
- [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) - Deployment instructions

---

**Remember:** These lessons were learned through real bugs that affected real users. Take time to internalize them before building new features.

**Last Updated:** October 12, 2025
**Next Review:** After v3.0 release or next major issue

---

*"Experience is the name everyone gives to their mistakes."* - Oscar Wilde
