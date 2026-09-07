import { supabaseClient } from './supabase.js';

// State to hold the currently logged-in user profile
export let currentUser = null;

// Helper to convert username to dummy email
const getEmailFromUsername = (username) => `${username.toLowerCase()}@dailycheckin.local`;

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

export const login = async (username, password) => {
  const email = getEmailFromUsername(username);
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  
  await fetchCurrentUserProfile(data.user.id);
  return currentUser;
};

export const logout = async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  currentUser = null;
};

// Note: Admin user creation via frontend using Supabase Auth is tricky because signUp automatically logs you in.
// We provide a warning in the UI for this behavior.
export const adminCreateUser = async (username, password, role) => {
  const email = getEmailFromUsername(username);
  
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
