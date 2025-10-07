# 🤖 Record Your Story v2.7.1
### Your memories, powered by AI

> **A personal timeline application that uses Claude AI to transform how you capture and share life's moments.**

[![Live Demo](https://img.shields.io/badge/🚀-Live%20Demo-7266FF)](https://record-your-story.onrender.com)
[![Version](https://img.shields.io/badge/version-2.7.1-blue)](https://github.com/cwarloe/record-your-story/releases)
[![License](https://img.shields.io/badge/license-ISC-green)](LICENSE)

---

## ✨ What Makes v2.7 Special

**Record Your Story** isn't just another timeline app. It's the first personal timeline powered by AI that understands your stories and helps you share them with the people who matter.

### 📝 Document Import with AI Analysis (NEW!)
Transform journals and text files into timeline events automatically
- **Upload Files**: Drag & drop .txt, .docx, .pdf, or .json files
- **Google Drive Integration**: Import directly from Drive with OAuth 2.0 🆕
- **AI Event Extraction**: Automatically identifies and extracts life events
- **Smart Date Detection**: Recognizes dates in various formats
- **Batch Processing**: Import multiple documents at once
- **Event Preview**: Review with confidence scores before importing
- **Emotional Preservation**: Keeps your authentic voice
- Perfect for importing old diaries, notes, Google Docs, and journal exports

### 🎤 Voice-to-Event (Live Now!)
Just speak naturally - Claude AI creates the event for you
- Click the microphone icon → speak your story
- AI extracts title, date, description, and tags
- Powered by Web Speech API + Claude 3.5 Sonnet
- Works in Chrome/Edge browsers

### 👥 Real-Time Collaboration (Live Now!)
Share timelines with family and friends
- Invite by email
- 3 permission levels (View, Edit, Admin)
- Perfect for family histories

### 🤖 AI Assistant (Live Now!)
Claude 3.5 Sonnet enhances your memories
- **Document Analysis**: Extract events from journals automatically
- **Voice-to-Event**: Speak naturally, AI creates the event
- **Timeline Summary**: Generate narrative summaries of your life
- **Smart Connections**: Discover relationships between events
- **Auto-Tagging**: AI suggests relevant tags
- **Event Enhancement**: Expand and enrich descriptions

### 📷 Google Photos Integration (Beta)
Import your memories directly from Google Photos
- OAuth 2.0 secure authentication
- Batch import with progress tracking
- Automatic event creation from photo metadata
- EXIF date extraction

---

## 🚀 Quick Start

### Try It Live
**👉 [record-your-story.onrender.com](https://record-your-story.onrender.com)**

1. Sign up with email
2. Create your first event
3. Add photos, tags, descriptions
4. Share with family (👥 Share button)

### Run Locally

```bash
# Clone the repo
git clone https://github.com/cwarloe/record-your-story.git
cd record-your-story

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev
# Open http://localhost:3000

# Build for production
npm run build
```

---

## 🎯 Key Features

### ✅ Available Now

- **🤖 AI-Powered Imports** 🆕
  - **Document Analysis**: Upload journals/text files, AI extracts events
  - **Google Drive**: Import directly from Drive with OAuth 2.0 🆕
  - **Voice-to-Event**: Speak your story, AI creates the event
  - **Smart Date Detection**: Recognizes "March 2015", "last summer", etc.
  - **Emotional Preservation**: Keeps your authentic voice
  - **Batch Processing**: Import multiple documents at once
  - **Confidence Scoring**: See reliability of extracted events

- **Rich Event Creation**
  - Formatted text editor (Quill.js)
  - Photo uploads (unlimited via IndexedDB)
  - Tags and categories
  - Event connections (link related memories)
  - AI Enhancement (expand descriptions with Claude)

- **Timeline Collaboration** 🆕
  - Share timelines by email
  - Permission management (View/Edit/Admin)
  - Real-time updates
  - Perfect for family histories

- **Smart Organization**
  - Advanced search (text, date, tags)
  - Filter by date range
  - Tag-based filtering
  - Year markers on timeline
  - AI Timeline Summary (narrative overview)
  - Smart Connections (discover related events)

- **Productivity**
  - Undo/Redo (Ctrl+Z/Y)
  - Keyboard shortcuts (press `?` to see all)
  - Drag & drop photos
  - Dark mode

- **Export & Backup**
  - Export to PDF
  - Import/Export JSON
  - Local-first (IndexedDB + Supabase)

### 🚧 Coming in v3.0

- **Claude Chat History Import** - Extract events from conversations
- **Enhanced Deduplication** - Smart detection of duplicate imports
- **Advanced Date Parsing** - More natural language date formats
- **Gmail Integration** - Import events from email
- **Google Calendar Import** - Sync events from calendar
- **Map View** - See your events on an interactive map
- **Video/Audio Upload** - Rich media beyond photos
- **SendGrid Email** - Send invitations to non-users

---

## 🏗️ Tech Stack

**Frontend:**
- TypeScript + Vite
- Vanilla JavaScript (no framework bloat)
- Quill.js for rich text
- IndexedDB for photos

**Backend:**
- Supabase (PostgreSQL + Auth + Storage)
- Row Level Security (RLS) for multi-user
- Real-time subscriptions

**AI:**
- Claude 3.5 Sonnet (Anthropic)
- Web Speech API (browser)
- Cost: ~$0.003 per AI-assisted event

**Deployment:**
- Render (static site)
- Automatic deploys from GitHub
- Free tier available

---

## 📁 Project Structure

```
record-your-story/
├── src/
│   ├── main.ts              # Main app logic
│   ├── style.css            # Styling (CSS variables)
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   └── services/
│       ├── supabase.ts      # Database service
│       └── claude.ts        # AI service (v2.3.0)
├── migrations/              # Database migrations
├── schema.sql              # Full database schema
├── index.html              # Entry point
├── AI_FEATURES.md          # AI implementation guide
├── COLLABORATION.md        # Collaboration docs
└── RENDER_DEPLOYMENT.md    # Deployment guide
```

---

## 🔧 Configuration

### Environment Variables

Create `.env` file:

```bash
# Supabase (Required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Claude AI (Optional - enables voice-to-event)
VITE_ANTHROPIC_API_KEY=your-api-key

# Google Photos (Optional - enables photo import)
VITE_GOOGLE_CLIENT_ID=your-client-id
```

### Database Setup

1. Create Supabase project
2. Run `schema.sql` in SQL Editor
3. Run migration: `migrations/v2.1.0_collaboration.sql`
4. Enable RLS policies (included in schema)

**Full guide:** [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

---

## 📚 Documentation

- **[AI Features Guide](AI_FEATURES.md)** - Implementing voice & AI
- **[Collaboration Setup](COLLABORATION.md)** - Timeline sharing
- **[Deployment Guide](RENDER_DEPLOYMENT.md)** - Deploy to Render
- **[v1 README](MVP-README.md)** - Original MVP documentation
- **[Changelog](CHANGELOG.md)** - Version history

---

## 🎯 Use Cases

### Family Histories
Share timeline with family members, each adding their memories. Perfect for preserving stories across generations.

### Life Milestones
Track career, relationships, travels. Export to PDF for job applications or memoirs.

### Project Documentation
Chronicle project evolution with photos, notes, and team collaboration.

### Medical Records
Keep timeline of appointments, treatments, symptoms. Share with doctors.

---

## 🤝 Contributing

Contributions welcome! This is an open-source project.

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Development Notes:**
- Use TypeScript strict mode
- Follow existing code style
- Add JSDoc comments for functions
- Test locally before submitting

---

## 🛣️ Roadmap

### v2.3.0 (Released) ✅
- [x] Voice recording UI with Web Speech API
- [x] AI event suggestions with Claude 3.5
- [x] Voice-to-event conversion
- [x] Natural language date extraction

### v2.4.0 (Released) ✅
- [x] Email invitation system (database ready)
- [x] Improved collaboration UI
- [x] Permission management enhancements

### v2.5.0 (Beta) 🚧
- [x] Google Photos import
- [x] Google Sign-In OAuth
- [x] Supabase Edge Function for import
- [ ] SendGrid email delivery (configured but not enabled)

### v3.0.0 (Planned) 📅
- [ ] Map view of events with geolocation
- [ ] Video/audio upload and playback
- [ ] AI timeline summaries
- [ ] Smart event connection suggestions
- [ ] Mobile-optimized PWA

---

## 📊 Version History

### v2.5.0-beta (Current)
**Google Integration + AI Voice**
- Google Photos import with OAuth 2.0
- Google Sign-In authentication
- Voice-to-event with Claude AI
- Supabase Edge Functions
- Email invitation backend

### v2.4.0 (December 2024)
**Collaboration Enhancements**
- Email invitation system
- Enhanced sharing UI
- Permission management improvements
- Database optimizations

### v2.3.0 (December 2024)
**AI Features Launch**
- Claude 3.5 Sonnet integration
- Voice recording with Web Speech API
- Natural language processing
- Auto-extract dates and tags

### v2.1.0 (November 2024)
**Collaboration Features**
- Share timelines with users
- Permission management (View/Edit/Admin)
- Real-time collaboration
- Invitation workflows

### v2.0.4 (November 2024)
**Enhanced UX**
- Keyboard shortcuts
- Undo/Redo system
- Toast notifications
- Help modal

### v1.0.0 (October 2024)
**MVP Release**
- Core timeline functionality
- Photo uploads (IndexedDB)
- Export PDF/JSON
- Local-first storage

**[Full Changelog](CHANGELOG.md)**

---

## 💡 Why "Record Your Story"?

Most timeline apps treat your memories like database entries. We believe your stories deserve better.

With AI assistance:
- **No writer's block** - Just speak, we'll format
- **Better writing** - AI enhances your descriptions
- **Automatic organization** - Tags, dates, connections
- **Meaningful summaries** - Not just lists, but narratives

Your life is a story. Let's tell it well.

---

## 🏆 What Makes This Different

| Feature | Record Your Story | Other Apps |
|---------|------------------|------------|
| AI Writing Assistant | ✅ Claude 3.5 | ❌ |
| Voice-to-Event | ✅ Coming Soon | ❌ |
| Real Collaboration | ✅ Live Now | ⚠️ Limited |
| Rich Media | ✅ Photos/Video/Audio | ⚠️ Photos Only |
| Export Options | ✅ PDF/JSON | ⚠️ Limited |
| Privacy First | ✅ Local + Cloud | ❌ Cloud Only |
| Open Source | ✅ Yes | ❌ |

---

## 📄 License

ISC License - Free for personal and commercial use

---

## 🙏 Acknowledgments

- **Claude AI** (Anthropic) - AI-powered features
- **Supabase** - Backend infrastructure
- **Quill.js** - Rich text editor
- **Vite** - Lightning-fast dev experience

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/cwarloe/record-your-story/issues)
- **Discussions:** [GitHub Discussions](https://github.com/cwarloe/record-your-story/discussions)
- **Live Demo:** [record-your-story.onrender.com](https://record-your-story.onrender.com)

---

## 🌟 Star This Repo!

If you find this useful, please give it a ⭐ on GitHub. It helps others discover the project!

---

**Built with ❤️ using Claude Code**

*Your memories deserve the best technology. Let's preserve them together.*
