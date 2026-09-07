// UI Manipulation Utilities

export const showView = (viewId) => {
  document.querySelectorAll('.app-view').forEach(el => el.classList.add('hidden-view'));
  document.getElementById(viewId).classList.remove('hidden-view');
  
  // Highlight active nav
  document.querySelectorAll('.nav-link').forEach(el => {
    if(el.dataset.target === viewId) {
      el.classList.add('text-indigo-600', 'border-b-2', 'border-indigo-600');
      el.classList.remove('text-slate-500', 'border-transparent');
    } else {
      el.classList.remove('text-indigo-600', 'border-b-2', 'border-indigo-600');
      el.classList.add('text-slate-500', 'border-transparent');
    }
  });
};

export const showToast = (message, type = 'success') => {
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  toast.className = `fixed bottom-5 right-5 ${bgClass} text-white px-6 py-3 rounded-lg shadow-lg animate-fade-in z-50`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

export const populateDropdown = (selectId, options, includeOther = false) => {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  select.innerHTML = '<option value="" disabled selected>Select an option...</option>';
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value || opt;
    option.textContent = opt.label || opt;
    select.appendChild(option);
  });
  
  if (includeOther) {
    const option = document.createElement('option');
    option.value = 'Other';
    option.textContent = 'Other...';
    select.appendChild(option);
  }
};

export const createFeedCard = (item, type, currentUser, handlers) => {
  const card = document.createElement('div');
  card.className = 'glass p-5 rounded-xl mb-4 animate-fade-in flex flex-col gap-3';
  
  const date = new Date(item.created_at).toLocaleString();
  const title = type === 'task' ? item.task : item.blocker_desc;
  const dependencyHtml = type === 'blocker' ? `<p class="text-sm font-medium text-amber-600 mt-1">Dependency: ${item.dependency_person}</p>` : '';
  
  // Status Dropdown logic
  const canEditStatus = currentUser && (
    currentUser.role === 'admin' || 
    currentUser.username === item.name || 
    (type === 'blocker' && currentUser.username === item.dependency_person)
  );

  let statusOptions = type === 'task' 
    ? ['Open', 'In Progress', 'Completed'] 
    : ['Open', 'In Progress', 'Resolved'];

  const statusHtml = canEditStatus ? `
    <select class="status-select bg-white text-slate-800 text-sm p-1 rounded border border-slate-200" data-id="${item.id}" data-type="${type}">
      ${statusOptions.map(opt => `<option value="${opt}" ${item.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
    </select>
  ` : `<span class="px-2 py-1 bg-slate-100 rounded text-xs border border-slate-200 text-slate-700 font-medium">${item.status}</span>`;

  // Comments HTML
  const commentsHtml = (item.comments || []).map(c => `
    <div class="bg-slate-50 border border-slate-100 p-2 rounded text-sm mb-1">
      <span class="font-bold text-indigo-700">${c.author}:</span> 
      <span class="text-slate-700">${c.text}</span>
      <span class="text-xs text-slate-400 ml-2">${new Date(c.time).toLocaleTimeString()}</span>
    </div>
  `).join('');

  const commentInputHtml = currentUser ? `
    <div class="flex gap-2 mt-2">
      <input type="text" class="comment-input flex-1 p-2 rounded bg-white border border-slate-200 text-sm" placeholder="Add a comment...">
      <button class="add-comment-btn px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm font-medium transition-colors" data-id="${item.id}" data-type="${type}">Post</button>
    </div>
  ` : `<p class="text-xs text-slate-400 italic">Log in to comment.</p>`;

  card.innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <h4 class="font-bold text-lg text-slate-800">${item.name}</h4>
        <p class="text-xs text-slate-500">${item.location} • ${date}</p>
      </div>
      <div>${statusHtml}</div>
    </div>
    <div class="py-2 text-slate-700">
      <p class="text-[15px]">${title}</p>
      ${dependencyHtml}
    </div>
    <div class="mt-2 border-t border-slate-100 pt-3">
      <h5 class="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Comments</h5>
      <div class="comments-container mb-2">${commentsHtml}</div>
      ${commentInputHtml}
    </div>
  `;

  return card;
};
