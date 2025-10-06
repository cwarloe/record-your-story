// Record Your Story - MVP Application
// LocalStorage-based personal timeline app

class StoryTimeline {
    constructor() {
        this.events = this.loadEvents();
        this.editingEventId = null;
        this.searchQuery = '';
        this.filterFrom = '';
        this.filterTo = '';
        this.filterTags = [];
        this.quill = null;
        this.currentPhotos = [];
        this.currentTags = [];
        this.lightboxPhotos = [];
        this.currentLightboxIndex = 0;
        this.db = null;
        this.init();
    }

    async init() {
        await this.initDB();
        this.initQuill();
        this.initTheme();
        await this.renderTimeline();
        this.attachEventListeners();
    }

    initTheme() {
        // Load saved theme preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            this.updateThemeIcon(true);
        }
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon(isDark);
    }

    updateThemeIcon(isDark) {
        const icon = document.querySelector('.theme-icon');
        if (icon) {
            icon.textContent = isDark ? '☀️' : '🌙';
        }
    }

    initQuill() {
        this.quill = new Quill('#event-description-editor', {
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

    // LocalStorage Management
    loadEvents() {
        const stored = localStorage.getItem('storyEvents');
        return stored ? JSON.parse(stored) : [];
    }

    saveEvents() {
        localStorage.setItem('storyEvents', JSON.stringify(this.events));
    }

    // Event Management
    async addEvent(title, date, description, photos = [], tags = []) {
        const event = {
            id: Date.now().toString(),
            title,
            date,
            description,
            tags,
            createdAt: new Date().toISOString()
        };
        this.events.push(event);
        this.saveEvents();

        // Save photos separately in IndexedDB
        if (photos.length > 0) {
            await this.savePhotos(event.id, photos);
        }

        await this.renderTimeline();
        return event;
    }

    async updateEvent(id, title, date, description, photos = [], tags = []) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1) {
            this.events[index] = {
                ...this.events[index],
                title,
                date,
                description,
                tags
            };
            this.saveEvents();

            // Update photos in IndexedDB
            if (photos.length > 0) {
                await this.savePhotos(id, photos);
            } else {
                await this.deletePhotos(id);
            }

            await this.renderTimeline();
        }
    }

    // IndexedDB for photos
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('StoryTimelineDB', 1);

            request.onerror = () => {
                console.error('IndexedDB failed to open');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('photos')) {
                    db.createObjectStore('photos', { keyPath: 'id' });
                }
            };
        });
    }

    async savePhotos(eventId, photos) {
        if (!this.db || !photos || photos.length === 0) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');

            store.put({ id: eventId, photos: photos });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getPhotos(eventId) {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const request = store.get(eventId);

            request.onsuccess = () => {
                resolve(request.result ? request.result.photos : []);
            };

            request.onerror = () => {
                console.error('Error getting photos:', request.error);
                resolve([]);
            };
        });
    }

    async deletePhotos(eventId) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            store.delete(eventId);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async deleteEvent(id) {
        if (confirm('Are you sure you want to delete this event?')) {
            this.events = this.events.filter(e => e.id !== id);
            this.saveEvents();
            await this.deletePhotos(id);
            await this.renderTimeline();
        }
    }

    clearAllEvents() {
        if (confirm('Are you sure you want to delete ALL events? This cannot be undone!')) {
            this.events = [];
            this.saveEvents();
            this.renderTimeline();
        }
    }

    // Filtering & Search
    getFilteredEvents() {
        let filtered = [...this.events];

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(event =>
                event.title.toLowerCase().includes(query) ||
                (event.description && event.description.toLowerCase().includes(query))
            );
        }

        // Apply date range filter
        if (this.filterFrom) {
            filtered = filtered.filter(event => event.date >= this.filterFrom);
        }
        if (this.filterTo) {
            filtered = filtered.filter(event => event.date <= this.filterTo);
        }

        // Apply tag filter
        if (this.filterTags.length > 0) {
            filtered = filtered.filter(event =>
                event.tags && event.tags.some(tag => this.filterTags.includes(tag))
            );
        }

        return filtered;
    }

    // Get all unique tags from all events
    getAllTags() {
        const tagSet = new Set();
        this.events.forEach(event => {
            if (event.tags) {
                event.tags.forEach(tag => tagSet.add(tag));
            }
        });
        return Array.from(tagSet).sort();
    }

    updateSearchResultsInfo() {
        const info = document.getElementById('search-results-info');
        if (!info) return;

        const filtered = this.getFilteredEvents();
        const total = this.events.length;

        if (this.searchQuery || this.filterFrom || this.filterTo) {
            info.textContent = `Showing ${filtered.length} of ${total} events`;
            info.style.display = 'block';
        } else {
            info.style.display = 'none';
        }
    }

    // UI Rendering
    async renderTimeline() {
        const container = document.getElementById('timeline-container');

        if (this.events.length === 0) {
            container.innerHTML = '<p class="empty-state">No events yet. Add your first life event above!</p>';
            this.updateSearchResultsInfo();
            return;
        }

        // Get filtered and sorted events
        const filteredEvents = this.getFilteredEvents();
        const sortedEvents = filteredEvents.sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        if (sortedEvents.length === 0) {
            container.innerHTML = '<p class="empty-state">No events match your search or filter criteria.</p>';
            this.updateSearchResultsInfo();
            return;
        }

        // Load photos for all events from IndexedDB
        const eventsWithPhotos = await Promise.all(sortedEvents.map(async (event) => {
            const photos = await this.getPhotos(event.id);
            return { ...event, photos };
        }));

        container.innerHTML = eventsWithPhotos.map(event => `
            <div class="timeline-event" data-id="${event.id}">
                <div class="event-date">${this.formatDate(event.date)}</div>
                <div class="event-content">
                    <h3>${this.escapeHtml(event.title)}</h3>
                    ${event.tags && event.tags.length > 0 ? `
                        <div class="event-tags">
                            ${event.tags.map(tag => `<span class="tag" data-tag="${tag}">${tag}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
                    ${event.photos && event.photos.length > 0 ? `
                        <div class="event-photos">
                            ${event.photos.map((photo, idx) => `
                                <img src="${photo}" alt="Event photo ${idx + 1}" class="event-photo" data-event-id="${event.id}" data-photo-index="${idx}">
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="event-actions">
                        <button class="btn-small btn-edit" data-id="${event.id}">Edit</button>
                        <button class="btn-small btn-delete" data-id="${event.id}">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        this.renderAvailableTags();

        this.attachTimelineListeners();
        this.updateSearchResultsInfo();
    }

    renderAvailableTags() {
        const allTags = this.getAllTags();
        const container = document.getElementById('available-tags');

        if (allTags.length === 0) {
            container.innerHTML = '<p class="no-tags">No tags yet</p>';
            return;
        }

        container.innerHTML = allTags.map(tag => `
            <span class="filter-tag ${this.filterTags.includes(tag) ? 'active' : ''}" data-tag="${tag}">
                ${tag}
            </span>
        `).join('');

        // Add click listeners
        container.querySelectorAll('.filter-tag').forEach(tagEl => {
            tagEl.addEventListener('click', () => {
                const tag = tagEl.dataset.tag;
                this.toggleTagFilter(tag);
            });
        });
    }

    toggleTagFilter(tag) {
        const index = this.filterTags.indexOf(tag);
        if (index > -1) {
            this.filterTags.splice(index, 1);
        } else {
            this.filterTags.push(tag);
        }
        this.renderTimeline();
    }

    // Event Listeners
    attachEventListeners() {
        const form = document.getElementById('event-form');
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const importFile = document.getElementById('import-file');
        const clearAllBtn = document.getElementById('clear-all-btn');
        const cancelBtn = document.getElementById('cancel-btn');

        // Search & Filter
        const searchInput = document.getElementById('search-input');
        const filterFrom = document.getElementById('filter-from');
        const filterTo = document.getElementById('filter-to');
        const clearFilterBtn = document.getElementById('clear-filter-btn');

        // Tags input
        const tagsInput = document.getElementById('event-tags');
        tagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag(tagsInput.value.trim());
                tagsInput.value = '';
            }
        });

        // Photo upload
        const photoInput = document.getElementById('event-photos');
        photoInput.addEventListener('change', (e) => this.handlePhotoSelect(e));

        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => this.importData(e));
        clearAllBtn.addEventListener('click', () => this.clearAllEvents());
        cancelBtn.addEventListener('click', () => this.cancelEdit());

        // Search with debounce
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = e.target.value;
                this.renderTimeline();
            }, 300);
        });

        // Date filters
        filterFrom.addEventListener('change', (e) => {
            this.filterFrom = e.target.value;
            this.renderTimeline();
        });

        filterTo.addEventListener('change', (e) => {
            this.filterTo = e.target.value;
            this.renderTimeline();
        });

        clearFilterBtn.addEventListener('click', () => {
            this.searchQuery = '';
            this.filterFrom = '';
            this.filterTo = '';
            searchInput.value = '';
            filterFrom.value = '';
            filterTo.value = '';
            this.renderTimeline();
        });
    }

    attachTimelineListeners() {
        const editButtons = document.querySelectorAll('.btn-edit');
        const deleteButtons = document.querySelectorAll('.btn-delete');
        const photoElements = document.querySelectorAll('.event-photo');

        editButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.startEdit(id);
            });
        });

        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.deleteEvent(id);
            });
        });

        photoElements.forEach(photo => {
            photo.addEventListener('click', (e) => {
                const eventId = e.target.dataset.eventId;
                const photoIndex = parseInt(e.target.dataset.photoIndex);
                this.openLightbox(eventId, photoIndex);
            });
        });
    }

    // Tag Management
    addTag(tagName) {
        if (!tagName) return;

        const cleanTag = tagName.toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (!cleanTag || this.currentTags.includes(cleanTag)) return;

        this.currentTags.push(cleanTag);
        this.renderTagsDisplay();
    }

    removeTag(tag) {
        this.currentTags = this.currentTags.filter(t => t !== tag);
        this.renderTagsDisplay();
    }

    renderTagsDisplay() {
        const display = document.getElementById('tags-display');
        if (this.currentTags.length === 0) {
            display.innerHTML = '';
            return;
        }

        display.innerHTML = this.currentTags.map(tag => `
            <span class="tag-badge">
                ${tag}
                <button type="button" class="remove-tag" data-tag="${tag}">&times;</button>
            </span>
        `).join('');

        // Attach remove handlers
        display.querySelectorAll('.remove-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.removeTag(e.target.dataset.tag);
            });
        });
    }

    // Photo Handling
    async handlePhotoSelect(e) {
        const files = Array.from(e.target.files).slice(0, 5); // Max 5 photos
        this.currentPhotos = [];

        for (const file of files) {
            const base64 = await this.fileToBase64(file);
            this.currentPhotos.push(base64);
        }

        this.renderPhotoPreview();
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    renderPhotoPreview() {
        const preview = document.getElementById('photo-preview');
        if (this.currentPhotos.length === 0) {
            preview.innerHTML = '';
            return;
        }

        preview.innerHTML = this.currentPhotos.map((photo, idx) => `
            <div class="preview-photo">
                <img src="${photo}" alt="Preview ${idx + 1}">
                <button type="button" class="remove-photo" data-index="${idx}">&times;</button>
            </div>
        `).join('');

        // Attach remove handlers
        preview.querySelectorAll('.remove-photo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.currentPhotos.splice(index, 1);
                this.renderPhotoPreview();
            });
        });
    }

    // Form Handling
    handleFormSubmit() {
        try {
            const title = document.getElementById('event-title').value.trim();
            const date = document.getElementById('event-date').value;

            // Safely get description - fallback to empty string if Quill isn't loaded
            let description = '';
            if (this.quill && this.quill.root) {
                description = this.quill.root.innerHTML;
            } else {
                console.warn('Quill editor not initialized, using plain text fallback');
            }

            if (!title || !date) {
                alert('Please fill in both title and date');
                return;
            }

            if (this.editingEventId) {
                this.updateEvent(this.editingEventId, title, date, description, this.currentPhotos, this.currentTags);
                this.cancelEdit();
            } else {
                this.addEvent(title, date, description, this.currentPhotos, this.currentTags);
            }

            this.resetForm();
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('There was an error adding the event. Please check the console for details.');
        }
    }

    async startEdit(id) {
        const event = this.events.find(e => e.id === id);
        if (!event) return;

        this.editingEventId = id;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-date').value = event.date;

        // Set Quill content
        if (this.quill && this.quill.root) {
            if (event.description) {
                this.quill.root.innerHTML = event.description;
            } else {
                this.quill.setText('');
            }
        }

        // Load photos from IndexedDB
        this.currentPhotos = await this.getPhotos(id);
        this.renderPhotoPreview();

        // Load tags
        this.currentTags = event.tags || [];
        this.renderTagsDisplay();

        document.querySelector('#event-form button[type="submit"]').textContent = 'Update Event';
        document.getElementById('cancel-btn').style.display = 'inline-block';

        // Scroll to form
        document.getElementById('add-event-section').scrollIntoView({ behavior: 'smooth' });
    }

    cancelEdit() {
        this.editingEventId = null;
        this.resetForm();
        document.querySelector('#event-form button[type="submit"]').textContent = 'Add Event';
        document.getElementById('cancel-btn').style.display = 'none';
    }

    resetForm() {
        document.getElementById('event-form').reset();
        if (this.quill && this.quill.setText) {
            this.quill.setText('');
        }
        this.currentPhotos = [];
        this.currentTags = [];
        this.renderPhotoPreview();
        this.renderTagsDisplay();
    }

    // Lightbox
    async openLightbox(eventId, photoIndex) {
        const photos = await this.getPhotos(eventId);
        if (!photos || photos.length === 0) return;

        this.lightboxPhotos = photos;
        this.currentLightboxIndex = photoIndex;
        this.showLightboxPhoto();

        const lightbox = document.getElementById('photo-lightbox');
        lightbox.style.display = 'flex';

        // Add event listeners
        document.querySelector('.lightbox-close').onclick = () => this.closeLightbox();
        document.querySelector('.lightbox-prev').onclick = () => this.prevLightboxPhoto();
        document.querySelector('.lightbox-next').onclick = () => this.nextLightboxPhoto();

        // Close on outside click
        lightbox.onclick = (e) => {
            if (e.target === lightbox) this.closeLightbox();
        };
    }

    closeLightbox() {
        document.getElementById('photo-lightbox').style.display = 'none';
    }

    showLightboxPhoto() {
        const img = document.getElementById('lightbox-img');
        img.src = this.lightboxPhotos[this.currentLightboxIndex];
    }

    prevLightboxPhoto() {
        this.currentLightboxIndex = (this.currentLightboxIndex - 1 + this.lightboxPhotos.length) % this.lightboxPhotos.length;
        this.showLightboxPhoto();
    }

    nextLightboxPhoto() {
        this.currentLightboxIndex = (this.currentLightboxIndex + 1) % this.lightboxPhotos.length;
        this.showLightboxPhoto();
    }

    // Import/Export
    exportData() {
        const dataStr = JSON.stringify(this.events, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `my-story-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) {
                    alert('Invalid file format');
                    return;
                }

                if (confirm(`Import ${imported.length} events? This will replace your current data.`)) {
                    this.events = imported;
                    this.saveEvents();
                    this.renderTimeline();
                    alert('Data imported successfully!');
                }
            } catch (err) {
                alert('Error reading file: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }

    // Utilities
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.storyApp = new StoryTimeline();
});
