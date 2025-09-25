import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import { protectPageOrRedirectToLogin, auth } from '/js/firebase-config.js';
import { addTask, listTasks } from '/js/tasks.js';
import { listClasses } from '/js/classes.js';
import { syncTheme } from '/js/theme.js';
import { formatDateForInput, toLocalDateKey } from '/js/dateUtils.js';

class AcademicCalendar {
    constructor() {
        this.calendar = null;
        this.userClasses = [];
        this.assignments = [];
        this.selectedDate = null;
        this.hiddenClassIds = new Set();
        this.init();
    }

    async init() {
        // Ensure only authed users can access page
        protectPageOrRedirectToLogin();
        
        // Initialize theme system
        syncTheme();
        
        // Wait for auth to be ready
        await this.waitForAuth();
        
        // Load user data
        await this.loadUserData();
        
        // Initialize calendar and UI
        this.initializeCalendar();
        this.setupEventListeners();
        this.setupModal();
        this.renderClassLegend();
        this.updateCalendarTitle();
    }

    waitForAuth() {
        return new Promise((resolve) => {
            if (auth.currentUser) {
                resolve();
            } else {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    if (user) {
                        unsubscribe();
                        resolve();
                    }
                });
            }
        });
    }

    async loadUserData() {
        try {
            // Load classes and assignments in parallel
            const [classes, tasks] = await Promise.all([
                listClasses(),
                listTasks()
            ]);
            
            this.userClasses = classes;
            this.assignments = tasks.filter(task => task.type === 'assignment');
            
            // Populate class dropdown
            this.populateClassDropdown();
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async refreshData() {
        try {
            const [classes, tasks] = await Promise.all([
                listClasses(),
                listTasks()
            ]);
            this.userClasses = classes;
            this.assignments = tasks.filter(task => task.type === 'assignment');
            this.populateClassDropdown();
            this.renderClassLegend();
            this.refreshCalendarEvents();
        } catch (e) {
            console.error('Failed to refresh calendar data:', e);
        }
    }

    populateClassDropdown() {
        const classSelect = document.getElementById('assignment-class');
        if (!classSelect) return;

        // Clear existing options except the first one
        classSelect.innerHTML = '<option value="">Select a class...</option>';

        this.userClasses.forEach(classItem => {
            const option = document.createElement('option');
            option.value = classItem.id;
            option.textContent = `${classItem.name}`;
            option.setAttribute('data-color', classItem.color);
            classSelect.appendChild(option);
        });
    }

    initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        this.calendar = new Calendar(calendarEl, {
            plugins: [dayGridPlugin, interactionPlugin],
            initialView: 'dayGridMonth',
            headerToolbar: false, // We handle this with custom header
            height: '100%',
            expandRows: true,
            firstDay: 0, // start week on Sunday
            editable: true,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: true,
            weekends: true,
            nowIndicator: true,
            events: this.formatAssignmentsForCalendar(),

            // Event handlers
            select: (info) => this.handleDateSelect(info),
            dateClick: (info) => this.handleDateClick(info),
            eventClick: (info) => this.handleEventClick(info),
            eventDrop: (info) => this.handleEventDrop(info),
            datesSet: (info) => {
                this.updateCalendarTitle();
            },
            
            // Custom event rendering for assignments
            eventDidMount: (info) => {
                const assignment = this.assignments.find(a => a.id === info.event.id);
                if (assignment) {
                    const associatedClass = this.userClasses.find(c => c.id === assignment.classId);
                    
                    // Apply class color
                    if (associatedClass) {
                        info.el.style.backgroundColor = associatedClass.color;
                        info.el.style.borderColor = associatedClass.color;
                    }
                    
                    // Add tooltip with assignment details
                    const tooltip = this.createAssignmentTooltip(assignment, associatedClass);
                    info.el.setAttribute('title', tooltip);
                }
            }
        });

        this.calendar.render();
    }

    updateCalendarTitle() {
        const titleEl = document.getElementById('calendar-title');
        if (titleEl && this.calendar) {
            titleEl.textContent = this.calendar.view.title;
        }
    }

    formatAssignmentsForCalendar(assignments = this.assignments) {
        return assignments.map(assignment => ({
            id: assignment.id,
            title: assignment.title,
            start: assignment.dueAt,
            allDay: true,
            extendedProps: {
                description: assignment.description,
                classId: assignment.classId
            }
        }));
    }

    getFilteredAssignments() {
        if (!this.hiddenClassIds || this.hiddenClassIds.size === 0) return this.assignments;
        return this.assignments.filter(a => a.classId ? !this.hiddenClassIds.has(a.classId) : true);
    }

    refreshCalendarEvents() {
        const filtered = this.getFilteredAssignments();
        // Replace events with filtered list
        this.calendar.removeAllEvents();
        this.calendar.addEventSource(this.formatAssignmentsForCalendar(filtered));
    }

    createAssignmentTooltip(assignment, associatedClass) {
        let tooltip = `Assignment: ${assignment.title}`;
        if (associatedClass) {
            tooltip += `\nClass: ${associatedClass.name}`;
        }
        if (assignment.description) {
            tooltip += `\nDescription: ${assignment.description}`;
        }
        return tooltip;
    }

    setupEventListeners() {
        // Navigation buttons
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const todayBtn = document.getElementById('today-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.calendar.prev();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.calendar.next();
            });
        }

        if (todayBtn) {
            todayBtn.addEventListener('click', () => {
                this.calendar.today();
            });
        }

        // Add Assignment button
        document.getElementById('add-assignment-btn').addEventListener('click', () => {
            this.openModal();
        });

        // Assignment form submission
        document.getElementById('assignment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveAssignment();
        });

        // Cancel button
        document.getElementById('cancel-assignment-btn').addEventListener('click', () => {
            this.closeModal();
        });

        // Auto-refresh data when returning to tab
        window.addEventListener('focus', () => this.refreshData());
    }

    setupModal() {
        const modal = document.getElementById('assignment-modal');
        const closeBtn = document.querySelector('.modal-header .close');
    
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
    
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // Setup assignment details modal
        this.setupDetailsModal();
    }

    setupDetailsModal() {
        const detailsModal = document.getElementById('assignment-details-modal');
        const closeDetailsBtn = document.getElementById('close-details-modal');
        const editBtn = document.getElementById('edit-assignment-btn');
        const deleteBtn = document.getElementById('delete-assignment-btn');
    
        if (closeDetailsBtn) {
            closeDetailsBtn.addEventListener('click', () => {
                this.closeDetailsModal();
            });
        }
    
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.editAssignmentFromDetails();
            });
        }
    
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteAssignmentFromDetails();
            });
        }
    
        window.addEventListener('click', (e) => {
            if (e.target === detailsModal) {
                this.closeDetailsModal();
            }
        });
    }
    
    showAssignmentDetails(assignment) {
        const detailsModal = document.getElementById('assignment-details-modal');
        if (!detailsModal) return;
    
        // Store current assignment for edit/delete operations
        this.currentAssignment = assignment;
    
        // Find associated class
        const associatedClass = this.userClasses.find(c => c.id === assignment.classId);
    
        // Populate details
        document.getElementById('details-title').textContent = assignment.title;
        
        const classNameEl = document.getElementById('details-class-name');
        const classDotEl = document.getElementById('details-class-dot');
        
        if (associatedClass) {
            classNameEl.textContent = associatedClass.name;
            classDotEl.style.backgroundColor = associatedClass.color;
            classDotEl.style.display = 'inline-block';
        } else {
            classNameEl.textContent = 'No class assigned';
            classDotEl.style.display = 'none';
        }
    
        // Format due date
        const dueDate = new Date(assignment.dueAt);
        document.getElementById('details-due-date').textContent = dueDate.toLocaleString();
    
        // Handle description
        const descriptionGroup = document.getElementById('details-description-group');
        const descriptionEl = document.getElementById('details-description');
        
        if (assignment.description && assignment.description.trim()) {
            descriptionEl.textContent = assignment.description;
            descriptionGroup.style.display = 'block';
        } else {
            descriptionGroup.style.display = 'none';
        }
    
        // Show modal
        detailsModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    
    closeDetailsModal() {
        const detailsModal = document.getElementById('assignment-details-modal');
        if (detailsModal) {
            detailsModal.classList.remove('open');
            document.body.style.overflow = '';
            this.currentAssignment = null;
        }
    }
    
    editAssignmentFromDetails() {
        if (!this.currentAssignment) return;
    
        // Capture the assignment before closing the details modal (which clears it)
        const assignment = this.currentAssignment;
    
        // Close details modal
        this.closeDetailsModal();
    
        // Populate edit form with current assignment data
        const form = document.getElementById('assignment-form');
        const modal = document.getElementById('assignment-modal');
        const modalTitle = document.getElementById('assignment-modal-title');
        const submitBtn = form.querySelector('button[type="submit"]');
    
        // Set form to edit mode
        modalTitle.textContent = 'Edit Assignment';
        submitBtn.textContent = 'Update Assignment';
        form.dataset.editMode = 'true';
        form.dataset.assignmentId = assignment.id;
    
        // Populate form fields
        document.getElementById('assignment-title').value = assignment.title;
        document.getElementById('assignment-description').value = assignment.description || '';
        document.getElementById('assignment-due-date').value = formatDateForInput(new Date(assignment.dueAt));
        document.getElementById('assignment-class').value = assignment.classId || '';
    
        // Show modal
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    
        // Focus on title input
        setTimeout(() => {
            document.getElementById('assignment-title')?.focus();
        }, 100);
    }
    
    deleteAssignmentFromDetails() {
        if (!this.currentAssignment) return;
    
        const associatedClass = this.userClasses.find(c => c.id === this.currentAssignment.classId);
        const className = associatedClass ? associatedClass.name : 'No class';
        
        const confirmDelete = confirm(
            `Delete assignment "${this.currentAssignment.title}" from ${className}?`
        );
        
        if (confirmDelete) {
            this.deleteAssignment(this.currentAssignment.id);
            this.closeDetailsModal();
        }
    }

    handleDateSelect(info) {
        // Store selected date and auto-fill in modal
        this.selectedDate = info.start;
        
        // Format date for datetime-local input
        const dueDateInput = document.getElementById('assignment-due-date');
        if (dueDateInput) {
            const localDate = new Date(info.start);
            localDate.setHours(23, 59); // Default to end of day
            dueDateInput.value = formatDateForInput(localDate);
        }
        
        this.openModal();
        this.calendar.unselect();
    }

    handleDateClick(info) {
        // Quick add from single day click
        this.selectedDate = info.date;
        const dueDateInput = document.getElementById('assignment-due-date');
        if (dueDateInput) {
            const localDate = new Date(info.date);
            localDate.setHours(23, 59);
            dueDateInput.value = formatDateForInput(localDate);
        }
        this.openModal();
    }

    handleEventClick(info) {
        const assignment = this.assignments.find(a => a.id === info.event.id);
        if (!assignment) return;
        
        this.showAssignmentDetails(assignment);
    }

    handleEventDrop(info) {
        // Update assignment due date when dragged
        const assignmentId = info.event.id;
        const newDueDate = info.event.start.toISOString();
        
        // Update in local array
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (assignment) {
            assignment.dueAt = newDueDate;
            // TODO: Update in Firestore
        }
    }

    openModal() {
        const modal = document.getElementById('assignment-modal');
        const form = document.getElementById('assignment-form');
        
        // Reset form
        form.reset();
        
        // Set default due date if a date was selected
        if (this.selectedDate) {
            const dueDateInput = document.getElementById('assignment-due-date');
            const localDate = new Date(this.selectedDate);
            localDate.setHours(23, 59);
            dueDateInput.value = formatDateForInput(localDate);
        }
        
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        
        // Focus on title input
        setTimeout(() => {
            document.getElementById('assignment-title')?.focus();
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('assignment-modal');
        modal.classList.remove('open');
        document.body.style.overflow = '';
        document.getElementById('assignment-form').reset();
        this.selectedDate = null;
    }

    async saveAssignment() {
        const form = document.getElementById('assignment-form');
        const formData = new FormData(form);
        
        const assignmentData = {
            title: formData.get('title'),
            description: formData.get('description') || '',
            dueAt: formData.get('dueDate'),
            classId: formData.get('classId') || null,
            type: 'assignment'
        };

        try {
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;

            // Save to Firestore
            const assignmentId = await addTask(assignmentData);
            
            // Add to local array with the new ID
            const newAssignment = { ...assignmentData, id: assignmentId };
            this.assignments.push(newAssignment);
            
            // Add to calendar (respect filters)
            this.refreshCalendarEvents();

            this.closeModal();
            
        } catch (error) {
            console.error('Error saving assignment:', error);
        } finally {
            // Reset button state
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async deleteAssignment(assignmentId) {
        try {
            // Remove from calendar
            const calendarEvent = this.calendar.getEventById(assignmentId);
            if (calendarEvent) {
                calendarEvent.remove();
            }
            
            // Remove from local array
            this.assignments = this.assignments.filter(a => a.id !== assignmentId);
            
            // TODO: Remove from Firestore
            // await removeTask(assignmentId);
            
        } catch (error) {
            console.error('Error deleting assignment:', error);
        }
    }

    renderClassLegend() {
        const legend = document.getElementById('class-legend');
        if (!legend) return;
        legend.innerHTML = '';
        
        if (!this.userClasses || this.userClasses.length === 0) {
            legend.innerHTML = '<div class="legend-empty">No classes yet. Add classes in your dashboard to color-code assignments.</div>';
            return;
        }
        
        this.userClasses.forEach(c => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const checked = !this.hiddenClassIds.has(c.id);
            item.innerHTML = `
                <label class="legend-toggle">
                    <input type="checkbox" data-class-id="${c.id}" ${checked ? 'checked' : ''} />
                    <span class="legend-dot" style="background:${c.color || '#3b82f6'}"></span>
                    <span class="legend-name">${c.name}</span>
                </label>
            `;
            legend.appendChild(item);
        });
        
        // Wire up checkbox events
        legend.querySelectorAll('input[type="checkbox"][data-class-id]').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-class-id');
                if (e.target.checked) {
                    this.hiddenClassIds.delete(id);
                } else {
                    this.hiddenClassIds.add(id);
                }
                this.refreshCalendarEvents();
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AcademicCalendar();
});