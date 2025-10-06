import { supabase } from '@/services/supabase';
import { claude } from '@/services/claude';
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

// AI / Voice state (v2.3.0) - Ready for full implementation
// Check if Claude AI is available
if (claude.isEnabled()) {
  console.log('🤖 AI features enabled');
}
// Web Speech API initialization (to be implemented)
// let recognition: any = null;
// let isRecording = false;
// let recordedTranscript = '';

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
  // Check for existing session
  const user = await supabase.getCurrentUser();
  currentUser = user as User | null;

  if (currentUser) {
    await loadUserData();
    showApp();
  } else {
    showAuth();
  }

  // Listen for auth changes
  supabase.onAuthStateChange(async (user) => {
    currentUser = user as User | null;
    if (user) {
      await loadUserData();
      showApp();
    } else {
      showAuth();
    }
  });
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
  } catch (error) {
    console.error('Fatal error in loadUserData:', error);
    alert('Error loading your data. Please refresh the page.');
  }
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
            <button id="export-pdf-btn" class="btn btn-secondary btn-small" title="Export to PDF">📄 Export PDF</button>
            <button id="theme-toggle" class="theme-toggle">🌙</button>
            <span class="user-email">${currentUser?.email || 'User'}</span>
            <button id="signout-btn" class="btn btn-small">Sign Out</button>
          </div>
        </header>

      <main class="app-main">
        <div class="timeline-header">
          <h2>${currentTimeline?.name || 'My Story'}</h2>
          <div class="timeline-actions">
            <button id="share-timeline-btn" class="btn btn-secondary btn-small" title="Share Timeline">👥 Share</button>
            <button id="add-event-btn" class="btn btn-primary">+ Add Event</button>
          </div>
        </div>

        <div class="search-filter-bar">
          <input type="text" id="search-input" placeholder="🔍 Search events..." value="${searchQuery}" />
          <input type="date" id="date-from" placeholder="From" value="${filterDateFrom}" />
          <input type="date" id="date-to" placeholder="To" value="${filterDateTo}" />
          <button id="clear-filters" class="btn btn-secondary btn-small">Clear Filters</button>
        </div>

        <div id="timeline" class="timeline">
          ${events.length === 0
            ? '<p class="empty-state">No events yet. Click "Add Event" to record your first story!</p>'
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
              <div id="connections-display" class="connections-display"></div>
            </div>

            <div class="modal-actions">
              <button type="submit" class="btn btn-primary">Save Event</button>
              <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

    // Event listeners
    document.getElementById('signout-btn')?.addEventListener('click', handleSignOut);
    document.getElementById('add-event-btn')?.addEventListener('click', () => showEventModal());
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
    return '<p class="empty-state">No events match your filters. Try adjusting your search.</p>';
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
              <button class="btn-icon edit-btn" data-id="${event.id}" title="Edit">✏️</button>
              <button class="btn-icon delete-btn" data-id="${event.id}" title="Delete">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  return html;
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
  document.querySelector('.modal-overlay')?.addEventListener('click', hideEventModal);

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
    icon.textContent = isDark ? '☀️' : '🌙';
  }
}

// Init theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const icon = document.getElementById('theme-toggle');
    if (icon) {
      icon.textContent = '☀️';
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
      hideEventModal();
      refreshTimeline();
      initTheme();
      showToast('Event created successfully!', 'success');
    }
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
      ? '<p class="empty-state">No events yet. Click "Add Event" to record your first story!</p>'
      : renderTimeline();

    // Re-attach all event listeners
    attachTimelineEventListeners();
  }
}

// Show toast notification
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
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
          <h3>⌨️ Keyboard Shortcuts</h3>
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
        <p class="shortcuts-note">💡 On Mac, use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd></p>
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
