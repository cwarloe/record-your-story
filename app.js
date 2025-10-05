// Record Your Story - MVP Application
// LocalStorage-based personal timeline app

class StoryTimeline {
    constructor() {
        this.events = this.loadEvents();
        this.editingEventId = null;
        this.searchQuery = '';
        this.filterFrom = '';
        this.filterTo = '';
        this.quill = null;
        this.currentPhotos = [];
        this.lightboxPhotos = [];
        this.currentLightboxIndex = 0;
        this.init();
    }

    init() {
        this.initQuill();
        this.initTheme();
        this.renderTimeline();
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
    addEvent(title, date, description, photos = []) {
        const event = {
            id: Date.now().toString(),
            title,
            date,
            description,
            photos,
            createdAt: new Date().toISOString()
        };
        this.events.push(event);
        this.saveEvents();
        this.renderTimeline();
        return event;
    }

    updateEvent(id, title, date, description, photos = []) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1) {
            this.events[index] = {
                ...this.events[index],
                title,
                date,
                description,
                photos
            };
            this.saveEvents();
            this.renderTimeline();
        }
    }

    deleteEvent(id) {
        if (confirm('Are you sure you want to delete this event?')) {
            this.events = this.events.filter(e => e.id !== id);
            this.saveEvents();
            this.renderTimeline();
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

        return filtered;
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
    renderTimeline() {
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

        container.innerHTML = sortedEvents.map(event => `
            <div class="timeline-event" data-id="${event.id}">
                <div class="event-date">${this.formatDate(event.date)}</div>
                <div class="event-content">
                    <h3>${this.escapeHtml(event.title)}</h3>
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

        this.attachTimelineListeners();
        this.updateSearchResultsInfo();
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
                this.updateEvent(this.editingEventId, title, date, description, this.currentPhotos);
                this.cancelEdit();
            } else {
                this.addEvent(title, date, description, this.currentPhotos);
            }

            this.resetForm();
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('There was an error adding the event. Please check the console for details.');
        }
    }

    startEdit(id) {
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

        // Set photos
        this.currentPhotos = event.photos || [];
        this.renderPhotoPreview();

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
        this.renderPhotoPreview();
    }

    // Lightbox
    openLightbox(eventId, photoIndex) {
        const event = this.events.find(e => e.id === eventId);
        if (!event || !event.photos) return;

        this.lightboxPhotos = event.photos;
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
