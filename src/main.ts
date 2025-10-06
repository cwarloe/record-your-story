import { supabase } from '@/services/supabase';
import type { User, Timeline, TimelineEvent } from '@/types';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './style.css';

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

// Filter state
let searchQuery = '';
let filterDateFrom = '';
let filterDateTo = '';
let filterTags: string[] = [];

// Store event connections
let eventConnections: Map<string, string[]> = new Map();

// Initialize app
async function init() {
  // Check for existing session
  currentUser = await supabase.getCurrentUser();

  if (currentUser) {
    await loadUserData();
    showApp();
  } else {
    showAuth();
  }

  // Listen for auth changes
  supabase.onAuthStateChange(async (user) => {
    currentUser = user;
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
  if (!currentUser) return;

  // Get user's timelines
  const { data: timelines, error: timelineError } = await supabase.getUserTimelines(currentUser.id);

  if (timelineError) {
    console.error('Error loading timelines:', timelineError);
    return;
  }

  // If no timelines exist, create default personal timeline
  if (!timelines || timelines.length === 0) {
    const { data: newTimeline, error: createError } = await supabase.createTimeline({
      name: 'My Story',
      owner_id: currentUser.id,
      type: 'personal',
    });

    if (createError) {
      console.error('Error creating timeline:', createError);
      return;
    }

    userTimelines = [newTimeline];
    currentTimeline = newTimeline;
  } else {
    userTimelines = timelines;
    // Use saved timeline or first one
    const savedTimelineId = localStorage.getItem('currentTimelineId');
    currentTimeline = timelines.find(t => t.id === savedTimelineId) || timelines[0];
  }

  // Load events for current timeline
  if (currentTimeline) {
    const { data: timelineEvents, error: eventsError } = await supabase.getEvents(currentTimeline.id);

    if (eventsError) {
      console.error('Error loading events:', eventsError);
      return;
    }

    events = timelineEvents || [];

    // Load photos for each event
    for (const event of events) {
      const { data: photos } = await supabase.getEventPhotos(event.id);
      (event as any).photos = photos || [];
    }

    // Load event connections
    await loadConnections();
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
  if (!app) return;

  app.innerHTML = `
    <div class="app-container">
      <header class="app-header">
        <h1>Record Your Story</h1>
        <div class="timeline-switcher">
          <select id="timeline-select" class="timeline-dropdown">
            ${userTimelines.map(t => `
              <option value="${t.id}" ${t.id === currentTimeline?.id ? 'selected' : ''}>
                ${t.name} (${t.type})
              </option>
            `).join('')}
          </select>
          <button id="new-timeline-btn" class="btn btn-small" title="Create Timeline">+ Timeline</button>
        </div>
        <div class="header-actions">
          <button id="theme-toggle" class="theme-toggle">🌙</button>
          <span class="user-email">${currentUser?.email}</span>
          <button id="signout-btn" class="btn btn-small">Sign Out</button>
        </div>
      </header>

      <main class="app-main">
        <div class="timeline-header">
          <h2>${currentTimeline?.name || 'My Story'}</h2>
          <button id="add-event-btn" class="btn btn-primary">+ Add Event</button>
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
            <input type="file" id="photo-upload" accept="image/*" multiple />
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

  // Attach event card listeners (edit, delete, tags)
  attachTimelineEventListeners();

  initTheme();
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

  return filteredEvents
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map(event => {
      const eventWithPhotos = event as any;
      return `
      <div class="timeline-event" data-id="${event.id}">
        <div class="event-date">${new Date(event.date).toLocaleDateString()}</div>
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
      `;
    })
    .join('');
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
    if (container && !quill) {
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
    }

    // Set description if editing
    if (eventId && quill) {
      const event = events.find(e => e.id === eventId);
      if (event?.description) {
        quill.root.innerHTML = event.description;
      } else {
        quill.setText('');
      }
    } else if (quill) {
      quill.setText('');
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

// Handle photo upload
function handlePhotoUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;

  Array.from(files).forEach(file => {
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
      currentUser = await supabase.getCurrentUser();
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
    const { data, error } = await supabase.updateEvent(editingEventId, {
      title,
      date,
      description,
      tags: currentTags,
    });

    if (error) {
      alert(`Error updating event: ${error.message}`);
    } else if (data) {
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
      alert(`Error creating event: ${error.message}`);
    } else if (data) {
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
    }
  }
}

// Delete event handler
async function handleDeleteEvent(eventId: string) {
  if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) {
    return;
  }

  const { error } = await supabase.deleteEvent(eventId);

  if (error) {
    alert(`Error deleting event: ${error.message}`);
  } else {
    events = events.filter(e => e.id !== eventId);
    refreshTimeline();
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

  const form = e.target as HTMLFormElement;
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
    alert('Failed to create timeline');
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

// Start app
init();
