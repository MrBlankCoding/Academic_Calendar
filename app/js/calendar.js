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
                this.renderDayBadges();
                this.updateCalendarTitle();
            },

            // Day cell hook for badges
            dayCellDidMount: (arg) => {
                // Ensure a badge container exists
                const dateKey = toLocalDateKey(arg.date);
                const badge = document.createElement('span');
                badge.className = 'day-badge';
                badge.dataset.date = dateKey;
                badge.textContent = '';
                // Avoid duplicates
                if (!arg.el.querySelector('.day-badge')) {
                    arg.el.appendChild(badge);
                }
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
                    
                    // Mark important assignments
                    if (assignment.important) {
                        info.el.classList.add('important');
                    }
                    
                    // Add tooltip with assignment details
                    const tooltip = this.createAssignmentTooltip(assignment, associatedClass);
                    info.el.setAttribute('title', tooltip);
                }
            }
        });

        this.calendar.render();
        // Initial badge render after first paint
        setTimeout(() => this.renderDayBadges(), 0);
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
                classId: assignment.classId,
                important: assignment.important
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
        this.renderDayBadges();
    }

    createAssignmentTooltip(assignment, associatedClass) {
        let tooltip = `Assignment: ${assignment.title}`;
        if (associatedClass) {
            tooltip += `\nClass: ${associatedClass.name}`;
        }
        if (assignment.description) {
            tooltip += `\nDescription: ${assignment.description}`;
        }
        if (assignment.important) {
            tooltip += `\n⭐ Important`;
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

        const associatedClass = this.userClasses.find(c => c.id === assignment.classId);
        const className = associatedClass ? associatedClass.name : 'No class';
        
        const confirmDelete = confirm(
            `Delete assignment "${assignment.title}" from ${className}?`
        );
        
        if (confirmDelete) {
            this.deleteAssignment(assignment.id);
        }
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
        this.renderDayBadges();
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
            important: formData.get('important') === 'on',
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
            
            this.renderDayBadges();
            
        } catch (error) {
            console.error('Error deleting assignment:', error);
        }
    }

    renderDayBadges() {
        if (!this.calendar) return;
        // Build counts for the visible range
        const assignments = this.getFilteredAssignments();
        const counts = new Map();
        for (const a of assignments) {
            if (!a.dueAt) continue;
            const key = toLocalDateKey(a.dueAt);
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        // Update badges in the current DOM
        const dayCells = document.querySelectorAll('.fc-daygrid-day');
        dayCells.forEach(cell => {
            const dateKey = cell.getAttribute('data-date');
            const badge = cell.querySelector('.day-badge');
            const count = counts.get(dateKey) || 0;
            if (badge) {
                badge.textContent = count > 0 ? String(count) : '';
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        });
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