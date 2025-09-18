import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { protectPageOrRedirectToLogin, auth } from '/js/firebase-config.js';
import { addTask, listTasks } from '/js/tasks.js';
import { listClasses } from '/js/classes.js';

class AcademicCalendar {
    constructor() {
        this.calendar = null;
        this.userClasses = [];
        this.assignments = [];
        this.selectedDate = null;
        this.init();
    }

    async init() {
        // Ensure only authed users can access page
        protectPageOrRedirectToLogin();
        
        // Wait for auth to be ready
        await this.waitForAuth();
        
        // Load user data
        await this.loadUserData();
        
        // Initialize calendar and UI
        this.initializeCalendar();
        this.setupEventListeners();
        this.setupModal();
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
            plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            editable: true,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: true,
            weekends: true,
            events: this.formatAssignmentsForCalendar(),
            
            // Event handlers
            select: (info) => this.handleDateSelect(info),
            eventClick: (info) => this.handleEventClick(info),
            eventDrop: (info) => this.handleEventDrop(info),
            
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
                        info.el.style.borderLeft = `4px solid #ef4444`;
                    }
                    
                    // Add tooltip with assignment details
                    const tooltip = this.createAssignmentTooltip(assignment, associatedClass);
                    info.el.setAttribute('title', tooltip);
                }
            }
        });

        this.calendar.render();
    }

    formatAssignmentsForCalendar() {
        return this.assignments.map(assignment => ({
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
    }

    setupModal() {
        const modal = document.getElementById('assignment-modal');
        const closeBtn = document.querySelector('.close');

        closeBtn.addEventListener('click', () => {
            this.closeModal();
        });

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
            dueDateInput.value = this.formatDateForInput(localDate);
        }
        
        this.openModal();
        this.calendar.unselect();
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
            dueDateInput.value = this.formatDateForInput(localDate);
        }
        
        modal.classList.add('open');
        
        // Focus on title input
        setTimeout(() => {
            document.getElementById('assignment-title')?.focus();
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('assignment-modal');
        modal.classList.remove('open');
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
            
            // Add to calendar
            const associatedClass = this.userClasses.find(c => c.id === assignmentData.classId);
            this.calendar.addEvent({
                id: assignmentId,
                title: assignmentData.title,
                start: assignmentData.dueAt,
                allDay: true,
                backgroundColor: associatedClass?.color || '#3b82f6',
                borderColor: associatedClass?.color || '#3b82f6',
                extendedProps: {
                    description: assignmentData.description,
                    classId: assignmentData.classId,
                    important: assignmentData.important
                }
            });

            this.closeModal();
            
            // Show success message
            this.showNotification('Assignment saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving assignment:', error);
            this.showNotification('Failed to save assignment. Please try again.', 'error');
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
            
            this.showNotification('Assignment deleted successfully!', 'success');
            
        } catch (error) {
            console.error('Error deleting assignment:', error);
            this.showNotification('Failed to delete assignment.', 'error');
        }
    }

    formatDateForInput(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().slice(0, 16);
    }

    showNotification(message, type = 'info') {
        // Create a simple notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new AcademicCalendar();
});