# Changelog

All notable changes to Record Your Story will be documented in this file.

## [2.1.0-alpha] - 2025-10-05

### 🤝 Collaboration Foundation

**Record Your Story v2.1.0-alpha** - Database schema and architecture for timeline collaboration (frontend implementation pending).

### ✨ New Features (Schema Only)

#### Database Schema
- **`shared_timelines` table**: Stores timeline sharing relationships
  - `timeline_id`: Which timeline is shared
  - `user_id`: Who it's shared with
  - `permission_level`: 'view', 'edit', or 'admin'
  - `invited_by`: Who sent the invitation
  - `accepted`: Whether invitation was accepted
- **Indexes**: Optimized for user/timeline lookups
- **RLS Policies**: Complete Row Level Security for collaboration

#### Permission System
- **View**: Read-only access to timeline and events
- **Edit**: Can create, edit, and delete any event in timeline
- **Admin**: Can manage collaborators + all edit permissions
- **Owner**: Implicit admin + can delete timeline

#### Updated RLS Policies
- Timelines: Access for owners and accepted collaborators
- Events: View/edit based on collaboration permissions
- Photos: Access follows event access rules
- Shared Timelines: Proper access control for invitations

### 📚 Documentation

Created **COLLABORATION.md** with complete implementation guide:
- Database schema details
- Permission level explanations
- Step-by-step frontend implementation guide
- Supabase service methods (code samples)
- UI component designs (HTML/CSS)
- Permission checking logic
- Security considerations
- Testing checklist

### 🛠️ Technical Changes

- Added `SharedTimeline` TypeScript interface
- Updated all RLS policies to support collaboration
- Added indexes for shared_timelines table
- Extended timeline/event policies for shared access

### 📊 Stats
- **Files Modified**: 3 (schema.sql, types/index.ts, COLLABORATION.md)
- **New Table**: shared_timelines
- **New Type**: SharedTimeline interface
- **Documentation**: Complete implementation guide (2000+ words)
- **Status**: Schema ready, frontend implementation needed ⏳

### 🚀 Next Steps

To complete collaboration features:
1. Add Supabase service methods (see COLLABORATION.md)
2. Create share modal UI component
3. Add pending invitations badge
4. Implement permission checks in UI
5. Add collaborators list display
6. Test all permission levels

**Estimated Effort**: 4-6 hours for full UI implementation

---

## [2.0.3] - 2025-10-05

### ↶ Undo/Redo System

**Record Your Story v2.0.3** - Complete undo/redo functionality with keyboard shortcuts and visual feedback.

### ✨ New Features

#### Undo/Redo System
- **Action History**: Tracks up to 50 recent actions
- **Undo Operations**: Ctrl+Z or ↶ Undo button
  - Undo create event → Deletes the event
  - Undo update event → Restores previous version
  - Undo delete event → Recreates the event
- **Redo Operations**: Ctrl+Y or Ctrl+Shift+Z or ↷ Redo button
  - Redo all undone actions
- **Smart History**: New actions clear redo history
- **Button States**: Visual feedback (disabled/enabled, opacity changes)
- **Toast Messages**: Shows what was undone/redone
  - "Undone: Created 'Event Title'"
  - "Redone: Edit to 'Event Title'"

#### Keyboard Shortcuts
- **Ctrl+Z / Cmd+Z**: Undo last action
- **Ctrl+Y / Cmd+Y**: Redo last undone action
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Alternative redo shortcut
- **Cross-platform**: Works on Windows, Mac, Linux

#### UI Enhancements
- **Header Buttons**: Undo ↶ and Redo ↷ buttons
- **Tooltips**: Show keyboard shortcuts
- **State Management**: Buttons automatically enable/disable
- **Visual Feedback**: Opacity changes show availability

### 🔄 How It Works

**History Stack:**
```typescript
interface HistoryAction {
  type: 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT';
  event: TimelineEvent;
  previousEvent?: TimelineEvent;
  timestamp: number;
}
```

**Action Tracking:**
- Event created → Added to history
- Event updated → Stores both old and new versions
- Event deleted → Stores deleted event for restoration
- Maximum 50 actions (FIFO queue)

**Undo Logic:**
- Create → Delete from database
- Update → Restore previous version
- Delete → Recreate event with same ID

**Redo Logic:**
- Create → Recreate event
- Update → Reapply changes
- Delete → Delete again

### 🐛 Bug Fixes

1. **Updated Delete Confirmation**
   - Changed message to "You can undo this action"
   - Reduces anxiety about permanent deletion

### 🛠️ Technical Changes

- Added `HistoryAction` interface
- Added `historyStack` and `historyIndex` state
- Added `addToHistory()` function with max size limit
- Added `undo()` and `redo()` async functions
- Added `updateUndoRedoButtons()` for UI state
- Integrated history tracking in `handleEventSubmit()`
- Integrated history tracking in `handleDeleteEvent()`
- Added keyboard event listener for shortcuts
- Updated button states on app load

### 📊 Stats
- **Lines Added**: ~200 (undo/redo logic)
- **Files Modified**: 2 (main.ts, CHANGELOG.md)
- **New Functions**: 4 (addToHistory, undo, redo, updateUndoRedoButtons)
- **Keyboard Shortcuts**: 3 (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
- **Status**: Fully functional ✅

---

## [2.0.2] - 2025-10-05

### 🎨 Quick Wins Sprint - UX Enhancements

**Record Your Story v2.0.2** - Polished user experience with toast notifications, drag & drop photos, and smooth animations.

### ✨ New Features

#### Toast Notifications
- **Success Messages**: Green toasts for successful actions
  - "Event created successfully!"
  - "Event updated successfully!"
  - "Event deleted successfully"
  - "Timeline created successfully!"
  - "PDF exported successfully!"
- **Info Messages**: Blue toasts for timeline switching
  - "Switched to 'Timeline Name'"
- **Error Messages**: Red toasts for failures
- **Auto-dismiss**: Toasts slide up and disappear after 3 seconds
- **Non-blocking**: Modern, unobtrusive notifications

#### Drag & Drop Photo Upload
- **Visual Drop Zone**: Drag files directly onto photo area
- **Hover Feedback**: Zone highlights when dragging files over
- **Click to Browse**: Click anywhere in drop zone to select files
- **File Validation**: Only accepts image files
- **Preview Thumbnails**: Photos animate in with scale effect

#### Smooth Animations
- **Timeline Events**: Staggered fade-in animation (0.05s delays)
- **Modal Transitions**: Slide-in with scale effect (0.3s)
- **Button Feedback**: Scale down on click for tactile feel
- **Photo Previews**: Zoom in on appearance, scale on hover
- **Tag Animations**: Slide in from left, scale on hover
- **Toast Slides**: Smooth slide-up from bottom with bounce

### 🐛 Bug Fixes

1. **Fixed Login Blank Screen**
   - Added defensive checks to `showApp()` function
   - Try-catch wrapper with error UI and reload button
   - Comprehensive logging for debugging
   - Null-coalescing operators for safe template rendering

2. **Fixed Quill Editor Not Loading**
   - Editor now reinitializes every time modal opens
   - Removed stale instance check that prevented recreation
   - Description properly loads when editing events

3. **Fixed Photo Upload Not Working**
   - Made entire drop zone clickable to trigger file browser
   - Added proper event listener for click-to-upload

### 🎨 CSS Enhancements

- **@keyframes fadeInUp**: Timeline event entrance animation
- **@keyframes modalFadeIn**: Modal overlay fade
- **@keyframes modalSlideIn**: Modal content slide-in with scale
- **@keyframes photoFadeIn**: Photo thumbnail appearance
- **@keyframes tagSlideIn**: Tag entrance animation
- **Toast Styles**: Success (green), error (red), info (blue) variants
- **Hover Effects**: Buttons, photos, tags, event cards
- **Active States**: Button press feedback

### 🛠️ Technical Changes

- Replaced `alert()` calls with `showToast()` throughout app
- Added `setupDragAndDrop()` function for file handling
- Added `handleFiles()` for unified file processing
- Improved error handling in `loadUserData()`
- Enhanced modal lifecycle management

### 📊 Stats
- **Lines Changed**: +250 CSS, +150 JS
- **Files Modified**: 2 (main.ts, style.css)
- **New Functions**: 2 (showToast, setupDragAndDrop)
- **Animations Added**: 6 keyframe animations
- **Status**: All features tested ✅

---

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
