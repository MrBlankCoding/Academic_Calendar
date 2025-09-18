import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { protectPageOrRedirectToLogin, auth } from '/js/firebase-config.js';
import { addTask } from '/js/tasks.js';
import { buildTaskFromEventForm } from '/js/schedule.js';

class AcademicCalendar {
    constructor() {
        this.calendar = null;
        this.events = this.loadEvents();
        this.init();
    }

    init() {
        // Ensure only authed users can access page
        protectPageOrRedirectToLogin();
        this.initializeCalendar();
        this.setupEventListeners();
        this.setupModal();
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
            events: this.events,
            
            // Event handlers
            select: (info) => this.handleDateSelect(info),
            eventClick: (info) => this.handleEventClick(info),
            eventDrop: (info) => this.handleEventDrop(info),
            eventResize: (info) => this.handleEventResize(info),
            
            // Event styling based on type
            eventClassNames: (info) => {
                return [`event-${info.event.extendedProps.type || 'other'}`];
            },
            
            // Custom event rendering
            eventDidMount: (info) => {
                const type = info.event.extendedProps.type || 'other';
                info.el.setAttribute('data-event-type', type);
                
                // Add tooltip
                if (info.event.extendedProps.description) {
                    info.el.setAttribute('title', info.event.extendedProps.description);
                }
            }
        });

        this.calendar.render();
    }

    setupEventListeners() {
        // Add Event button
        document.getElementById('add-event-btn').addEventListener('click', () => {
            this.openModal();
        });

        // Event form submission
        document.getElementById('event-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveEvent();
        });

        // Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.closeModal();
        });
    }

    setupModal() {
        const modal = document.getElementById('event-modal');
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
        const startInput = document.getElementById('event-start');
        const endInput = document.getElementById('event-end');
        
        const startDate = new Date(info.start);
        const endDate = new Date(info.end);
        
        startInput.value = this.formatDateForInput(startDate);
        endInput.value = this.formatDateForInput(endDate);
        
        this.openModal();
        this.calendar.unselect();
    }

    handleEventClick(info) {
        const event = info.event;
        const confirmDelete = confirm(`Delete event "${event.title}"?`);
        
        if (confirmDelete) {
            event.remove();
            this.removeEventFromStorage(event.id);
        }
    }

    handleEventDrop(info) {
        this.updateEventInStorage(info.event);
    }

    handleEventResize(info) {
        this.updateEventInStorage(info.event);
    }

    openModal(eventData = null) {
        const modal = document.getElementById('event-modal');
        const form = document.getElementById('event-form');
        
        if (eventData) {
            document.getElementById('event-title').value = eventData.title || '';
            document.getElementById('event-start').value = this.formatDateForInput(eventData.start);
            document.getElementById('event-end').value = this.formatDateForInput(eventData.end);
            document.getElementById('event-description').value = eventData.extendedProps?.description || '';
            document.getElementById('event-type').value = eventData.extendedProps?.type || 'other';
        } else {
            // New event
            form.reset();
        }
        
        modal.classList.add('open');
    }

    closeModal() {
        const modal = document.getElementById('event-modal');
        modal.classList.remove('open');
        document.getElementById('event-form').reset();
    }

    async saveEvent() {
        const form = document.getElementById('event-form');
        const formData = new FormData(form);
        
        const eventData = {
            id: Date.now().toString(),
            title: formData.get('title'),
            start: formData.get('start'),
            end: formData.get('end') || formData.get('start'),
            description: formData.get('description'),
            type: formData.get('type')
        };

        this.calendar.addEvent({
            id: eventData.id,
            title: eventData.title,
            start: eventData.start,
            end: eventData.end,
            extendedProps: {
                description: eventData.description,
                type: eventData.type
            }
        });

        this.saveEventToStorage(eventData);

        // Also create a Firestore task tied to the current user
        try {
            if (!auth.currentUser) throw new Error('Not authenticated');
            const taskPayload = buildTaskFromEventForm(formData);
            // link back to this calendar event id
            taskPayload.calendarEventId = eventData.id;
            await addTask(taskPayload);
        } catch (err) {
            console.warn('Failed to add task to Firestore:', err);
            // Non-fatal for UI; event still added locally
        }
        this.closeModal();
    }

    formatDateForInput(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().slice(0, 16);
    }

    // Local storage methods
    loadEvents() {
        const stored = localStorage.getItem('academic-calendar-events');
        if (stored) {
            return JSON.parse(stored);
        }
        return [];
    }

    saveEventToStorage(eventData) {
        this.events.push(eventData);
        localStorage.setItem('academic-calendar-events', JSON.stringify(this.events));
    }

    updateEventInStorage(calendarEvent) {
        const eventIndex = this.events.findIndex(e => e.id === calendarEvent.id);
        if (eventIndex !== -1) {
            this.events[eventIndex] = {
                id: calendarEvent.id,
                title: calendarEvent.title,
                start: calendarEvent.start.toISOString(),
                end: calendarEvent.end ? calendarEvent.end.toISOString() : null,
                description: calendarEvent.extendedProps?.description,
                type: calendarEvent.extendedProps?.type
            };
            localStorage.setItem('academic-calendar-events', JSON.stringify(this.events));
        }
    }

    removeEventFromStorage(eventId) {
        this.events = this.events.filter(e => e.id !== eventId);
        localStorage.setItem('academic-calendar-events', JSON.stringify(this.events));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AcademicCalendar();
});