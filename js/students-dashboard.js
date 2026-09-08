import { fetchAllAttendance, fetchUniqueStudents, fetchRegisteredStudents } from './supabase.js';

let currentTab = 'attendance';
let currentData = [];
let filteredData = [];

// DOM Elements
const tabs = {
  attendance: document.getElementById('tab-attendance'),
  unique: document.getElementById('tab-unique'),
  registered: document.getElementById('tab-registered')
};
const searchInput = document.getElementById('search-input');
const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');

// Columns config
const columnsConfig = {
  attendance: [
    { key: 'created_at', label: 'Date', format: val => new Date(val).toLocaleString() },
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'college_name', label: 'College' },
    { key: 'usn', label: 'USN' },
    { key: 'stream', label: 'Stream' },
    { key: 'section', label: 'Section' }
  ],
  unique: [
    { key: 'created_at', label: 'Date Added', format: val => new Date(val).toLocaleString() },
    { key: 'usn', label: 'USN' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'enquiry_id', label: 'Enquiry ID', format: val => val || '<span class="text-slate-400 italic">Not Registered</span>' }
  ],
  registered: [
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'center', label: 'Center' },
    { key: 'enquiry_id', label: 'Enquiry ID' }
  ]
};

// Initialize
async function init() {
  setupEventListeners();
  await loadData('attendance');
}

function setupEventListeners() {
  tabs.attendance.addEventListener('click', () => switchTab('attendance'));
  tabs.unique.addEventListener('click', () => switchTab('unique'));
  tabs.registered.addEventListener('click', () => switchTab('registered'));

  searchInput.addEventListener('input', (e) => {
    applyFilter(e.target.value);
  });
}

async function switchTab(tabId) {
  currentTab = tabId;
  
  // Update UI active state
  Object.keys(tabs).forEach(key => {
    if (key === tabId) {
      tabs[key].className = 'px-5 py-2 rounded-md bg-indigo-100 text-indigo-700 font-semibold text-sm shadow-sm transition-all whitespace-nowrap';
    } else {
      tabs[key].className = 'px-5 py-2 rounded-md bg-white text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-all whitespace-nowrap';
    }
  });

  searchInput.value = ''; // Reset search
  await loadData(tabId);
}

async function loadData(tabId) {
  showLoading(true);
  try {
    if (tabId === 'attendance') {
      currentData = await fetchAllAttendance();
    } else if (tabId === 'unique') {
      currentData = await fetchUniqueStudents();
    } else if (tabId === 'registered') {
      currentData = await fetchRegisteredStudents();
    }
    filteredData = [...currentData];
    renderTable();
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    showLoading(false);
  }
}

function applyFilter(query) {
  query = query.toLowerCase().trim();
  if (!query) {
    filteredData = [...currentData];
  } else {
    filteredData = currentData.filter(item => {
      // Search across all text values
      return Object.values(item).some(val => 
        val && String(val).toLowerCase().includes(query)
      );
    });
  }
  renderTable();
}

function renderTable() {
  const config = columnsConfig[currentTab];
  
  // Render Headers
  let headerHtml = '<tr>';
  config.forEach(col => {
    headerHtml += `<th class="px-6 py-3 whitespace-nowrap">${col.label}</th>`;
  });
  headerHtml += '</tr>';
  tableHead.innerHTML = headerHtml;

  // Render Rows
  if (filteredData.length === 0) {
    tableBody.innerHTML = '';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    let rowsHtml = '';
    filteredData.forEach(row => {
      rowsHtml += '<tr class="hover:bg-slate-50 transition-colors">';
      config.forEach(col => {
        let val = row[col.key];
        if (col.format) {
          val = col.format(val);
        } else if (val === null || val === undefined) {
          val = '-';
        }
        rowsHtml += `<td class="px-6 py-4 whitespace-nowrap">${val}</td>`;
      });
      rowsHtml += '</tr>';
    });
    tableBody.innerHTML = rowsHtml;
  }
}

function showLoading(isLoading) {
  if (isLoading) {
    loadingState.classList.remove('hidden');
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    emptyState.classList.add('hidden');
  } else {
    loadingState.classList.add('hidden');
  }
}

// Start
init();
