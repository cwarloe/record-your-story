# Timeline Collaboration Architecture

## Overview

Record Your Story v2.1+ supports timeline collaboration, allowing users to share timelines with others and collaborate on events together.

## Database Schema

### `shared_timelines` Table

```sql
CREATE TABLE public.shared_timelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_id UUID NOT NULL REFERENCES public.timelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit', 'admin')),
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_share UNIQUE (timeline_id, user_id)
);
```

### Permission Levels

**View** - Read-only access
- Can view all events in the timeline
- Can see timeline details
- Cannot create, edit, or delete events
- Cannot manage collaborators

**Edit** - Full event management
- All View permissions
- Can create new events
- Can edit ANY event in the timeline (not just their own)
- Can delete ANY event
- Cannot manage collaborators
- Cannot delete the timeline

**Admin** - Full control except ownership
- All Edit permissions
- Can invite new collaborators
- Can change collaborator permissions
- Can remove collaborators
- Cannot delete the timeline (only owner can)
- Cannot transfer ownership

**Owner** (implicit) - Complete control
- All Admin permissions
- Can delete the timeline
- Can transfer ownership (future feature)
- Cannot be removed from timeline

## Row Level Security (RLS)

### Timeline Access

Users can access timelines if:
- They own the timeline (owner_id = auth.uid())
- They have an accepted share for the timeline

```sql
CREATE POLICY "Users can view their own timelines and shared timelines"
  ON public.timelines FOR SELECT
  USING (
    auth.uid() = owner_id OR
    id IN (
      SELECT timeline_id FROM public.shared_timelines
      WHERE user_id = auth.uid() AND accepted = TRUE
    )
  );
```

### Event Access

Users can view events if:
- They authored the event
- They are mentioned in the event
- They own the timeline
- They have an accepted share for the timeline

Users can create events if:
- They own the timeline, OR
- They have 'edit' or 'admin' permission on the timeline

Users can edit/delete events if:
- They authored the event, OR
- They have 'edit' or 'admin' permission on the timeline

## Implementation Guide

### Step 1: Supabase Service Methods

Add these methods to `src/services/supabase.ts`:

```typescript
// Share timeline with user by email
async shareTimeline(
  timelineId: string,
  userEmail: string,
  permissionLevel: 'view' | 'edit' | 'admin'
): Promise<{ data: SharedTimeline | null; error: any }> {
  // 1. Look up user by email
  const { data: users, error: userError } = await this.client
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single();

  if (userError || !users) {
    return { data: null, error: 'User not found' };
  }

  // 2. Create share
  const { data, error } = await this.client
    .from('shared_timelines')
    .insert({
      timeline_id: timelineId,
      user_id: users.id,
      permission_level: permissionLevel,
      invited_by: (await this.getCurrentUser())!.id,
      accepted: false, // Requires user acceptance
    })
    .select()
    .single();

  return { data, error };
}

// Get collaborators for a timeline
async getTimelineCollaborators(
  timelineId: string
): Promise<{ data: any[] | null; error: any }> {
  const { data, error } = await this.client
    .from('shared_timelines')
    .select(`
      *,
      user:users(id, email, name),
      invited_by_user:users!invited_by(id, email, name)
    `)
    .eq('timeline_id', timelineId);

  return { data, error };
}

// Accept timeline share invitation
async acceptTimelineShare(shareId: string): Promise<{ error: any }> {
  const { error } = await this.client
    .from('shared_timelines')
    .update({ accepted: true })
    .eq('id', shareId);

  return { error };
}

// Update collaborator permission
async updateCollaboratorPermission(
  shareId: string,
  permissionLevel: 'view' | 'edit' | 'admin'
): Promise<{ error: any }> {
  const { error } = await this.client
    .from('shared_timelines')
    .update({ permission_level: permissionLevel })
    .eq('id', shareId);

  return { error };
}

// Remove collaborator
async removeCollaborator(shareId: string): Promise<{ error: any }> {
  const { error } = await this.client
    .from('shared_timelines')
    .delete()
    .eq('id', shareId);

  return { error };
}

// Get pending shares for current user
async getPendingShares(): Promise<{ data: any[] | null; error: any }> {
  const user = await this.getCurrentUser();
  if (!user) return { data: null, error: 'Not authenticated' };

  const { data, error } = await this.client
    .from('shared_timelines')
    .select(`
      *,
      timeline:timelines(id, name, type),
      invited_by_user:users!invited_by(id, email, name)
    `)
    .eq('user_id', user.id)
    .eq('accepted', false);

  return { data, error };
}
```

### Step 2: UI Components

#### Share Timeline Modal

Add a "Share" button to the timeline header (next to timeline name):

```html
<button id="share-timeline-btn" class="btn btn-secondary btn-small">
  👥 Share
</button>
```

Modal HTML:

```html
<div id="share-modal" class="modal hidden">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h3>Share Timeline</h3>
      <button class="modal-close">&times;</button>
    </div>
    <form id="share-form">
      <label>User Email</label>
      <input type="email" id="share-email" placeholder="user@example.com" required />

      <label>Permission Level</label>
      <select id="share-permission">
        <option value="view">View Only</option>
        <option value="edit">Can Edit</option>
        <option value="admin">Admin</option>
      </select>

      <button type="submit" class="btn btn-primary">Send Invitation</button>
    </form>

    <div class="collaborators-section">
      <h4>Current Collaborators</h4>
      <div id="collaborators-list"></div>
    </div>
  </div>
</div>
```

#### Pending Invitations Badge

Show pending invitations in header:

```html
<div class="pending-invitations" id="pending-invites">
  <button class="btn btn-small">
    📬 Invitations (<span id="pending-count">0</span>)
  </button>
</div>
```

#### Invitations Modal

```html
<div id="invitations-modal" class="modal hidden">
  <div class="modal-overlay"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h3>Timeline Invitations</h3>
      <button class="modal-close">&times;</button>
    </div>
    <div id="invitations-list">
      <!-- Populated dynamically -->
    </div>
  </div>
</div>
```

### Step 3: Frontend Logic

#### Load Shared Timelines

Update `loadUserData()` to include shared timelines:

```typescript
async function loadUserData() {
  // ... existing code ...

  // Get user's timelines (owned)
  const { data: ownedTimelines } = await supabase.getUserTimelines(currentUser.id);

  // Get shared timelines
  const { data: sharedTimelines } = await supabase.client
    .from('shared_timelines')
    .select('*, timeline:timelines(*)')
    .eq('user_id', currentUser.id)
    .eq('accepted', true);

  // Combine and mark ownership
  userTimelines = [
    ...(ownedTimelines || []).map(t => ({ ...t, isOwner: true })),
    ...(sharedTimelines || []).map(s => ({
      ...s.timeline,
      isOwner: false,
      permission: s.permission_level
    }))
  ];

  // ... rest of code ...
}
```

#### Show Pending Invitations on Load

```typescript
async function checkPendingInvitations() {
  const { data: pending } = await supabase.getPendingShares();

  const count = pending?.length || 0;
  const countEl = document.getElementById('pending-count');
  if (countEl) countEl.textContent = count.toString();

  // Show/hide badge
  const badge = document.getElementById('pending-invites');
  if (badge) {
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}
```

#### Handle Share Form

```typescript
async function handleShareTimeline(e: SubmitEvent) {
  e.preventDefault();

  const email = (document.getElementById('share-email') as HTMLInputElement).value;
  const permission = (document.getElementById('share-permission') as HTMLSelectElement).value;

  if (!currentTimeline) return;

  const { data, error } = await supabase.shareTimeline(
    currentTimeline.id,
    email,
    permission as 'view' | 'edit' | 'admin'
  );

  if (error) {
    showToast(`Error sharing timeline: ${error}`, 'error');
  } else {
    showToast(`Invitation sent to ${email}`, 'success');
    await loadCollaborators();
    (document.getElementById('share-email') as HTMLInputElement).value = '';
  }
}
```

#### Accept Invitation

```typescript
async function acceptInvitation(shareId: string) {
  const { error } = await supabase.acceptTimelineShare(shareId);

  if (error) {
    showToast('Error accepting invitation', 'error');
  } else {
    showToast('Timeline added to your account!', 'success');
    await loadUserData(); // Refresh timelines
    await checkPendingInvitations(); // Update badge
    showApp();
  }
}
```

### Step 4: Permission Checks

Before allowing edit/delete actions, check permissions:

```typescript
function canEditTimeline(timeline: Timeline): boolean {
  if (!currentUser) return false;

  // Owner can always edit
  if (timeline.owner_id === currentUser.id) return true;

  // Check shared permission
  const share = userTimelines.find(t =>
    t.id === timeline.id && !t.isOwner
  );

  return share?.permission === 'edit' || share?.permission === 'admin';
}

function canManageCollaborators(timeline: Timeline): boolean {
  if (!currentUser) return false;

  // Owner and admins can manage
  if (timeline.owner_id === currentUser.id) return true;

  const share = userTimelines.find(t =>
    t.id === timeline.id && !t.isOwner
  );

  return share?.permission === 'admin';
}
```

Hide/disable UI elements based on permissions:

```typescript
// In showApp()
if (!canEditTimeline(currentTimeline)) {
  document.getElementById('add-event-btn')?.setAttribute('disabled', 'true');
}

if (!canManageCollaborators(currentTimeline)) {
  document.getElementById('share-timeline-btn')?.style.display = 'none';
}

// On each event card
if (!canEditEvent(event)) {
  editBtn.style.display = 'none';
  deleteBtn.style.display = 'none';
}
```

## Visual Indicators

### Timeline Badge

Show who owns the timeline:

```html
<h2>
  ${currentTimeline.name}
  ${currentTimeline.isOwner
    ? '<span class="owner-badge">Owner</span>'
    : `<span class="shared-badge">${currentTimeline.permission}</span>`
  }
</h2>
```

### Event Author Display

Show who created each event:

```typescript
// In renderTimeline()
<div class="event-meta">
  <span class="event-author">By ${event.author_email || 'Unknown'}</span>
  ${event.author_id !== currentUser?.id ? '<span class="shared-tag">Shared</span>' : ''}
</div>
```

## CSS Styling

```css
.owner-badge {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  margin-left: 0.5rem;
  font-weight: 600;
}

.shared-badge {
  background: linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  margin-left: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
}

.collaborator-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border);
}

.collaborator-info {
  display: flex;
  flex-direction: column;
}

.collaborator-email {
  font-weight: 600;
  color: var(--text-primary);
}

.collaborator-permission {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.collaborator-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.pending-invitations {
  position: relative;
}

.invitation-item {
  padding: var(--spacing-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
  background: var(--bg-secondary);
}

.invitation-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
```

## Testing Checklist

- [ ] Owner can share timeline with view permission
- [ ] Owner can share timeline with edit permission
- [ ] Owner can share timeline with admin permission
- [ ] Invited user receives invitation
- [ ] Invited user can accept invitation
- [ ] Invited user can decline invitation
- [ ] View-only user cannot create/edit/delete events
- [ ] Edit user can create/edit/delete events
- [ ] Edit user cannot manage collaborators
- [ ] Admin user can manage collaborators
- [ ] Admin user cannot delete timeline
- [ ] Owner can change collaborator permissions
- [ ] Owner can remove collaborators
- [ ] Shared timeline appears in timeline dropdown
- [ ] Permission badges display correctly
- [ ] Timeline switcher shows ownership status
- [ ] RLS policies prevent unauthorized access
- [ ] Cannot share with same user twice
- [ ] Cannot share timeline you don't own

## Future Enhancements

- **Email Notifications**: Send email when timeline is shared
- **Real-time Updates**: WebSocket sync for multi-user editing
- **Activity Feed**: Show who did what in shared timelines
- **Comments**: Allow collaborators to comment on events
- **Version History**: Track all changes in shared timelines
- **Offline Sync**: Handle conflicts when multiple users edit offline
- **Transfer Ownership**: Allow owner to transfer to another user
- **Public Sharing**: Generate public view-only links
- **Export Permissions**: Control who can export the timeline

## Security Considerations

- All database access controlled by RLS policies
- Users can only see emails of people they share timelines with
- Invitation acceptance prevents unauthorized access
- Permission checks on both frontend and backend
- Share links should be one-time use tokens (future)
- Audit log for sensitive operations (future)

---

**Status**: Foundation complete (schema + types). Frontend implementation needed.
**Estimated Effort**: 4-6 hours for full UI implementation
**Priority**: High (enables family/team collaboration use cases)
