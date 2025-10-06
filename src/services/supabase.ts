import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User, Event, Timeline, EventPhoto } from '@/types';

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

  onAuthStateChange(callback: (user: any) => void) {
    return this.client.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null);
    });
  }

  // Event methods
  async createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>) {
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

  async updateEvent(id: string, updates: Partial<Event>) {
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
}

export const supabase = new SupabaseService();
