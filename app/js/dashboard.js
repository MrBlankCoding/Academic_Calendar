import { protectPageOrRedirectToLogin, signOutAndGoHome, auth, onAuthStateChanged, db } from "/js/firebase-config.js";
import { initThemeToggle, syncTheme } from "/js/theme.js";
import { listTasks, removeTask } from "/js/tasks.js";
import { collection, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { 
  parseDate, 
  startOfToday, 
  endOfToday, 
  formatDueDate, 
  formatCurrentDate, 
  isDueToday, 
  getTodayStorageKey 
} from "/js/dateUtils.js";
import { 
  loadClasses,
  getUserClasses,
  setupClassEventListeners,
  findClassById
} from "/js/classManager.js";
import {
  initTimeline,
  updateTimelineTasks,
  updateTimelineClasses,
  setupUpcomingFilters,
  renderUpcomingTimeline
} from "/js/timelineManager.js";

// Protect page and init theme
protectPageOrRedirectToLogin();
syncTheme();
initThemeToggle();

// Global state
let allTasks = [];

// Initialize dashboard
async function initDashboard() {
  setupEventListeners();
  setupUpcomingFilters();
  updateCurrentDate();
  await loadAndRender();
  const classes = await loadClasses();
  updateStats();
  
  // Initialize timeline with tasks and classes
  initTimeline(allTasks, classes);
  renderUpcomingTimeline();
}

// Update current date display
function updateCurrentDate() {
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    dateEl.textContent = formatCurrentDate();
  }
}

// Update stats in sidebar
function updateStats() {
  const totalAssignmentsEl = document.getElementById('totalAssignments');
  const totalClassesEl = document.getElementById('totalClasses');
  const todayCountEl = document.getElementById('todayCount');
  const importantCountEl = document.getElementById('importantCount');
  const classesCountEl = document.getElementById('classesCount');

  const userClasses = getUserClasses();

  if (totalAssignmentsEl) {
    totalAssignmentsEl.textContent = allTasks.filter(t => t.type === 'assignment').length;
  }
  
  if (totalClassesEl) {
    totalClassesEl.textContent = userClasses.length;
  }

  // Count today's assignments
  const start = startOfToday();
  const end = endOfToday();
  const todayAssignments = allTasks.filter(t => {
    const d = parseDate(t.dueAt);
    return t.type === 'assignment' && d && d >= start && d <= end;
  });

  if (todayCountEl) {
    todayCountEl.textContent = todayAssignments.length;
  }

  // Count important tasks
  const importantTasks = allTasks.filter(t => t.important && t.status !== 'done');
  if (importantCountEl) {
    importantCountEl.textContent = importantTasks.length;
  }

  if (classesCountEl) {
    classesCountEl.textContent = userClasses.length;
  }
}

function renderAssignmentList(container, items, completedMap) {
  container.innerHTML = '';
  
  if (items.length === 0) {
    const emptyState = document.createElement('li');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <i class="fas fa-tasks"></i>
      <p>No assignments found</p>
    `;
    container.appendChild(emptyState);
    return;
  }

  const userClasses = getUserClasses();

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'assignment-item';

    // Find associated class for color
    const associatedClass = findClassById(item.classId);
    if (associatedClass) {
      li.style.borderLeft = `4px solid ${associatedClass.color}`;
    }

    const isCompleted = !!completedMap[item.id];
    
    li.innerHTML = `
      <input type="checkbox" class="assignment-checkbox" ${isCompleted ? 'checked' : ''}>
      <div class="assignment-content">
        <div class="assignment-title ${isCompleted ? 'completed' : ''}">${item.title || 'Untitled'}</div>
        <div class="assignment-meta">
          ${item.dueAt ? `<span><i class="fas fa-clock"></i> ${formatDueDate(item.dueAt)}</span>` : ''}
          ${associatedClass ? `<span class="assignment-class"><span class="class-dot" style="background: ${associatedClass.color}"></span>${associatedClass.name}</span>` : ''}
          ${item.important ? '<span class="assignment-important"><i class="fas fa-star"></i> Important</span>' : ''}
        </div>
      </div>
    `;

    const checkbox = li.querySelector('.assignment-checkbox');
    const title = li.querySelector('.assignment-title');

    checkbox.addEventListener('change', async (e) => {
      const checked = e.currentTarget.checked;
      const map = loadCompletedLocal();
      if (checked) {
        // Optimistically strike-through and delete from DB
        title.classList.add('completed');
        // Persist the full item so it can be rendered after reload today
        map[item.id] = {
          id: item.id,
          title: item.title,
          dueAt: item.dueAt || null,
          type: item.type || 'assignment',
          classId: item.classId || null,
          important: !!item.important,
          __fromDB: false
        };
        saveCompletedLocal(map);
        try {
          if (item.id && item.__fromDB) {
            await removeTask(item.id);
            item.__fromDB = false; // mark as removed from DB
          }
        } catch (err) {
          // Revert on failure
          checkbox.checked = false;
          title.classList.remove('completed');
          delete map[item.id];
          saveCompletedLocal(map);
        }
      } else {
        // Un-complete locally (won't re-add to DB)
        title.classList.remove('completed');
        delete map[item.id];
        saveCompletedLocal(map);
      }
      
      // Update stats and timeline after completion change
      updateStats();
      updateTimelineTasks(allTasks);
      renderUpcomingTimeline();
    });

    container.appendChild(li);
  }
}

// Event listeners setup
function setupEventListeners() {
  // Settings button
  const settingsBtn = document.getElementById("settingsBtn");
  settingsBtn?.addEventListener("click", () => {
    openSettingsModal();
  });

  // Sign out button (in settings modal)
  const signOutBtn = document.getElementById("signOutBtn");
  signOutBtn?.addEventListener("click", () => {
    signOutAndGoHome();
  });

  // Delete account button
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  deleteAccountBtn?.addEventListener("click", async () => {
    await handleDeleteAccount();
  });

  // Setup class-related event listeners
  setupClassEventListeners();

  // Modal close buttons
  document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      modal.classList.remove('open');
    });
  });

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.remove('open');
    }
  });

  // Escape key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.open').forEach(modal => {
        modal.classList.remove('open');
      });
    }
  });
}

async function loadAndRender() {
  const todayListEl = document.getElementById('todayAssignments');
  const importantListEl = document.getElementById('importantTasks');
  if (!todayListEl || !importantListEl) return;

  let tasks = [];
  try {
    tasks = await listTasks();
    allTasks = tasks; // Store for stats and timeline
    
    // Update timeline with new tasks
    updateTimelineTasks(allTasks);
  } catch (e) {
    console.warn('Failed to load tasks:', e);
  }

  // Base lists from DB
  let todaysAssignments = tasks
    .filter(t => (t.type === 'assignment') && isDueToday(t))
    .map(t => ({ ...t, __fromDB: true }));

  let importantTasks = tasks
    .filter(t => !!t.important && t.status !== 'done')
    .map(t => ({ ...t, __fromDB: true }));

  // Merge in locally completed items (they may have been deleted from DB)
  const completedMap = loadCompletedLocal();
  const completedItems = Object.values(completedMap || {});

  // Add completed items back into relevant lists if they match criteria and aren't already present
  const seenIds = new Set([
    ...todaysAssignments.map(t => t.id),
    ...importantTasks.map(t => t.id)
  ]);

  for (const it of completedItems) {
    if (!seenIds.has(it.id) && it.type === 'assignment' && isDueToday(it)) {
      todaysAssignments.push({ ...it, __fromDB: false });
      seenIds.add(it.id);
    }
  }

  for (const it of completedItems) {
    if (!seenIds.has(it.id) && !!it.important) {
      importantTasks.push({ ...it, __fromDB: false });
      seenIds.add(it.id);
    }
  }

  // Render
  renderAssignmentList(todayListEl, todaysAssignments, completedMap);
  renderAssignmentList(importantListEl, importantTasks, completedMap);
  
  // Update stats and timeline
  updateStats();
  renderUpcomingTimeline();
}

function loadCompletedLocal() {
  try {
    const uid = auth.currentUser?.uid || 'anon';
    const key = getTodayStorageKey(uid);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCompletedLocal(map) {
  const uid = auth.currentUser?.uid || 'anon';
  const key = getTodayStorageKey(uid);
  localStorage.setItem(key, JSON.stringify(map || {}));
}

// Settings Modal Functions
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

async function handleDeleteAccount() {
  const confirmDelete = confirm(
    "Are you sure you want to delete your account? This action cannot be undone and will delete all your data."
  );
  
  if (!confirmDelete) return;

  const finalConfirm = prompt(
    "Type 'DELETE' to confirm account deletion:"
  );

  if (finalConfirm !== 'DELETE') {
    alert("Account deletion cancelled.");
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Delete all user data from Firestore
    await deleteUserData(user.uid);
    
    // Delete the user account
    await user.delete();
    
    alert("Account deleted successfully.");
    window.location.replace("/views/login.html");
  } catch (error) {
    console.error("Error deleting account:", error);
    alert("Failed to delete account. Please try again or contact support.");
  }
}

async function deleteUserData(uid) {
  // Delete all user's tasks
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const tasksSnapshot = await getDocs(tasksRef);
  for (const taskDoc of tasksSnapshot.docs) {
    await deleteDoc(taskDoc.ref);
  }

  // Delete all user's classes
  const classesRef = collection(db, 'users', uid, 'classes');
  const classesSnapshot = await getDocs(classesRef);
  for (const classDoc of classesSnapshot.docs) {
    await deleteDoc(classDoc.ref);
  }

  // Delete user document
  const userRef = doc(db, 'users', uid);
  await deleteDoc(userRef);
}

// Utility to run after auth is ready (onAuthStateChanged may fire after DOMContentLoaded)
function firebaseAuthReady(cb) {
  if (auth.currentUser) { cb(); return () => {}; }
  const un = onAuthStateChanged(auth, () => { cb(); un(); });
  return un;
}

// After auth known, initialize dashboard
firebaseAuthReady(initDashboard);