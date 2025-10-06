# 🤖 Record Your Story v2.0
### Your memories, powered by AI

> **A personal timeline application that uses Claude AI to transform how you capture and share life's moments.**

[![Live Demo](https://img.shields.io/badge/🚀-Live%20Demo-7266FF)](https://record-your-story.onrender.com)
[![Version](https://img.shields.io/badge/version-2.3.0--alpha-blue)](https://github.com/cwarloe/record-your-story/releases)
[![License](https://img.shields.io/badge/license-ISC-green)](LICENSE)

---

## ✨ What Makes v2.0 Special

**Record Your Story** isn't just another timeline app. It's the first personal timeline powered by AI that understands your stories and helps you share them with the people who matter.

### 🎤 Voice-to-Event (Coming Soon)
Just speak naturally - our AI creates the event for you
- "Last summer we went to Paris for two weeks..."
- → Title: "Family Vacation in Paris"
- → Auto-filled description, dates, tags

### 👥 Real-Time Collaboration (Live Now!)
Share timelines with family and friends
- Invite by email
- 3 permission levels (View, Edit, Admin)
- Perfect for family histories

### 🤖 AI Assistant (Foundation Ready)
Claude 3.5 Sonnet enhances your memories
- Improve event descriptions
- Auto-generate tags
- Timeline summaries: "Tell me about 2023"

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

- **Rich Event Creation**
  - Formatted text editor (Quill.js)
  - Photo uploads (unlimited via IndexedDB)
  - Tags and categories
  - Event connections (link related memories)

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

- **Productivity**
  - Undo/Redo (Ctrl+Z/Y)
  - Keyboard shortcuts (press `?` to see all)
  - Drag & drop photos
  - Dark mode

- **Export & Backup**
  - Export to PDF
  - Import/Export JSON
  - Local-first (IndexedDB + Supabase)

### 🚧 Coming Soon (AI Features)

- **Voice-to-Event** - Speak your story, AI does the rest
- **AI Enhancement** - One-click improve descriptions
- **Timeline Summaries** - "What happened in 2023?"
- **Smart Connections** - AI finds related events

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
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Claude AI (Optional - enables AI features)
VITE_ANTHROPIC_API_KEY=your-api-key
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

### v2.3.0 (In Progress)
- [ ] Voice recording UI
- [ ] AI event suggestions
- [ ] Timeline summaries
- [ ] Smart event connections

### v2.4.0 (Planned)
- [ ] Google Photos import
- [ ] Email invitations for non-users
- [ ] Map view of events
- [ ] Video/audio upload UI

### v2.5.0 (Planned)
- [ ] Premium features (Whisper API)
- [ ] Mobile apps (React Native)
- [ ] Ancestry.com partnership
- [ ] Multi-language support

---

## 📊 Version History

### v2.3.0-alpha (Current)
**AI Features Foundation**
- Claude 3.5 Sonnet integration
- Voice-to-event service layer
- AI enhancement methods
- Timeline intelligence ready

### v2.1.0
**Collaboration Features**
- Share timelines with users
- Permission management
- Invitation system
- Real-time collaboration

### v2.0.4
**Enhanced UX**
- Keyboard shortcuts
- Undo/Redo system
- Toast notifications
- Help modal

### v1.0.0
**MVP Release**
- Core timeline functionality
- Photo uploads
- Export PDF
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
