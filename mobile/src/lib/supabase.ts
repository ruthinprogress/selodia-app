import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Expo Router's web static-rendering pass runs in plain Node.js with no
// window/localStorage - AsyncStorage's web shim needs both, so it crashes
// there. Fall back to a no-op storage during that pass; there's no real
// session to recover before a page has even rendered once.
const isSsr = Platform.OS === 'web' && typeof window === 'undefined';
const authStorage = isSsr
  ? { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} }
  : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: !isSsr,
    persistSession: true,
    // no URL bar on a phone, so there's nothing to detect a session in
    detectSessionInUrl: false,
  },
});
