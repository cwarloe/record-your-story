# Changelog

All notable changes to Record Your Story will be documented in this file.

## [2.0.1] - 2025-10-05

### 🎉 Multiple Timelines + Bug Fixes

**Record Your Story v2.0.1** - Added multiple timeline support and fixed critical bugs for edit/delete functionality.

### ✨ New Features

#### Multiple Timelines (Sprint 2)
- **Timeline Switcher**: Dropdown in header to switch between timelines
- **Create Timeline**: Modal to create new timelines with custom names
- **Timeline Types**: Personal, Family, Work, Shared
- **Persistent Selection**: Remembers selected timeline via LocalStorage
- **Auto-Creation**: Automatically creates "My Story" timeline for new users
- **Seamless Switching**: Events reload when switching timelines

### 🐛 Bug Fixes

1. **Fixed UUID Error on Event Save**
   - Add Event button was passing PointerEvent instead of eventId
   - Updated event listener to use arrow function wrapper

2. **Fixed TypeScript Type Conflicts**
   - Renamed custom Event interface to TimelineEvent
   - Resolved conflicts with DOM Event type

3. **Fixed Edit/Delete Buttons Not Working**
   - Buttons weren't attaching listeners on initial page load
   - Created `attachTimelineEventListeners()` helper function
   - Used `e.currentTarget` instead of `e.target` for reliability
   - Added `stopPropagation()` to prevent event bubbling

4. **Fixed Private Property Access Errors**
   - Added `createEventConnection()` method to SupabaseService
   - Added `getEventConnections()` method to SupabaseService
   - Proper encapsulation of Supabase client access

### 🛠️ Technical Changes

- **Type System**: Event → TimelineEvent throughout codebase
- **CSS**: Added timeline switcher styles with responsive breakpoints
- **Architecture**: Improved event listener management
- **Mobile**: Responsive timeline switcher for small screens

### 📊 Stats
- **Lines Changed**: +259 -43
- **Files Modified**: 4 (main.ts, supabase.ts, style.css, types/index.ts)
- **Status**: All features tested in Edge and Chrome ✅

---

## [2.0.0] - 2025-10-05

### 🚀 Major Version - TypeScript Migration

**Record Your Story v2.0** - Complete rewrite in TypeScript with Supabase cloud sync and advanced features.

### ✨ Features

#### Sprint 1 - Core Enhancements
- **Search & Filter**: Full-text search across events
- **Edit Events**: Update existing events with pre-filled modal
- **Delete Events**: Remove events with confirmation dialog
- **Date Range Filtering**: Filter timeline by date range
- **Tag Filtering**: Click tags to filter events

#### Sprint 2 - Event Connections
- **Link Related Events**: Bi-directional event connections
- **Connection Picker**: UI to select related events
- **Connection Badges**: Visual indicators (🔗 3) on timeline cards
- **Database Sync**: Connections stored in Supabase

### 🛠️ Technical Stack

- **TypeScript**: Full type safety
- **Vite**: Modern build tool
- **Supabase**: Cloud database and authentication
- **Quill.js**: Rich text editing
- **Row Level Security**: Secure data access

### 📁 Project Structure
- `src/` - TypeScript source code
- `src/types/` - Type definitions
- `src/services/` - Supabase service layer
- `schema.sql` - Database schema
- `v1/` - Original v1.0 code preserved

---

## [1.0.0] - 2025-10-05

### 🎉 Initial Release

**Record Your Story v1.0** - A complete personal timeline application for documenting life events with rich formatting, photos, and tags.

### ✨ Features

#### Core Functionality
- **Event Management**: Create, edit, and delete life events
- **Required Fields**: Title and date for each event
- **Optional Fields**: Rich text description, photos, tags
- **Chronological Display**: Events sorted by date (newest first)

#### Rich Content
- **Rich Text Editor**: Quill.js integration for formatted descriptions
  - Bold, italic, underline
  - Ordered and unordered lists
  - Hyperlinks
  - Clean toolbar interface
- **Photo Uploads**: Attach up to 5 photos per event
  - Base64 encoding
  - Thumbnail display in timeline
  - Full-screen lightbox viewer
  - Previous/next navigation
  - Unlimited storage via IndexedDB

#### Organization & Discovery
- **Tags/Categories**: Organize events with custom tags
  - Multiple tags per event
  - Color-coded gradient badges
  - Click to filter timeline
  - Auto-generated tag filter UI
- **Text Search**: Real-time search across titles and descriptions
  - Debounced for performance
  - Search results counter
- **Date Filtering**: Filter events by date range (from/to)
- **Combined Filtering**: Search + date + tags work together

#### User Experience
- **Dark Mode**: Eye-friendly theme toggle
  - Smooth color transitions
  - Persistent preference in LocalStorage
  - Moon/sun icon in header
- **Responsive Design**: Works on all screen sizes
  - Desktop, tablet, mobile optimized
  - Touch-friendly controls
  - Adaptive layouts

#### Data Management
- **LocalStorage**: Fast access to event metadata
- **IndexedDB**: Unlimited photo storage
- **Export**: Download timeline as JSON
- **Import**: Restore from backup
- **Data Ownership**: Everything stored locally

### 🛠️ Technical Highlights

- **Vanilla JavaScript**: No framework dependencies
- **Hybrid Storage**: LocalStorage + IndexedDB
- **CSS Variables**: Full theming support
- **Error Handling**: Graceful degradation
- **Browser Storage**: ~5-10MB LocalStorage + unlimited IndexedDB

### 📁 Files

- `index.html` - Main application UI
- `app.js` - Application logic (600+ lines)
- `style.css` - Styling with CSS variables (500+ lines)
- `README.md` - User documentation
- `MVP-README.md` - Original MVP docs
- `ROADMAP.md` - Future feature planning
- `CHANGELOG.md` - This file

### 🐛 Bug Fixes

- Fixed LocalStorage quota exceeded error (switched photos to IndexedDB)
- Added error handling for form submission
- Null-check for Quill editor with fallback
- Fixed async timing issues with IndexedDB

### 🎨 Design

- Purple/blue gradient theme
- Clean, modern interface
- Smooth animations and transitions
- Dark mode with full component support

### 📊 Stats

- **Total Commits**: 6
- **Lines of Code**: ~1,500
- **Features**: 9 major features
- **Development Time**: Weekend sprint
- **Status**: Production ready ✅

### 🙏 Acknowledgments

- Built with [Quill.js](https://quilljs.com/)
- Inspired by personal journaling and family history preservation
- Developed with Claude Code assistance

---

## Future Versions

See [ROADMAP.md](ROADMAP.md) for planned features in future releases.

### Potential v1.1 Features
- Timeline visualization with connecting lines
- Export to PDF
- Print-friendly view

### Potential v2.0 Features
- Cloud sync (optional)
- Share events via links
- Multiple timelines
- Collaboration features

---

**Version Format**: MAJOR.MINOR.PATCH
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

**Release Date**: October 5, 2025
**Stability**: Stable ✅
