import { supabase } from '@/services/supabase';
import { createEvent } from "./services/events";
import { claude } from '@/services/claude';
import { invitationService } from '@/services/invitations';
import { googlePhotosService } from '@/services/google-photos';
import { documentImportService } from '@/services/document-import';
import { googleDrive } from '@/services/google-drive';
import { deduplicationService } from '@/services/deduplication';
import type { User, Timeline, TimelineEvent } from '@/types';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './style.css';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// App state
let currentUser: User | null = null;
let currentTimeline: Timeline | null = null;
let userTimelines: Timeline[] = []; // All user's timelines
let events: TimelineEvent[] = [];
let quill: Quill | null = null;
let currentTags: string[] = [];
let currentPhotos: string[] = [];
let editingEventId: string | null = null;
let currentConnections: string[] = []; // Event IDs to connect

// AI / Voice state (v2.3.0)
if (claude.isEnabled()) {
  console.log('ðŸ¤– AI features enabled');
}

// Web Speech API
let recognition: any = null;
let isRecording = false;
let recordedTranscript = '';

// Initialize Web Speech API
function initSpeechRecognition() {
  const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('Web Speech API not supported in this browser');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    recordedTranscript = transcript;
    updateTranscriptDisplay();
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
    showToast(`Recording error: ${event.error}`, 'error');
  };

  recognition.onend = () => {
    if (isRecording) {
      recognition.start(); // Restart if still recording
    }
  };

  return true;
}

// Filter state
let searchQuery = '';
let filterDateFrom = '';
let filterDateTo = '';
let filterTags: string[] = [];

// Store event connections
let eventConnections: Map<string, string[]> = new Map();

// Undo/Redo state
interface HistoryAction {
  type: 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT';
  event: TimelineEvent;
  previousEvent?: TimelineEvent; // For updates
  timestamp: number;
}

let historyStack: HistoryAction[] = [];
let historyIndex: number = -1;
const MAX_HISTORY = 50;

// Initialize app
async function init() {
  // Check for invitation tokens in URL
  const urlParams = new URLSearchParams(window.location.search);
  const eventInviteToken = urlParams.get('invite');
  const timelineInviteToken = urlParams.get('timeline-invite');

  // Check for existing session
  const user = await supabase.getCurrentUser();
  currentUser = user as User | null;

  if (currentUser) {
    // If user is logged in and has invitation tokens, accept them
    if (eventInviteToken) {
      await handleInvitationAcceptance(eventInviteToken);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (timelineInviteToken) {
      await handleTimelineInvitationAcceptance(timelineInviteToken);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    await loadUserData();
    showApp();
  } else {
    // Show landing page first for new visitors
    showLandingPage();
  }

  // Listen for auth changes
  supabase.onAuthStateChange(async (user) => {
    currentUser = user as User | null;
    if (user) {
      // Check for invitation tokens after login
      const urlParams = new URLSearchParams(window.location.search);
      const eventInviteToken = urlParams.get('invite');
      const timelineInviteToken = urlParams.get('timeline-invite');

      if (eventInviteToken) {
        await handleInvitationAcceptance(eventInviteToken);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (timelineInviteToken) {
        await handleTimelineInvitationAcceptance(timelineInviteToken);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      await loadUserData();
      showApp();
    } else {
      showLandingPage();
    }
  });
}

// Handle invitation acceptance
async function handleInvitationAcceptance(token: string) {
  showToast('Processing invitation...', 'info');

  const result = await invitationService.acceptInvitation(token);

  if (result.success) {
    showToast('✅ Invitation accepted! You now have access to the shared timeline.', 'success');
    // The shared timeline will appear when we load user data
  } else {
    showToast(`❌ ${result.error || 'Failed to accept invitation'}`, 'error');
  }
}

// Handle timeline invitation acceptance
async function handleTimelineInvitationAcceptance(token: string) {
  showToast('Processing timeline invitation...', 'info');

  const result = await supabase.acceptTimelineEmailInvitation(token);

  if (result.data) {
    showToast('✅ Timeline invitation accepted! You now have access to the shared timeline.', 'success');
    // The shared timeline will appear when we load user data
  } else {
    showToast(`❌ ${result.error?.message || 'Failed to accept timeline invitation'}`, 'error');
  }
}

// Load user's timelines and events
async function loadUserData() {
  console.log('loadUserData() called, currentUser:', currentUser);

  if (!currentUser) {
    console.error('loadUserData: No current user!');
    return;
  }

  try {
    // Ensure user record exists in public.users
    const authUser = await supabase.getCurrentUser();
    if (authUser) {
      await supabase.ensureUserRecord(authUser);
    }

    // Get user's timelines
    const { data: timelines, error: timelineError } = await supabase.getUserTimelines(currentUser.id);

    if (timelineError) {
      console.error('Error loading timelines:', timelineError);
      alert('Error loading timelines. Please refresh the page.');
      return;
    }

    console.log('Loaded timelines:', timelines);

    // If no timelines exist, create default personal timeline
    if (!timelines || timelines.length === 0) {
      console.log('No timelines found, creating default...');
      const { data: newTimeline, error: createError } = await supabase.createTimeline({
        name: 'My Story',
        owner_id: currentUser.id,
        type: 'personal',
      });

      if (createError) {
        console.error('Error creating timeline:', createError);
        alert('Error creating timeline. Please check your database permissions.');
        return;
      }

      console.log('Created new timeline:', newTimeline);
      userTimelines = [newTimeline];
      currentTimeline = newTimeline;
    } else {
      userTimelines = timelines;
      // Use saved timeline or first one
      const savedTimelineId = localStorage.getItem('currentTimelineId');
      currentTimeline = timelines.find(t => t.id === savedTimelineId) || timelines[0];
      console.log('Selected timeline:', currentTimeline);
    }

    // Load events for current timeline
    if (currentTimeline) {
      const { data: timelineEvents, error: eventsError } = await supabase.getEvents(currentTimeline.id);

      if (eventsError) {
        console.error('Error loading events:', eventsError);
        // Don't return - just set empty events array
        events = [];
      } else {
        events = timelineEvents || [];
        console.log('Loaded events:', events.length);

        // Load photos for each event
        for (const event of events) {
          const { data: photos } = await supabase.getEventPhotos(event.id);
          (event as any).photos = photos || [];
        }

        // Load event connections
        await loadConnections();
      }
    } else {
      console.error('No currentTimeline set after loading!');
    }

    // Load pending timeline invitations
    if (currentUser.email) {
      const { data: pendingInvites } = await supabase.getPendingTimelineInvitations(currentUser.email);
      (window as any).pendingTimelineInvitations = pendingInvites || [];
    }
  } catch (error) {
    console.error('Fatal error in loadUserData:', error);
    alert('Error loading your data. Please refresh the page.');
  }
}

// Show modern landing page
function showLandingPage() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="landing-page">
      <!-- Navigation -->
      <nav class="landing-nav">
        <div class="nav-container">
          <div class="nav-logo">
            <span class="nav-icon">📖</span>
            <span class="nav-title">Record Your Story</span>
          </div>
          <div class="nav-actions">
            <button id="nav-signin" class="btn btn-ghost">Sign In</button>
            <button id="nav-get-started" class="btn btn-primary">Get Started</button>
          </div>
        </div>
      </nav>

      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-container">
          <div class="hero-content">
            <h1 class="hero-title">
              Your Life's Story,<br>
              <span class="hero-highlight">Beautifully Organized</span>
            </h1>
            <p class="hero-subtitle">
              Transform your memories into a stunning timeline. Use AI to capture stories from voice,
              documents, and photos. Share your legacy with family and friends.
            </p>
            <div class="hero-cta">
              <button id="hero-cta-primary" class="btn btn-primary btn-lg">
                Start Your Timeline
              </button>
              <button id="hero-cta-secondary" class="btn btn-secondary btn-lg">
                Watch Demo
              </button>
            </div>
            <div class="hero-stats">
              <div class="stat">
                <span class="stat-number">10K+</span>
                <span class="stat-label">Stories Created</span>
              </div>
              <div class="stat">
                <span class="stat-number">50K+</span>
                <span class="stat-label">Memories Preserved</span>
              </div>
              <div class="stat">
                <span class="stat-number">4.9★</span>
                <span class="stat-label">User Rating</span>
              </div>
            </div>
          </div>
          <div class="hero-visual">
            <div class="hero-illustration">
              <img src="/illustrations/hero-timeline.svg" alt="Interactive timeline visualization showing memory connections" />
            </div>
          </div>
        </div>
      </section>

      <!-- Features Section -->
      <section class="features-section">
        <div class="container">
          <div class="section-header">
            <h2>Everything You Need to Preserve Your Story</h2>
            <p>Powerful AI features make capturing and organizing your memories effortless</p>
          </div>

          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon">🎤</div>
              <h3>Voice-to-Story</h3>
              <p>Speak naturally and let AI transform your words into beautifully written events. No typing required.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">📄</div>
              <h3>Document Import</h3>
              <p>Upload journals, letters, or notes. AI automatically extracts and organizes your life events.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">📷</div>
              <h3>Photo Integration</h3>
              <p>Import memories directly from Google Photos with automatic event creation and metadata extraction.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">👥</div>
              <h3>Family Collaboration</h3>
              <p>Share timelines with family members. Everyone can contribute their perspective to your shared story.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">🤖</div>
              <h3>AI Enhancement</h3>
              <p>Get writing suggestions, auto-tagging, and smart connections between related events.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">📊</div>
              <h3>Timeline Summary</h3>
              <p>AI generates narrative summaries of your life, highlighting key themes and milestones.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Social Proof -->
      <section class="testimonials-section">
        <div class="container">
          <div class="section-header">
            <h2>Loved by Families Worldwide</h2>
          </div>

          <div class="testimonials-grid">
            <div class="testimonial-card">
              <div class="testimonial-content">
                "Record Your Story helped us preserve our family history in a way that brings tears to our eyes. The AI features made it so easy to capture stories we thought we'd forgotten."
              </div>
              <div class="testimonial-author">
                <div class="author-avatar">👩‍👧‍👦</div>
                <div class="author-info">
                  <div class="author-name">Sarah Johnson</div>
                  <div class="author-title">Family Historian</div>
                </div>
              </div>
            </div>

            <div class="testimonial-card">
              <div class="testimonial-content">
                "The voice recording feature is incredible. I can just speak my memories and the AI turns them into beautiful, well-written stories. It's like having a personal biographer."
              </div>
              <div class="testimonial-author">
                <div class="author-avatar">👴</div>
                <div class="author-info">
                  <div class="author-name">Robert Chen</div>
                  <div class="author-title">Retired Teacher</div>
                </div>
              </div>
            </div>

            <div class="testimonial-card">
              <div class="testimonial-content">
                "Sharing our timeline with the kids has brought our family closer. They love reading about their childhood and learning about our history."
              </div>
              <div class="testimonial-author">
                <div class="author-avatar">👨‍👩‍👧‍👦</div>
                <div class="author-info">
                  <div class="author-name">Maria & David Rodriguez</div>
                  <div class="author-title">Parents of 3</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA Section -->
      <section class="cta-section">
        <div class="container">
          <div class="cta-content">
            <h2>Ready to Start Your Story?</h2>
            <p>Join thousands of families preserving their most precious memories</p>
            <button id="final-cta" class="btn btn-primary btn-lg">
              Create Your Timeline Free
            </button>
            <p class="cta-note">No credit card required • Free forever plan available</p>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="container">
          <div class="footer-content">
            <div class="footer-logo">
              <span class="nav-icon">📖</span>
              <span class="nav-title">Record Your Story</span>
            </div>
            <div class="footer-links">
              <a href="#privacy">Privacy</a>
              <a href="#terms">Terms</a>
              <a href="#support">Support</a>
            </div>
            <div class="footer-copyright">
              © 2024 Record Your Story. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Event listeners
  document.getElementById('nav-signin')?.addEventListener('click', showAuth);
  document.getElementById('nav-get-started')?.addEventListener('click', showAuth);
  document.getElementById('hero-cta-primary')?.addEventListener('click', showAuth);
  document.getElementById('hero-cta-secondary')?.addEventListener('click', () => {
    // Placeholder for demo video
    alert('Demo video coming soon!');
  });
  document.getElementById('final-cta')?.addEventListener('click', showAuth);
}

// Show authentication UI
function showAuth() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Record Your Story</h1>
        <p class="tagline">Your life, your timeline, your story</p>

        <div id="auth-form">
          <input type="email" id="email" placeholder="Email" required />
          <input type="password" id="password" placeholder="Password" required />

          <div class="auth-buttons">
            <button id="signup-btn" class="btn btn-primary">Sign Up</button>
            <button id="signin-btn" class="btn btn-secondary">Sign In</button>
          </div>

          <div class="divider">or</div>

          <button id="google-btn" class="btn btn-google">
            Sign in with Google
          </button>
        </div>

        <div id="auth-message" class="message"></div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('signup-btn')?.addEventListener('click', handleSignUp);
  document.getElementById('signin-btn')?.addEventListener('click', handleSignIn);
  document.getElementById('google-btn')?.addEventListener('click', handleGoogleSignIn);
}

// Show main app UI
function showApp() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App element not found!');
    return;
  }

  // Defensive checks
  if (!currentUser) {
    console.error('No current user!');
    showAuth();
    return;
  }

  if (!currentTimeline) {
    console.error('No current timeline!');
    return;
  }

  try {
    app.innerHTML = `
      <div class="app-container">
        <header class="app-header">
          <h1>Record Your Story</h1>
          <div class="timeline-switcher">
            <select id="timeline-select" class="timeline-dropdown">
              ${(userTimelines || []).map(t => `
                <option value="${t.id}" ${t.id === currentTimeline?.id ? 'selected' : ''}>
                  ${t.name} (${t.type})
                </option>
              `).join('')}
            </select>
            <button id="new-timeline-btn" class="btn btn-small" title="Create Timeline">+ Timeline</button>
          </div>
          <div class="header-actions">
            <button id="undo-btn" class="btn btn-secondary btn-small" title="Undo (Ctrl+Z)" disabled style="opacity: 0.5;">↶ Undo</button>
            <button id="redo-btn" class="btn btn-secondary btn-small" title="Redo (Ctrl+Y)" disabled style="opacity: 0.5;">↷ Redo</button>
            <button id="export-pdf-btn" class="btn btn-secondary btn-small" title="Export to PDF">
              <img src="/icons/export-timeline.svg" alt="Export" class="icon icon-sm" />
              Export PDF
            </button>
            ${((window as any).pendingTimelineInvitations || []).length > 0 ? `<button id="pending-invitations-btn" class="btn btn-primary btn-small" title="Pending Timeline Invitations">📩 ${((window as any).pendingTimelineInvitations || []).length}</button>` : ''}
            <button id="theme-toggle" class="theme-toggle">🌙</button>
            <span class="user-email">${currentUser?.email || 'User'}</span>
            <button id="signout-btn" class="btn btn-small">Sign Out</button>
          </div>
        </header>

      <main class="app-main">
        <div class="timeline-header">
          <h2>${currentTimeline?.name || 'My Story'}</h2>
          <div class="timeline-actions">
            ${claude.isEnabled() ? '<button id="ai-summarize-btn" class="btn btn-secondary btn-small" title="AI Timeline Summary">🤖 Summarize</button>' : ''}
            ${claude.isEnabled() ? '<button id="import-journal-btn" class="btn btn-secondary btn-small" title="Import Journal/Documents">📝 Import Journal</button>' : ''}
            <button id="import-google-photos-btn" class="btn btn-secondary btn-small" title="Import from Google Photos">
              <img src="/icons/photo-upload.svg" alt="Import Photos" class="icon icon-sm" />
              Import Photos
            </button>
            <button id="share-timeline-btn" class="btn btn-secondary btn-small" title="Share Timeline">
              <img src="/icons/share-timeline.svg" alt="Share" class="icon icon-sm" />
              Share
            </button>
            <button id="add-event-btn" class="btn btn-primary">
              <img src="/icons/add-memory.svg" alt="Add" class="icon icon-sm" />
              Add Event
            </button>
          </div>
        </div>

        <div class="search-filter-bar">
          <div style="position: relative;">
            <img src="/icons/search-memories.svg" alt="Search" class="icon icon-sm" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); pointer-events: none;" />
            <input type="text" id="search-input" placeholder="Search events..." value="${searchQuery}" style="padding-left: 40px;" />
          </div>
          <input type="date" id="date-from" placeholder="From" value="${filterDateFrom}" />
          <input type="date" id="date-to" placeholder="To" value="${filterDateTo}" />
          <button id="clear-filters" class="btn btn-secondary btn-small">Clear Filters</button>
        </div>

        <div id="timeline" class="timeline">
          ${events.length === 0
            ? `
              <div class="empty-state">
                <img src="/illustrations/empty-timeline.svg" alt="Empty timeline illustration" />
                <h3>Start Your Memory Journey</h3>
                <p>Your timeline is waiting for your first story. Every memory matters.</p>
                <button id="empty-add-event-btn" class="btn btn-primary">
                  <img src="/icons/add-memory.svg" alt="Add" class="icon icon-sm" />
                  Add Your First Memory
                </button>
              </div>
            `
            : renderTimeline()
          }
        </div>
      </main>

      <div id="event-modal" class="modal hidden">
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>Add Event</h3>
            <button id="modal-close" class="modal-close">&times;</button>
          </div>
          <form id="event-form">
            <input type="text" id="event-title" placeholder="Event Title" required />
            <input type="date" id="event-date" required />

            <label>Description</label>
            <div class="voice-recording-section">
              <button type="button" id="voice-record-btn" class="btn btn-secondary btn-small">🎤 Record Story</button>
              ${claude.isEnabled() ? '<button type="button" id="enhance-btn" class="btn btn-secondary btn-small">✨ Enhance with AI</button>' : ''}
              <div id="recording-indicator" class="recording-indicator" style="display: none;">
                <span class="pulse-dot"></span>
                <span>Recording...</span>
              </div>
            </div>
            <div id="transcript-display" class="transcript-display" style="display: none;"></div>
            <div id="editor-container"></div>

            <label>Photos</label>
            <div id="photo-drop-zone" class="photo-drop-zone">
              <div class="drop-zone-content">
                <span class="drop-zone-icon">📸</span>
                <p>Drag & drop photos here</p>
                <p class="drop-zone-or">or</p>
                <label for="photo-upload" class="btn btn-secondary btn-small">Browse Files</label>
              </div>
              <input type="file" id="photo-upload" accept="image/*" multiple style="display: none;" />
            </div>
            <div id="photo-preview" class="photo-preview"></div>

            <label>Tags</label>
            <input type="text" id="event-tags" placeholder="Type and press Enter to add tags" />
            <div id="tags-display" class="tags-display"></div>

            <label>🔗 Connected Events</label>
            <div id="connections-panel">
              <button type="button" id="add-connection-btn" class="btn btn-secondary btn-small">+ Link Event</button>
              ${claude.isEnabled() ? '<button type="button" id="ai-suggest-connections-btn" class="btn btn-secondary btn-small">🤖 Suggest Links</button>' : ''}
              <div id="connections-display" class="connections-display"></div>
            </div>

            <div class="invitation-section">
              <label class="checkbox-label">
                <input type="checkbox" id="invite-checkbox" />
                <span>📧 Invite someone to see this event</span>
              </label>
              <div id="invitation-fields" class="invitation-fields" style="display: none;">
                <input
                  type="email"
                  id="invite-email"
                  placeholder="friend@example.com"
                  class="invite-input"
                />
                <select id="invite-type" class="invite-select">
                  <option value="view">View only</option>
                  <option value="collaborate">Can collaborate</option>
                </select>
                <p class="invitation-hint">
                  💡 They'll receive an email invitation to sign up and view your timeline.
                  Perfect for sharing memories with family and friends!
                </p>
              </div>
            </div>

            <div class="modal-actions">
              <button type="submit" class="btn btn-primary">Save Event</button>
              <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      <div id="ai-suggestions-modal" class="modal hidden">
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>🤖 AI Event Suggestions</h3>
            <button id="ai-modal-close" class="modal-close">&times;</button>
          </div>
          <div class="ai-suggestions-content">
            <p class="transcript-label">📝 Your story:</p>
            <div id="ai-transcript" class="ai-transcript"></div>

            <div id="ai-loading" class="ai-loading">
              <div class="spinner"></div>
              <p>Analyzing your story...</p>
            </div>

            <div id="ai-suggestions" class="ai-suggestions" style="display: none;">
              <h4>✨ Suggested Event Details:</h4>
              <div class="suggestion-field">
                <label>Title:</label>
                <p id="suggested-title"></p>
              </div>
              <div class="suggestion-field">
                <label>Date:</label>
                <p id="suggested-date"></p>
              </div>
              <div class="suggestion-field">
                <label>Description:</label>
                <p id="suggested-description"></p>
              </div>
              <div class="suggestion-field">
                <label>Tags:</label>
                <div id="suggested-tags" class="tags-display"></div>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" id="accept-suggestions-btn" class="btn btn-primary" style="display: none;">✅ Accept & Fill Form</button>
              <button type="button" id="reject-suggestions-btn" class="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

    // Event listeners
    document.getElementById('signout-btn')?.addEventListener('click', handleSignOut);
    document.getElementById('add-event-btn')?.addEventListener('click', () => showEventModal());
    document.getElementById('import-google-photos-btn')?.addEventListener('click', handleGooglePhotosImport);
    document.getElementById('import-journal-btn')?.addEventListener('click', showDocumentImportModal);
    document.getElementById('ai-summarize-btn')?.addEventListener('click', showAISummaryModal);
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // Search and filter listeners
    document.getElementById('search-input')?.addEventListener('input', handleSearch);
    document.getElementById('date-from')?.addEventListener('change', handleDateFilter);
    document.getElementById('date-to')?.addEventListener('change', handleDateFilter);
    document.getElementById('clear-filters')?.addEventListener('click', clearFilters);

    // Timeline switcher listeners
    document.getElementById('timeline-select')?.addEventListener('change', handleTimelineSwitch);
    document.getElementById('new-timeline-btn')?.addEventListener('click', showCreateTimelineModal);
    document.getElementById('share-timeline-btn')?.addEventListener('click', showShareTimelineModal);

    // Export listener
    document.getElementById('export-pdf-btn')?.addEventListener('click', exportToPDF);

    // Pending invitations listener
    document.getElementById('pending-invitations-btn')?.addEventListener('click', showPendingInvitationsModal);

    // Undo/Redo listeners
    document.getElementById('undo-btn')?.addEventListener('click', undo);
    document.getElementById('redo-btn')?.addEventListener('click', redo);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl/Cmd shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (e.key === 'n') {
          e.preventDefault();
          showEventModal();
        } else if (e.key === 'k') {
          e.preventDefault();
          document.getElementById('search-input')?.focus();
        } else if (e.key === 'p') {
          e.preventDefault();
          exportToPDF();
        } else if (e.key === 's') {
          e.preventDefault();
          // Save is handled by form submit, just prevent browser save
        }
      }

      // Non-modifier shortcuts (only when not in input)
      if (!isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '?') {
          e.preventDefault();
          showKeyboardShortcuts();
        } else if (e.key === 'Escape') {
          // Close any open modals
          hideEventModal();
          const shortcutsModal = document.getElementById('shortcuts-modal');
          if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
            shortcutsModal.classList.add('hidden');
          }
        }
      }
    });

    // Attach event card listeners (edit, delete, tags)
    attachTimelineEventListeners();

    initTheme();
    updateUndoRedoButtons();
  } catch (error) {
    console.error('Error rendering app:', error);
    app.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <h2>Something went wrong</h2>
        <p>Please refresh the page or <button onclick="location.reload()" style="background: #7266FF; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Click here to reload</button></p>
        <pre style="text-align: left; background: #f5f5f5; padding: 16px; border-radius: 8px; margin-top: 20px;">${error}</pre>
      </div>
    `;
  }
}

// Get filtered events
function getFilteredEvents(): TimelineEvent[] {
  return events.filter(event => {
    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = event.title.toLowerCase().includes(query);
      const matchesDescription = event.description?.toLowerCase().includes(query);
      const matchesTags = event.tags?.some(tag => tag.toLowerCase().includes(query));

      if (!matchesTitle && !matchesDescription && !matchesTags) {
        return false;
      }
    }

    // Date range filter
    if (filterDateFrom && new Date(event.date) < new Date(filterDateFrom)) {
      return false;
    }
    if (filterDateTo && new Date(event.date) > new Date(filterDateTo)) {
      return false;
    }

    // Tag filter
    if (filterTags.length > 0) {
      const hasTag = filterTags.some(filterTag =>
        event.tags?.includes(filterTag)
      );
      if (!hasTag) return false;
    }

    return true;
  });
}

// Render timeline events
function renderTimeline(): string {
  const filteredEvents = getFilteredEvents();

  if (filteredEvents.length === 0) {
    return `
      <div class="empty-state">
        <img src="/illustrations/empty-search.svg" alt="No search results illustration" />
        <h3>No Memories Found</h3>
        <p>No events match your current filters. Try different keywords or adjust your date range.</p>
        <button id="clear-search-filters-btn" class="btn btn-secondary">
          <img src="/icons/filter-memories.svg" alt="Clear filters" class="icon icon-sm" />
          Clear Filters
        </button>
      </div>
    `;
  }

  // Sort events by date (newest first)
  const sortedEvents = filteredEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let html = '';
  let lastYear: number | null = null;

  sortedEvents.forEach(event => {
    const eventDate = new Date(event.date);
    const eventYear = eventDate.getFullYear();

    // Add year separator if year changed
    if (lastYear !== eventYear) {
      html += `<div class="timeline-year-marker">${eventYear}</div>`;
      lastYear = eventYear;
    }

    const eventWithPhotos = event as any;
    html += `
      <div class="timeline-event" data-id="${event.id}">
        <div class="timeline-dot"></div>
        <div class="event-card">
          <div class="event-date">${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          <div class="event-content">
            <h3>
              ${event.title}
              ${eventConnections.has(event.id) && eventConnections.get(event.id)!.length > 0
                ? `<span class="connection-badge" title="Connected to ${eventConnections.get(event.id)!.length} event(s)">
                    🔗 ${eventConnections.get(event.id)!.length}
                  </span>`
                : ''
              }
            </h3>
            <div class="event-description">${event.description || ''}</div>
            ${eventWithPhotos.photos && eventWithPhotos.photos.length > 0
              ? `<div class="event-photos">
                  ${eventWithPhotos.photos.map((photo: any) => `
                    <img src="${photo.data}" alt="Event photo" class="event-photo" />
                  `).join('')}
                </div>`
              : ''
            }
            ${event.tags && event.tags.length > 0
              ? `<div class="event-tags">${event.tags.map(tag => `
                <span class="tag clickable-tag" data-tag="${tag}">${tag}</span>
              `).join('')}</div>`
              : ''
            }
            <div class="event-actions">
              <button class="btn-icon edit-btn" data-id="${event.id}" title="Edit" aria-label="Edit event">
                <img src="/icons/edit-memory.svg" alt="Edit" class="icon icon-sm" />
              </button>
              <button class="btn-icon delete-btn" data-id="${event.id}" title="Delete" aria-label="Delete event">
                <img src="/icons/delete-memory.svg" alt="Delete" class="icon icon-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  return html;
}

// Voice recording functions
function startRecording() {
  if (!recognition) {
    const initialized = initSpeechRecognition();
    if (!initialized) {
      showToast('Voice recording not supported in this browser. Try Chrome or Edge.', 'error');
      return;
    }
  }

  try {
    recordedTranscript = '';
    isRecording = true;
    recognition.start();
    updateRecordingUI(true);
    showToast('🎤 Recording started...', 'info');
  } catch (error) {
    console.error('Failed to start recording:', error);
    showToast('Failed to start recording', 'error');
    isRecording = false;
  }
}

function stopRecording() {
  if (recognition && isRecording) {
    isRecording = false;
    recognition.stop();
    updateRecordingUI(false);
    showToast('Recording stopped', 'info');

    // If we have a transcript, offer AI suggestions
    if (recordedTranscript.trim().length > 20) {
      showAISuggestionsModal();
    } else {
      showToast('Transcript too short. Try recording again.', 'error');
    }
  }
}

function updateRecordingUI(recording: boolean) {
  const btn = document.getElementById('voice-record-btn');
  const indicator = document.getElementById('recording-indicator');

  if (btn) {
    btn.textContent = recording ? '⏹️ Stop Recording' : '🎤 Record Story';
    btn.classList.toggle('recording', recording);
  }

  if (indicator) {
    indicator.style.display = recording ? 'flex' : 'none';
  }
}

function updateTranscriptDisplay() {
  const display = document.getElementById('transcript-display');
  if (display) {
    display.textContent = recordedTranscript;
    display.style.display = recordedTranscript ? 'block' : 'none';
  }
}

// Show AI suggestions modal
async function showAISuggestionsModal() {
  const modal = document.getElementById('ai-suggestions-modal');
  if (!modal) return;

  modal.classList.remove('hidden');

  // Display transcript
  const transcriptEl = document.getElementById('ai-transcript');
  if (transcriptEl) {
    transcriptEl.textContent = recordedTranscript;
  }

  // Show loading state
  const loadingEl = document.getElementById('ai-loading');
  const suggestionsEl = document.getElementById('ai-suggestions');
  const acceptBtn = document.getElementById('accept-suggestions-btn');

  if (loadingEl) loadingEl.style.display = 'block';
  if (suggestionsEl) suggestionsEl.style.display = 'none';
  if (acceptBtn) acceptBtn.style.display = 'none';

  try {
    // Call Claude AI to analyze transcript
    const result = await claude.suggestEventFromTranscript(recordedTranscript);

    if (result.error) {
      showToast(result.error, 'error');
      hideAISuggestionsModal();
      return;
    }

    // Hide loading, show suggestions
    if (loadingEl) loadingEl.style.display = 'none';
    if (suggestionsEl) suggestionsEl.style.display = 'block';
    if (acceptBtn) acceptBtn.style.display = 'block';

    // Display suggestions
    const titleEl = document.getElementById('suggested-title');
    const dateEl = document.getElementById('suggested-date');
    const descEl = document.getElementById('suggested-description');
    const tagsEl = document.getElementById('suggested-tags');

    if (titleEl && result.title) titleEl.textContent = result.title;
    if (dateEl && result.date) dateEl.textContent = result.date;
    if (descEl && result.description) descEl.textContent = result.description;
    if (tagsEl && result.tags) {
      tagsEl.innerHTML = result.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('');
    }

    // Store suggestions for later
    (window as any).__aiSuggestions = result;

  } catch (error) {
    console.error('AI suggestions failed:', error);
    showToast('AI analysis failed. Please try again.', 'error');
    hideAISuggestionsModal();
  }

  // Event listeners
  document.getElementById('ai-modal-close')?.addEventListener('click', hideAISuggestionsModal);
  document.getElementById('reject-suggestions-btn')?.addEventListener('click', hideAISuggestionsModal);
  document.getElementById('accept-suggestions-btn')?.addEventListener('click', acceptAISuggestions);
  document.querySelector('#ai-suggestions-modal .modal-overlay')?.addEventListener('click', hideAISuggestionsModal);
}

// Hide AI suggestions modal
function hideAISuggestionsModal() {
  const modal = document.getElementById('ai-suggestions-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Accept AI suggestions and fill event form
function acceptAISuggestions() {
  const suggestions = (window as any).__aiSuggestions;
  if (!suggestions) return;

  // Close AI modal
  hideAISuggestionsModal();

  // Fill the event form
  if (suggestions.title) {
    (document.getElementById('event-title') as HTMLInputElement).value = suggestions.title;
  }

  if (suggestions.date) {
    (document.getElementById('event-date') as HTMLInputElement).value = suggestions.date;
  }

  if (suggestions.description && quill) {
    quill.setText(suggestions.description);
  }

  if (suggestions.tags) {
    currentTags = [...suggestions.tags];
    renderTags();
  }

  showToast('✅ Form filled with AI suggestions', 'success');
}

// Show event modal (for create or edit)
function showEventModal(eventId?: string) {
  const modal = document.getElementById('event-modal');
  if (!modal) return;

  editingEventId = eventId || null;
  modal.classList.remove('hidden');

  // If editing, load event data
  if (eventId) {
    const event = events.find(e => e.id === eventId);
    if (event) {
      (document.getElementById('event-title') as HTMLInputElement).value = event.title;
      (document.getElementById('event-date') as HTMLInputElement).value = event.date;
      currentTags = [...(event.tags || [])];

      // Load photos
      const eventWithPhotos = event as any;
      currentPhotos = eventWithPhotos.photos?.map((p: any) => p.data) || [];

      // Load connections
      currentConnections = eventConnections.get(eventId) || [];

      // Update modal title
      const modalTitle = modal.querySelector('h3');
      if (modalTitle) modalTitle.textContent = 'Edit Event';
    }
  } else {
    // Reset for new event
    (document.getElementById('event-title') as HTMLInputElement).value = '';
    (document.getElementById('event-date') as HTMLInputElement).value = '';
    currentTags = [];
    currentPhotos = [];
    currentConnections = [];

    const modalTitle = modal.querySelector('h3');
    if (modalTitle) modalTitle.textContent = 'Add Event';
  }

  // Initialize Quill editor
  setTimeout(() => {
    const container = document.getElementById('editor-container');
    if (container) {
      // Always recreate Quill when modal opens
      quill = new Quill('#editor-container', {
        theme: 'snow',
        placeholder: 'Tell your story... (use toolbar to format text)',
        modules: {
          toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['link'],
            ['clean']
          ]
        }
      });

      // Set description if editing
      if (eventId) {
        const event = events.find(e => e.id === eventId);
        if (event?.description) {
          quill.root.innerHTML = event.description;
        }
      }
    }

    // Render tags, photos, and connections
    renderTags();
    renderPhotoPreview();
    renderConnections();
  }, 100);

  // Event listeners
  document.getElementById('modal-close')?.addEventListener('click', hideEventModal);
  document.getElementById('cancel-btn')?.addEventListener('click', hideEventModal);
  document.getElementById('event-form')?.addEventListener('submit', handleEventSubmit);
  document.getElementById('event-tags')?.addEventListener('keypress', handleTagInput);
  document.getElementById('photo-upload')?.addEventListener('change', handlePhotoUpload);
  document.getElementById('add-connection-btn')?.addEventListener('click', showConnectionPicker);
  document.getElementById('ai-suggest-connections-btn')?.addEventListener('click', handleAISuggestConnections);
  document.querySelector('.modal-overlay')?.addEventListener('click', hideEventModal);

  // Voice recording listener
  document.getElementById('voice-record-btn')?.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  // AI Enhancement listener
  document.getElementById('enhance-btn')?.addEventListener('click', handleEnhanceEvent);

  // Invitation checkbox listener
  document.getElementById('invite-checkbox')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    const fields = document.getElementById('invitation-fields');
    if (fields) {
      fields.style.display = checked ? 'block' : 'none';
    }
  });

  // Drag & drop listeners
  setupDragAndDrop();

  // Make drop zone clickable to trigger file input
  document.getElementById('photo-drop-zone')?.addEventListener('click', () => {
    document.getElementById('photo-upload')?.click();
  });
}

// Hide event modal
function hideEventModal() {
  const modal = document.getElementById('event-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  currentTags = [];
  currentPhotos = [];
  if (quill) {
    quill.setText('');
  }
}

// Handle tag input
function handleTagInput(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const tag = input.value.trim();

    if (tag && !currentTags.includes(tag)) {
      currentTags.push(tag);
      renderTags();
      input.value = '';
    }
  }
}

// Render tags
function renderTags() {
  const tagsDisplay = document.getElementById('tags-display');
  if (!tagsDisplay) return;

  tagsDisplay.innerHTML = currentTags
    .map(tag => `
      <span class="tag">
        ${tag}
        <button type="button" class="tag-remove" data-tag="${tag}">&times;</button>
      </span>
    `)
    .join('');

  // Add remove listeners
  tagsDisplay.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tagToRemove = (e.target as HTMLElement).dataset.tag;
      currentTags = currentTags.filter(t => t !== tagToRemove);
      renderTags();
    });
  });
}

// Setup drag & drop for photos
function setupDragAndDrop() {
  const dropZone = document.getElementById('photo-drop-zone');
  if (!dropZone) return;

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Highlight drop zone when dragging over
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove('drag-over');
    });
  });

  // Handle dropped files
  dropZone.addEventListener('drop', (e: DragEvent) => {
    const files = e.dataTransfer?.files;
    if (files) {
      handleFiles(files);
    }
  });
}

// Handle photo upload (from input or drag-drop)
function handlePhotoUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files) {
    handleFiles(files);
  }
}

// Process uploaded files
function handleFiles(files: FileList) {
  Array.from(files).forEach(file => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert(`${file.name} is not an image file`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      currentPhotos.push(dataUrl);
      renderPhotoPreview();
    };
    reader.readAsDataURL(file);
  });
}

// Render photo preview
function renderPhotoPreview() {
  const preview = document.getElementById('photo-preview');
  if (!preview) return;

  preview.innerHTML = currentPhotos
    .map((photo, index) => `
      <div class="photo-item">
        <img src="${photo}" alt="Preview" />
        <button type="button" class="photo-remove" data-index="${index}">&times;</button>
      </div>
    `)
    .join('');

  // Add remove listeners
  preview.querySelectorAll('.photo-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt((e.target as HTMLElement).dataset.index || '0');
      currentPhotos.splice(index, 1);
      renderPhotoPreview();
    });
  });
}

// Connection handlers
// AI Suggest Connections
async function handleAISuggestConnections() {
  if (!claude.isEnabled()) {
    showToast('Claude AI not enabled', 'error');
    return;
  }

  const titleInput = document.getElementById('event-title') as HTMLInputElement;
  const title = titleInput?.value.trim();

  if (!title) {
    showToast('Please add a title first', 'info');
    return;
  }

  if (!quill) {
    showToast('Editor not ready', 'error');
    return;
  }

  const description = quill.getText().trim();

  if (!description) {
    showToast('Please add a description for better suggestions', 'info');
    return;
  }

  if (events.length < 2) {
    showToast('Need at least 2 events to suggest connections', 'info');
    return;
  }

  const suggestBtn = document.getElementById('ai-suggest-connections-btn') as HTMLButtonElement;
  if (suggestBtn) {
    suggestBtn.disabled = true;
    suggestBtn.textContent = 'ðŸ¤– Analyzing...';
  }

  try {
    const currentEvent = {
      id: editingEventId || 'new',
      title,
      description,
      date: (document.getElementById('event-date') as HTMLInputElement)?.value || '',
      tags: currentTags
    };

    const allEvents = events.map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      tags: e.tags || []
    }));

    const result = await claude.suggestConnections(currentEvent, allEvents);

    if (result.error) {
      showToast(result.error, 'error');
      return;
    }

    if (!result.connections || result.connections.length === 0) {
      showToast('No related events found', 'info');
      return;
    }

    // Add high-confidence suggestions to connections
    const highConfidenceLinks = result.connections.filter(c => c.confidence >= 60);

    if (highConfidenceLinks.length === 0) {
      showToast('No strong connections found', 'info');
      return;
    }

    highConfidenceLinks.forEach(conn => {
      if (!currentConnections.includes(conn.eventId)) {
        currentConnections.push(conn.eventId);
      }
    });

    renderConnections();
    showToast(`✨ Added ${highConfidenceLinks.length} AI-suggested connection(s)!`, 'success');

  } catch (error) {
    console.error('AI connection error:', error);
    showToast('Failed to suggest connections', 'error');
  } finally {
    if (suggestBtn) {
      suggestBtn.disabled = false;
      suggestBtn.textContent = 'ðŸ¤– Suggest Links';
    }
  }
}

function showConnectionPicker() {
  const connectionsDisplay = document.getElementById('connections-display');
  if (!connectionsDisplay) return;

  // Get events excluding current one being edited
  const availableEvents = events.filter(e => e.id !== editingEventId && !currentConnections.includes(e.id));

  if (availableEvents.length === 0) {
    alert('No other events available to link!');
    return;
  }

  const pickerHtml = `
    <div class="connection-picker">
      <h4>Select events to link:</h4>
      <div class="event-list">
        ${availableEvents.map(event => `
          <div class="connection-option">
            <input type="checkbox" id="conn-${event.id}" value="${event.id}" />
            <label for="conn-${event.id}">
              <strong>${event.title}</strong> - ${new Date(event.date).toLocaleDateString()}
            </label>
          </div>
        `).join('')}
      </div>
      <button type="button" id="save-connections-btn" class="btn btn-primary btn-small">Add Selected</button>
    </div>
  `;

  connectionsDisplay.innerHTML = pickerHtml;

  document.getElementById('save-connections-btn')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.connection-option input:checked');
    checkboxes.forEach(cb => {
      const eventId = (cb as HTMLInputElement).value;
      if (!currentConnections.includes(eventId)) {
        currentConnections.push(eventId);
      }
    });
    renderConnections();
  });
}

function renderConnections() {
  const connectionsDisplay = document.getElementById('connections-display');
  if (!connectionsDisplay) return;

  if (currentConnections.length === 0) {
    connectionsDisplay.innerHTML = '<p class="empty-text">No connected events yet</p>';
    return;
  }

  connectionsDisplay.innerHTML = currentConnections
    .map(connId => {
      const event = events.find(e => e.id === connId);
      if (!event) return '';
      return `
        <div class="connection-item">
          <span>🔗 ${event.title} (${new Date(event.date).toLocaleDateString()})</span>
          <button type="button" class="remove-connection" data-id="${connId}">&times;</button>
        </div>
      `;
    })
    .join('');

  // Add remove listeners
  connectionsDisplay.querySelectorAll('.remove-connection').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const connId = (e.target as HTMLElement).dataset.id;
      currentConnections = currentConnections.filter(id => id !== connId);
      renderConnections();
    });
  });
}

// Save connections to database
async function saveConnections(eventId: string) {
  if (currentConnections.length === 0) return;

  for (const connectedEventId of currentConnections) {
    // Create bi-directional connection
    const { error } = await supabase.createEventConnection(eventId, connectedEventId);

    if (!error) {
      // Store in local map
      if (!eventConnections.has(eventId)) {
        eventConnections.set(eventId, []);
      }
      if (!eventConnections.get(eventId)!.includes(connectedEventId)) {
        eventConnections.get(eventId)!.push(connectedEventId);
      }

      // Bi-directional
      if (!eventConnections.has(connectedEventId)) {
        eventConnections.set(connectedEventId, []);
      }
      if (!eventConnections.get(connectedEventId)!.includes(eventId)) {
        eventConnections.get(connectedEventId)!.push(eventId);
      }
    }
  }
}

// Load connections from database
async function loadConnections() {
  const eventIds = events.map(e => e.id);
  const { data, error } = await supabase.getEventConnections(eventIds);

  if (!error && data) {
    eventConnections.clear();
    data.forEach((conn: any) => {
      if (!eventConnections.has(conn.event_id_1)) {
        eventConnections.set(conn.event_id_1, []);
      }
      if (!eventConnections.get(conn.event_id_1)!.includes(conn.event_id_2)) {
        eventConnections.get(conn.event_id_1)!.push(conn.event_id_2);
      }

      if (!eventConnections.has(conn.event_id_2)) {
        eventConnections.set(conn.event_id_2, []);
      }
      if (!eventConnections.get(conn.event_id_2)!.includes(conn.event_id_1)) {
        eventConnections.get(conn.event_id_2)!.push(conn.event_id_1);
      }
    });
  }
}

// Toggle theme
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');

  const icon = document.getElementById('theme-toggle');
  if (icon) {
    icon.textContent = isDark ? 'â˜€ï¸' : 'ðŸŒ™';
  }
}

// Init theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.getElementById('theme-toggle');
    if (icon) {
      icon.textContent = 'â˜€ï¸';
    }
  }
}

// Auth handlers
async function handleSignUp() {
  const email = (document.getElementById('email') as HTMLInputElement)?.value;
  const password = (document.getElementById('password') as HTMLInputElement)?.value;

  if (!email || !password) return;

  const { data, error } = await supabase.signUp(email, password);

  if (error) {
    showMessage(`Error: ${error.message}`, 'error');
  } else {
    // Check if user is confirmed
    if (data?.user?.email_confirmed_at || data?.session) {
      showMessage('Account created! Signing you in...', 'success');
      // User is auto-confirmed and signed in
      const user = await supabase.getCurrentUser();
      currentUser = user as User | null;
      if (currentUser) {
        await loadUserData();
        showApp();
        initTheme();
      }
    } else {
      showMessage('Account created! Please sign in.', 'success');
    }
  }
}

async function handleSignIn() {
  const email = (document.getElementById('email') as HTMLInputElement)?.value;
  const password = (document.getElementById('password') as HTMLInputElement)?.value;

  if (!email || !password) return;

  const { error } = await supabase.signIn(email, password);

  if (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
}

async function handleGoogleSignIn() {
  const { error } = await supabase.signInWithGoogle();

  if (error) {
    showMessage(`Error: ${error.message}`, 'error');
  }
}

async function handleSignOut() {
  const { error } = await supabase.signOut();

  if (error) {
    console.error('Error signing out:', error);
  }
}

// Handle Google Photos import
async function handleGooglePhotosImport() {
  if (!currentTimeline) {
    showToast('No timeline selected', 'error');
    return;
  }

  try {
    // Show confirmation dialog
    const maxPhotos = prompt(
      'How many photos would you like to import from Google Photos?\n\n' +
      'Note: Each photo will create a new event on your timeline.\n' +
      'Recommended: Start with 10-20 photos.',
      '20'
    );

    if (!maxPhotos) return; // User cancelled

    const count = parseInt(maxPhotos);
    if (isNaN(count) || count < 1 || count > 100) {
      showToast('Please enter a number between 1 and 100', 'error');
      return;
    }

    showToast('ðŸ” Requesting Google Photos authorization...', 'info');

    // Authorize with Google
    await googlePhotosService.authorize();

    showToast('ðŸ“¥ Importing photos... This may take a minute.', 'info');

    // Import photos
    const result = await googlePhotosService.importPhotos(
      currentTimeline.id,
      count,
      (imported, total) => {
        showToast(`Imported ${imported} of ${total} photos...`, 'info');
      }
    );

    if (result.success) {
      showToast(
        `✅ Successfully imported ${result.imported} photos!${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        'success'
      );

      // Reload events to show new photos
      await loadUserData();
      showApp();
    } else {
      showToast(`❌ Import failed: ${result.error}`, 'error');
    }

  } catch (error) {
    console.error('Google Photos import error:', error);
    showToast(`❌ Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
  }
}

// Handle AI Event Enhancement
async function handleEnhanceEvent() {
  if (!claude.isEnabled()) {
    showToast('Claude AI not enabled. Add VITE_ANTHROPIC_API_KEY to enable.', 'error');
    return;
  }

  const titleInput = document.getElementById('event-title') as HTMLInputElement;
  const title = titleInput?.value.trim();

  if (!title) {
    showToast('Please add a title first', 'info');
    return;
  }

  if (!quill) {
    showToast('Editor not ready', 'error');
    return;
  }

  const description = quill.root.innerHTML;

  if (!description || description === '<p><br></p>') {
    showToast('Please add a description first', 'info');
    return;
  }

  const enhanceBtn = document.getElementById('enhance-btn') as HTMLButtonElement;
  if (enhanceBtn) {
    enhanceBtn.disabled = true;
    enhanceBtn.textContent = '✨ Enhancing...';
  }

  try {
    const result = await claude.enhanceEvent(title, quill.getText());

    if (result.error) {
      showToast(result.error, 'error');
      return;
    }

    // Update title if improved
    if (result.improvedTitle && titleInput) {
      titleInput.value = result.improvedTitle;
    }

    // Update description if improved
    if (result.improvedDescription && quill) {
      quill.root.innerHTML = `<p>${result.improvedDescription}</p>`;
    }

    // Add suggested tags
    if (result.suggestedTags && result.suggestedTags.length > 0) {
      currentTags = [...new Set([...currentTags, ...result.suggestedTags])];
      renderTags();
    }

    showToast('✨ Event enhanced with AI!', 'success');

  } catch (error) {
    console.error('Enhancement error:', error);
    showToast('Failed to enhance event', 'error');
  } finally {
    if (enhanceBtn) {
      enhanceBtn.disabled = false;
      enhanceBtn.textContent = '✨ Enhance with AI';
    }
  }
}

// Event form handler
async function handleEventSubmit(e: SubmitEvent) {
  e.preventDefault();

  const title = (document.getElementById('event-title') as HTMLInputElement)?.value;
  const date = (document.getElementById('event-date') as HTMLInputElement)?.value;
  const description = quill?.root.innerHTML || '';

  if (!title || !date || !currentTimeline || !currentUser) return;

  if (editingEventId) {
    // Update existing event
    const previousEvent = events.find(e => e.id === editingEventId);

    const { data, error } = await supabase.updateEvent(editingEventId, {
      title,
      date,
      description,
      tags: currentTags,
    });

    if (error) {
      showToast(`Error updating event: ${error.message}`, 'error');
    } else if (data) {
      // Add to history
      if (previousEvent) {
        addToHistory({
          type: 'UPDATE_EVENT',
          event: data,
          previousEvent: { ...previousEvent },
          timestamp: Date.now()
        });
      }

      // Delete old photos and save new ones
      await supabase.deleteEventPhotos(editingEventId);
      if (currentPhotos.length > 0) {
        await supabase.saveEventPhotos(editingEventId, currentPhotos);
      }

      // Update in local array
      const index = events.findIndex(e => e.id === editingEventId);
      if (index !== -1) {
        events[index] = data;
        (events[index] as any).photos = currentPhotos.map((data, i) => ({ data, order: i }));
      }

      // Save connections
      await saveConnections(editingEventId);

      hideEventModal();
      refreshTimeline();
      initTheme();
      showToast('Event updated successfully!', 'success');
    }
  } else {
    // Create new event
    const newEvent = {
      title,
      date,
      description,
      tags: currentTags,
      author_id: currentUser.id,
      timeline_id: currentTimeline.id,
      visibility: 'private' as const,
    };

    const { data, error } = await supabase.createEvent(newEvent);

    if (error) {
      showToast(`Error creating event: ${error.message}`, 'error');
    } else if (data) {
      // Add to history
      addToHistory({
        type: 'CREATE_EVENT',
        event: data,
        timestamp: Date.now()
      });

      // Save photos if any
      if (currentPhotos.length > 0) {
        await supabase.saveEventPhotos(data.id, currentPhotos);
        (data as any).photos = currentPhotos.map((d, i) => ({ data: d, order: i }));
      }

      // Save connections
      await saveConnections(data.id);

      events.push(data);

      // Handle invitation if checked
      const inviteCheckbox = document.getElementById('invite-checkbox') as HTMLInputElement;
      const inviteEmail = (document.getElementById('invite-email') as HTMLInputElement)?.value;
      const inviteType = (document.getElementById('invite-type') as HTMLSelectElement)?.value as 'view' | 'collaborate';

      if (inviteCheckbox?.checked && inviteEmail && currentUser && currentTimeline) {
        // Send invitation in background (don't block success message)
        sendInvitation(inviteEmail, inviteType, data.title);
      }

      showToast('Event created successfully! ✅', 'success');
      hideEventModal();
      refreshTimeline();
      initTheme();
    }
  }
}

// Send invitation helper
async function sendInvitation(email: string, type: 'view' | 'collaborate', eventTitle: string) {
  if (!currentUser || !currentTimeline) return;

  showToast('📧 Sending invitation...', 'info');

  const result = await invitationService.sendInvitation({
    email,
    senderName: currentUser.email.split('@')[0], // Use email prefix as name
    eventTitle,
    timelineId: currentTimeline.id,
    invitationType: type,
  });

  if (result.success) {
    showToast(`✅ Invitation sent to ${email}`, 'success');
  } else {
    showToast(`âŒ Failed to send invitation: ${result.error}`, 'error');
  }
}

// Delete event handler
async function handleDeleteEvent(eventId: string) {
  if (!confirm('Are you sure you want to delete this event? You can undo this action.')) {
    return;
  }

  const eventToDelete = events.find(e => e.id === eventId);
  if (!eventToDelete) return;

  const { error } = await supabase.deleteEvent(eventId);

  if (error) {
    showToast(`Error deleting event: ${error.message}`, 'error');
  } else {
    // Add to history before removing
    addToHistory({
      type: 'DELETE_EVENT',
      event: { ...eventToDelete },
      timestamp: Date.now()
    });

    events = events.filter(e => e.id !== eventId);
    refreshTimeline();
    showToast('Event deleted successfully', 'success');
  }
}

// Show message helper
function showMessage(text: string, type: 'success' | 'error') {
  const messageEl = document.getElementById('auth-message');
  if (messageEl) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
  }
}

// Search and filter handlers
function handleSearch(e: Event) {
  const input = e.target as HTMLInputElement;
  searchQuery = input.value;
  refreshTimeline();
}

function handleDateFilter() {
  filterDateFrom = (document.getElementById('date-from') as HTMLInputElement)?.value || '';
  filterDateTo = (document.getElementById('date-to') as HTMLInputElement)?.value || '';
  refreshTimeline();
}

function handleTagFilter(tag: string) {
  if (filterTags.includes(tag)) {
    filterTags = filterTags.filter(t => t !== tag);
  } else {
    filterTags.push(tag);
  }
  refreshTimeline();
}

function clearFilters() {
  searchQuery = '';
  filterDateFrom = '';
  filterDateTo = '';
  filterTags = [];

  // Clear input values
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const dateFrom = document.getElementById('date-from') as HTMLInputElement;
  const dateTo = document.getElementById('date-to') as HTMLInputElement;

  if (searchInput) searchInput.value = '';
  if (dateFrom) dateFrom.value = '';
  if (dateTo) dateTo.value = '';

  refreshTimeline();
}

// Handle timeline switch
async function handleTimelineSwitch(e: Event) {
  const select = e.target as HTMLSelectElement;
  const timelineId = select.value;

  // Find and set the selected timeline
  const selectedTimeline = userTimelines.find(t => t.id === timelineId);
  if (!selectedTimeline) return;

  currentTimeline = selectedTimeline;

  // Save preference
  localStorage.setItem('currentTimelineId', timelineId);

  // Reload events for this timeline
  const { data: timelineEvents, error } = await supabase.getEvents(timelineId);

  if (error) {
    console.error('Error loading timeline events:', error);
    showToast('Error loading timeline events', 'error');
    return;
  }

  events = timelineEvents || [];

  // Load photos for events
  for (const event of events) {
    const { data: photos } = await supabase.getEventPhotos(event.id);
    (event as any).photos = photos || [];
  }

  // Load event connections
  await loadConnections();

  // Refresh UI
  showApp();
  showToast(`Switched to "${selectedTimeline.name}"`, 'info');
}

// Show create timeline modal
function showCreateTimelineModal() {
  const app = document.getElementById('app');
  if (!app) return;

  // Create modal HTML
  const modalHtml = `
    <div id="timeline-modal" class="modal">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Create New Timeline</h3>
          <button id="timeline-modal-close" class="modal-close">&times;</button>
        </div>
        <form id="timeline-form">
          <input type="text" id="timeline-name" placeholder="Timeline Name" required />

          <label>Type</label>
          <select id="timeline-type" required>
            <option value="personal">Personal</option>
            <option value="family">Family</option>
            <option value="work">Work</option>
            <option value="shared">Shared</option>
          </select>

          <div class="modal-actions">
            <button type="button" id="timeline-cancel-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Timeline</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Add modal to page
  app.insertAdjacentHTML('beforeend', modalHtml);

  // Event listeners
  document.getElementById('timeline-modal-close')?.addEventListener('click', hideCreateTimelineModal);
  document.getElementById('timeline-cancel-btn')?.addEventListener('click', hideCreateTimelineModal);
  document.getElementById('timeline-form')?.addEventListener('submit', handleCreateTimeline);
  document.querySelector('#timeline-modal .modal-overlay')?.addEventListener('click', hideCreateTimelineModal);
}

// Hide create timeline modal
function hideCreateTimelineModal() {
  const modal = document.getElementById('timeline-modal');
  if (modal) {
    modal.remove();
  }
}

// Handle create timeline
async function handleCreateTimeline(e: Event) {
  e.preventDefault();

  const nameInput = document.getElementById('timeline-name') as HTMLInputElement;
  const typeSelect = document.getElementById('timeline-type') as HTMLSelectElement;

  const name = nameInput.value.trim();
  const type = typeSelect.value as 'personal' | 'family' | 'work' | 'shared';

  if (!name || !currentUser) return;

  // Create timeline
  const { data: newTimeline, error } = await supabase.createTimeline({
    name,
    type,
    owner_id: currentUser.id,
  });

  if (error) {
    console.error('Error creating timeline:', error);
    showToast('Failed to create timeline', 'error');
    return;
  }

  if (newTimeline) {
    // Add to timelines list
    userTimelines.push(newTimeline);

    // Switch to new timeline
    currentTimeline = newTimeline;
    localStorage.setItem('currentTimelineId', newTimeline.id);

    // Clear events (new timeline has none)
    events = [];

    // Refresh UI
    showApp();
    showToast(`Timeline "${name}" created successfully!`, 'success');
  }

  hideCreateTimelineModal();
}

// Attach event listeners to timeline event cards
function attachTimelineEventListeners() {
  // Attach tag click listeners
  document.querySelectorAll('.clickable-tag').forEach(tagEl => {
    tagEl.addEventListener('click', (e) => {
      const tag = (e.target as HTMLElement).dataset.tag;
      if (tag) handleTagFilter(tag);
    });
  });

  // Attach edit button listeners
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const button = e.currentTarget as HTMLElement;
      const eventId = button.dataset.id;
      if (eventId) showEventModal(eventId);
    });
  });

  // Attach delete button listeners
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const button = e.currentTarget as HTMLElement;
      const eventId = button.dataset.id;
      if (eventId) handleDeleteEvent(eventId);
    });
  });
}

function refreshTimeline() {
  const timeline = document.getElementById('timeline');
  if (timeline) {
    timeline.innerHTML = events.length === 0
      ? `
        <div class="empty-state">
          <img src="/illustrations/empty-timeline.svg" alt="Empty timeline illustration" />
          <h3>Start Your Memory Journey</h3>
          <p>Your timeline is waiting for your first story. Every memory matters.</p>
          <button id="empty-add-event-btn" class="btn btn-primary">
            <img src="/icons/add-memory.svg" alt="Add" class="icon icon-sm" />
            Add Your First Memory
          </button>
        </div>
      `
      : renderTimeline();

    // Re-attach all event listeners
    attachTimelineEventListeners();
  }
}

// Show toast notification
function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Add to page
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add action to history
function addToHistory(action: HistoryAction) {
  // Remove any actions after current index (user made new action after undo)
  historyStack = historyStack.slice(0, historyIndex + 1);

  // Add new action
  historyStack.push(action);

  // Limit history size
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  } else {
    historyIndex++;
  }

  updateUndoRedoButtons();
}

// Undo last action
async function undo() {
  if (historyIndex < 0) {
    showToast('Nothing to undo', 'info');
    return;
  }

  const action = historyStack[historyIndex];

  try {
    switch (action.type) {
      case 'CREATE_EVENT':
        // Undo create = delete the event
        await supabase.deleteEvent(action.event.id);
        events = events.filter(e => e.id !== action.event.id);
        showToast(`Undone: Created "${action.event.title}"`, 'info');
        break;

      case 'UPDATE_EVENT':
        // Undo update = restore previous version
        if (action.previousEvent) {
          const { error } = await supabase.updateEvent(action.event.id, action.previousEvent);
          if (!error) {
            const index = events.findIndex(e => e.id === action.event.id);
            if (index !== -1) {
              events[index] = action.previousEvent;
            }
            showToast(`Undone: Edit to "${action.event.title}"`, 'info');
          }
        }
        break;

      case 'DELETE_EVENT':
        // Undo delete = recreate the event
        const { data, error } = await supabase.createEvent(action.event);
        if (!error && data) {
          events.push(data);
          showToast(`Undone: Deleted "${action.event.title}"`, 'info');
        }
        break;
    }

    historyIndex--;
    refreshTimeline();
    updateUndoRedoButtons();
  } catch (error) {
    console.error('Undo failed:', error);
    showToast('Undo failed', 'error');
  }
}

// Redo last undone action
async function redo() {
  if (historyIndex >= historyStack.length - 1) {
    showToast('Nothing to redo', 'info');
    return;
  }

  historyIndex++;
  const action = historyStack[historyIndex];

  try {
    switch (action.type) {
      case 'CREATE_EVENT':
        // Redo create
        const { data: created, error: createError } = await supabase.createEvent(action.event);
        if (!createError && created) {
          events.push(created);
          showToast(`Redone: Created "${action.event.title}"`, 'info');
        }
        break;

      case 'UPDATE_EVENT':
        // Redo update
        const { error: updateError } = await supabase.updateEvent(action.event.id, action.event);
        if (!updateError) {
          const index = events.findIndex(e => e.id === action.event.id);
          if (index !== -1) {
            events[index] = action.event;
          }
          showToast(`Redone: Edit to "${action.event.title}"`, 'info');
        }
        break;

      case 'DELETE_EVENT':
        // Redo delete
        await supabase.deleteEvent(action.event.id);
        events = events.filter(e => e.id !== action.event.id);
        showToast(`Redone: Deleted "${action.event.title}"`, 'info');
        break;
    }

    refreshTimeline();
    updateUndoRedoButtons();
  } catch (error) {
    console.error('Redo failed:', error);
    showToast('Redo failed', 'error');
  }
}

// Update undo/redo button states
function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
  const redoBtn = document.getElementById('redo-btn') as HTMLButtonElement | null;

  if (undoBtn) {
    undoBtn.disabled = historyIndex < 0;
    undoBtn.style.opacity = historyIndex < 0 ? '0.5' : '1';
  }

  if (redoBtn) {
    redoBtn.disabled = historyIndex >= historyStack.length - 1;
    redoBtn.style.opacity = historyIndex >= historyStack.length - 1 ? '0.5' : '1';
  }
}

// Export timeline to PDF
async function exportToPDF() {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Title
  doc.setFontSize(20);
  doc.setTextColor(114, 102, 255); // Purple
  doc.text(currentTimeline?.name || 'My Timeline', pageWidth / 2, 20, { align: 'center' });

  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 28, { align: 'center' });

  let yPos = 40;
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);

  // Sort events by date (oldest first for PDF)
  const sortedEvents = events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const event of sortedEvents) {
    // Check if we need a new page
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    // Date
    doc.setFontSize(10);
    doc.setTextColor(114, 102, 255);
    doc.text(new Date(event.date).toLocaleDateString(), margin, yPos);
    yPos += 6;

    // Title
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    const titleLines = doc.splitTextToSize(event.title, maxWidth);
    doc.text(titleLines, margin, yPos);
    yPos += titleLines.length * 6 + 2;

    // Description (strip HTML)
    if (event.description) {
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = event.description;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const descLines = doc.splitTextToSize(textContent, maxWidth);
      doc.text(descLines, margin, yPos);
      yPos += descLines.length * 5 + 2;
    }

    // Tags
    if (event.tags && event.tags.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Tags: ${event.tags.join(', ')}`, margin, yPos);
      yPos += 5;
    }

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos + 3, pageWidth - margin, yPos + 3);
    yPos += 12;
  }

  // Save PDF
  const filename = `${currentTimeline?.name || 'timeline'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);

  // Show success toast
  showToast('Timeline exported to PDF successfully!', 'success');
}

// Show keyboard shortcuts modal
function showKeyboardShortcuts() {
  const app = document.getElementById('app');
  if (!app) return;

  // Create modal HTML
  const modalHtml = `
    <div id="shortcuts-modal" class="modal">
      <div class="modal-overlay"></div>
      <div class="modal-content shortcuts-modal-content">
        <div class="modal-header">
          <h3>âŒ¨ï¸ Keyboard Shortcuts</h3>
          <button id="shortcuts-modal-close" class="modal-close">&times;</button>
        </div>
        <div class="shortcuts-grid">
          <div class="shortcuts-section">
            <h4>Navigation</h4>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
              <span>Focus Search</span>
            </div>
            <div class="shortcut-item">
              <kbd>Esc</kbd>
              <span>Close Modal</span>
            </div>
            <div class="shortcut-item">
              <kbd>?</kbd>
              <span>Show This Help</span>
            </div>
          </div>

          <div class="shortcuts-section">
            <h4>Actions</h4>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>N</kbd>
              <span>New Event</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>P</kbd>
              <span>Export PDF</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
              <span>Save Event (in modal)</span>
            </div>
          </div>

          <div class="shortcuts-section">
            <h4>Edit</h4>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Z</kbd>
              <span>Undo</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Y</kbd>
              <span>Redo</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
              <span>Redo (Alt)</span>
            </div>
          </div>
        </div>
        <p class="shortcuts-note">ðŸ’¡ On Mac, use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd></p>
      </div>
    </div>
  `;

  // Add modal to page
  app.insertAdjacentHTML('beforeend', modalHtml);

  // Event listeners
  document.getElementById('shortcuts-modal-close')?.addEventListener('click', hideKeyboardShortcuts);
  document.querySelector('#shortcuts-modal .modal-overlay')?.addEventListener('click', hideKeyboardShortcuts);
}

function hideKeyboardShortcuts() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) {
    modal.remove();
  }
}

// Collaboration features
async function showShareTimelineModal() {
  if (!currentTimeline || !currentUser) return;

  const app = document.getElementById('app');
  if (!app) return;

  // Load current shares
  const { data: shares } = await supabase.getTimelineShares(currentTimeline.id);

  const modalHtml = `
    <div id="share-modal" class="modal">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>👥 Share "${currentTimeline.name}"</h3>
          <button id="share-modal-close" class="modal-close">&times;</button>
        </div>

        <div class="share-form">
          <h4>Invite User by Email</h4>
          <form id="invite-form">
            <input type="email" id="invite-email" placeholder="user@example.com" required />
            <select id="invite-permission" required>
              <option value="view">View Only</option>
              <option value="edit">Can Edit</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" class="btn btn-primary btn-small">Send Invitation</button>
          </form>
          <p class="help-text">User must have an account to receive invitations</p>
        </div>

        <div class="shared-users">
          <h4>Shared With</h4>
          <div id="shares-list">
            ${shares && shares.length > 0
              ? shares.map((share: any) => `
                <div class="share-item" data-share-id="${share.id}">
                  <div class="share-info">
                    <span class="share-email">${share.user.email}</span>
                    <select class="share-permission" data-share-id="${share.id}">
                      <option value="view" ${share.permission_level === 'view' ? 'selected' : ''}>View Only</option>
                      <option value="edit" ${share.permission_level === 'edit' ? 'selected' : ''}>Can Edit</option>
                      <option value="admin" ${share.permission_level === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                  </div>
                  <button class="btn-icon remove-share" data-share-id="${share.id}" title="Remove access">🗑️</button>
                </div>
              `).join('')
              : '<p class="empty-text">Not shared with anyone yet</p>'
            }
          </div>
        </div>

        <div class="modal-actions">
          <button id="share-modal-done" class="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  `;

  app.insertAdjacentHTML('beforeend', modalHtml);

  // Event listeners
  document.getElementById('share-modal-close')?.addEventListener('click', hideShareTimelineModal);
  document.getElementById('share-modal-done')?.addEventListener('click', hideShareTimelineModal);
  document.querySelector('#share-modal .modal-overlay')?.addEventListener('click', hideShareTimelineModal);
  document.getElementById('invite-form')?.addEventListener('submit', handleInviteUser);

  // Permission change listeners
  document.querySelectorAll('.share-permission').forEach(select => {
    select.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const shareId = target.dataset.shareId;
      const newPermission = target.value as 'view' | 'edit' | 'admin';

      if (shareId) {
        const { error } = await supabase.updateSharePermission(shareId, newPermission);
        if (error) {
          showToast('Failed to update permission', 'error');
        } else {
          showToast('Permission updated', 'success');
        }
      }
    });
  });

  // Remove share listeners
  document.querySelectorAll('.remove-share').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement;
      const shareId = target.dataset.shareId;

      if (shareId && confirm('Remove this user\'s access to the timeline?')) {
        const { error } = await supabase.removeTimelineShare(shareId);
        if (error) {
          showToast('Failed to remove access', 'error');
        } else {
          showToast('Access removed', 'success');
          // Refresh modal
          hideShareTimelineModal();
          showShareTimelineModal();
        }
      }
    });
  });
}

function hideShareTimelineModal() {
  const modal = document.getElementById('share-modal');
  if (modal) {
    modal.remove();
  }
}

// AI Timeline Summary Modal
async function showAISummaryModal() {
  if (!currentTimeline || events.length === 0) {
    showToast('No events to summarize', 'error');
    return;
  }

  if (!claude.isEnabled()) {
    showToast('Claude AI not enabled. Add VITE_ANTHROPIC_API_KEY to enable.', 'error');
    return;
  }

  const app = document.getElementById('app');
  if (!app) return;

  const modalHtml = `
    <div id="ai-summary-modal" class="modal">
      <div class="modal-overlay"></div>
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header">
          <h3>🤖 AI Timeline Summary</h3>
          <button id="ai-summary-close" class="modal-close">&times;</button>
        </div>

        <div style="padding: 20px;">
          <div id="summary-loading" style="text-align: center; padding: 40px;">
            <div class="spinner" style="margin: 0 auto 20px;"></div>
            <p>🤖 Claude is analyzing your timeline...</p>
          </div>

          <div id="summary-content" style="display: none;">
            <div class="summary-section">
              <h4>📖 Narrative Summary</h4>
              <p id="summary-text" style="line-height: 1.6; color: #444;"></p>
            </div>

            <div class="summary-section" style="margin-top: 24px;">
              <h4>💡 Key Insights</h4>
              <ul id="insights-list" style="line-height: 1.8;"></ul>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button id="summary-done-btn" class="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  `;

  app.insertAdjacentHTML('beforeend', modalHtml);

  // Event listeners
  document.getElementById('ai-summary-close')?.addEventListener('click', hideAISummaryModal);
  document.getElementById('summary-done-btn')?.addEventListener('click', hideAISummaryModal);
  document.querySelector('#ai-summary-modal .modal-overlay')?.addEventListener('click', hideAISummaryModal);

  // Generate summary
  try {
    const eventsData = events.map(e => ({
      title: e.title,
      date: e.date,
      tags: e.tags || []
    }));

    const result = await claude.summarizeTimeline(eventsData);

    const loadingEl = document.getElementById('summary-loading');
    const contentEl = document.getElementById('summary-content');
    const summaryText = document.getElementById('summary-text');
    const insightsList = document.getElementById('insights-list');

    if (result.error) {
      if (loadingEl) loadingEl.innerHTML = `<p style="color: #e74c3c;">Error: ${result.error}</p>`;
      return;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';

    if (summaryText && result.summary) {
      summaryText.textContent = result.summary;
    }

    if (insightsList && result.insights) {
      insightsList.innerHTML = result.insights
        .map(insight => `<li style="margin-bottom: 8px;">${insight}</li>`)
        .join('');
    }

  } catch (error) {
    console.error('AI Summary error:', error);
    const loadingEl = document.getElementById('summary-loading');
    if (loadingEl) {
      loadingEl.innerHTML = `<p style="color: #e74c3c;">Failed to generate summary. Please try again.</p>`;
    }
  }
}

function hideAISummaryModal() {
  const modal = document.getElementById('ai-summary-modal');
  if (modal) {
    modal.remove();
  }
}

// Pending Timeline Invitations Modal
async function showPendingInvitationsModal() {
  const pendingInvites = (window as any).pendingTimelineInvitations || [];

  const app = document.getElementById('app');
  if (!app) return;

  const modalHtml = `
    <div id="pending-invitations-modal" class="modal">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>📩 Pending Timeline Invitations</h3>
          <button id="pending-invitations-close" class="modal-close">&times;</button>
        </div>

        <div style="padding: 20px;">
          ${pendingInvites.length === 0
            ? '<p style="text-align: center; color: #666;">No pending timeline invitations.</p>'
            : pendingInvites.map((invite: any) => `
                <div class="invitation-item" style="
                  border: 1px solid #ddd;
                  border-radius: 8px;
                  padding: 16px;
                  margin-bottom: 16px;
                  background: #f9f9f9;
                ">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                      <h4 style="margin: 0 0 4px 0; color: #333;">"${invite.timeline.name}"</h4>
                      <p style="margin: 0; color: #666; font-size: 14px;">
                        Invited by ${invite.inviter.email} â€¢ ${invite.invitation_type === 'view' ? 'View access' : 'Collaborate access'}
                      </p>
                      <p style="margin: 4px 0 0 0; color: #888; font-size: 12px;">
                        Expires: ${new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button class="accept-invitation-btn btn btn-primary btn-small"
                            data-invite-id="${invite.id}"
                            data-token="${invite.invitation_token}">
                      ✅ Accept
                    </button>
                    <button class="decline-invitation-btn btn btn-secondary btn-small"
                            data-invite-id="${invite.id}">
                      ❌ Decline
                    </button>
                  </div>
                </div>
              `).join('')
          }
        </div>

        <div class="modal-actions">
          <button id="pending-invitations-done" class="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  `;

  app.insertAdjacentHTML('beforeend', modalHtml);

  // Event listeners
  document.getElementById('pending-invitations-close')?.addEventListener('click', hidePendingInvitationsModal);
  document.getElementById('pending-invitations-done')?.addEventListener('click', hidePendingInvitationsModal);
  document.querySelector('#pending-invitations-modal .modal-overlay')?.addEventListener('click', hidePendingInvitationsModal);

  // Accept/decline listeners
  document.querySelectorAll('.accept-invitation-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const token = target.getAttribute('data-token');
      if (token) {
        const result = await supabase.acceptTimelineEmailInvitation(token);
        if (result.data) {
          showToast('✅ Timeline invitation accepted!', 'success');
          // Remove from pending list
          const inviteId = target.getAttribute('data-invite-id');
          (window as any).pendingTimelineInvitations = (window as any).pendingTimelineInvitations.filter((inv: any) => inv.id !== inviteId);
          // Refresh UI
          hidePendingInvitationsModal();
          showApp();
        } else {
          showToast(`âŒ ${result.error?.message || 'Failed to accept invitation'}`, 'error');
        }
      }
    });
  });

  document.querySelectorAll('.decline-invitation-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      const inviteId = target.getAttribute('data-invite-id');
      if (inviteId) {
        const result = await supabase.declineTimelineEmailInvitation(inviteId);
        if (!result.error) {
          showToast('Invitation declined', 'info');
          // Remove from pending list
          (window as any).pendingTimelineInvitations = (window as any).pendingTimelineInvitations.filter((inv: any) => inv.id !== inviteId);
          // Refresh UI
          hidePendingInvitationsModal();
          showApp();
        } else {
          showToast('Failed to decline invitation', 'error');
        }
      }
    });
  });
}

function hidePendingInvitationsModal() {
  const modal = document.getElementById('pending-invitations-modal');
  if (modal) {
    modal.remove();
  }
}

// Document Import Modal
async function showDocumentImportModal() {
  if (!currentTimeline) {
    showToast('Please select a timeline first', 'error');
    return;
  }

  if (!claude.isEnabled()) {
    showToast('Claude AI not enabled. Add VITE_ANTHROPIC_API_KEY to enable document import.', 'error');
    return;
  }

  const app = document.getElementById('app');
  if (!app) return;

  const modalHtml = `
    <div id="document-import-modal" class="modal">
      <div class="modal-overlay"></div>
      <div class="modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h3>📝 Import Journal/Documents</h3>
          <button id="doc-import-close" class="modal-close">&times;</button>
        </div>

        <div style="padding: 20px;">
          <p style="color: #666; margin-bottom: 20px;">
            Upload text files, journal entries, or documents. AI will analyze them and extract life events for your timeline.
          </p>

          <!-- Import source tabs -->
          <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid #eee;">
            <button id="tab-upload" class="import-tab active" style="
              flex: 1;
              padding: 12px;
              border: none;
              background: none;
              cursor: pointer;
              font-weight: 500;
              border-bottom: 3px solid #6c5b7b;
              color: #6c5b7b;
            ">
              ðŸ“¤ Upload Files
            </button>
            <button id="tab-drive" class="import-tab" style="
              flex: 1;
              padding: 12px;
              border: none;
              background: none;
              cursor: pointer;
              font-weight: 500;
              border-bottom: 3px solid transparent;
              color: #666;
            ">
              ðŸ“ Google Drive
            </button>
          </div>

          <!-- Upload panel -->
          <div id="upload-panel">
            <div id="upload-zone" style="
            border: 2px dashed #ccc;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            background: #f9f9f9;
          ">
            <div style="font-size: 48px; margin-bottom: 12px;">📄</div>
            <p style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">
              Drop files here or click to browse
            </p>
            <p style="font-size: 14px; color: #888;">
              Supports: .txt, .docx, .pdf, .json
            </p>
            <input
              type="file"
              id="file-input"
              multiple
              accept=".txt,.docx,.pdf,.json"
              style="display: none;"
            />
          </div>

          <div id="file-list" style="margin-top: 20px; display: none;">
            <h4 style="margin-bottom: 12px;">Selected Files:</h4>
            <div id="files-container"></div>
          </div>
          </div>

          <!-- Google Drive panel -->
          <div id="drive-panel" style="display: none;">
            <div id="drive-auth-section" style="text-align: center; padding: 40px;">
              <div style="font-size: 48px; margin-bottom: 12px;">📁</div>
              <h4 style="margin-bottom: 16px;">Connect to Google Drive</h4>
              <p style="color: #666; margin-bottom: 24px;">
                Access your documents from Google Drive and import them to your timeline.
              </p>
              <button id="connect-drive-btn" class="btn btn-primary">
                Connect Google Drive
              </button>
            </div>

            <div id="drive-files-section" style="display: none;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h4>Your Documents</h4>
                <button id="disconnect-drive-btn" style="
                  background: none;
                  border: none;
                  color: #e74c3c;
                  cursor: pointer;
                  font-size: 14px;
                  text-decoration: underline;
                ">Disconnect</button>
              </div>

              <div id="drive-files-list" style="
                max-height: 400px;
                overflow-y: auto;
                border: 1px solid #ddd;
                border-radius: 8px;
              ">
                <div id="drive-files-loading" style="text-align: center; padding: 40px;">
                  <div class="spinner" style="margin: 0 auto 16px;"></div>
                  <p>Loading documents...</p>
                </div>
                <div id="drive-files-container" style="display: none;"></div>
              </div>

              <button id="import-selected-drive-btn" class="btn btn-primary" style="margin-top: 16px; display: none;">
                Import Selected Files
              </button>
            </div>
          </div>

          <div id="analysis-progress" style="display: none; margin-top: 20px;">
            <div style="text-align: center; padding: 20px;">
              <div class="spinner" style="margin: 0 auto 16px;"></div>
              <p id="progress-text">Analyzing documents...</p>
              <div style="background: #e0e0e0; border-radius: 4px; height: 8px; margin-top: 12px; overflow: hidden;">
                <div id="progress-bar" style="background: #4CAF50; height: 100%; width: 0%; transition: width 0.3s;"></div>
              </div>
            </div>
          </div>

          <div id="events-preview" style="display: none; margin-top: 20px;">
            <h4 style="margin-bottom: 12px;">📋 Extracted Events Preview:</h4>
            <div id="preview-container" style="
              max-height: 400px;
              overflow-y: auto;
              border: 1px solid #ddd;
              border-radius: 8px;
              padding: 16px;
            "></div>
            <p style="margin-top: 12px; font-size: 14px; color: #666;">
              Review the extracted events below. You can import them all or cancel.
            </p>
          </div>
        </div>

        <div class="modal-actions">
          <button id="import-events-btn" class="btn btn-primary" style="display: none;">
            ✅ Import All Events
          </button>
          <button id="cancel-import-btn" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  app.insertAdjacentHTML('beforeend', modalHtml);

  // Get elements
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const fileList = document.getElementById('file-list');
  const filesContainer = document.getElementById('files-container');
  const uploadPanel = document.getElementById('upload-panel');
  const drivePanel = document.getElementById('drive-panel');
  const tabUpload = document.getElementById('tab-upload');
  const tabDrive = document.getElementById('tab-drive');

  let selectedFiles: File[] = [];
  let extractedEvents: any[] = [];
  let selectedDriveFiles: string[] = []; // Drive file IDs

  // Tab switching
  function switchTab(tab: 'upload' | 'drive') {
    if (tab === 'upload') {
      uploadPanel!.style.display = 'block';
      drivePanel!.style.display = 'none';
      tabUpload!.style.borderBottom = '3px solid #6c5b7b';
      tabUpload!.style.color = '#6c5b7b';
      tabDrive!.style.borderBottom = '3px solid transparent';
      tabDrive!.style.color = '#666';
    } else {
      uploadPanel!.style.display = 'none';
      drivePanel!.style.display = 'block';
      tabUpload!.style.borderBottom = '3px solid transparent';
      tabUpload!.style.color = '#666';
      tabDrive!.style.borderBottom = '3px solid #6c5b7b';
      tabDrive!.style.color = '#6c5b7b';

      // Check if already authenticated
      if (googleDrive.isAuthenticated()) {
        showDriveFiles();
      }
    }
  }

  tabUpload?.addEventListener('click', () => switchTab('upload'));
  tabDrive?.addEventListener('click', () => switchTab('drive'));

  // Click to browse
  uploadZone?.addEventListener('click', () => fileInput?.click());

  // Drag and drop handlers
  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '#4CAF50';
    uploadZone.style.background = '#f0f8f0';
  });

  uploadZone?.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = '#ccc';
    uploadZone.style.background = '#f9f9f9';
  });

  uploadZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = '#ccc';
    uploadZone.style.background = '#f9f9f9';

    const files = Array.from(e.dataTransfer?.files || []);
    handleFileSelection(files);
  });

  // File input change
  fileInput?.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    handleFileSelection(files);
  });

  function handleFileSelection(files: File[]) {
    selectedFiles = files;

    if (files.length === 0) return;

    // Show file list
    if (fileList && filesContainer) {
      fileList.style.display = 'block';
      filesContainer.innerHTML = files.map((file, idx) => `
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f5f5f5;
          border-radius: 4px;
          margin-bottom: 8px;
        ">
          <div>
            <strong>${file.name}</strong>
            <span style="color: #888; margin-left: 12px; font-size: 14px;">
              ${(file.size / 1024).toFixed(1)} KB
            </span>
          </div>
          <button class="remove-file-btn" data-idx="${idx}" style="
            background: none;
            border: none;
            color: #e74c3c;
            cursor: pointer;
            font-size: 20px;
            padding: 0 8px;
          ">&times;</button>
        </div>
      `).join('');

      // Add remove handlers
      document.querySelectorAll('.remove-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0');
          selectedFiles.splice(idx, 1);
          handleFileSelection(selectedFiles);
        });
      });
    }

    // Auto-start analysis
    analyzeDocuments();
  }

  async function analyzeDocuments() {
    const progressSection = document.getElementById('analysis-progress');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');

    if (progressSection) progressSection.style.display = 'block';

    try {
      const result = await documentImportService.processDocuments(
        selectedFiles,
        (current, total) => {
          if (progressText) {
            progressText.textContent = `Analyzing ${current}/${total} documents...`;
          }
          if (progressBar) {
            progressBar.style.width = `${(current / total) * 70}%`;
          }
        }
      );

      if (!result.success || result.allEvents.length === 0) {
        if (progressSection) progressSection.style.display = 'none';
        showToast(result.errors[0] || 'No events found in documents', 'error');
        return;
      }

      // Check for duplicates
      if (progressText) progressText.textContent = 'Checking for duplicates...';
      if (progressBar) progressBar.style.width = '75%';

      const dedupResult = await deduplicationService.deduplicateEvents(
        result.allEvents,
        events,
        (current, total) => {
          if (progressText) {
            progressText.textContent = `Checking duplicates ${current}/${total}...`;
          }
          if (progressBar) {
            progressBar.style.width = `${75 + (current / total) * 25}%`;
          }
        }
      );

      if (progressSection) progressSection.style.display = 'none';

      // Show preview with dedup info
      extractedEvents = dedupResult.unique;
      showEventsPreview(extractedEvents);

      // Show deduplication results
      if (dedupResult.duplicates.length > 0) {
        showToast(
          `Found ${result.allEvents.length} events, removed ${dedupResult.duplicates.length} duplicates`,
          'info'
        );
      } else if (result.errors.length > 0) {
        showToast(`Processed ${result.processed} files, ${result.failed} failed`, 'warning');
      } else {
        showToast(`Found ${extractedEvents.length} unique events in ${result.processed} documents`, 'success');
      }

    } catch (error: any) {
      console.error('Document analysis error:', error);
      if (progressSection) progressSection.style.display = 'none';
      showToast('Failed to analyze documents: ' + error.message, 'error');
    }
  }

  function showEventsPreview(events: any[]) {
    const previewSection = document.getElementById('events-preview');
    const previewContainer = document.getElementById('preview-container');
    const importBtn = document.getElementById('import-events-btn');

    if (previewSection) previewSection.style.display = 'block';
    if (importBtn) importBtn.style.display = 'inline-block';

    if (previewContainer) {
      previewContainer.innerHTML = events.map((event, idx) => `
        <div style="
          padding: 12px;
          border-bottom: 1px solid #eee;
          ${idx === events.length - 1 ? 'border-bottom: none;' : ''}
        ">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <strong style="font-size: 16px;">${event.title}</strong>
            <span style="
              background: ${event.confidence > 80 ? '#4CAF50' : event.confidence > 50 ? '#FF9800' : '#999'};
              color: white;
              padding: 2px 8px;
              border-radius: 4px;
              font-size: 12px;
            ">${event.confidence}% confidence</span>
          </div>
          <div style="color: #666; font-size: 14px; margin-bottom: 8px;">
            📅 ${event.date === 'unknown' ? 'Date unknown' : event.date}
          </div>
          <div style="font-size: 14px; line-height: 1.5; margin-bottom: 8px;">
            ${event.description}
          </div>
          ${event.tags && event.tags.length > 0 ? `
            <div style="margin-top: 8px;">
              ${event.tags.map((tag: string) => `
                <span style="
                  background: #e3f2fd;
                  color: #1976d2;
                  padding: 2px 8px;
                  border-radius: 12px;
                  font-size: 12px;
                  margin-right: 6px;
                ">${tag}</span>
              `).join('')}
            </div>
          ` : ''}
          <details style="margin-top: 8px; font-size: 13px; color: #888;">
            <summary style="cursor: pointer;">Source text</summary>
            <div style="margin-top: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px; font-style: italic;">
              "${event.sourceText}"
            </div>
          </details>
        </div>
      `).join('');
    }
  }

  // Import events button
  document.getElementById('import-events-btn')?.addEventListener('click', async () => {
    await importEvents(extractedEvents);
  });

  async function importEvents(events: any[]) {
    const importBtn = document.getElementById('import-events-btn');
    if (importBtn) {
      importBtn.textContent = 'Importing...';
      (importBtn as HTMLButtonElement).disabled = true;
    }

    try {
      let imported = 0;
      let failed = 0;

      for (const event of events) {
        try {
          await createEvent({
            title: event.title,
            dateISO: event.date === 'unknown' ? new Date().toISOString().split('T')[0] : event.date,
            description: event.description,
            tags: event.tags || [],
          });
          imported++;
        } catch (error) {
          console.error('Failed to import event:', event.title, error);
          failed++;
        }
      }

      hideDocumentImportModal();

      if (failed === 0) {
        showToast(`Successfully imported ${imported} events!`, 'success');
      } else {
        showToast(`Imported ${imported} events, ${failed} failed`, 'warning');
      }

      // Reload events
      await loadUserData();

    } catch (error: any) {
      console.error('Import error:', error);
      showToast('Failed to import events: ' + error.message, 'error');

      if (importBtn) {
        importBtn.textContent = 'âœ“ Import All Events';
        (importBtn as HTMLButtonElement).disabled = false;
      }
    }
  }

  // Google Drive functions
  async function connectDrive() {
    if (!googleDrive.isEnabled()) {
      showToast('Google Drive not configured. Add VITE_GOOGLE_DRIVE_CLIENT_ID to enable.', 'error');
      return;
    }

    try {
      await googleDrive.authorize();
      await showDriveFiles();
    } catch (error: any) {
      console.error('Drive authorization error:', error);
      showToast(error.message || 'Failed to connect to Google Drive', 'error');
    }
  }

  async function showDriveFiles() {
    const authSection = document.getElementById('drive-auth-section');
    const filesSection = document.getElementById('drive-files-section');
    const filesLoading = document.getElementById('drive-files-loading');
    const filesContainer = document.getElementById('drive-files-container');

    if (authSection) authSection.style.display = 'none';
    if (filesSection) filesSection.style.display = 'block';
    if (filesLoading) filesLoading.style.display = 'block';
    if (filesContainer) filesContainer.style.display = 'none';

    try {
      const files = await googleDrive.listDocuments({
        maxResults: 50
      });

      if (filesLoading) filesLoading.style.display = 'none';
      if (filesContainer) {
        filesContainer.style.display = 'block';

        if (files.length === 0) {
          filesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #888;">
              <p>No documents found in your Google Drive.</p>
              <p style="font-size: 14px; margin-top: 8px;">We're looking for .txt, .docx, .pdf, and Google Docs files.</p>
            </div>
          `;
        } else {
          filesContainer.innerHTML = files.map(file => `
            <div class="drive-file-item" data-file-id="${file.id}" style="
              display: flex;
              align-items: center;
              padding: 12px;
              border-bottom: 1px solid #eee;
              cursor: pointer;
              transition: background 0.2s;
            " onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
              <input type="checkbox" class="drive-file-checkbox" data-file-id="${file.id}" style="margin-right: 12px;" />
              <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">${file.name}</div>
                <div style="font-size: 13px; color: #888;">
                  ${file.size ? (parseInt(file.size) / 1024).toFixed(1) + ' KB' : 'N/A'} â€¢
                  ${new Date(file.modifiedTime).toLocaleDateString()}
                </div>
              </div>
            </div>
          `).join('');

          // Add checkbox handlers
          document.querySelectorAll('.drive-file-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
              const fileId = (e.target as HTMLInputElement).getAttribute('data-file-id')!;
              const checked = (e.target as HTMLInputElement).checked;

              if (checked) {
                selectedDriveFiles.push(fileId);
              } else {
                selectedDriveFiles = selectedDriveFiles.filter(id => id !== fileId);
              }

              const importBtn = document.getElementById('import-selected-drive-btn');
              if (importBtn) {
                importBtn.style.display = selectedDriveFiles.length > 0 ? 'inline-block' : 'none';
              }
            });
          });
        }
      }

    } catch (error: any) {
      console.error('Failed to list Drive files:', error);
      if (filesLoading) filesLoading.style.display = 'none';
      if (filesContainer) {
        filesContainer.style.display = 'block';
        filesContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #e74c3c;">
            <p>Failed to load files from Google Drive.</p>
            <p style="font-size: 14px; margin-top: 8px;">${error.message}</p>
          </div>
        `;
      }
    }
  }

  async function importFromDrive() {
    if (selectedDriveFiles.length === 0) return;

    const progressSection = document.getElementById('analysis-progress');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');

    if (progressSection) progressSection.style.display = 'block';
    if (progressText) progressText.textContent = 'Downloading files from Google Drive...';

    try {
      // Download files from Drive
      const files = await googleDrive.importDocuments(
        selectedDriveFiles,
        (current, total) => {
          if (progressText) {
            progressText.textContent = `Downloading ${current}/${total} files...`;
          }
          if (progressBar) {
            progressBar.style.width = `${(current / total) * 50}%`;
          }
        }
      );

      // Analyze with document import service
      if (progressText) progressText.textContent = 'Analyzing documents with AI...';

      const result = await documentImportService.processDocuments(
        files,
        (current, total) => {
          if (progressText) {
            progressText.textContent = `Analyzing ${current}/${total} documents...`;
          }
          if (progressBar) {
            progressBar.style.width = `${50 + (current / total) * 35}%`;
          }
        }
      );

      if (!result.success || result.allEvents.length === 0) {
        if (progressSection) progressSection.style.display = 'none';
        showToast(result.errors[0] || 'No events found in documents', 'error');
        return;
      }

      // Check for duplicates
      if (progressText) progressText.textContent = 'Checking for duplicates...';
      if (progressBar) progressBar.style.width = '87%';

      const dedupResult = await deduplicationService.deduplicateEvents(
        result.allEvents,
        events,
        (current, total) => {
          if (progressText) {
            progressText.textContent = `Checking duplicates ${current}/${total}...`;
          }
          if (progressBar) {
            progressBar.style.width = `${87 + (current / total) * 13}%`;
          }
        }
      );

      if (progressSection) progressSection.style.display = 'none';

      // Show preview with dedup info
      extractedEvents = dedupResult.unique;
      showEventsPreview(extractedEvents);

      // Show deduplication results
      if (dedupResult.duplicates.length > 0) {
        showToast(
          `Found ${result.allEvents.length} events, removed ${dedupResult.duplicates.length} duplicates`,
          'info'
        );
      } else if (result.errors.length > 0) {
        showToast(`Processed ${result.processed} files, ${result.failed} failed`, 'warning');
      } else {
        showToast(`Found ${extractedEvents.length} unique events in ${result.processed} documents`, 'success');
      }

    } catch (error: any) {
      console.error('Drive import error:', error);
      if (progressSection) progressSection.style.display = 'none';
      showToast('Failed to import from Google Drive: ' + error.message, 'error');
    }
  }

  // Google Drive event listeners
  document.getElementById('connect-drive-btn')?.addEventListener('click', connectDrive);
  document.getElementById('disconnect-drive-btn')?.addEventListener('click', async () => {
    await googleDrive.revokeAccess();
    const authSection = document.getElementById('drive-auth-section');
    const filesSection = document.getElementById('drive-files-section');
    if (authSection) authSection.style.display = 'block';
    if (filesSection) filesSection.style.display = 'none';
    showToast('Disconnected from Google Drive', 'success');
  });
  document.getElementById('import-selected-drive-btn')?.addEventListener('click', importFromDrive);

  // Close handlers
  document.getElementById('doc-import-close')?.addEventListener('click', hideDocumentImportModal);
  document.getElementById('cancel-import-btn')?.addEventListener('click', hideDocumentImportModal);
  document.querySelector('#document-import-modal .modal-overlay')?.addEventListener('click', hideDocumentImportModal);
}

function hideDocumentImportModal() {
  const modal = document.getElementById('document-import-modal');
  if (modal) {
    modal.remove();
  }
}

async function handleInviteUser(e: Event) {
  e.preventDefault();

  if (!currentTimeline || !currentUser) return;

  const emailInput = document.getElementById('invite-email') as HTMLInputElement;
  const permissionSelect = document.getElementById('invite-permission') as HTMLSelectElement;

  const email = emailInput.value.trim();
  const permission = permissionSelect.value as 'view' | 'edit' | 'admin';

  if (!email) return;

  const { error } = await supabase.inviteUserToTimeline(
    currentTimeline.id,
    email,
    permission,
    currentUser.id
  );

  if (error) {
    showToast(error.message || 'Failed to send invitation', 'error');
  } else {
    showToast('Invitation sent!', 'success');
    emailInput.value = '';
    // Refresh modal
    hideShareTimelineModal();
    showShareTimelineModal();
  }
}

// Start app
init();


