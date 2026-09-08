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
    .insert(tasks);
  if (error) throw error;
  return data;
};

export const submitBlockers = async (blockers) => {
  const { data, error } = await supabaseClient
    .from('blockers')
    .insert(blockers);
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

export const submitAttendanceAndCheckRegistration = async (attendanceData) => {
  const { data, error } = await supabaseClient.rpc('submit_attendance_and_check_registration', {
    p_full_name: attendanceData.full_name,
    p_email: attendanceData.email,
    p_mobile: attendanceData.mobile,
    p_college_name: attendanceData.college_name,
    p_usn: attendanceData.usn,
    p_stream: attendanceData.stream,
    p_section: attendanceData.section,
    p_room_number: attendanceData.room_number || null
  });
  if (error) throw error;
  return data; // Returns boolean (is_registered)
};

export const fetchAllAttendance = async () => {
  const { data, error } = await supabaseClient
    .from('student_attendance')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) console.error('Error fetching attendance:', error);
  return data || [];
};

export const fetchUniqueStudents = async () => {
  const { data, error } = await supabaseClient
    .from('unique_students')
    .select('*');
  if (error) console.error('Error fetching unique students:', error);
  return data || [];
};

export const fetchRegisteredStudents = async () => {
  const { data, error } = await supabaseClient
    .from('registered_students')
    .select('*');
  if (error) console.error('Error fetching registered students:', error);
  return data || [];
};
