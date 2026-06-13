/* =============================================
   RepLog — Workout Tracker
   All logic: routing, storage, forms, charts
============================================= */

// ─── State ──────────────────────────────────

let workouts = JSON.parse(localStorage.getItem('replog_workouts') || '[]');
let currentPage = 'dashboard';

// ─── Utils ──────────────────────────────────

function save() {
  localStorage.setItem('replog_workouts', JSON.stringify(workouts));
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function calcVolume(exercises) {
  return exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((s, set) => {
      const w = parseFloat(set.weight) || 0;
      const r = parseInt(set.reps) || 0;
      return s + (w * r);
    }, 0);
  }, 0);
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

function getMuscleGroup(name) {
  const n = name.toLowerCase();
  if (/bench|press|fly|push|chest|pec/.test(n)) return 'Chest';
  if (/squat|leg|lunge|quad|ham|glute|deadlift/.test(n)) return 'Legs';
  if (/pull|row|lat|back|chin|shrug/.test(n)) return 'Back';
  if (/shoulder|delt|ohp|lateral|raise/.test(n)) return 'Shoulders';
  if (/curl|bicep/.test(n)) return 'Biceps';
  if (/tricep|dip|extension/.test(n)) return 'Triceps';
  if (/core|abs|crunch|plank/.test(n)) return 'Core';
  return 'Other';
}

// ─── Navigation ─────────────────────────────

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  currentPage = page;

  if (page === 'dashboard') renderDashboard();
  if (page === 'history') renderHistory();
  if (page === 'progress') renderProgress();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.page));
});

// ─── Dashboard ──────────────────────────────

function renderDashboard() {
  // Date
  const now = new Date();
  document.getElementById('header-date').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Stats
  document.getElementById('stat-total').textContent = workouts.length;

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = workouts.filter(w => new Date(w.date + 'T00:00:00') >= weekAgo).length;
  document.getElementById('stat-week').textContent = thisWeek;

  const totalVol = workouts.reduce((t, w) => t + calcVolume(w.exercises), 0);
  document.getElementById('stat-volume').textContent = Math.round(totalVol).toLocaleString();

  const prs = workouts.filter(w => w.notes && /pr|personal record|new max/i.test(w.notes)).length;
  document.getElementById('stat-prs').textContent = prs;

  // Streak
  const streak = calcStreak();
  document.getElementById('streak-count').textContent = streak;

  // Recent workouts (last 8)
  const recent = [...workouts].reverse().slice(0, 8);
  renderWorkoutTable('recent-workouts', recent);
}

function calcStreak() {
  if (!workouts.length) return 0;
  const dates = [...new Set(workouts.map(w => w.date))].sort().reverse();
  let streak = 0;
  let check = todayStr();
  for (const d of dates) {
    if (d === check) {
      streak++;
      const prev = new Date(check + 'T00:00:00');
      prev.setDate(prev.getDate() - 1);
      check = prev.toISOString().slice(0, 10);
    } else break;
  }
  return streak;
}

function renderWorkoutTable(containerId, list) {
  const container = document.getElementById(containerId);
  if (!list.length) {
    container.innerHTML = '<div class="empty-state">No workouts logged yet. Hit "Log Workout" to start.</div>';
    return;
  }

  const header = `
    <div class="workout-row table-header">
      <span class="col-head">Workout</span>
      <span class="col-head">Date</span>
      <span class="col-head">Duration</span>
      <span class="col-head">Volume</span>
      <span class="col-head"></span>
    </div>`;

  const rows = list.map(w => {
    const vol = calcVolume(w.exercises);
    return `
      <div class="workout-row" data-id="${w.id}">
        <span class="col-name">${escHtml(w.name)}</span>
        <span class="col-date">${formatDate(w.date)}</span>
        <span class="col-duration">${w.duration ? w.duration + ' min' : '—'}</span>
        <span class="col-volume">${vol ? Math.round(vol).toLocaleString() + ' lbs' : '—'}</span>
        <span class="col-arrow">›</span>
      </div>`;
  }).join('');

  container.innerHTML = header + rows;

  container.querySelectorAll('.workout-row:not(.table-header)').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.id));
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Log Workout ────────────────────────────

let exerciseCount = 0;

function addExercise() {
  const id = exerciseCount++;
  const block = document.createElement('div');
  block.className = 'exercise-block';
  block.dataset.exId = id;
  block.innerHTML = `
    <div class="exercise-header">
      <input class="form-input" placeholder="Exercise name (e.g. Bench Press)" data-role="ex-name" />
      <select class="form-input" data-role="ex-muscle">
        <option value="">Muscle group</option>
        <option>Chest</option><option>Back</option><option>Legs</option>
        <option>Shoulders</option><option>Biceps</option><option>Triceps</option>
        <option>Core</option><option>Cardio</option><option>Other</option>
      </select>
      <button class="btn-icon remove-exercise" title="Remove exercise">&times;</button>
    </div>
    <div class="exercise-sets" data-sets-container></div>
    <div class="exercise-footer">
      <button class="btn-ghost add-set-btn" style="font-size:12px;padding:0.4rem 0.875rem;">+ Add Set</button>
    </div>`;

  block.querySelector('.remove-exercise').addEventListener('click', () => block.remove());
  block.querySelector('.add-set-btn').addEventListener('click', () => addSet(block.querySelector('[data-sets-container]')));

  document.getElementById('exercises-list').appendChild(block);
  addSet(block.querySelector('[data-sets-container]'));
}

function addSet(container) {
  const setNum = container.children.length + 1;
  const row = document.createElement('div');
  row.className = 'set-row';
  row.innerHTML = `
    <span class="set-label">Set ${setNum}</span>
    <input class="form-input mono" type="number" placeholder="lbs" min="0" data-role="weight" />
    <input class="form-input mono" type="number" placeholder="reps" min="0" data-role="reps" />
    <button class="btn-icon remove-set" title="Remove set">&times;</button>`;
  row.querySelector('.remove-set').addEventListener('click', () => {
    row.remove();
    renumberSets(container);
  });
  container.appendChild(row);
}

function renumberSets(container) {
  [...container.querySelectorAll('.set-label')].forEach((el, i) => {
    el.textContent = `Set ${i + 1}`;
  });
}

function readForm() {
  const name = document.getElementById('workout-name').value.trim();
  const date = document.getElementById('workout-date').value;
  const duration = document.getElementById('workout-duration').value;
  const notes = document.getElementById('workout-notes').value.trim();

  const exercises = [];
  document.querySelectorAll('.exercise-block').forEach(block => {
    const exName = block.querySelector('[data-role="ex-name"]').value.trim();
    const muscle = block.querySelector('[data-role="ex-muscle"]').value;
    if (!exName) return;
    const sets = [];
    block.querySelectorAll('.set-row').forEach(row => {
      const weight = row.querySelector('[data-role="weight"]').value;
      const reps = row.querySelector('[data-role="reps"]').value;
      if (weight || reps) sets.push({ weight, reps });
    });
    exercises.push({ name: exName, muscle, sets });
  });

  return { name, date, duration, notes, exercises };
}

function clearForm() {
  document.getElementById('workout-name').value = '';
  document.getElementById('workout-date').value = todayStr();
  document.getElementById('workout-duration').value = '';
  document.getElementById('workout-notes').value = '';
  document.getElementById('exercises-list').innerHTML = '';
  exerciseCount = 0;
}

document.getElementById('add-exercise-btn').addEventListener('click', addExercise);

document.getElementById('save-workout-btn').addEventListener('click', () => {
  const data = readForm();
  if (!data.name) { toast('Give your workout a name.'); return; }
  if (!data.date) { toast('Pick a date.'); return; }
  if (!data.exercises.length) { toast('Add at least one exercise.'); return; }

  const workout = {
    id: Date.now().toString(),
    name: data.name,
    date: data.date,
    duration: data.duration,
    notes: data.notes,
    exercises: data.exercises,
    createdAt: new Date().toISOString()
  };

  workouts.push(workout);
  save();
  clearForm();
  toast('Workout saved.');
  navigate('dashboard');
});

document.getElementById('clear-form-btn').addEventListener('click', clearForm);

// Set default date
document.getElementById('workout-date').value = todayStr();

// ─── History ────────────────────────────────

function renderHistory(filter = '') {
  const list = [...workouts]
    .reverse()
    .filter(w => !filter || w.name.toLowerCase().includes(filter.toLowerCase()));
  renderWorkoutTable('history-list', list);

  // Fix empty state message for history
  if (!list.length) {
    const container = document.getElementById('history-list');
    container.innerHTML = filter
      ? `<div class="empty-state">No workouts match "${escHtml(filter)}".</div>`
      : '<div class="empty-state">No workouts logged yet.</div>';
  }
}

document.getElementById('history-search').addEventListener('input', e => {
  renderHistory(e.target.value);
});

// ─── Modal ──────────────────────────────────

function openModal(id) {
  const w = workouts.find(x => x.id === id);
  if (!w) return;

  document.getElementById('modal-title').textContent = w.name;

  const vol = calcVolume(w.exercises);
  const metaHTML = `
    <div class="modal-meta">
      <div class="modal-meta-item">
        <span class="modal-meta-label">Date</span>
        <span class="modal-meta-value" style="font-size:14px;">${formatDate(w.date)}</span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">Duration</span>
        <span class="modal-meta-value">${w.duration || '—'}<span style="font-size:13px;color:var(--text-muted);">${w.duration ? ' min' : ''}</span></span>
      </div>
      <div class="modal-meta-item">
        <span class="modal-meta-label">Volume</span>
        <span class="modal-meta-value" style="font-size:16px;">${vol ? Math.round(vol).toLocaleString() : '—'}<span style="font-size:11px;color:var(--text-muted);">${vol ? ' lbs' : ''}</span></span>
      </div>
    </div>`;

  const exHTML = w.exercises.map(ex => `
    <div class="modal-exercise-row">
      <div class="modal-exercise-name">${escHtml(ex.name)}${ex.muscle ? `<span style="font-size:11px;color:var(--text-dim);font-weight:400;margin-left:8px;">${ex.muscle}</span>` : ''}</div>
      <table class="modal-sets-table">
        <thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Volume</th></tr></thead>
        <tbody>
          ${ex.sets.map((s, i) => {
            const vol = ((parseFloat(s.weight)||0) * (parseInt(s.reps)||0));
            return `<tr>
              <td>${i+1}</td>
              <td>${s.weight ? s.weight + ' lbs' : '—'}</td>
              <td>${s.reps || '—'}</td>
              <td>${vol ? vol.toLocaleString() : '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`).join('');

  const notesHTML = w.notes
    ? `<div class="modal-notes">${escHtml(w.notes)}</div>`
    : '';

  document.getElementById('modal-body').innerHTML = metaHTML +
    `<div class="modal-exercises-title">Exercises (${w.exercises.length})</div>` +
    exHTML + notesHTML;

  document.getElementById('modal-delete').dataset.deleteId = id;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-close-btn').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

document.getElementById('modal-delete').addEventListener('click', e => {
  const id = e.target.dataset.deleteId;
  workouts = workouts.filter(w => w.id !== id);
  save();
  closeModal();
  toast('Workout deleted.');
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'history') renderHistory();
});

// ─── Progress ───────────────────────────────

function renderProgress() {
  renderVolumeChart();
  renderHeatmap();
  renderMuscleBars();
}

function renderVolumeChart() {
  const chartCard = document.getElementById('volume-chart').parentElement;
  const empty = document.getElementById('chart-empty');

  if (workouts.length < 2) {
    empty.style.display = 'flex';
    document.getElementById('volume-chart').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  document.getElementById('volume-chart').style.display = 'none';

  // Remove old chart if exists
  const oldChart = chartCard.querySelector('.chart-bars');
  if (oldChart) oldChart.remove();

  // Group by week
  const weekMap = {};
  workouts.forEach(w => {
    const key = getWeekKey(w.date);
    if (!weekMap[key]) weekMap[key] = 0;
    weekMap[key] += calcVolume(w.exercises);
  });

  const weeks = Object.keys(weekMap).sort().slice(-10);
  const values = weeks.map(k => weekMap[k]);
  const maxVal = Math.max(...values, 1);

  const barsDiv = document.createElement('div');
  barsDiv.className = 'chart-bars';

  weeks.forEach((week, i) => {
    const pct = (values[i] / maxVal) * 100;
    const label = new Date(week + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    barsDiv.innerHTML += `
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${Math.max(pct, 2)}%" title="${Math.round(values[i]).toLocaleString()} lbs"></div>
        <span class="chart-bar-label">${label}</span>
      </div>`;
  });

  chartCard.appendChild(barsDiv);
}

function renderHeatmap() {
  const container = document.getElementById('heatmap');
  container.innerHTML = '';

  const workoutDates = new Set(workouts.map(w => w.date));

  // Build 16 weeks back
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (16 * 7));
  // Align to Monday
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

  const cursor = new Date(start);
  while (cursor <= today) {
    const col = document.createElement('div');
    col.className = 'heatmap-col';
    for (let d = 0; d < 7; d++) {
      const cell = document.createElement('div');
      const dateKey = cursor.toISOString().slice(0, 10);
      cell.className = 'heatmap-cell' + (workoutDates.has(dateKey) ? ' active' : '');
      cell.title = formatDate(dateKey) + (workoutDates.has(dateKey) ? ' — trained' : '');
      col.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }
    container.appendChild(col);
  }
}

function renderMuscleBars() {
  const container = document.getElementById('muscle-bars');

  const counts = {};
  workouts.forEach(w => {
    w.exercises.forEach(ex => {
      const group = ex.muscle || getMuscleGroup(ex.name);
      counts[group] = (counts[group] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  if (!sorted.length) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;">No exercise data yet.</div>';
    return;
  }

  container.innerHTML = sorted.map(([group, count]) => `
    <div class="muscle-bar-row">
      <span class="muscle-bar-label">${group}</span>
      <div class="muscle-bar-track">
        <div class="muscle-bar-fill" style="width:${(count/max)*100}%"></div>
      </div>
      <span class="muscle-bar-count">${count}</span>
    </div>`).join('');
}

// ─── Keyboard ───────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── Init ───────────────────────────────────

renderDashboard(); 