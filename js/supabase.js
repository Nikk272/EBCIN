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
    p_semester: attendanceData.semester,
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
  const { data: uniqueData, error: uniqueError } = await supabaseClient
    .from('unique_students')
    .select('*');
  if (uniqueError) console.error('Error fetching unique students:', uniqueError);
  
  const { data: attendanceData } = await supabaseClient
    .from('student_attendance')
    .select('usn, mobile, email, college_name, stream, semester');

  const attendanceMap = new Map();
  if (attendanceData && attendanceData.length > 0) {
    attendanceData.forEach(att => {
      if (att.usn && att.usn.toLowerCase() !== 'na' && att.usn.toLowerCase() !== 'n/a' && att.usn.toLowerCase() !== 'none') {
        attendanceMap.set(att.usn.toLowerCase(), att);
      }
      if (att.mobile) {
        attendanceMap.set(att.mobile, att);
      }
      if (att.email) {
        attendanceMap.set(att.email.toLowerCase(), att);
      }
    });
  }

  const enrichedData = (uniqueData || []).map(student => {
    const attMatch = (student.usn && attendanceMap.get(student.usn.toLowerCase())) ||
                     (student.mobile && attendanceMap.get(student.mobile)) ||
                     (student.email && attendanceMap.get(student.email.toLowerCase()));
    
    return {
      ...student,
      college_name: student.college_name || attMatch?.college_name || '-',
      stream: student.stream || attMatch?.stream || '-',
      semester: student.semester || attMatch?.semester || '-'
    };
  });

  return enrichedData;
};

export const fetchRegisteredStudents = async () => {
  const { data, error } = await supabaseClient
    .from('registered_students')
    .select('*')
    .range(0, 4999);
  if (error) console.error('Error fetching registered students:', error);
  return data || [];
};

export const uploadRegisteredStudents = async (records, onProgress) => {
  const batchSize = 50;
  let successCount = 0;
  let duplicateCount = 0;
  let errors = [];
  const total = records.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    // Attempt bulk upsert matching on enquiry_id
    const { error } = await supabaseClient
      .from('registered_students')
      .upsert(batch, { onConflict: 'enquiry_id', ignoreDuplicates: false });

    if (error) {
      // If batch fails (e.g., unique key constraint on mobile/email or single bad record),
      // process items in this batch one-by-one to salvage all valid rows
      for (const item of batch) {
        try {
          const { error: singleErr } = await supabaseClient
            .from('registered_students')
            .upsert(item, { onConflict: 'enquiry_id' });

          if (singleErr) {
            const msg = singleErr.message || '';
            if (msg.includes('duplicate key') || msg.includes('unique constraint') || singleErr.code === '23505') {
              duplicateCount++;
            } else {
              errors.push(`Row ${item.name || item.enquiry_id || 'Unknown'}: ${msg}`);
            }
          } else {
            successCount++;
          }
        } catch (itemErr) {
          errors.push(`Row ${item.name || 'Unknown'}: ${itemErr.message}`);
        }
      }
    } else {
      successCount += batch.length;
    }

    if (onProgress) {
      const current = Math.min(i + batchSize, total);
      onProgress({
        current,
        total,
        percentage: Math.round((current / total) * 100),
        successCount,
        duplicateCount,
        errorsCount: errors.length
      });
    }
  }

  // Attempt to sync matching unique_students records if any
  try {
    await supabaseClient.rpc('sync_registered_students_with_unique');
  } catch (syncErr) {
    // Graceful fallback if RPC is not yet executed in database
  }

  return {
    total,
    successCount,
    duplicateCount,
    errors
  };
};

