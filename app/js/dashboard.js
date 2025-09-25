import { protectPageOrRedirectToLogin, signOutAndGoHome, auth, onAuthStateChanged, db } from "/js/firebase-config.js";
import { initThemeToggle, syncTheme } from "/js/theme.js";
import { listTasks, removeTask } from "/js/tasks.js";
import { collection, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { 
  formatDueDate, 
  formatCurrentDate, 
  isDueToday, 
  getTodayStorageKey 
} from "/js/dateUtils.js";
import { 
  loadClasses,
  setupClassEventListeners,
  findClassById
} from "/js/classManager.js";
import {
  initTimeline,
  updateTimelineTasks,
  setupUpcomingFilters,
  renderUpcomingTimeline
} from "/js/timelineManager.js";

// Init 
protectPageOrRedirectToLogin();
syncTheme();
initThemeToggle();

// state
let allTasks = [];

async function initDashboard() {
  setupEventListeners();
  setupUpcomingFilters();
  updateCurrentDate();
  await loadAndRender();
  const classes = await loadClasses();
  
  initTimeline(allTasks, classes);
  renderUpcomingTimeline();
}

function updateCurrentDate() {
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    dateEl.textContent = formatCurrentDate();
  }
}

function renderAssignmentList(container, items, completedMap) {
  container.innerHTML = '';
  
  if (items.length === 0) {
    const emptyState = document.createElement('li');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <p>Nothing for now :)</p>
    `;
    container.appendChild(emptyState);
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'assignment-item';

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
          ${item.dueAt ? `<span> ${formatDueDate(item.dueAt)}</span>` : ''}
          ${associatedClass ? `<span class="assignment-class"><span class="class-dot" style="background: ${associatedClass.color}"></span>${associatedClass.name}</span>` : ''}
        </div>
      </div>
    `;

    const checkbox = li.querySelector('.assignment-checkbox');
    const title = li.querySelector('.assignment-title');

    checkbox.addEventListener('change', async (e) => {
      const checked = e.currentTarget.checked;
      const map = loadCompletedLocal();
      if (checked) {
        title.classList.add('completed');
        map[item.id] = {
          id: item.id,
          title: item.title,
          dueAt: item.dueAt || null,
          type: item.type || 'assignment',
          classId: item.classId || null,
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
        title.classList.remove('completed');
        delete map[item.id];
        saveCompletedLocal(map);
      }
      
      // Update timeline after completion change
      updateTimelineTasks(allTasks);
      renderUpcomingTimeline();
    });

    container.appendChild(li);
  }
}

function setupEventListeners() {
  const settingsBtn = document.getElementById("settingsBtn");
  settingsBtn?.addEventListener("click", () => {
    openSettingsModal();
  });

  const signOutBtn = document.getElementById("signOutBtn");
  signOutBtn?.addEventListener("click", () => {
    signOutAndGoHome();
  });

  // Delete account button
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  deleteAccountBtn?.addEventListener("click", async () => {
    await handleDeleteAccount();
  }); 

  setupClassEventListeners();

  document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      modal.classList.remove('open');
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.remove('open');
    }
  });

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
  if (!todayListEl) return;

  let tasks = [];
  try {
    tasks = await listTasks();
    allTasks = tasks; // Store for timeline
    
    // Update timeline with new tasks
    updateTimelineTasks(allTasks);
  } catch (e) {
    console.warn('Failed to load tasks:', e);
  }

  let todaysAssignments = tasks
    .filter(t => (t.type === 'assignment') && isDueToday(t))
    .map(t => ({ ...t, __fromDB: true }));
  const completedMap = loadCompletedLocal();
  const completedItems = Object.values(completedMap || {});

  const seenIds = new Set([
    ...todaysAssignments.map(t => t.id)
  ]);

  for (const it of completedItems) {
    if (!seenIds.has(it.id) && it.type === 'assignment' && isDueToday(it)) {
      todaysAssignments.push({ ...it, __fromDB: false });
      seenIds.add(it.id);
    }
  }

  // Render
  renderAssignmentList(todayListEl, todaysAssignments, completedMap);
  
  // Update timeline
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

function firebaseAuthReady(cb) {
  if (auth.currentUser) { cb(); return () => {}; }
  const un = onAuthStateChanged(auth, () => { cb(); un(); });
  return un;
}

// After auth known, initialize dashboard
firebaseAuthReady(initDashboard);