import { addClass, listClasses, updateClass, removeClass, CLASS_COLORS } from "/js/classes.js";

// Global state for classes
let userClasses = [];
let currentEditingClass = null;


async function loadClasses() {
  try {
    userClasses = await listClasses();
    renderClasses();
    return userClasses;
  } catch (error) {
    console.error("Error loading classes:", error);
    throw error;
  }
}

function getUserClasses() {
  return userClasses;
}

function renderClasses() {
  const classesList = document.getElementById('classesList');
  if (!classesList) return;

  classesList.innerHTML = '';

  if (userClasses.length === 0) {
    const emptyState = document.createElement('li');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <p>No classes added yet</p>
      <small>Add your first class to get started</small>
    `;
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
        ${classItem.instructor ? `<div class="class-instructor">${classItem.instructor}</div>` : ''}
      </div>
      <div class="class-actions">
        <button class="btn small outline edit-class-btn" data-class-id="${classItem.id}">
        </button>
        <button class="btn small danger delete-class-btn" data-class-id="${classItem.id}">
        </button>
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
  document.body.style.overflow = 'hidden';
  
  // Focus on name input
  setTimeout(() => {
    document.getElementById('class-name')?.focus();
  }, 100);
}

function closeClassModal() {
  const modal = document.getElementById('class-modal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
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
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    if (currentEditingClass) {
      // Update existing class
      await updateClass(currentEditingClass, classData);
    } else {
      // Add new class
      await addClass(classData);
    }

    await loadClasses(); // Reload classes
    closeClassModal();
    
    // Return the updated classes for external use
    return userClasses;
  } catch (error) {
    console.error("Error saving class:", error);
    throw error;
  } finally {
    // Reset button state
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = submitBtn.textContent === 'Saving...' ? 'Save Class' : submitBtn.textContent;
      submitBtn.disabled = false;
    }
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
      return userClasses;
    } catch (error) {
      console.error("Error deleting class:", error);
      throw error;
    }
  }
}

function setupColorPresets() {
  const colorPresets = document.getElementById('color-presets');
  if (!colorPresets) return;

  colorPresets.innerHTML = ''; // Clear existing presets

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

function setupClassEventListeners() {
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

  // Setup color presets
  setupColorPresets();
}

function findClassById(classId) {
  return userClasses.find(c => c.id === classId);
}

export {
  loadClasses,
  getUserClasses,
  renderClasses,
  openClassModal,
  closeClassModal,
  saveClass,
  editClass,
  deleteClass,
  setupColorPresets,
  setupClassEventListeners,
  findClassById
};
