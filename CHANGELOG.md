# Changelog

All notable changes to Record Your Story will be documented in this file.

## [2.7.2] - 2025-10-06

### 🔍 Smart Event Deduplication

**New Feature:** Automatically detect and prevent duplicate events during import with multi-strategy matching.

### ✨ What's New

#### Intelligent Duplicate Detection
- **Multi-Strategy Matching**: Combines exact, fuzzy, and AI-powered detection
- **Exact Match Detection**: Identifies identical title + date combinations (100% confidence)
- **Fuzzy Matching**: Levenshtein distance algorithm for similar titles and dates (85%+ threshold)
- **AI-Powered Analysis**: Claude compares borderline cases semantically (60%+ threshold)
- **Automatic Processing**: Runs transparently during import
- **Progress Tracking**: Real-time progress for duplicate checking
- **User Feedback**: Clear notifications showing duplicate count

#### Detection Strategies

1. **Strategy 1: Exact Match** (Instant, 100% confidence)
   - Same title (case-insensitive)
   - Same date
   - Perfect for re-imports

2. **Strategy 2: Fuzzy Match** (Fast, 85%+ similarity)
   - String similarity (Levenshtein algorithm)
   - Date proximity scoring
   - Weighted composite: 70% title, 30% date
   - Catches typos and variations

3. **Strategy 3: AI Similarity** (Fallback, 60%+ fuzzy)
   - Only for borderline cases
   - Semantic comparison by Claude
   - Detects same event with different wording
   - Low temperature (0.1) for consistency

#### Date Similarity Scoring
- Same day: 1.0
- Within 1 week: 0.95-1.0
- Within 30 days: 0.42-0.65
- Within 90 days: 0.12-0.42
- Beyond 90 days: exponential decay

### 🛠️ Technical Details

**New Files:**
- `src/services/deduplication.ts` - Deduplication engine (~350 lines)
  - `checkDuplicate()` - Main duplicate detection
  - `findExactMatch()` - Exact title/date matching
  - `findFuzzyMatch()` - Similarity-based matching
  - `stringSimilarity()` - Normalized similarity scoring
  - `levenshteinDistance()` - Edit distance algorithm
  - `dateSimilarity()` - Temporal proximity scoring
  - `checkAISimilarity()` - AI-powered comparison
  - `deduplicateEvents()` - Batch processing

**Updated Files:**
- `src/main.ts` - Integrated into import flows
  - Added dedup to document upload flow
  - Added dedup to Google Drive import flow
  - Progress indicators for dedup process
  - Toast notifications with duplicate count

### 🎯 Benefits

- **Prevents Data Pollution**: No duplicate events in timeline
- **Multi-Source Safe**: Import from multiple sources without fear
- **Intelligent**: Catches both exact and semantic duplicates
- **Performance**: Fast algorithms with AI only for edge cases
- **Transparent**: Users see what's being filtered

### 🔜 Future Enhancements (v2.7.3)

- User-configurable sensitivity thresholds
- Manual duplicate review interface
- Merge conflicting duplicates
- Cross-timeline deduplication

## [2.7.1] - 2025-10-06

### 📁 Google Drive Integration

**New Feature:** Import documents directly from Google Drive with OAuth 2.0 authentication.

### ✨ What's New

#### Google Drive OAuth
- **Secure Authentication**: OAuth 2.0 popup-based flow
- **Browse Drive Files**: View and select documents from your Google Drive
- **Multi-Format Support**: Google Docs, .txt, .docx, .pdf files
- **Auto-Export**: Google Docs automatically exported to plain text
- **Token Management**: Secure token storage with automatic expiration

#### Enhanced Import UI
- **Tab-Based Interface**: Switch between "Upload Files" and "Google Drive"
- **File Selection**: Checkboxes for selecting multiple Drive files
- **Batch Import**: Import multiple documents with one click
- **Progress Tracking**: Real-time progress for download and analysis
- **Connection Management**: Easy connect/disconnect from Drive

#### User Experience
1. Click "📝 Import Journal" button
2. Switch to "📁 Google Drive" tab
3. Click "Connect Google Drive"
4. Authorize in popup window
5. Select documents with checkboxes
6. Click "Import Selected Files"
7. AI analyzes and extracts events

### 🛠️ Technical Details

**New Files:**
- `src/services/google-drive.ts` - Complete Google Drive service
  - OAuth 2.0 authentication with popup
  - File listing with MIME type filters
  - Document download and export
  - Access token caching in LocalStorage

**Updated Files:**
- `src/main.ts` - Tab-based import UI
  - Drive authentication flow
  - File browser with checkboxes
  - Batch import functionality
- `google-callback.html` - Multi-service OAuth callback
  - Supports both Google Photos and Drive
  - Dynamic UI based on service

**Configuration:**
Set `VITE_GOOGLE_DRIVE_CLIENT_ID` environment variable to enable Google Drive integration.

### 🎯 Integration Benefits

- **Seamless Access**: No need to download files manually
- **Always Up-to-Date**: Import latest versions from Drive
- **Efficient**: Reuses existing AI document analysis
- **Secure**: OAuth 2.0 standard authentication

## [2.7.0] - 2025-10-06

### 🤖 Document Import with AI Analysis

**New Feature:** Upload journal entries, text files, or documents and let AI automatically extract life events for your timeline.

### ✨ What's New

#### Document Import System
- **Drag & Drop Upload**: Intuitive file upload with visual drag-and-drop zone
- **Multi-File Processing**: Batch process multiple documents at once
- **AI Event Extraction**: Claude 3.5 Sonnet analyzes documents and identifies life events
- **Smart Preview**: Review extracted events with confidence scores before importing
- **Progress Tracking**: Real-time progress bar for batch document analysis
- **Supported Formats**: .txt, .docx, .pdf, .json files

#### AI Capabilities
- **Date Detection**: Automatically identifies dates (e.g., "March 2015", "last summer")
- **Event Splitting**: Separates multiple journal entries from single documents
- **Emotional Preservation**: Maintains authentic voice and emotional language
- **Auto-Tagging**: Suggests relevant tags for each extracted event
- **Confidence Scoring**: Shows reliability estimate (0-100%) for each event
- **Source Tracking**: Preserves original text snippets for reference

#### User Experience
1. Click "📝 Import Journal" button in timeline header
2. Drag files or click to browse
3. AI automatically analyzes and extracts events
4. Preview events with confidence scores and source text
5. Import all events with one click

### 🛠️ Technical Details

**New Files:**
- `src/services/document-import.ts` - Document parsing and analysis service
  - `ParsedDocument` interface for file metadata
  - `ExtractedEvent` interface for AI-extracted events
  - `processDocuments()` for batch processing
  - `analyzeDocument()` for AI analysis

**Updated Files:**
- `src/services/claude.ts` - Added `extractEventsFromDocument()` method
  - Specialized prompt for journal/document analysis
  - Preserves emotional authenticity
  - Handles ~15k character documents
- `src/main.ts` - Added document import modal and UI
  - 350+ lines of import functionality
  - Event preview with confidence indicators
  - Batch import with error handling

### 🎯 Use Cases

- Import old journal entries from other apps
- Extract events from diary text files
- Process exported notes from Google Docs/Word
- Bulk import life events from text archives
- Convert unstructured writing into timeline events

### 🔜 Coming Next (v2.7.1)

- Google Drive OAuth integration
- Direct import from Google Docs
- Smart deduplication for imported events
- Enhanced date parsing for more formats

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
