import { protectPageOrRedirectToLogin, signOutAndGoHome, auth, onAuthStateChanged, db } from "/js/firebase-config.js";
import { initThemeToggle } from "/js/theme.js";
import { listTasks, removeTask } from "/js/tasks.js";
import { addClass, listClasses, updateClass, removeClass, CLASS_COLORS } from "/js/classes.js";
import { collection, doc, deleteDoc, getDocs } from 'firebase/firestore';

// Protect page and init theme
protectPageOrRedirectToLogin();
initThemeToggle();

// Global state
let userClasses = [];
let currentEditingClass = null;

// Initialize dashboard
async function initDashboard() {
  setupEventListeners();
  await loadAndRender();
  await loadClasses();
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

  // Add class button
  const addClassBtn = document.getElementById("addClassBtn");
  addClassBtn?.addEventListener("click", () => {
    openClassModal();
  });

  // Class form submission
  const classForm = document.getElementById("class-form");
  classForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveClass();
  });

  // Cancel class button
  const cancelClassBtn = document.getElementById("cancel-class-btn");
  cancelClassBtn?.addEventListener("click", () => {
    closeClassModal();
  });

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

  // Setup color presets
  setupColorPresets();
}

// Settings Modal Functions
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  modal.classList.add('open');
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

// Class Management Functions
async function loadClasses() {
  try {
    userClasses = await listClasses();
    renderClasses();
  } catch (error) {
    console.error("Error loading classes:", error);
  }
}

function renderClasses() {
  const classesList = document.getElementById('classesList');
  if (!classesList) return;

  classesList.innerHTML = '';

  if (userClasses.length === 0) {
    const emptyState = document.createElement('li');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = '<p style="color: var(--muted); text-align: center; padding: var(--space-2);">No classes added yet</p>';
    classesList.appendChild(emptyState);
    return;
  }

  userClasses.forEach(classItem => {
    const li = document.createElement('li');
    li.className = 'class-item';
    
    li.innerHTML = `
      <div class="class-color" style="background-color: ${classItem.color}"></div>
      <div class="class-info">
        <div class="class-name">${classItem.name}</div>
      </div>
      <div class="class-actions">
        <button class="btn small outline edit-class-btn" data-class-id="${classItem.id}">Edit</button>
        <button class="btn small danger delete-class-btn" data-class-id="${classItem.id}">Delete</button>
      </div>
    `;

    // Add event listeners for edit and delete
    const editBtn = li.querySelector('.edit-class-btn');
    const deleteBtn = li.querySelector('.delete-class-btn');

    editBtn.addEventListener('click', () => editClass(classItem.id));
    deleteBtn.addEventListener('click', () => deleteClass(classItem.id));

    classesList.appendChild(li);
  });
}

function openClassModal(classData = null) {
  const modal = document.getElementById('class-modal');
  const form = document.getElementById('class-form');
  const title = document.getElementById('class-modal-title');

  if (classData) {
    // Edit mode
    currentEditingClass = classData.id;
    title.textContent = 'Edit Class';
    document.getElementById('class-name').value = classData.name || '';
    document.getElementById('class-instructor').value = classData.instructor || '';
    document.getElementById('class-color').value = classData.color || '#3788d8';
  } else {
    // Add mode
    currentEditingClass = null;
    title.textContent = 'Add New Class';
    form.reset();
    document.getElementById('class-color').value = '#3788d8';
  }

  modal.classList.add('open');
}

function closeClassModal() {
  const modal = document.getElementById('class-modal');
  modal.classList.remove('open');
  currentEditingClass = null;
}

async function saveClass() {
  const form = document.getElementById('class-form');
  const formData = new FormData(form);

  const classData = {
    name: formData.get('name'),
    instructor: formData.get('instructor'),
    color: formData.get('color')
  };

  try {
    if (currentEditingClass) {
      // Update existing class
      await updateClass(currentEditingClass, classData);
    } else {
      // Add new class
      await addClass(classData);
    }

    await loadClasses(); // Reload classes
    closeClassModal();
  } catch (error) {
    console.error("Error saving class:", error);
    alert("Failed to save class. Please try again.");
  }
}

async function editClass(classId) {
  const classData = userClasses.find(c => c.id === classId);
  if (classData) {
    openClassModal(classData);
  }
}

async function deleteClass(classId) {
  const classData = userClasses.find(c => c.id === classId);
  const confirmDelete = confirm(`Delete class "${classData?.name}"?`);
  
  if (confirmDelete) {
    try {
      await removeClass(classId);
      await loadClasses(); // Reload classes
    } catch (error) {
      console.error("Error deleting class:", error);
      alert("Failed to delete class. Please try again.");
    }
  }
}

function setupColorPresets() {
  const colorPresets = document.getElementById('color-presets');
  if (!colorPresets) return;

  CLASS_COLORS.forEach(color => {
    const preset = document.createElement('div');
    preset.className = 'color-preset';
    preset.style.backgroundColor = color;
    preset.addEventListener('click', () => {
      document.getElementById('class-color').value = color;
      // Update visual selection
      document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('selected'));
      preset.classList.add('selected');
    });
    colorPresets.appendChild(preset);
  });
}

// Enhanced task rendering with class colors
function renderList(container, items, completedMap) {
  container.innerHTML = '';
  
  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'task-item';

    // Find associated class for color
    const associatedClass = userClasses.find(c => c.id === item.classId);
    if (associatedClass) {
      li.style.borderLeftColor = associatedClass.color;
      li.style.borderLeftWidth = '4px';
    }

    const isCompleted = !!completedMap[item.id];
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isCompleted;
    checkbox.className = 'task-checkbox';

    const title = document.createElement('span');
    title.textContent = item.title || 'Untitled';
    title.className = 'task-title' + (isCompleted ? ' completed' : '');

    const meta = document.createElement('span');
    meta.className = 'task-meta';
    let metaText = '';
    
    if (item.dueAt) {
      const due = parseDate(item.dueAt);
      if (due) metaText += `due ${due.toLocaleString()}`;
    }
    
    if (associatedClass) {
      metaText += (metaText ? ' • ' : '') + associatedClass.name;
    }
    
    meta.textContent = metaText;

    li.appendChild(checkbox);
    li.appendChild(title);
    li.appendChild(meta);

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
          alert('Failed to mark complete. Please try again.');
        }
      } else {
        // Un-complete locally (won't re-add to DB)
        title.classList.remove('completed');
        delete map[item.id];
        saveCompletedLocal(map);
      }
    });

    container.appendChild(li);
  }
}

// Dashboard logic (existing functions with minor updates)
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

function todayKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const uid = auth.currentUser?.uid || 'anon';
  return `dashboard-completed-${uid}-${yyyy}-${mm}-${dd}`;
}

function loadCompletedLocal() {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCompletedLocal(map) {
  localStorage.setItem(todayKey(), JSON.stringify(map || {}));
}

async function loadAndRender() {
  const todayListEl = document.getElementById('todayAssignments');
  const importantListEl = document.getElementById('importantTasks');
  if (!todayListEl || !importantListEl) return;

  let tasks = [];
  try {
    tasks = await listTasks();
  } catch (e) {
    console.warn('Failed to load tasks:', e);
  }

  const start = startOfToday();
  const end = endOfToday();

  const isDueToday = (task) => {
    const d = parseDate(task.dueAt);
    return !!d && d >= start && d <= end;
  };

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
  renderList(todayListEl, todaysAssignments, completedMap);
  renderList(importantListEl, importantTasks, completedMap);
}

// Utility to run after auth is ready (onAuthStateChanged may fire after DOMContentLoaded)
function firebaseAuthReady(cb) {
  if (auth.currentUser) { cb(); return () => {}; }
  const un = onAuthStateChanged(auth, () => { cb(); un(); });
  return un;
}

// After auth known, initialize dashboard
firebaseAuthReady(initDashboard);