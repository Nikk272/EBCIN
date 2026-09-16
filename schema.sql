-- Enable UUID & pgcrypto extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Create profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique not null,
  email text,
  role text default 'user' check (role in ('admin', 'user'))
);

-- Tasks table
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  location text not null,
  task text not null,
  status text default 'Open' check (status in ('Open', 'In Progress', 'Completed')),
  comments jsonb default '[]'::jsonb
);

-- Blockers table
create table if not exists public.blockers (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  location text not null,
  blocker_desc text not null,
  dependency_person text not null,
  status text default 'Open' check (status in ('Open', 'In Progress', 'Resolved')),
  comments jsonb default '[]'::jsonb
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.blockers enable row level security;

-- Policies for Profiles
-- Anyone can view profiles (needed for check-in dropdown)
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Policies for Tasks
-- Anyone can insert tasks (public check-in)
create policy "Tasks can be created by anyone" on public.tasks for insert with check (true);
-- Authenticated users can view tasks
create policy "Tasks are viewable by authenticated users" on public.tasks for select using (auth.role() = 'authenticated');
-- Authenticated users can update tasks
create policy "Tasks can be updated by authenticated users" on public.tasks for update using (auth.role() = 'authenticated');

-- Policies for Blockers
create policy "Blockers can be created by anyone" on public.blockers for insert with check (true);
create policy "Blockers are viewable by authenticated users" on public.blockers for select using (auth.role() = 'authenticated');
create policy "Blockers can be updated by authenticated users" on public.blockers for update using (auth.role() = 'authenticated');

-- Function to handle new user signup and insert into profiles
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, username, email, role)
  values (new.id, new.raw_user_meta_data->>'username', new.email, coalesce(new.raw_user_meta_data->>'role', 'user'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Admin: Delete User RPC (Security Definer to bypass RLS and delete from auth.users)
create or replace function public.admin_delete_user(user_id uuid)
returns void as $$
begin
  -- Only allow if the calling user is an admin
  if (select role from public.profiles where id = auth.uid()) != 'admin' then
    raise exception 'Unauthorized';
  end if;
  
  -- Delete from auth.users (cascade deletes profile)
  delete from auth.users where id = user_id;
end;
$$ language plpgsql security definer;

-- Admin: Update User RPC (Updates username, email, role, and password)
drop function if exists public.admin_update_user(uuid, text, text);
drop function if exists public.admin_update_user(uuid, text, text, text, text);

create or replace function public.admin_update_user(
  user_id uuid,
  new_username text default null,
  new_email text default null,
  new_role text default null,
  new_password text default null
)
returns void as $$
declare
  v_caller_role text;
begin
  if (select role from public.profiles where id = auth.uid()) != 'admin' then
    raise exception 'Unauthorized';
  end if;
  
  -- Update profile table
  update public.profiles 
  set 
    username = coalesce(nullif(trim(new_username), ''), username),
    email = coalesce(nullif(trim(new_email), ''), email),
    role = coalesce(nullif(trim(new_role), ''), role)
  where id = user_id;

  -- Update auth.users email if provided
  if new_email is not null and trim(new_email) != '' then
    update auth.users
    set email = lower(trim(new_email)),
        email_confirmed_at = now()
    where id = user_id;
  end if;

  -- Update auth.users password if provided
  if new_password is not null and trim(new_password) != '' then
    update auth.users
    set encrypted_password = crypt(new_password, gen_salt('bf'))
    where id = user_id;
  end if;
end;
$$ language plpgsql security definer;

-- Student Attendance table
create table if not exists public.student_attendance (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  full_name text not null,
  email text not null,
  mobile text not null,
  college_name text not null,
  usn text not null,
  semester text not null,
  stream text not null,
  section text not null,
  room_number text
);

-- Migration for existing installations:
-- alter table public.student_attendance add column if not exists semester text default 'Sem 5';
-- update public.student_attendance set semester = 'Sem 5' where semester is null or trim(semester) = '';

-- Enable RLS for student_attendance
alter table public.student_attendance enable row level security;

-- Policy: Anyone can insert attendance records
create policy "Attendance can be created by anyone" on public.student_attendance for insert with check (true);

-- Policy: Only authenticated users (admins) can view attendance
create policy "Attendance is viewable by authenticated users" on public.student_attendance for select using (auth.role() = 'authenticated');
create policy "Attendance can be updated by authenticated users" on public.student_attendance for update using (auth.role() = 'authenticated');

-- Unique Students table
create table if not exists public.unique_students (
  id uuid primary key default uuid_generate_v4(),
  usn text unique,
  mobile text unique,
  email text unique,
  college_name text,
  stream text,
  semester text,
  enquiry_id text
);

-- Migrations for existing unique_students table:
-- alter table public.unique_students add column if not exists college_name text;
-- alter table public.unique_students add column if not exists stream text;
-- alter table public.unique_students add column if not exists semester text;

alter table public.unique_students enable row level security;
create policy "Unique students viewable by authenticated users" on public.unique_students for select using (auth.role() = 'authenticated');

-- Registered Students table
create table if not exists public.registered_students (
  id uuid primary key default uuid_generate_v4(),
  name text,
  mobile text unique,
  email text unique,
  center text,
  enquiry_id text unique
);

alter table public.registered_students enable row level security;

drop policy if exists "Registered students viewable by authenticated users" on public.registered_students;
drop policy if exists "Registered students can be inserted by authenticated users" on public.registered_students;
drop policy if exists "Registered students can be updated by authenticated users" on public.registered_students;
drop policy if exists "Registered students can be deleted by authenticated users" on public.registered_students;

create policy "Registered students viewable by authenticated users" on public.registered_students for select using (true);
create policy "Registered students can be inserted by authenticated users" on public.registered_students for insert with check (true);
create policy "Registered students can be updated by authenticated users" on public.registered_students for update using (true) with check (true);
create policy "Registered students can be deleted by authenticated users" on public.registered_students for delete using (true);

-- Function to sync newly uploaded registered students with unique_students
create or replace function public.sync_registered_students_with_unique()
returns void as $$
begin
  update public.unique_students u
  set enquiry_id = r.enquiry_id
  from public.registered_students r
  where u.enquiry_id is null
    and (u.mobile = r.mobile or u.email = r.email);
end;
$$ language plpgsql security definer;

-- RPC for bulk upsert of registered students (bypasses client RLS quirks and handles duplicate constraint gracefully)
create or replace function public.bulk_upsert_registered_students(p_records jsonb)
returns jsonb as $$
declare
  v_rec jsonb;
  v_name text;
  v_mobile text;
  v_email text;
  v_center text;
  v_enquiry_id text;
  v_success integer := 0;
  v_duplicates integer := 0;
  v_errors integer := 0;
  v_total integer := 0;
begin
  v_total := jsonb_array_length(p_records);

  for v_rec in select * from jsonb_array_elements(p_records)
  loop
    v_name := nullif(trim(v_rec->>'name'), '');
    v_mobile := nullif(trim(v_rec->>'mobile'), '');
    v_email := nullif(trim(v_rec->>'email'), '');
    v_center := nullif(trim(v_rec->>'center'), '');
    v_enquiry_id := nullif(trim(v_rec->>'enquiry_id'), '');

    -- Skip completely empty rows
    if v_name is null and v_mobile is null and v_email is null and v_enquiry_id is null then
      continue;
    end if;

    begin
      -- Try upsert by enquiry_id if enquiry_id is provided
      if v_enquiry_id is not null then
        insert into public.registered_students(name, mobile, email, center, enquiry_id)
        values (v_name, v_mobile, v_email, v_center, v_enquiry_id)
        on conflict (enquiry_id) do update set
          name = coalesce(excluded.name, public.registered_students.name),
          mobile = coalesce(excluded.mobile, public.registered_students.mobile),
          email = coalesce(excluded.email, public.registered_students.email),
          center = coalesce(excluded.center, public.registered_students.center);
        
        v_success := v_success + 1;
      else
        insert into public.registered_students(name, mobile, email, center, enquiry_id)
        values (v_name, v_mobile, v_email, v_center, null);
        
        v_success := v_success + 1;
      end if;

    exception when unique_violation then
      -- If mobile or email unique constraint violated, update existing student row
      begin
        update public.registered_students
        set
          name = coalesce(v_name, name),
          center = coalesce(v_center, center),
          enquiry_id = coalesce(v_enquiry_id, enquiry_id)
        where (v_mobile is not null and mobile = v_mobile)
           or (v_email is not null and email = v_email);

        v_duplicates := v_duplicates + 1;
      exception when others then
        v_errors := v_errors + 1;
      end;
    when others then
      v_errors := v_errors + 1;
    end;
  end loop;

  -- Sync matching unique_students records
  perform public.sync_registered_students_with_unique();

  return jsonb_build_object(
    'total', v_total,
    'successCount', v_success,
    'duplicateCount', v_duplicates,
    'errorsCount', v_errors
  );
end;
$$ language plpgsql security definer;

-- RPC to handle attendance submission and registration logic
drop function if exists public.submit_attendance_and_check_registration(text,text,text,text,text,text,text,text,text);

create or replace function public.submit_attendance_and_check_registration(
  p_full_name text,
  p_email text,
  p_mobile text,
  p_college_name text,
  p_usn text,
  p_semester text,
  p_stream text,
  p_section text,
  p_room_number text default null
) returns boolean as $$
declare
  v_unique_student_id uuid;
  v_enquiry_id text;
  v_is_registered boolean := false;
  v_clean_usn text := null;
begin
  -- Normalize USN: convert to uppercase and trim; if user enters NA / N/A / NONE, treat as NULL for unique tracking
  if p_usn is not null and trim(p_usn) <> '' then
    p_usn := upper(trim(p_usn));
  end if;

  if p_usn is not null and p_usn not in ('NA', 'N/A', 'NONE', 'N.A.') then
    v_clean_usn := p_usn;
  end if;

  -- 1. Insert attendance
  insert into public.student_attendance(full_name, email, mobile, college_name, usn, semester, stream, section, room_number)
  values (p_full_name, p_email, p_mobile, p_college_name, p_usn, p_semester, p_stream, p_section, p_room_number);

  -- 2. Check unique_students (matching by clean USN, mobile, or email)
  select id, enquiry_id into v_unique_student_id, v_enquiry_id
  from public.unique_students
  where (v_clean_usn is not null and usn = v_clean_usn) or mobile = p_mobile or email = p_email
  limit 1;

  if v_unique_student_id is null then
    -- Insert new unique student (NULL usn is permitted multiple times under UNIQUE constraint)
    insert into public.unique_students(usn, mobile, email, college_name, stream, semester)
    values (v_clean_usn, p_mobile, p_email, p_college_name, p_stream, p_semester)
    returning id into v_unique_student_id;
  else
    -- Update unique_students record with latest details if missing
    update public.unique_students
    set usn = coalesce(usn, v_clean_usn),
        college_name = coalesce(college_name, p_college_name),
        stream = coalesce(stream, p_stream),
        semester = coalesce(semester, p_semester)
    where id = v_unique_student_id;
  end if;

  -- 3. Check registration status
  if v_enquiry_id is not null then
    v_is_registered := true;
  else
    -- Check registered_students
    select enquiry_id into v_enquiry_id
    from public.registered_students
    where mobile = p_mobile or email = p_email
    limit 1;

    if v_enquiry_id is not null then
      -- Update unique_students
      update public.unique_students
      set enquiry_id = v_enquiry_id
      where id = v_unique_student_id;
      
      v_is_registered := true;
    end if;
  end if;

  return v_is_registered;
end;
$$ language plpgsql security definer;
