
import { createClient } from '@supabase/supabase-js';

/**
 * ACECORP ENTERPRISE - CLOUD PERSISTENCE ADAPTER (V2.1.0)
 * Updated for project migration and rebranding to AceCorp.
 */

const VITE_URL = (import.meta as any).env?.VITE_SUPABASE_URL;
const VITE_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// NEW PROJECT CREDENTIALS (iwnrckpwruufcniqydqt)
const NEW_PROJECT_URL = 'https://iwnrckpwruufcniqydqt.supabase.co'; 
const NEW_PROJECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3bnJja3B3cnV1ZmNuaXF5ZHF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM5NzcsImV4cCI6MjA4NjkyOTk3N30.e5X8eqfphv8PCKcuizOz3ffcBD7yWuGBzALtaUVCngU';

const finalUrl = VITE_URL || NEW_PROJECT_URL;
const finalKey = VITE_KEY || NEW_PROJECT_KEY;

export const hasValidConfig = !!(finalUrl && finalKey && finalUrl.startsWith('http'));

let clientInstance: any = null;

if (hasValidConfig) {
  try {
    clientInstance = createClient(finalUrl, finalKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    console.log('AceCorp Core: Cloud database link established with project iwnrckpwruufcniqydqt.');
  } catch (e) {
    console.error("AceCorp Core: Supabase initialization error.", e);
  }
} else {
  console.error("AceCorp Core: CRITICAL CONFIGURATION ERROR. Database link offline.");
}

export const supabase = clientInstance;
