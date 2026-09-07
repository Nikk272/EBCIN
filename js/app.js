import { 
  getSession, 
  login, 
  logout, 
  adminCreateUser, 
  currentUser 
} from './auth.js';
import { 
  fetchUsers, 
  submitTasks, 
  submitBlockers, 
  fetchTasks, 
  fetchBlockers, 
  updateTaskStatus, 
  updateBlockerStatus, 
  addTaskComment, 
  addBlockerComment 
} from './supabase.js';
import { showView, showToast, populateDropdown, createFeedCard } from './ui.js';

// Global state
let usersList = [];
let currentFeed = 'tasks'; // 'tasks' or 'blockers'
let tasksData = [];
let blockersData = [];

// DOM Elements
const navLinks = document.querySelectorAll('.nav-link');
const formCheckin = document.getElementById('form-checkin');
const formLogin = document.getElementById('form-login');
const formCreateUser = document.getElementById('form-create-user');
const btnAddTask = document.getElementById('btn-add-task');
const btnAddBlocker = document.getElementById('btn-add-blocker');
const tasksContainer = document.getElementById('tasks-container');
const blockersContainer = document.getElementById('blockers-container');
const locationSelect = document.getElementById('ci-location');

// Initialize
const init = async () => {
  await loadUsers();
  
  const session = await getSession();
  updateAuthUI(session);

  if (session) {
    showView('view-dashboard');
    loadDashboard();
  } else {
    showView('view-checkin');
  }

  setupEventListeners();
};

const loadUsers = async () => {
  usersList = await fetchUsers();
  const usernames = usersList.map(u => u.username);
  populateDropdown('ci-name', usernames);
  // Optional blocker initial select populate will happen when adding a blocker row
};

const updateAuthUI = (session) => {
  const loginNav = document.getElementById('nav-login');
  const dashboardNav = document.getElementById('nav-dashboard');
  const userMenu = document.getElementById('user-menu');
  const usernameDisplay = document.getElementById('current-username-display');
  const adminPanel = document.getElementById('admin-panel');

  if (session && currentUser) {
    loginNav.style.display = 'none';
    dashboardNav.style.display = 'block';
    userMenu.classList.remove('hidden');
    usernameDisplay.textContent = currentUser.username;
    
    if (currentUser.role === 'admin') {
      adminPanel.classList.remove('hidden');
      renderAdminUserList();
    } else {
      adminPanel.classList.add('hidden');
    }
  } else {
    loginNav.style.display = 'block';
    dashboardNav.style.display = 'none';
    userMenu.classList.add('hidden');
    adminPanel.classList.add('hidden');
  }
};

const loadDashboard = async () => {
  tasksData = await fetchTasks();
  blockersData = await fetchBlockers();
  renderFeed();
};

const renderFeed = () => {
  const container = document.getElementById('feed-container');
  container.innerHTML = '';
  
  const data = currentFeed === 'tasks' ? tasksData : blockersData;
  const type = currentFeed === 'tasks' ? 'task' : 'blocker';

  if (data.length === 0) {
    container.innerHTML = `<p class="col-span-full text-center text-slate-400 py-10">No ${currentFeed} found.</p>`;
    return;
  }

  data.forEach(item => {
    const card = createFeedCard(item, type, currentUser);
    container.appendChild(card);
  });
};

const setupEventListeners = () => {
  // Navigation
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const target = e.target.dataset.target;
      if (target === 'view-dashboard' && !currentUser) {
        showToast('Please log in first.', 'error');
        showView('view-login');
        return;
      }
      showView(target);
      if (target === 'view-dashboard') loadDashboard();
    });
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await logout();
    updateAuthUI(null);
    showView('view-checkin');
    showToast('Logged out successfully');
  });

  // Location logic simplified via HTML5 datalist (no JS needed)

  // Add Task Row
  btnAddTask.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ci-task w-full p-3 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-sm';
    input.placeholder = 'Another task...';
    input.required = true;
    tasksContainer.appendChild(input);
  });

  // Add Blocker Row
  btnAddBlocker.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'blocker-row flex flex-col md:flex-row gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 relative shadow-sm';
    
    // Select HTML string
    const usernames = usersList.map(u => `<option value="${u.username}">${u.username}</option>`).join('');
    
    row.innerHTML = `
      <div class="flex-1">
        <input type="text" class="blk-desc w-full p-2 rounded bg-white border border-slate-200 text-sm shadow-sm" placeholder="Describe the blocker..." required>
      </div>
      <div class="w-full md:w-1/3">
        <select class="blk-dep w-full p-2 rounded bg-white border border-slate-200 text-sm shadow-sm" required>
          <option value="" disabled selected>Dependency...</option>
          ${usernames}
          <option value="Other">Other...</option>
        </select>
        <input type="text" class="blk-dep-other w-full p-2 rounded bg-white border border-slate-200 text-sm mt-1 hidden shadow-sm" placeholder="Name">
      </div>
      <button type="button" class="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-white text-xs shadow hover:bg-red-600" onclick="this.parentElement.remove()">×</button>
    `;
    
    const select = row.querySelector('.blk-dep');
    const otherInput = row.querySelector('.blk-dep-other');
    select.addEventListener('change', (e) => {
      if (e.target.value === 'Other') {
        otherInput.classList.remove('hidden');
        otherInput.required = true;
      } else {
        otherInput.classList.add('hidden');
        otherInput.required = false;
      }
    });

    blockersContainer.appendChild(row);
  });

  // Submit Check-In
  formCheckin.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('ci-name').value;
    const location = locationSelect.value.trim();

    const taskInputs = document.querySelectorAll('.ci-task');
    const tasks = Array.from(taskInputs).map(input => ({
      name, location, task: input.value
    }));

    const blockerRows = document.querySelectorAll('.blocker-row');
    const blockers = Array.from(blockerRows).map(row => {
      const desc = row.querySelector('.blk-desc').value;
      let dep = row.querySelector('.blk-dep').value;
      if (dep === 'Other') dep = row.querySelector('.blk-dep-other').value;
      return { name, location, blocker_desc: desc, dependency_person: dep };
    });

    try {
      if (tasks.length > 0) await submitTasks(tasks);
      if (blockers.length > 0) await submitBlockers(blockers);
      
      showToast('Check-in submitted successfully!');
      
      // Reset form
      formCheckin.reset();
      tasksContainer.innerHTML = '<input type="text" class="ci-task w-full p-3 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-sm" placeholder="What are you working on today?" required>';
      blockersContainer.innerHTML = '';
    } catch (err) {
      console.error(err);
      showToast('Error submitting check-in. Check console.', 'error');
    }
  });

  // Login Form
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');
    
    try {
      errDiv.classList.add('hidden');
      await login(u, p);
      showToast('Logged in successfully');
      updateAuthUI(await getSession());
      showView('view-dashboard');
      loadDashboard();
      formLogin.reset();
    } catch (err) {
      errDiv.textContent = err.message || 'Login failed';
      errDiv.classList.remove('hidden');
    }
  });

  // Admin Create User Form
  formCreateUser.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('admin-new-username').value;
    const p = document.getElementById('admin-new-password').value;
    const r = document.getElementById('admin-new-role').value;

    try {
      await adminCreateUser(u, p, r);
      showToast('User created! You have been logged out. Please log in again.');
      formCreateUser.reset();
      await loadUsers();
      updateAuthUI(null);
      showView('view-login');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Feed Tabs
  document.getElementById('tab-tasks').addEventListener('click', (e) => {
    currentFeed = 'tasks';
    e.target.classList.replace('text-slate-600', 'text-indigo-700');
    e.target.classList.replace('hover:text-slate-800', 'bg-white');
    e.target.classList.remove('hover:bg-white/50');
    e.target.classList.add('bg-white', 'shadow');
    
    const blockBtn = document.getElementById('tab-blockers');
    blockBtn.classList.remove('bg-white', 'shadow', 'text-indigo-700');
    blockBtn.classList.add('text-slate-600', 'hover:text-slate-800', 'hover:bg-white/50');
    renderFeed();
  });

  document.getElementById('tab-blockers').addEventListener('click', (e) => {
    currentFeed = 'blockers';
    e.target.classList.replace('text-slate-600', 'text-indigo-700');
    e.target.classList.replace('hover:text-slate-800', 'bg-white');
    e.target.classList.remove('hover:bg-white/50');
    e.target.classList.add('bg-white', 'shadow');
    
    const taskBtn = document.getElementById('tab-tasks');
    taskBtn.classList.remove('bg-white', 'shadow', 'text-indigo-700');
    taskBtn.classList.add('text-slate-600', 'hover:text-slate-800', 'hover:bg-white/50');
    renderFeed();
  });

  // Delegate Events for Feed Cards (Status Change & Comments)
  document.getElementById('feed-container').addEventListener('change', async (e) => {
    if (e.target.classList.contains('status-select')) {
      const id = e.target.dataset.id;
      const type = e.target.dataset.type;
      const newStatus = e.target.value;
      
      try {
        if (type === 'task') {
          await updateTaskStatus(id, newStatus);
          const task = tasksData.find(t => t.id === id);
          if(task) task.status = newStatus;
        } else {
          await updateBlockerStatus(id, newStatus);
          const blocker = blockersData.find(b => b.id === id);
          if(blocker) blocker.status = newStatus;
        }
        showToast('Status updated');
      } catch (err) {
        showToast('Error updating status', 'error');
        console.error(err);
      }
    }
  });

  document.getElementById('feed-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('add-comment-btn')) {
      const btn = e.target;
      const id = btn.dataset.id;
      const type = btn.dataset.type;
      const input = btn.previousElementSibling;
      const text = input.value.trim();

      if (!text) return;

      const newComment = {
        author: currentUser.username,
        text: text,
        time: new Date().toISOString()
      };

      btn.disabled = true;
      btn.textContent = '...';

      try {
        if (type === 'task') {
          const item = tasksData.find(t => t.id === id);
          await addTaskComment(id, item.comments || [], newComment);
          item.comments = [...(item.comments || []), newComment];
        } else {
          const item = blockersData.find(b => b.id === id);
          await addBlockerComment(id, item.comments || [], newComment);
          item.comments = [...(item.comments || []), newComment];
        }
        input.value = '';
        renderFeed(); // Re-render to show new comment
      } catch (err) {
        showToast('Error adding comment', 'error');
        console.error(err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Post';
      }
    }
  });
};

const renderAdminUserList = () => {
  const list = document.getElementById('admin-user-list');
  list.innerHTML = '';
  usersList.forEach(u => {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center bg-slate-50 border border-slate-100 p-2 rounded';
    li.innerHTML = `
      <span class="text-slate-800 font-medium">${u.username} <span class="text-xs text-slate-500 ml-2 uppercase">${u.role}</span></span>
      ${u.username !== 'admin' ? `<button class="text-xs text-red-500 hover:text-red-700 delete-user" data-id="${u.id}">Delete (DB Only)</button>` : ''}
    `;
    list.appendChild(li);
  });
};

// Start
document.addEventListener('DOMContentLoaded', init);
