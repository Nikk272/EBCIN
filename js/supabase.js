import CONFIG from './config.js';

// Initialize Supabase Client
const { createClient } = supabase;
export const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// API Wrappers

export const fetchUsers = async () => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*');
  if (error) console.error('Error fetching users:', error);
  return data || [];
};

export const submitTasks = async (tasks) => {
  const { data, error } = await supabaseClient
    .from('tasks')
    .insert(tasks)
    .select();
  if (error) throw error;
  return data;
};

export const submitBlockers = async (blockers) => {
  const { data, error } = await supabaseClient
    .from('blockers')
    .insert(blockers)
    .select();
  if (error) throw error;
  return data;
};

export const fetchTasks = async () => {
  const { data, error } = await supabaseClient
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) console.error('Error fetching tasks:', error);
  return data || [];
};

export const fetchBlockers = async () => {
  const { data, error } = await supabaseClient
    .from('blockers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) console.error('Error fetching blockers:', error);
  return data || [];
};

export const updateTaskStatus = async (id, status) => {
  const { error } = await supabaseClient
    .from('tasks')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
};

export const updateBlockerStatus = async (id, status) => {
  const { error } = await supabaseClient
    .from('blockers')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
};

export const addTaskComment = async (id, currentComments, newComment) => {
  const updatedComments = [...currentComments, newComment];
  const { error } = await supabaseClient
    .from('tasks')
    .update({ comments: updatedComments })
    .eq('id', id);
  if (error) throw error;
};

export const addBlockerComment = async (id, currentComments, newComment) => {
  const updatedComments = [...currentComments, newComment];
  const { error } = await supabaseClient
    .from('blockers')
    .update({ comments: updatedComments })
    .eq('id', id);
  if (error) throw error;
};
