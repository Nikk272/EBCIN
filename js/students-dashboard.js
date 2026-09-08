import { fetchAllAttendance, fetchUniqueStudents, fetchRegisteredStudents } from './supabase.js';
import { getSession } from './auth.js';

let currentTab = 'attendance';
let currentData = [];
let filteredData = [];
let currentFilters = {
  date: '',
  dropdown: '',
  stream: '',
  section: '',
  room: ''
};

// DOM Elements
const tabs = {
  attendance: document.getElementById('tab-attendance'),
  unique: document.getElementById('tab-unique'),
  registered: document.getElementById('tab-registered')
};
const searchInput = document.getElementById('search-input');
const filterDate = document.getElementById('filter-date');
const filterDropdown = document.getElementById('filter-dropdown');
const filterStream = document.getElementById('filter-stream');
const filterSection = document.getElementById('filter-section');
const filterRoom = document.getElementById('filter-room');
const btnExport = document.getElementById('btn-export');
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
    { key: 'section', label: 'Section' },
    { key: 'room_number', label: 'Room' }
  ],
  unique: [
    { key: 'usn', label: 'USN' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'enquiry_id', label: 'Enquiry ID', htmlFormat: val => val || '<span class="text-slate-400 italic">Not Registered</span>', csvFormat: val => val || 'Not Registered' }
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
  const session = await getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  
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

  filterDate.addEventListener('change', (e) => { currentFilters.date = e.target.value; applyFilter(searchInput.value); });
  filterDropdown.addEventListener('change', (e) => { currentFilters.dropdown = e.target.value; applyFilter(searchInput.value); });
  filterStream.addEventListener('change', (e) => { currentFilters.stream = e.target.value; applyFilter(searchInput.value); });
  filterSection.addEventListener('change', (e) => { currentFilters.section = e.target.value; applyFilter(searchInput.value); });
  filterRoom.addEventListener('change', (e) => { currentFilters.room = e.target.value; applyFilter(searchInput.value); });

  btnExport.addEventListener('click', exportToCSV);
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
  currentFilters = { date: '', dropdown: '', stream: '', section: '', room: '' };
  filterDate.value = '';
  filterDropdown.value = '';
  filterStream.value = '';
  filterSection.value = '';
  filterRoom.value = '';
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
    updateFilterDropdown();
    renderTable();
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    showLoading(false);
  }
}

function updateFilterDropdown() {
  filterDropdown.innerHTML = '<option value="">All</option>';
  filterStream.innerHTML = '<option value="">All Streams</option>';
  filterSection.innerHTML = '<option value="">All Sections</option>';
  filterRoom.innerHTML = '<option value="">All Rooms</option>';

  if (currentTab === 'attendance') {
    const colleges = [...new Set(currentData.map(d => d.college_name))].filter(Boolean);
    const streams = [...new Set(currentData.map(d => d.stream))].filter(Boolean);
    const sections = [...new Set(currentData.map(d => d.section))].filter(Boolean);
    const rooms = [...new Set(currentData.map(d => d.room_number))].filter(Boolean);

    colleges.forEach(c => filterDropdown.innerHTML += `<option value="${c}">${c}</option>`);
    streams.forEach(c => filterStream.innerHTML += `<option value="${c}">${c}</option>`);
    sections.forEach(c => filterSection.innerHTML += `<option value="${c}">${c}</option>`);
    rooms.forEach(c => filterRoom.innerHTML += `<option value="${c}">${c}</option>`);

    filterDate.classList.remove('hidden');
    filterDropdown.classList.remove('hidden');
    filterStream.classList.remove('hidden');
    filterSection.classList.remove('hidden');
    filterRoom.classList.remove('hidden');
  } else if (currentTab === 'unique') {
    filterDropdown.innerHTML += '<option value="registered">Registered</option><option value="not_registered">Not Registered</option>';
    
    filterDate.classList.add('hidden');
    filterDropdown.classList.remove('hidden');
    filterStream.classList.add('hidden');
    filterSection.classList.add('hidden');
    filterRoom.classList.add('hidden');
  } else if (currentTab === 'registered') {
    const centers = [...new Set(currentData.map(d => d.center))].filter(Boolean);
    centers.forEach(c => filterDropdown.innerHTML += `<option value="${c}">${c}</option>`);
    
    filterDate.classList.add('hidden');
    filterDropdown.classList.remove('hidden');
    filterStream.classList.add('hidden');
    filterSection.classList.add('hidden');
    filterRoom.classList.add('hidden');
  }
}

function applyFilter(query) {
  query = query.toLowerCase().trim();
  
  filteredData = currentData.filter(item => {
    let matchesDropdown = true;
    let matchesDate = true;
    let matchesStream = true;
    let matchesSection = true;
    let matchesRoom = true;

    if (currentTab === 'attendance') {
      if (currentFilters.dropdown) matchesDropdown = item.college_name === currentFilters.dropdown;
      if (currentFilters.date) {
        const itemDate = item.created_at ? item.created_at.split('T')[0] : '';
        matchesDate = itemDate === currentFilters.date;
      }
      if (currentFilters.stream) matchesStream = item.stream === currentFilters.stream;
      if (currentFilters.section) matchesSection = item.section === currentFilters.section;
      if (currentFilters.room) matchesRoom = item.room_number === currentFilters.room;
    } else if (currentTab === 'unique') {
      if (currentFilters.dropdown === 'registered') matchesDropdown = !!item.enquiry_id;
      if (currentFilters.dropdown === 'not_registered') matchesDropdown = !item.enquiry_id;
    } else if (currentTab === 'registered') {
      if (currentFilters.dropdown) matchesDropdown = item.center === currentFilters.dropdown;
    }

    let matchesSearch = true;
    if (query) {
      matchesSearch = Object.values(item).some(val => 
        val && String(val).toLowerCase().includes(query)
      );
    }
    
    return matchesDropdown && matchesDate && matchesStream && matchesSection && matchesRoom && matchesSearch;
  });
  
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
        if (col.htmlFormat) {
          val = col.htmlFormat(val);
        } else if (col.format) {
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

function exportToCSV() {
  if (filteredData.length === 0) {
    alert("No data to export");
    return;
  }
  const config = columnsConfig[currentTab];
  
  // Create UTF-8 BOM
  let csvContent = "\uFEFF";
  
  // Headers
  const headers = config.map(col => `"${col.label}"`);
  csvContent += headers.join(",") + "\r\n";
  
  // Rows
  filteredData.forEach(row => {
    const rowData = config.map(col => {
      let val = row[col.key];
      if (val === null || val === undefined) val = "";
      if (col.csvFormat) {
        val = col.csvFormat(val);
      } else if (col.format) {
        val = col.format(val);
      }
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvContent += rowData.join(",") + "\r\n";
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${currentTab}_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Start
init();
