import { fetchAllAttendance, fetchUniqueStudents, fetchRegisteredStudents, uploadRegisteredStudents } from './supabase.js';
import { getSession } from './auth.js';

let currentTab = 'attendance';
let currentData = [];
let filteredData = [];
let currentFilters = {
  date: '',
  dropdown: '',
  semester: '',
  stream: '',
  section: '',
  room: ''
};

// Upload State
let parsedUploadRecords = [];
let isUploading = false;

// DOM Elements
const tabs = {
  attendance: document.getElementById('tab-attendance'),
  unique: document.getElementById('tab-unique'),
  registered: document.getElementById('tab-registered')
};
const searchInput = document.getElementById('search-input');
const filterDate = document.getElementById('filter-date');
const filterDropdown = document.getElementById('filter-dropdown');
const filterSemester = document.getElementById('filter-semester');
const filterStream = document.getElementById('filter-stream');
const filterSection = document.getElementById('filter-section');
const filterRoom = document.getElementById('filter-room');
const btnExport = document.getElementById('btn-export');
const btnDownloadTemplate = document.getElementById('btn-download-template');
const btnUploadCsv = document.getElementById('btn-upload-csv');
const inputCsvFile = document.getElementById('input-csv-file');

const tableHead = document.getElementById('table-head');
const tableBody = document.getElementById('table-body');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const uploadModal = document.getElementById('upload-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const uploadPreviewView = document.getElementById('upload-preview-view');
const uploadProgressView = document.getElementById('upload-progress-view');
const uploadResultView = document.getElementById('upload-result-view');
const fileNameDisplay = document.getElementById('file-name-display');
const fileRowsCount = document.getElementById('file-rows-count');
const detectedColumnsBadges = document.getElementById('detected-columns-badges');
const previewTableHead = document.getElementById('preview-table-head');
const previewTableBody = document.getElementById('preview-table-body');
const uploadProgressBar = document.getElementById('upload-progress-bar');
const uploadProgressStatus = document.getElementById('upload-progress-status');
const uploadProgressPercent = document.getElementById('upload-progress-percent');
const uploadResultMessage = document.getElementById('upload-result-message');
const statTotal = document.getElementById('stat-total');
const statSuccess = document.getElementById('stat-success');
const statDuplicates = document.getElementById('stat-duplicates');
const uploadErrorLog = document.getElementById('upload-error-log');
const btnCancelUpload = document.getElementById('btn-cancel-upload');
const btnConfirmUpload = document.getElementById('btn-confirm-upload');
const btnFinishUpload = document.getElementById('btn-finish-upload');

// Columns config
const columnsConfig = {
  attendance: [
    { key: 'created_at', label: 'Date', format: val => new Date(val).toLocaleString() },
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'college_name', label: 'College' },
    { key: 'usn', label: 'USN' },
    { key: 'semester', label: 'Semester' },
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
    window.location.href = 'checkin.html';
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
  filterSemester.addEventListener('change', (e) => { currentFilters.semester = e.target.value; applyFilter(searchInput.value); });
  filterStream.addEventListener('change', (e) => { currentFilters.stream = e.target.value; applyFilter(searchInput.value); });
  filterSection.addEventListener('change', (e) => { currentFilters.section = e.target.value; applyFilter(searchInput.value); });
  filterRoom.addEventListener('change', (e) => { currentFilters.room = e.target.value; applyFilter(searchInput.value); });

  btnExport.addEventListener('click', exportToCSV);

  // Registered Students Actions
  btnDownloadTemplate.addEventListener('click', downloadTemplate);
  btnUploadCsv.addEventListener('click', () => {
    inputCsvFile.value = '';
    inputCsvFile.click();
  });
  inputCsvFile.addEventListener('change', handleFileSelect);

  // Modal Actions
  btnCloseModal.addEventListener('click', closeUploadModal);
  btnCancelUpload.addEventListener('click', closeUploadModal);
  btnConfirmUpload.addEventListener('click', startUpload);
  btnFinishUpload.addEventListener('click', () => {
    closeUploadModal();
    loadData('registered');
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

  // Toggle registered students action buttons
  if (tabId === 'registered') {
    btnDownloadTemplate.classList.remove('hidden');
    btnUploadCsv.classList.remove('hidden');
  } else {
    btnDownloadTemplate.classList.add('hidden');
    btnUploadCsv.classList.add('hidden');
  }

  searchInput.value = ''; // Reset search
  currentFilters = { date: '', dropdown: '', semester: '', stream: '', section: '', room: '' };
  filterDate.value = '';
  filterDropdown.value = '';
  filterSemester.value = '';
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
  filterSemester.innerHTML = '<option value="">All Semesters</option>';
  filterStream.innerHTML = '<option value="">All Streams</option>';
  filterSection.innerHTML = '<option value="">All Sections</option>';
  filterRoom.innerHTML = '<option value="">All Rooms</option>';

  if (currentTab === 'attendance') {
    const colleges = [...new Set(currentData.map(d => d.college_name))].filter(Boolean);
    const streams = [...new Set(currentData.map(d => d.stream))].filter(Boolean);
    const sections = [...new Set(currentData.map(d => d.section))].filter(Boolean);
    const rooms = [...new Set(currentData.map(d => d.room_number))].filter(Boolean);

    colleges.forEach(c => filterDropdown.innerHTML += `<option value="${c}">${c}</option>`);
    for (let s = 1; s <= 8; s++) {
      filterSemester.innerHTML += `<option value="Sem ${s}">Sem ${s}</option>`;
    }
    streams.forEach(c => filterStream.innerHTML += `<option value="${c}">${c}</option>`);
    sections.forEach(c => filterSection.innerHTML += `<option value="${c}">${c}</option>`);
    rooms.forEach(c => filterRoom.innerHTML += `<option value="${c}">${c}</option>`);

    filterDate.classList.remove('hidden');
    filterDropdown.classList.remove('hidden');
    filterSemester.classList.remove('hidden');
    filterStream.classList.remove('hidden');
    filterSection.classList.remove('hidden');
    filterRoom.classList.remove('hidden');
  } else if (currentTab === 'unique') {
    filterDropdown.innerHTML += '<option value="registered">Registered</option><option value="not_registered">Not Registered</option>';
    
    filterDate.classList.add('hidden');
    filterDropdown.classList.remove('hidden');
    filterSemester.classList.add('hidden');
    filterStream.classList.add('hidden');
    filterSection.classList.add('hidden');
    filterRoom.classList.add('hidden');
  } else if (currentTab === 'registered') {
    const centers = [...new Set(currentData.map(d => d.center))].filter(Boolean);
    centers.forEach(c => filterDropdown.innerHTML += `<option value="${c}">${c}</option>`);
    
    filterDate.classList.add('hidden');
    filterDropdown.classList.remove('hidden');
    filterSemester.classList.add('hidden');
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
    let matchesSemester = true;
    let matchesStream = true;
    let matchesSection = true;
    let matchesRoom = true;

    if (currentTab === 'attendance') {
      if (currentFilters.dropdown) matchesDropdown = item.college_name === currentFilters.dropdown;
      if (currentFilters.date) {
        const itemDate = item.created_at ? item.created_at.split('T')[0] : '';
        matchesDate = itemDate === currentFilters.date;
      }
      if (currentFilters.semester) matchesSemester = item.semester === currentFilters.semester;
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
    
    return matchesDropdown && matchesDate && matchesSemester && matchesStream && matchesSection && matchesRoom && matchesSearch;
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

function downloadTemplate() {
  const headers = ["Name", "Mobile", "Email", "Center", "Enquiry ID"];
  const sampleRows = [
    ["Ranjith E", "7022804291", "ranjith@example.com", "CAT9 SVCE Bengaluru", "EONFWL1337790"],
    ["Neha Sd", "8105856156", "nehasd2405@gmail.com", "CAT9 SVCE Bengaluru", "EONFWL1336592"]
  ];

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += headers.map(h => `"${h}"`).join(",") + "\r\n";
  sampleRows.forEach(row => {
    csvContent += row.map(val => `"${val}"`).join(",") + "\r\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "registered_students_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseCSV(text) {
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  
  const lines = [];
  let currentRow = [];
  let currentVal = '';
  let insideQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  
  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(c => c !== '')) {
      lines.push(currentRow);
    }
  }
  
  return lines;
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target.result;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        alert("The selected CSV file appears to be empty or missing data rows.");
        inputCsvFile.value = '';
        return;
      }

      const headers = rows[0];
      const mapping = {
        name: -1,
        mobile: -1,
        email: -1,
        center: -1,
        enquiry_id: -1
      };

      headers.forEach((h, idx) => {
        const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean === 'name' || clean === 'studentname' || clean === 'fullname') {
          mapping.name = idx;
        } else if (clean === 'mobile' || clean === 'mobilenumber' || clean === 'phone' || clean === 'phonenumber' || clean === 'contact') {
          mapping.mobile = idx;
        } else if (clean === 'email' || clean === 'emailid' || clean === 'emailaddress') {
          mapping.email = idx;
        } else if (clean === 'center' || clean === 'centre' || clean === 'location' || clean === 'college') {
          mapping.center = idx;
        } else if (clean.includes('enquiry') || clean === 'enqid' || clean === 'regid') {
          mapping.enquiry_id = idx;
        }
      });

      // Require at least name or enquiry_id or mobile
      if (mapping.name === -1 && mapping.enquiry_id === -1 && mapping.mobile === -1) {
        alert("Could not identify required columns (Name, Mobile, Email, Center, or Enquiry ID). Please check your CSV format or download our template.");
        inputCsvFile.value = '';
        return;
      }

      parsedUploadRecords = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const record = {
          name: mapping.name !== -1 ? (row[mapping.name] || null) : null,
          mobile: mapping.mobile !== -1 ? (row[mapping.mobile] || null) : null,
          email: mapping.email !== -1 ? (row[mapping.email] || null) : null,
          center: mapping.center !== -1 ? (row[mapping.center] || null) : null,
          enquiry_id: mapping.enquiry_id !== -1 ? (row[mapping.enquiry_id] || null) : null
        };
        
        // Clean mobile number (remove spaces)
        if (record.mobile) {
          record.mobile = record.mobile.replace(/\s+/g, '');
        }

        // At least one identifier must be present
        if (record.name || record.enquiry_id || record.mobile || record.email) {
          parsedUploadRecords.push(record);
        }
      }

      if (parsedUploadRecords.length === 0) {
        alert("No valid student records found in the file.");
        inputCsvFile.value = '';
        return;
      }

      openUploadPreviewModal(file.name, mapping, parsedUploadRecords);
    } catch (err) {
      console.error("Error reading CSV:", err);
      alert("Error parsing CSV file: " + err.message);
      inputCsvFile.value = '';
    }
  };

  reader.readAsText(file);
}

function openUploadPreviewModal(filename, mapping, records) {
  fileNameDisplay.textContent = filename;
  fileRowsCount.textContent = `${records.length.toLocaleString()} records detected`;

  // Display badges
  const fieldNames = [
    { key: 'name', label: 'Name', mapped: mapping.name !== -1 },
    { key: 'mobile', label: 'Mobile', mapped: mapping.mobile !== -1 },
    { key: 'email', label: 'Email', mapped: mapping.email !== -1 },
    { key: 'center', label: 'Center', mapped: mapping.center !== -1 },
    { key: 'enquiry_id', label: 'Enquiry ID', mapped: mapping.enquiry_id !== -1 }
  ];

  detectedColumnsBadges.innerHTML = fieldNames.map(f => {
    if (f.mapped) {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>${f.label}</span>`;
    } else {
      return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-400"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>${f.label}</span>`;
    }
  }).join('');

  // Preview table head
  previewTableHead.innerHTML = `
    <tr>
      <th class="px-3 py-2">#</th>
      <th class="px-3 py-2">Name</th>
      <th class="px-3 py-2">Mobile</th>
      <th class="px-3 py-2">Email</th>
      <th class="px-3 py-2">Center</th>
      <th class="px-3 py-2">Enquiry ID</th>
    </tr>
  `;

  // Preview table body (first 5 records)
  const previewSlice = records.slice(0, 5);
  previewTableBody.innerHTML = previewSlice.map((rec, i) => `
    <tr class="hover:bg-slate-50">
      <td class="px-3 py-1.5 text-slate-400 font-mono">${i + 1}</td>
      <td class="px-3 py-1.5 font-medium text-slate-800">${rec.name || '-'}</td>
      <td class="px-3 py-1.5">${rec.mobile || '-'}</td>
      <td class="px-3 py-1.5">${rec.email || '-'}</td>
      <td class="px-3 py-1.5">${rec.center || '-'}</td>
      <td class="px-3 py-1.5 font-mono text-indigo-600">${rec.enquiry_id || '-'}</td>
    </tr>
  `).join('');

  // Set views
  uploadPreviewView.classList.remove('hidden');
  uploadProgressView.classList.add('hidden');
  uploadResultView.classList.add('hidden');

  btnCancelUpload.classList.remove('hidden');
  btnConfirmUpload.classList.remove('hidden');
  btnConfirmUpload.disabled = false;
  btnConfirmUpload.innerHTML = `<span>Upload ${records.length.toLocaleString()} Students</span>`;
  btnFinishUpload.classList.add('hidden');
  btnCloseModal.classList.remove('hidden');

  uploadModal.classList.remove('hidden');
}

async function startUpload() {
  if (parsedUploadRecords.length === 0 || isUploading) return;
  isUploading = true;

  // Switch to progress view
  uploadPreviewView.classList.add('hidden');
  uploadProgressView.classList.remove('hidden');
  uploadProgressView.classList.add('flex');
  uploadResultView.classList.add('hidden');

  btnCancelUpload.classList.add('hidden');
  btnConfirmUpload.classList.add('hidden');
  btnCloseModal.classList.add('hidden');

  uploadProgressBar.style.width = '0%';
  uploadProgressPercent.textContent = '0%';
  uploadProgressStatus.textContent = `Starting import of ${parsedUploadRecords.length} records...`;

  try {
    const result = await uploadRegisteredStudents(parsedUploadRecords, ({ current, total, percentage }) => {
      uploadProgressBar.style.width = `${percentage}%`;
      uploadProgressPercent.textContent = `${percentage}%`;
      uploadProgressStatus.textContent = `Uploaded ${current.toLocaleString()} of ${total.toLocaleString()} records...`;
    });

    // Switch to result view
    uploadProgressView.classList.add('hidden');
    uploadProgressView.classList.remove('flex');
    uploadResultView.classList.remove('hidden');
    uploadResultView.classList.add('flex');

    statTotal.textContent = result.total.toLocaleString();
    statSuccess.textContent = result.successCount.toLocaleString();
    statDuplicates.textContent = result.duplicateCount.toLocaleString();

    if (result.errors && result.errors.length > 0) {
      uploadErrorLog.classList.remove('hidden');
      uploadErrorLog.innerHTML = `<p class="font-semibold text-rose-800 mb-1">Warnings / Errors (${result.errors.length}):</p>` + 
        result.errors.slice(0, 20).map(e => `<p>• ${e}</p>`).join('') +
        (result.errors.length > 20 ? `<p class="italic">...and ${result.errors.length - 20} more</p>` : '');
    } else {
      uploadErrorLog.classList.add('hidden');
    }

    btnFinishUpload.classList.remove('hidden');
    btnCloseModal.classList.remove('hidden');
  } catch (err) {
    console.error("Upload error:", err);
    alert("An error occurred during upload: " + err.message);
    closeUploadModal();
  } finally {
    isUploading = false;
  }
}

function closeUploadModal() {
  if (isUploading) return;
  uploadModal.classList.add('hidden');
  inputCsvFile.value = '';
  parsedUploadRecords = [];
}

// Start
init();

