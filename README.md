# Record Your Story v1.0

**Record Your Story** is a personal timeline application for documenting and organizing your life events with rich formatting, photos, and tags. Keep your memories safe with local-first storage that puts you in control of your data.

## ✨ Features

- **📝 Rich Event Creation** - Add life events with titles, dates, and formatted descriptions
- **🎨 Rich Text Editor** - Format your stories with bold, italic, lists, and links
- **📸 Photo Uploads** - Attach up to 5 photos per event (unlimited storage via IndexedDB)
- **🏷️ Tags/Categories** - Organize events with custom tags (work, family, travel, etc.)
- **🔍 Search & Filter** - Find events by text, date range, or tags
- **🌓 Dark Mode** - Eye-friendly theme with persistent preference
- **💾 Data Ownership** - All data stored locally in your browser
- **📤 Export/Import** - Backup and restore your timeline as JSON
- **📱 Responsive Design** - Works beautifully on desktop, tablet, and mobile

## 🚀 Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cwarloe/record-your-story.git
   cd record-your-story
   ```

2. **Open in browser:**
   ```bash
   # Just open index.html in any modern browser
   open index.html  # macOS
   start index.html # Windows
   xdg-open index.html # Linux
   ```

3. **Start recording your story!**
   - Add your first life event
   - Upload photos to bring memories to life
   - Tag events to organize your timeline
   - Use search to find specific moments

## 📖 How to Use

### Adding Events
1. Fill in the event title and date (required)
2. Write your story in the rich text editor
3. Add tags by typing and pressing Enter
4. Upload photos (optional, up to 5)
5. Click "Add Event"

### Organizing with Tags
- Type tags in the form (e.g., "work", "family", "travel")
- Press Enter to add each tag
- Click tags below the search box to filter your timeline
- Active filters are highlighted

### Search & Filter
- **Text Search**: Search event titles and descriptions
- **Date Range**: Filter events between specific dates
- **Tags**: Click tag filters to show only tagged events
- **Clear**: Reset all filters with one click

### Data Management
- **Export Data**: Download your timeline as JSON (backup!)
- **Import Data**: Restore from a previous backup
- **Dark Mode**: Toggle theme with the moon/sun icon

## 🛠️ Technical Details

### Storage Architecture
- **LocalStorage**: Event metadata (title, date, description, tags)
- **IndexedDB**: Photos (base64 images, unlimited storage)
- **Hybrid Approach**: Fast metadata access + unlimited photo storage

### Tech Stack
- **Frontend**: Vanilla JavaScript (no frameworks!)
- **Rich Text**: Quill.js
- **Storage**: LocalStorage + IndexedDB
- **Styling**: Custom CSS with CSS variables for theming

### Browser Support
- Chrome/Edge (recommended)
- Firefox
- Safari
- Any modern browser with LocalStorage and IndexedDB support

## 📁 Project Structure

```
record-your-story/
├── index.html          # Main application
├── app.js             # Application logic
├── style.css          # Styling & themes
├── README.md          # This file
├── MVP-README.md      # Original MVP documentation
├── ROADMAP.md         # Future feature ideas
├── CHANGELOG.md       # Version history
├── Documentation/     # Project documentation
├── Project_Plans/     # Planning documents
└── Designs/          # UI/UX designs
```

## 🔒 Privacy & Data

**Your data stays with you:**
- All data stored locally in your browser
- No server, no cloud, no tracking
- Export your data anytime
- Works completely offline after first load

**Important Notes:**
- Clearing browser data will delete your timeline
- Use Export regularly to backup your events
- Import/Export to transfer between devices

## 🎯 Use Cases

- **Personal Journal** - Document your life journey
- **Family History** - Preserve family stories with photos
- **Project Timeline** - Track project milestones
- **Travel Log** - Remember adventures with photos and tags
- **Career Tracker** - Document professional achievements
- **Memory Book** - Keep cherished moments organized

## 🚧 Future Enhancements

See [ROADMAP.md](ROADMAP.md) for planned features:
- Timeline visualization with connecting lines
- Share individual events via links
- Multiple timelines (separate work/personal)
- Cloud sync (optional)
- Collaboration features

## 📝 License

MIT License - Feel free to use for personal or commercial projects

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!
Open an issue or submit a pull request.

## 🙏 Credits

Built with:
- [Quill.js](https://quilljs.com/) - Rich text editor
- Love for preserving memories

---

**Version**: 1.0.0
**Last Updated**: October 2025
**Status**: Production Ready ✅

Start preserving your story today! 📖✨
