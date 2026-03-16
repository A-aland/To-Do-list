

'use strict';


const STATE = {
  tasks: [],
  categories: [],
  filter: 'all',
  categoryFilter: null,
  sortBy: 'created',
  searchQuery: '',
  editingTaskId: null,
  theme: 'dark',
  streak: 0,
  lastCompletedDate: null,
};

const COLORS = [
  '#00ffc8', '#7b5cff', '#ff3cac', '#ffce00',
  '#00bfff', '#ff6b35', '#a8ff78', '#f093fb',
  '#4facfe', '#f77062',
];


function save() {
  localStorage.setItem('aland_tasks', JSON.stringify(STATE.tasks));
  localStorage.setItem('aland_categories', JSON.stringify(STATE.categories));
  localStorage.setItem('aland_theme', STATE.theme);
  localStorage.setItem('aland_streak', STATE.streak);
  localStorage.setItem('aland_lastCompleted', STATE.lastCompletedDate || '');
}

function load() {
  try {
    STATE.tasks = JSON.parse(localStorage.getItem('aland_tasks')) || [];
    STATE.categories = JSON.parse(localStorage.getItem('aland_categories')) || defaultCategories();
    STATE.theme = localStorage.getItem('aland_theme') || 'dark';
    STATE.streak = parseInt(localStorage.getItem('aland_streak')) || 0;
    STATE.lastCompletedDate = localStorage.getItem('aland_lastCompleted') || null;
  } catch (e) {
    STATE.tasks = [];
    STATE.categories = defaultCategories();
  }
}

function defaultCategories() {
  return [
    { id: uid(), name: 'Work', color: '#7b5cff' },
    { id: uid(), name: 'Personal', color: '#00ffc8' },
    { id: uid(), name: 'Health', color: '#ff3cac' },
  ];
}

// ── UTILS ──────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return { label: 'Today', cls: 'today' };
  if (diff === 1) return { label: 'Tomorrow', cls: '' };
  if (diff === -1) return { label: 'Yesterday', cls: 'overdue' };
  if (diff < 0) return { label: `${Math.abs(diff)}d ago`, cls: 'overdue' };
  if (diff < 7) return { label: `In ${diff}d`, cls: '' };
  return { label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), cls: '' };
}

function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}

// ── TASK CRUD ──────────────────────────────────
function createTask(text, opts = {}) {
  return {
    id: uid(),
    text: text.trim(),
    completed: false,
    priority: opts.priority || 'medium',
    category: opts.category || '',
    due: opts.due || '',
    note: opts.note || '',
    subtasks: [],
    createdAt: Date.now(),
    completedAt: null,
  };
}

function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) { input.focus(); return; }

  const task = createTask(text, {
    priority: document.getElementById('taskPriority').value,
    category: document.getElementById('taskCategory').value,
    due: document.getElementById('taskDue').value,
    note: document.getElementById('taskNote').value.trim(),
  });

  STATE.tasks.unshift(task);
  save();
  render();

  input.value = '';
  document.getElementById('taskNote').value = '';
  document.getElementById('taskDue').value = '';
  input.focus();
  toast('✓ Task added');
}

function toggleTask(id) {
  const task = STATE.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  if (task.completed) updateStreak();
  save();
  render();
}

function deleteTask(id) {
  STATE.tasks = STATE.tasks.filter(t => t.id !== id);
  save();
  render();
  toast('Task deleted');
}

function updateStreak() {
  const today = new Date().toDateString();
  if (STATE.lastCompletedDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (STATE.lastCompletedDate === yesterday) {
    STATE.streak++;
  } else {
    STATE.streak = 1;
  }
  STATE.lastCompletedDate = today;
}

// ── FILTERING ──────────────────────────────────
function getFilteredTasks() {
  let tasks = [...STATE.tasks];
  const today = new Date(); today.setHours(0,0,0,0);

  // Search
  if (STATE.searchQuery) {
    const q = STATE.searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      t.text.toLowerCase().includes(q) ||
      t.note.toLowerCase().includes(q) ||
      (t.category && STATE.categories.find(c => c.id === t.category)?.name.toLowerCase().includes(q))
    );
  }

  // Category filter
  if (STATE.categoryFilter) {
    tasks = tasks.filter(t => t.category === STATE.categoryFilter);
  }

  // View filter
  if (STATE.filter === 'today') {
    tasks = tasks.filter(t => {
      if (!t.due) return false;
      const d = new Date(t.due + 'T00:00:00');
      return d.getTime() === today.getTime();
    });
  } else if (STATE.filter === 'upcoming') {
    tasks = tasks.filter(t => {
      if (!t.due || t.completed) return false;
      const d = new Date(t.due + 'T00:00:00');
      return d > today;
    });
  } else if (STATE.filter === 'completed') {
    tasks = tasks.filter(t => t.completed);
  } else {
    // All: not completed, or completed today
    tasks = tasks.filter(t => !t.completed || (t.completedAt && new Date(t.completedAt).toDateString() === today.toDateString()));
  }

  // Sort
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  if (STATE.sortBy === 'priority') {
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  } else if (STATE.sortBy === 'due') {
    tasks.sort((a, b) => {
      if (!a.due) return 1; if (!b.due) return -1;
      return new Date(a.due) - new Date(b.due);
    });
  } else if (STATE.sortBy === 'alpha') {
    tasks.sort((a, b) => a.text.localeCompare(b.text));
  } else {
    tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Completed always at bottom
  tasks.sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1);
  return tasks;
}

// ── BADGE COUNTS ───────────────────────────────
function updateBadges() {
  const today = new Date(); today.setHours(0,0,0,0);
  const all = STATE.tasks.filter(t => !t.completed);
  const todayTasks = STATE.tasks.filter(t => {
    if (!t.due || t.completed) return false;
    const d = new Date(t.due + 'T00:00:00');
    return d.getTime() === today.getTime();
  });
  const upcoming = STATE.tasks.filter(t => {
    if (!t.due || t.completed) return false;
    const d = new Date(t.due + 'T00:00:00');
    return d > today;
  });
  const completed = STATE.tasks.filter(t => t.completed);

  document.getElementById('badge-all').textContent = all.length;
  document.getElementById('badge-today').textContent = todayTasks.length;
  document.getElementById('badge-upcoming').textContent = upcoming.length;
  document.getElementById('badge-completed').textContent = completed.length;

  document.getElementById('statTotal').textContent = STATE.tasks.length;
  document.getElementById('statDone').textContent = completed.length;
  document.getElementById('statStreak').textContent = STATE.streak;

  const todayAll = STATE.tasks.filter(t => t.due === new Date().toISOString().split('T')[0]);
  const todayDone = todayAll.filter(t => t.completed).length;
  const pct = todayAll.length ? Math.round((todayDone / todayAll.length) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';
}

// ── RENDER TASKS ───────────────────────────────
function render() {
  const list = document.getElementById('taskList');
  const empty = document.getElementById('emptyState');
  const tasks = getFilteredTasks();

  // Clear old cards only (not empty state)
  [...list.querySelectorAll('.task-card, .task-group-header')].forEach(el => el.remove());

  if (tasks.length === 0) {
    empty.style.display = 'flex';
    updateBadges();
    renderCategories();
    return;
  }
  empty.style.display = 'none';

  tasks.forEach(task => {
    const card = buildTaskCard(task);
    list.appendChild(card);
  });

  updateBadges();
  renderCategories();
  populateCategorySelects();
}

function buildTaskCard(task) {
  const cat = STATE.categories.find(c => c.id === task.category);
  const due = task.due ? formatDate(task.due) : null;
  const subtasksDone = task.subtasks.filter(s => s.done).length;
  const hasSubtasks = task.subtasks.length > 0;

  const card = document.createElement('div');
  card.className = 'task-card' + (task.completed ? ' completed' : '');
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;
  card.setAttribute('draggable', 'true');

  card.innerHTML = `
    <div class="task-check ${task.completed ? 'checked' : ''}" data-id="${task.id}"></div>
    <div class="task-body">
      <div class="task-text">${escapeHtml(task.text)}</div>
      <div class="task-sub">
        <span class="priority-badge ${task.priority}">${priorityLabel(task.priority)}</span>
        ${cat ? `<span class="task-category-tag" style="background:${cat.color}22;color:${cat.color}">${escapeHtml(cat.name)}</span>` : ''}
        ${due ? `<span class="task-due ${due.cls}">◷ ${due.label}</span>` : ''}
        ${hasSubtasks ? `<span class="task-subtask-progress">${subtasksDone}/${task.subtasks.length} subtasks</span>` : ''}
      </div>
      ${task.note ? `<div class="task-note-preview">${escapeHtml(task.note)}</div>` : ''}
    </div>
    <div class="task-actions">
      <button class="task-action-btn edit-btn" title="Edit" data-id="${task.id}">✎</button>
      <button class="task-action-btn delete delete-btn" title="Delete" data-id="${task.id}">✕</button>
    </div>
  `;

  // Checkbox
  card.querySelector('.task-check').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTask(task.id);
  });

  // Edit
  card.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(task.id);
  });

  // Delete
  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  // Click to open modal
  card.addEventListener('click', () => openModal(task.id));

  // Drag
  setupDrag(card, task.id);

  return card;
}

function priorityLabel(p) {
  return { low: '⬡ LOW', medium: '◈ MED', high: '⬢ HIGH', critical: '⚡ CRIT' }[p] || p;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── DRAG & DROP ────────────────────────────────
let dragId = null;
function setupDrag(card, id) {
  card.addEventListener('dragstart', () => {
    dragId = id;
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drag-over'); });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (dragId && dragId !== id) {
      const fromIdx = STATE.tasks.findIndex(t => t.id === dragId);
      const toIdx = STATE.tasks.findIndex(t => t.id === id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = STATE.tasks.splice(fromIdx, 1);
        STATE.tasks.splice(toIdx, 0, moved);
        save();
        render();
      }
    }
  });
}

// ── CATEGORIES ─────────────────────────────────
function renderCategories() {
  const list = document.getElementById('categoryList');
  list.innerHTML = '';

  STATE.categories.forEach(cat => {
    const count = STATE.tasks.filter(t => t.category === cat.id && !t.completed).length;
    const btn = document.createElement('button');
    btn.className = 'category-item' + (STATE.categoryFilter === cat.id ? ' active' : '');
    btn.innerHTML = `
      <span class="cat-dot" style="background:${cat.color}"></span>
      <span class="cat-name">${escapeHtml(cat.name)}</span>
      <span class="cat-count">${count}</span>
    `;
    btn.addEventListener('click', () => {
      STATE.categoryFilter = STATE.categoryFilter === cat.id ? null : cat.id;
      render();
    });
    list.appendChild(btn);
  });
}

function populateCategorySelects() {
  const selects = [
    document.getElementById('taskCategory'),
    document.getElementById('modalCategory'),
  ];
  selects.forEach(sel => {
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">No Category</option>';
    STATE.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    sel.value = val;
  });
}

// ── MODAL ──────────────────────────────────────
function openModal(id) {
  const task = STATE.tasks.find(t => t.id === id);
  if (!task) return;
  STATE.editingTaskId = id;

  populateCategorySelects();

  document.getElementById('modalTitle').value = task.text;
  document.getElementById('modalPriority').value = task.priority;
  document.getElementById('modalCategory').value = task.category || '';
  document.getElementById('modalDue').value = task.due || '';
  document.getElementById('modalNote').value = task.note || '';
  document.getElementById('modalCreated').textContent = new Date(task.createdAt).toLocaleString();

  const tag = document.getElementById('modalPriorityTag');
  tag.innerHTML = `<span class="priority-badge ${task.priority}">${priorityLabel(task.priority)}</span>`;

  renderSubtasks(task);

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  STATE.editingTaskId = null;
}

function saveModal() {
  const id = STATE.editingTaskId;
  const task = STATE.tasks.find(t => t.id === id);
  if (!task) return;

  const newText = document.getElementById('modalTitle').value.trim();
  if (!newText) return;

  task.text = newText;
  task.priority = document.getElementById('modalPriority').value;
  task.category = document.getElementById('modalCategory').value;
  task.due = document.getElementById('modalDue').value;
  task.note = document.getElementById('modalNote').value.trim();

  save();
  render();
  closeModal();
  toast('✓ Changes saved');
}

// ── SUBTASKS ────────────────────────────────────
function renderSubtasks(task) {
  const list = document.getElementById('subtaskList');
  list.innerHTML = '';
  task.subtasks.forEach((sub, i) => {
    const item = document.createElement('div');
    item.className = 'subtask-item';
    item.innerHTML = `
      <div class="subtask-check ${sub.done ? 'checked' : ''}" data-index="${i}"></div>
      <span class="subtask-text ${sub.done ? 'done' : ''}">${escapeHtml(sub.text)}</span>
      <button class="subtask-del" data-index="${i}">✕</button>
    `;
    item.querySelector('.subtask-check').addEventListener('click', () => {
      sub.done = !sub.done;
      renderSubtasks(task);
    });
    item.querySelector('.subtask-del').addEventListener('click', () => {
      task.subtasks.splice(i, 1);
      renderSubtasks(task);
    });
    list.appendChild(item);
  });
}

function addSubtask() {
  const id = STATE.editingTaskId;
  const task = STATE.tasks.find(t => t.id === id);
  if (!task) return;
  const input = document.getElementById('subtaskInput');
  const text = input.value.trim();
  if (!text) return;
  task.subtasks.push({ text, done: false });
  renderSubtasks(task);
  input.value = '';
  input.focus();
}

// ── CATEGORY MODAL ─────────────────────────────
let selectedColor = COLORS[0];

function openCategoryModal() {
  selectedColor = COLORS[0];
  document.getElementById('categoryNameInput').value = '';
  renderColorPicker();
  document.getElementById('categoryModalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('categoryNameInput').focus(), 100);
}

function renderColorPicker() {
  const picker = document.getElementById('colorPicker');
  picker.innerHTML = '';
  COLORS.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (color === selectedColor ? ' selected' : '');
    sw.style.background = color;
    sw.addEventListener('click', () => {
      selectedColor = color;
      renderColorPicker();
    });
    picker.appendChild(sw);
  });
}

function saveCategory() {
  const name = document.getElementById('categoryNameInput').value.trim();
  if (!name) return;
  STATE.categories.push({ id: uid(), name, color: selectedColor });
  save();
  document.getElementById('categoryModalOverlay').classList.remove('open');
  render();
  toast('✓ Category created');
}

// ── THEME ──────────────────────────────────────
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = STATE.theme === 'light' ? 'light' : '';
  save();
}

// ── DATE DISPLAY ───────────────────────────────
function updateDateDisplay() {
  const d = new Date();
  const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  document.getElementById('topbarDate').textContent = d.toLocaleDateString('en', opts);
}

// ── PARTICLES ──────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.3,
      a: Math.random() * 0.4 + 0.05,
      c: Math.random() > 0.5 ? '#00ffc8' : '#7b5cff',
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c + Math.floor(p.a * 255).toString(16).padStart(2, '0');
      ctx.fill();

      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
    });
    requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();
  window.addEventListener('resize', () => { resize(); createParticles(); });
}

// ── INIT ───────────────────────────────────────
function init() {
  load();

  // Apply theme
  if (STATE.theme === 'light') document.documentElement.dataset.theme = 'light';

  updateDateDisplay();
  setInterval(updateDateDisplay, 60000);
  initParticles();
  render();

  // ── EVENT LISTENERS ──

  // Add task
  document.getElementById('addTaskBtn').addEventListener('click', addTask);
  document.getElementById('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Nav filter
  document.querySelectorAll('.nav-item[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.filter = btn.dataset.filter;
      STATE.categoryFilter = null;
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('viewTitle').textContent = btn.querySelector('span:not(.nav-icon):not(.nav-badge)').textContent;
      render();
    });
  });

  // Search
  document.getElementById('searchToggle').addEventListener('click', () => {
    document.getElementById('searchBar').classList.toggle('open');
    if (document.getElementById('searchBar').classList.contains('open')) {
      document.getElementById('searchInput').focus();
    }
  });
  document.getElementById('searchInput').addEventListener('input', e => {
    STATE.searchQuery = e.target.value;
    render();
  });

  // Sort
  document.getElementById('sortBtn').addEventListener('click', () => {
    document.getElementById('sortPanel').classList.toggle('open');
  });
  document.querySelectorAll('.sort-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.sortBy = btn.dataset.sort;
      render();
    });
  });

  // Theme
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Modal
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalSave').addEventListener('click', saveModal);
  document.getElementById('modalDelete').addEventListener('click', () => {
    deleteTask(STATE.editingTaskId);
    closeModal();
  });
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Modal priority change live preview
  document.getElementById('modalPriority').addEventListener('change', e => {
    const tag = document.getElementById('modalPriorityTag');
    tag.innerHTML = `<span class="priority-badge ${e.target.value}">${priorityLabel(e.target.value)}</span>`;
  });

  // Subtasks
  document.getElementById('addSubtaskBtn').addEventListener('click', addSubtask);
  document.getElementById('subtaskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addSubtask();
  });

  // Category modal
  document.getElementById('addCategoryBtn').addEventListener('click', openCategoryModal);
  document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);
  document.getElementById('categoryModalClose').addEventListener('click', () => {
    document.getElementById('categoryModalOverlay').classList.remove('open');
  });
  document.getElementById('categoryModalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('categoryModalOverlay')) {
      document.getElementById('categoryModalOverlay').classList.remove('open');
    }
  });
  document.getElementById('categoryNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCategory();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      document.getElementById('categoryModalOverlay').classList.remove('open');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('searchBar').classList.add('open');
      document.getElementById('searchInput').focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      document.getElementById('taskInput').focus();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
