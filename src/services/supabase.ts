import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { TimelineEvent, Timeline } from '@/types';

// Supabase configuration
// TODO: Replace with actual Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('Supabase credentials missing!', {
        url: SUPABASE_URL,
        key: SUPABASE_ANON_KEY ? 'Present' : 'Missing'
      });
    }
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // Auth methods
  async signUp(email: string, password: string) {
    console.log('Attempting sign up with:', email);
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
    });
    console.log('Sign up result:', { data, error });
    return { data, error };
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  async signInWithGoogle() {
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
    });
    return { data, error };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut();
    return { error };
  }

  async getCurrentUser() {
    const { data: { user } } = await this.client.auth.getUser();
    return user;
  }

  async ensureUserRecord(authUser: any) {
    // Check if user record exists in public.users
    const { data: existingUser } = await this.client
      .from('users')
      .select('id')
      .eq('id', authUser.id)
      .single();

    if (!existingUser) {
      // Create user record
      const { error } = await this.client
        .from('users')
        .insert([{
          id: authUser.id,
          email: authUser.email,
          name: authUser.user_metadata?.name || null,
          avatar_url: authUser.user_metadata?.avatar_url || null
        }]);

      if (error) {
        console.error('Error creating user record:', error);
      }
    }
  }

  onAuthStateChange(callback: (user: any) => void) {
    return this.client.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }

  // Event methods
  async createEvent(event: Omit<TimelineEvent, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await this.client
      .from('events')
      .insert([event])
      .select()
      .single();
    return { data, error };
  }

  async getEvents(timeline_id: string) {
    const { data, error } = await this.client
      .from('events')
      .select('*')
      .eq('timeline_id', timeline_id)
      .order('date', { ascending: false });
    return { data, error };
  }

  async updateEvent(id: string, updates: Partial<TimelineEvent>) {
    const { data, error } = await this.client
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  async deleteEvent(id: string) {
    const { error } = await this.client
      .from('events')
      .delete()
      .eq('id', id);
    return { error };
  }

  // Photo methods
  async saveEventPhotos(event_id: string, photos: string[]) {
    const photoData = photos.map((data, index) => ({
      event_id,
      data,
      order: index,
    }));

    const { data, error } = await this.client
      .from('event_photos')
      .insert(photoData)
      .select();
    return { data, error };
  }

  async getEventPhotos(event_id: string) {
    const { data, error } = await this.client
      .from('event_photos')
      .select('*')
      .eq('event_id', event_id)
      .order('order', { ascending: true });
    return { data, error };
  }

  async deleteEventPhotos(event_id: string) {
    const { error } = await this.client
      .from('event_photos')
      .delete()
      .eq('event_id', event_id);
    return { error };
  }

  // Timeline methods
  async createTimeline(timeline: Omit<Timeline, 'id' | 'created_at'>) {
    const { data, error } = await this.client
      .from('timelines')
      .insert([timeline])
      .select()
      .single();
    return { data, error };
  }

  async getUserTimelines(user_id: string) {
    const { data, error } = await this.client
      .from('timelines')
      .select('*')
      .eq('owner_id', user_id);
    return { data, error };
  }

  // Event Connection methods
  async createEventConnection(event_id_1: string, event_id_2: string) {
    const { error } = await this.client
      .from('event_connections')
      .upsert({
        event_id_1,
        event_id_2,
        connection_type: 'manual',
        approved: true,
      }, { onConflict: 'event_id_1,event_id_2' });
    return { error };
  }

  async getEventConnections(eventIds: string[]) {
    if (eventIds.length === 0) return { data: [], error: null };

    const { data, error } = await this.client
      .from('event_connections')
      .select('*')
      .or(`event_id_1.in.(${eventIds.join(',')}),event_id_2.in.(${eventIds.join(',')})`);
    return { data, error };
  }

  // Real-time subscriptions
  subscribeToEvents(timeline_id: string, callback: (event: any) => void) {
    return this.client
      .channel(`events:${timeline_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `timeline_id=eq.${timeline_id}`,
        },
        callback
      )
      .subscribe();
  }

  // Collaboration methods
  async inviteUserToTimeline(timeline_id: string, email: string, permission_level: 'view' | 'edit' | 'admin', invited_by: string) {
    // First, check if user exists with this email
    const { data: users, error: userError } = await this.client
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !users) {
      return { data: null, error: { message: 'User not found with this email. They need to sign up first.' } };
    }

    // Create invitation
    const { data, error } = await this.client
      .from('shared_timelines')
      .insert([{
        timeline_id,
        user_id: users.id,
        permission_level,
        invited_by,
        accepted: false
      }])
      .select()
      .single();

    return { data, error };
  }

  async getTimelineInvitations(user_id: string) {
    const { data, error } = await this.client
      .from('shared_timelines')
      .select(`
        *,
        timeline:timelines(name, type),
        inviter:users!invited_by(email)
      `)
      .eq('user_id', user_id)
      .eq('accepted', false);

    return { data, error };
  }

  async acceptTimelineInvitation(share_id: string) {
    const { data, error } = await this.client
      .from('shared_timelines')
      .update({ accepted: true })
      .eq('id', share_id)
      .select()
      .single();

    return { data, error };
  }

  async declineTimelineInvitation(share_id: string) {
    const { error } = await this.client
      .from('shared_timelines')
      .delete()
      .eq('id', share_id);

    return { error };
  }

  async getTimelineShares(timeline_id: string) {
    const { data, error } = await this.client
      .from('shared_timelines')
      .select(`
        *,
        user:users(email)
      `)
      .eq('timeline_id', timeline_id)
      .eq('accepted', true);

    return { data, error };
  }

  async removeTimelineShare(share_id: string) {
    const { error } = await this.client
      .from('shared_timelines')
      .delete()
      .eq('id', share_id);

    return { error };
  }

  async updateSharePermission(share_id: string, permission_level: 'view' | 'edit' | 'admin') {
    const { data, error } = await this.client
      .from('shared_timelines')
      .update({ permission_level })
      .eq('id', share_id)
      .select()
      .single();

    return { data, error };
  }

  async getSharedTimelines(user_id: string) {
    const { data, error } = await this.client
      .from('shared_timelines')
      .select(`
        *,
        timeline:timelines(*)
      `)
      .eq('user_id', user_id)
      .eq('accepted', true);

    return { data, error };
  }
}

export const supabase = new SupabaseService();
