import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) 
  ? CONFIG.SUPABASE_URL 
  : 'https://ckjiukvxqqvjmpxhpclb.supabase.co';

export const SUPABASE_ANON_KEY = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_ANON_KEY)
  ? CONFIG.SUPABASE_ANON_KEY
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNraml1a3Z4cXF2am1weGhwY2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjYxMTgsImV4cCI6MjA5ODEwMjExOH0.VWi7wlZdGKVF0q-9bF3bStOh6w-dW1eK9l-PqzBJmjI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'resqnet_supabase_auth_token',
  }
});

// Helper database and auth accessors
export const db = supabase;
export const realtime = supabase;

// Enhanced Auth Wrapper ensuring reliable localStorage persistence & profile caching
export const auth = {
  /**
   * Get current session and user reliably
   */
  async getCurrentUser() {
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session) {
        // Check cached profile as immediate fallback
        const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('resqnet_user_profile') : null;
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.id) {
              return { data: { user: parsed, session: { access_token: parsed.access_token || '' } }, error: null };
            }
          } catch { }
        }
        return { data: { user: null, session: null }, error: sessionErr };
      }

      const user = sessionData.session.user;
      return { data: { user, session: sessionData.session }, error: null };
    } catch (err) {
      console.warn('[Auth] getCurrentUser error:', err.message);
      return { data: { user: null, session: null }, error: err };
    }
  },

  /**
   * Sign In with Email & Password
   */
  async signInWithPassword({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data?.user) {
      // Fetch or create profile
      try {
        const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single();
        const fullProfile = {
          id: data.user.id,
          email: data.user.email,
          fullName: profile?.full_name || profile?.name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
          name: profile?.name || profile?.full_name || data.user.user_metadata?.full_name || 'User',
          phone: profile?.phone || '',
          address: profile?.address || '',
          role: profile?.role || 'reporter',
          created_at: profile?.created_at || new Date().toISOString(),
          access_token: data.session?.access_token || '',
        };
        localStorage.setItem('resqnet_user_profile', JSON.stringify(fullProfile));
        sessionStorage.setItem('userProfile', JSON.stringify(fullProfile));
      } catch (pErr) {
        console.warn('[Auth] Profile fetch note:', pErr.message);
      }
    }

    return { data, error: null };
  },

  /**
   * Sign Up with Email & Password
   */
  async signUp({ email, password, name, phone = '', address = '', redirectTo }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone,
          address,
        },
        emailRedirectTo: redirectTo || (typeof window !== 'undefined' ? window.location.origin + '/auth.html' : undefined),
      }
    });

    if (error) throw error;

    if (data?.user) {
      const profile = {
        id: data.user.id,
        email,
        full_name: (name || '').trim(),
        name: (name || '').trim(),
        phone: (phone || '').replace(/[^\d+]/g, ''),
        address: (address || '').trim(),
        role: 'reporter',
        created_at: new Date().toISOString(),
        total_reports: 0,
        avatar: '',
        access_token: data.session?.access_token || '',
      };

      try {
        await supabase.from('users').upsert([profile]);
      } catch (uErr) {
        console.warn('[Auth] DB profile upsert note:', uErr.message);
      }

      localStorage.setItem('resqnet_user_profile', JSON.stringify(profile));
      sessionStorage.setItem('userProfile', JSON.stringify(profile));
    }

    return { data, error: null };
  },

  /**
   * Sign Out
   */
  async signOut() {
    try {
      await supabase.auth.signOut();
    } catch { }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('resqnet_user_profile');
      localStorage.removeItem('resqnet_supabase_auth_token');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    return { error: null };
  },

  /**
   * Send Reset Password Email
   */
  async sendResetPasswordEmail({ email }) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin + '/auth.html' : undefined
    });
    return { data, error };
  },

  /**
   * Update Password for current user
   */
  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  },

  /**
   * Sign in with OAuth (Google)
   */
  async signInWithOAuth({ provider = 'google' }) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin + '/reporter.html' : undefined
      }
    });
    return { data, error };
  }
};
