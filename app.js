// Record Your Story - MVP Application
// LocalStorage-based personal timeline app

class StoryTimeline {
    constructor() {
        this.events = this.loadEvents();
        this.editingEventId = null;
        this.init();
    }

    init() {
        this.renderTimeline();
        this.attachEventListeners();
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
    addEvent(title, date, description) {
        const event = {
            id: Date.now().toString(),
            title,
            date,
            description,
            createdAt: new Date().toISOString()
        };
        this.events.push(event);
        this.saveEvents();
        this.renderTimeline();
        return event;
    }

    updateEvent(id, title, date, description) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1) {
            this.events[index] = {
                ...this.events[index],
                title,
                date,
                description
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

    // UI Rendering
    renderTimeline() {
        const container = document.getElementById('timeline-container');

        if (this.events.length === 0) {
            container.innerHTML = '<p class="empty-state">No events yet. Add your first life event above!</p>';
            return;
        }

        // Sort events by date (newest first)
        const sortedEvents = [...this.events].sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );

        container.innerHTML = sortedEvents.map(event => `
            <div class="timeline-event" data-id="${event.id}">
                <div class="event-date">${this.formatDate(event.date)}</div>
                <div class="event-content">
                    <h3>${this.escapeHtml(event.title)}</h3>
                    ${event.description ? `<p>${this.escapeHtml(event.description)}</p>` : ''}
                    <div class="event-actions">
                        <button class="btn-small btn-edit" data-id="${event.id}">Edit</button>
                        <button class="btn-small btn-delete" data-id="${event.id}">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        this.attachTimelineListeners();
    }

    // Event Listeners
    attachEventListeners() {
        const form = document.getElementById('event-form');
        const exportBtn = document.getElementById('export-btn');
        const importBtn = document.getElementById('import-btn');
        const importFile = document.getElementById('import-file');
        const clearAllBtn = document.getElementById('clear-all-btn');
        const cancelBtn = document.getElementById('cancel-btn');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit();
        });

        exportBtn.addEventListener('click', () => this.exportData());
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => this.importData(e));
        clearAllBtn.addEventListener('click', () => this.clearAllEvents());
        cancelBtn.addEventListener('click', () => this.cancelEdit());
    }

    attachTimelineListeners() {
        const editButtons = document.querySelectorAll('.btn-edit');
        const deleteButtons = document.querySelectorAll('.btn-delete');

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
    }

    // Form Handling
    handleFormSubmit() {
        const title = document.getElementById('event-title').value.trim();
        const date = document.getElementById('event-date').value;
        const description = document.getElementById('event-description').value.trim();

        if (!title || !date) return;

        if (this.editingEventId) {
            this.updateEvent(this.editingEventId, title, date, description);
            this.cancelEdit();
        } else {
            this.addEvent(title, date, description);
        }

        this.resetForm();
    }

    startEdit(id) {
        const event = this.events.find(e => e.id === id);
        if (!event) return;

        this.editingEventId = id;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-description').value = event.description || '';

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
