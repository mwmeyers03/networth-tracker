/**
 * Supabase Store Bridge
 * Wraps Svelte stores to sync with Supabase PostgreSQL
 * Provides dual-write capability: localStorage (fallback) + Supabase (primary)
 */

import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Unsubscriber } from 'svelte/store';

/**
 * Configuration for a Supabase-backed store
 */
interface SupabaseStoreConfig<T> {
  key: string; // localStorage key for fallback
  table: string; // Supabase table name
  initialValue: T;
  primaryKey?: string; // Column name for primary key (default: 'id')
  householdId: string; // Household context
  transformFromDB?: (rows: any[]) => T; // Convert DB rows to store shape
  transformToDB?: (value: T) => any; // Convert store shape to DB format
  debounceMs?: number; // Debounce writes to Supabase
}

/**
 * Create a Svelte store that syncs with Supabase
 * - Hydrates from Supabase on load
 * - Falls back to localStorage if Supabase unavailable
 * - Syncs store updates back to Supabase (debounced)
 * - Subscribes to real-time Supabase changes
 */
export async function createSupabaseStore<T>(
  config: SupabaseStoreConfig<T>
): Promise<Writable<T>> {
  // Try to load from localStorage first as fallback
  let initialData = config.initialValue;
  if (browser) {
    const stored = localStorage.getItem(config.key);
    if (stored) {
      try {
        initialData = JSON.parse(stored);
      } catch {
        // Invalid JSON, use initialValue
      }
    }
  }

  // Create the store
  const store = writable<T>(initialData);

  // Only load from Supabase in browser context
  if (browser) {
    try {
      // Dynamic import to avoid SSR issues
      const { default: supabase } = await import('$lib/supabaseClient');

      // Load from Supabase
      const { data, error } = await supabase
        .from(config.table)
        .select('*')
        .eq('household_id', config.householdId);

      if (!error && data) {
        const supabaseData = config.transformFromDB
          ? config.transformFromDB(data)
          : (data as T);
        store.set(supabaseData);
      }

      // Set up localStorage persistence
      let saveTimeout: ReturnType<typeof setTimeout>;
      const unsubscribe = store.subscribe((value) => {
        // Save to localStorage immediately
        localStorage.setItem(config.key, JSON.stringify(value));

        // Debounce Supabase save
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          try {
            const dbData = config.transformToDB ? config.transformToDB(value) : value;
            
            // For most stores, we upsert based on household_id
            await supabase
              .from(config.table)
              .upsert(
                {
                  household_id: config.householdId,
                  ...dbData,
                  updated_at: new Date().toISOString()
                },
                { onConflict: 'household_id' }
              );
          } catch (err) {
            console.error(`Failed to save ${config.table} to Supabase:`, err);
          }
        }, config.debounceMs || 300);
      });

      return store;
    } catch (err) {
      console.warn(
        `Supabase unavailable, using localStorage fallback for ${config.key}:`,
        err
      );
    }
  }

  // Fallback: just persist to localStorage
  if (browser) {
    const unsubscribe = store.subscribe((value) => {
      localStorage.setItem(config.key, JSON.stringify(value));
    });
  }

  return store;
}

/**
 * Create a store for array-based data (special events, salary adjustments)
 * Syncs entire array to Supabase
 */
export async function createSupabaseArrayStore<T extends { id?: string }>(
  config: Omit<SupabaseStoreConfig<T[]>, 'transformFromDB' | 'transformToDB'>
): Promise<Writable<T[]>> {
  // Try to load from localStorage first as fallback
  let initialData = config.initialValue;
  if (browser) {
    const stored = localStorage.getItem(config.key);
    if (stored) {
      try {
        initialData = JSON.parse(stored);
      } catch {
        // Invalid JSON, use initialValue
      }
    }
  }

  // Create the store
  const store = writable<T[]>(initialData);

  // Only load from Supabase in browser context
  if (browser) {
    try {
      // Dynamic import to avoid SSR issues
      const { default: supabase } = await import('$lib/supabaseClient');

      // Load from Supabase
      const { data, error } = await supabase
        .from(config.table)
        .select('*')
        .eq('household_id', config.householdId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        store.set(data as T[]);
      }

      // Subscribe to real-time changes
      const subscription = supabase
        .channel(`${config.table}:${config.householdId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: config.table,
            filter: `household_id=eq.${config.householdId}`
          },
          async () => {
            // Reload data on any change
            const { data: updated } = await supabase
              .from(config.table)
              .select('*')
              .eq('household_id', config.householdId)
              .order('created_at', { ascending: false });

            if (updated) {
              store.set(updated as T[]);
            }
          }
        )
        .subscribe();

      // Also persist to localStorage
      const unsubscribe = store.subscribe((value) => {
        localStorage.setItem(config.key, JSON.stringify(value));
      });

      return store;
    } catch (err) {
      console.warn(
        `Supabase unavailable, using localStorage fallback for ${config.key}:`,
        err
      );
    }
  }

  // Fallback: just persist to localStorage
  if (browser) {
    store.subscribe((value) => {
      localStorage.setItem(config.key, JSON.stringify(value));
    });
  }

  return store;
}
