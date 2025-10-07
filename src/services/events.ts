// src/services/events.ts
import { supabase } from "./supabase";

export interface EventInput {
  title: string;
  dateISO: string;
  description?: string;
  tags?: string[];
}

export async function createEvent(input: EventInput): Promise<void> {
  const { error } = await supabase.from("events").insert(input as any);
  if (error) throw error;
}

export async function loadEvents(_userId: string): Promise<any[]> {
  let query: any = supabase.from("events").select("*");
  // query = query.eq("user_id", userId); // uncomment if applicable
  query = query.order("dateISO", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

