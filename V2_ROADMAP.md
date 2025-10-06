# Record Your Story v2.0 - Scope & Roadmap

## 🎯 V2.0 Vision
**"Connected Storylines"** - Where everyone's life stories intersect, get tagged, and AI helps find the meaningful connections.

---

## ✅ Current Status (v1.5 - Cloud-Enabled MVP)

**Completed:**
- ✅ Authentication (email/password, Google OAuth)
- ✅ Cloud database (Supabase with RLS)
- ✅ Create events with rich text (Quill.js)
- ✅ Photo uploads (unlimited via Supabase)
- ✅ Tags system (add/remove)
- ✅ Dark mode with persistence
- ✅ Timeline display (chronological)
- ✅ Real-time sync infrastructure

**What Works:**
- Users can sign up/in
- Create events with photos, rich text, tags
- Data persists in cloud
- Responsive UI

---

## 🚀 V2.0 Scope - Core Features

### **MUST HAVE** (v2.0 Release Blockers)

#### 1. **Search & Filter** ⭐ Sprint 1
**User Story:** "I have 50+ events and need to find specific moments quickly"

**Features:**
- Text search (title + description)
- Date range filter (from/to dates)
- Tag filter (click tag to filter)
- Clear filters button
- Real-time filtering (no page reload)

**Acceptance Criteria:**
- [ ] Search box filters events as user types (debounced)
- [ ] Date pickers filter by range
- [ ] Clicking a tag filters timeline to that tag
- [ ] "Clear filters" resets to all events
- [ ] Works with 100+ events smoothly

---

#### 2. **Edit & Delete Events** ⭐ Sprint 1
**User Story:** "I made a typo and want to fix my event"

**Features:**
- Click event to edit (opens pre-filled modal)
- Delete event with confirmation
- Edit preserves photos and tags
- Optimistic UI updates

**Acceptance Criteria:**
- [ ] Click event → opens edit modal with existing data
- [ ] Save updates event in database
- [ ] Delete shows confirmation dialog
- [ ] Photos and tags load correctly in edit mode
- [ ] Timeline updates immediately after save/delete

---

#### 3. **Event Connections** ⭐ Sprint 2
**User Story (Your Friend's Vision):** "I want to link related events to see how stories connect"

**Features:**
- "Link Event" button on each event
- Select related events to connect
- Visual indicator of linked events (badge/icon)
- Click connection to navigate to linked event
- View all connections for an event

**UI Design:**
```
[Event Card]
  Title: "Started at Google"
  Date: 2015-03-15
  [🔗 2 connections] ← Click to see linked events
    → "Graduated from Stanford" (2014-06)
    → "Promoted to Manager" (2017-11)
```

**Acceptance Criteria:**
- [ ] "Link Event" UI in event modal/card
- [ ] Can select multiple events to connect
- [ ] Connections saved to `event_connections` table
- [ ] Visual badge shows connection count
- [ ] Click badge to see linked events
- [ ] Bi-directional (A→B means B→A)

---

#### 4. **Multiple Timelines** ⭐ Sprint 2
**User Story:** "I want separate timelines for work, family, and personal life"

**Features:**
- Create named timelines (Personal, Family, Work, etc.)
- Timeline switcher in header
- Each timeline has own events
- Timeline-specific themes/colors (optional)
- Default timeline auto-created on signup

**UI Design:**
```
[Header]
  Timeline: [Personal ▼]  ← Dropdown to switch
    • Personal (45 events)
    • Family (23 events)
    • Work (18 events)
    + Create New Timeline
```

**Acceptance Criteria:**
- [ ] Dropdown to switch between timelines
- [ ] "Create Timeline" modal (name, type)
- [ ] Events scoped to current timeline
- [ ] URL reflects current timeline (?timeline=work)
- [ ] Default "My Story" timeline created for new users

---

### **SHOULD HAVE** (v2.0 Enhanced)

#### 5. **AI-Powered Event Suggestions** 🤖 Sprint 3
**User Story:** "AI helps me discover connections I didn't notice"

**Features:**
- Detect overlapping dates between users' events
- Suggest connections based on keywords (NLP)
- "You might want to link these events" suggestions
- Confidence score for suggestions
- Approve/dismiss suggestions

**Example AI Logic:**
```javascript
// User A has: "Vacation in Paris" (2019-07-15)
// User B has: "Summer Trip to France" (2019-07-12)
// AI suggests: "These events happened at the same time, link them?"
```

**Technical Approach:**
- Simple keyword matching (Paris, France, 2019)
- Date proximity detection (±7 days)
- Shared tags/locations
- Store in `event_connections` with type: 'ai_suggested'

**Acceptance Criteria:**
- [ ] AI scans for overlapping events (date + keywords)
- [ ] Suggestions appear in "Suggestions" panel
- [ ] Show confidence score (High/Medium/Low)
- [ ] User can approve → creates connection
- [ ] User can dismiss → hides suggestion
- [ ] Runs weekly in background (or on-demand)

---

#### 6. **@Mentions & Shared Events** 👥 Sprint 4
**User Story:** "When I tag my friend in my wedding event, they see it on their timeline"

**Features:**
- @mention users in event description or dedicated field
- Tagged users see event in "Your Appearances" section
- Approve/decline mention requests (privacy)
- Mentioned events show on your timeline (visual distinction)
- Notification when you're mentioned

**UI Design:**
```
[Event Form]
  Title: "My Wedding"
  Date: 2020-08-15
  Mention People: [@john @sarah] ← Type to search users

[John's Timeline - "Your Appearances" Tab]
  📍 You appear in:
    • "My Wedding" by @charlie (2020-08-15)
```

**Acceptance Criteria:**
- [ ] "@mention" input field in event form
- [ ] Search users by email/name
- [ ] Mentioned users receive notification
- [ ] "Your Appearances" tab shows where you're tagged
- [ ] Approve/decline mention requests
- [ ] Visual distinction (different border/icon) for shared events

---

### **NICE TO HAVE** (Post v2.0)

#### 7. **Advanced AI Features** 🤖 Future
- Auto-suggest event titles from description
- Photo date extraction (EXIF data)
- Timeline story summarization
- "Memory prompts" - "What happened in 2015?"

#### 8. **Collaboration Features** 👥 Future
- Shared timelines (family timeline)
- Real-time collaborative editing
- Comments on events
- Activity feed

#### 9. **Export & Import** 📦 Future
- Export timeline to PDF with photos
- JSON/CSV export for data portability
- Import from other services (Facebook timeline, etc.)

---

## 📅 Sprint Plan (Agile 2-Week Sprints)

### **Sprint 1: Core Usability** (Weeks 1-2)
**Goal:** Users can manage their events effectively

- [ ] Search & Filter UI + logic
- [ ] Edit event (pre-fill modal with existing data)
- [ ] Delete event with confirmation
- [ ] Testing: Create 50+ events, search/filter smoothly

**Definition of Done:**
- All acceptance criteria met
- Responsive on mobile
- No console errors
- Supabase queries optimized

---

### **Sprint 2: Connections & Timelines** (Weeks 3-4)
**Goal:** Users can organize and link their stories

- [ ] Multiple timelines (create, switch, delete)
- [ ] Event connections UI (link/unlink)
- [ ] Visual connection indicators
- [ ] Navigation between linked events
- [ ] Testing: Link 10+ events across 3 timelines

**Definition of Done:**
- Connections work bi-directionally
- Timeline switcher persists selection
- Links visible on event cards
- Database schema handles connections properly

---

### **Sprint 3: AI Discovery** (Weeks 5-6)
**Goal:** AI helps users find meaningful connections

- [ ] AI matching algorithm (keyword + date proximity)
- [ ] Suggestions panel UI
- [ ] Approve/dismiss suggestions
- [ ] Confidence scoring
- [ ] Testing: AI finds 80%+ of obvious connections

**Definition of Done:**
- AI suggests connections based on overlaps
- User can accept/reject suggestions
- False positives < 20%
- Runs efficiently for 100+ events

---

### **Sprint 4: Social Features** (Weeks 7-8)
**Goal:** Users can tag each other in shared memories

- [ ] @mention user search
- [ ] "Your Appearances" feed
- [ ] Mention approval system
- [ ] Notifications (basic)
- [ ] Privacy controls
- [ ] Testing: Tag friends, see shared events

**Definition of Done:**
- Users can @mention others
- Tagged users see events in appearances feed
- Privacy: approve/decline mentions
- Real-time updates via Supabase subscriptions

---

## 🎯 V2.0 Success Metrics

**User Engagement:**
- Average events per user: 30+
- Average connections per user: 10+
- Weekly active users (returning): 60%+

**Feature Adoption:**
- % users with multiple timelines: 40%+
- % users who link events: 70%+
- % users who use AI suggestions: 50%+
- % users who @mention others: 30%+

**Technical:**
- Page load time: < 2s
- Search responsiveness: < 100ms
- AI suggestion accuracy: 80%+

---

## 🧪 Testing Strategy

### **Unit Tests**
- Search/filter logic
- AI matching algorithm
- Event CRUD operations

### **Integration Tests**
- Supabase queries
- Real-time subscriptions
- Auth flows

### **User Testing**
- 5 users test each sprint
- Feedback loop: bugs → fixes within sprint
- Feature toggles for beta testing

---

## 🚫 Out of Scope (Not in v2.0)

**Explicitly NOT building:**
- ❌ Mobile apps (native iOS/Android)
- ❌ Payment/monetization
- ❌ Advanced permissions (admin/editor/viewer)
- ❌ Video uploads
- ❌ Public profiles/discovery
- ❌ Analytics dashboard

**Rationale:** Focus on core "connected storylines" vision. These can be v3.0+.

---

## 🤝 Decision Framework

**When adding features, ask:**
1. Does this help find meaningful connections between events?
2. Does this support multiple timelines (work/family/personal)?
3. Does this leverage AI to enhance discovery?
4. Can we build it in 1 sprint (2 weeks)?

**If NO to 2+ questions → defer to backlog**

---

## 📋 Acceptance Criteria for v2.0 Release

**Before we can call it v2.0:**
- [x] Cloud authentication working
- [x] Events with photos/tags/rich text
- [ ] Search & filter working
- [ ] Edit/delete events
- [ ] Event connections (manual linking)
- [ ] Multiple timelines
- [ ] AI suggestions (at least basic keyword matching)
- [ ] @mentions with "Your Appearances" feed
- [ ] Mobile responsive
- [ ] Dark mode
- [ ] No critical bugs
- [ ] Performance: handles 100+ events smoothly

**Nice to have (can ship without):**
- Real-time notifications
- Advanced AI (NLP beyond keywords)
- PDF export
- Comments on events

---

## 🚀 Post-v2.0 Roadmap (v3.0 Ideas)

**Potential Future Features:**
- Shared family timelines (collaborative)
- AI-powered "story suggestions" (write this event for you)
- Import from social media (Facebook, Instagram)
- Voice recording for events
- Mobile apps (React Native)
- Monetization (premium AI features)

---

## ✅ Next Steps (This Week)

### **Immediate Tasks:**
1. **Agree on v2.0 scope** (this document)
2. **Start Sprint 1:**
   - Search & filter UI wireframe
   - Edit event flow diagram
   - Database query optimization for search

3. **Set up project board:**
   - GitHub Projects or Trello
   - Backlog → To Do → In Progress → Done
   - Sprint planning every 2 weeks

---

## 📝 Open Questions (To Discuss)

1. **AI Complexity:** Start with simple keyword matching or invest in NLP library (compromise: start simple, iterate)?
2. **Mentions Privacy:** Default to "auto-approve" or "approval required" for mentions?
3. **Timeline Limit:** Max number of timelines per user? (Suggest: 10)
4. **Connection Types:** Just "related" or specific types (same event, cause-effect, etc.)?
5. **Real-time Updates:** How aggressive? (Push notifications, websockets, or polling?)

---

**Does this scope align with your vision? Any features to add/remove/prioritize differently?** 🚀

Let's finalize this roadmap and start building! 💪
