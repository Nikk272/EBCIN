import { supabaseClient } from './supabase.js';

// State to hold the currently logged-in user profile
export let currentUser = null;

// Helper to resolve identifier (username or email) to email
export const getEmailFromIdentifier = async (identifier) => {
  if (identifier.includes('@')) return identifier;
  
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('email')
    .eq('username', identifier)
    .single();
  if (error || !data || !data.email) {
    throw new Error('User not found or has no email associated.');
  }
  return data.email;
};

export const getSession = async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await fetchCurrentUserProfile(session.user.id);
  } else {
    currentUser = null;
  }
  return session;
};

const fetchCurrentUserProfile = async (userId) => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (error) {
    console.error('Error fetching user profile:', error);
    currentUser = null;
  } else {
    currentUser = data;
  }
};

export const login = async (identifier, password) => {
  const email = await getEmailFromIdentifier(identifier);
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  
  await fetchCurrentUserProfile(data.user.id);
  return currentUser;
};

export const resetPassword = async (identifier) => {
  const email = await getEmailFromIdentifier(identifier);
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
};

export const updatePassword = async (newPassword) => {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const logout = async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  currentUser = null;
};

// Note: Admin user creation via frontend using Supabase Auth is tricky because signUp automatically logs you in.
// We provide a warning in the UI for this behavior.
export const adminCreateUser = async (email, username, password, role) => {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
        role: role
      }
    }
  });

  if (error) throw error;
  return data;
};
