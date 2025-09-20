import { 
  parseDate, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  formatTimeFromDate, 
  isToday, 
  isTomorrow, 
  isOverdue, 
  isDueSoon, 
  groupAssignmentsByDate 
} from "/js/dateUtils.js";

// Global state for timeline
let currentFilter = 'all';
let allTasks = [];
let userClasses = [];

function initTimeline(tasks, classes) {
  allTasks = tasks || [];
  userClasses = classes || [];
}

function updateTimelineTasks(tasks) {
  allTasks = tasks || [];
}

function updateTimelineClasses(classes) {
  userClasses = classes || [];
}

function setupUpcomingFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update filter and re-render
      currentFilter = btn.dataset.filter;
      renderUpcomingTimeline();
    });
  });
}

function renderUpcomingTimeline() {
  const timelineContainer = document.getElementById('upcomingTimeline');
  if (!timelineContainer) return;

  // Filter assignments based on current filter
  const filteredAssignments = getFilteredUpcomingAssignments();
  
  timelineContainer.innerHTML = '';

  if (filteredAssignments.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'timeline-empty';
    emptyState.innerHTML = `
      <i class="fas fa-calendar-check"></i>
      <h3>No upcoming assignments</h3>
      <p>You're all caught up! ${currentFilter === 'all' ? 'Add some assignments to see them here.' : 'Try changing the filter to see more assignments.'}</p>
    `;
    timelineContainer.appendChild(emptyState);
    return;
  }

  // Group assignments by date
  const groupedAssignments = groupAssignmentsByDate(filteredAssignments);
  
  // Render timeline items
  Object.entries(groupedAssignments).forEach(([dateKey, assignments]) => {
    const date = new Date(dateKey);
    const timelineItem = createTimelineItem(date, assignments);
    timelineContainer.appendChild(timelineItem);
  });
}

function getFilteredUpcomingAssignments() {
  const now = new Date();
  const startWeek = startOfWeek();
  const endWeek = endOfWeek();
  const startMonth = startOfMonth();
  const endMonth = endOfMonth();

  let filtered = allTasks.filter(task => {
    if (task.type !== 'assignment') return false;
    
    const dueDate = parseDate(task.dueAt);
    if (!dueDate) return false;
    
    // Only show future assignments
    if (dueDate < now) return false;
    
    return true;
  });

  // Apply filter
  switch (currentFilter) {
    case 'week':
      filtered = filtered.filter(task => {
        const dueDate = parseDate(task.dueAt);
        return dueDate >= startWeek && dueDate < endWeek;
      });
      break;
    case 'month':
      filtered = filtered.filter(task => {
        const dueDate = parseDate(task.dueAt);
        return dueDate >= startMonth && dueDate <= endMonth;
      });
      break;
    case 'important':
      filtered = filtered.filter(task => task.important);
      break;
    // 'all' shows all future assignments
  }

  // Sort by due date
  filtered.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  
  return filtered;
}

function createTimelineItem(date, assignments) {
  const timelineItem = document.createElement('div');
  timelineItem.className = 'timeline-item';
  
  const todayCheck = isToday(date);
  const tomorrowCheck = isTomorrow(date);
  
  // Create date element
  const timelineDate = document.createElement('div');
  timelineDate.className = 'timeline-date';
  if (todayCheck) timelineDate.style.background = '#10b981';
  if (tomorrowCheck) timelineDate.style.background = '#f59e0b';
  
  timelineDate.innerHTML = `
    <span class="day">${date.getDate()}</span>
    <span class="month">${date.toLocaleDateString('en-US', { month: 'short' })}</span>
  `;
  
  timelineItem.appendChild(timelineDate);
  
  // Create assignments for this date
  assignments.forEach(assignment => {
    const timelineContent = createTimelineContent(assignment, date);
    timelineItem.appendChild(timelineContent);
  });
  
  return timelineItem;
}

function createTimelineContent(assignment, date) {
  const associatedClass = userClasses.find(c => c.id === assignment.classId);
  const dueDate = parseDate(assignment.dueAt);
  
  // Determine badges
  const badges = [];
  if (assignment.important) badges.push('important');
  if (isOverdue(dueDate)) badges.push('overdue');
  else if (isDueSoon(dueDate)) badges.push('due-soon');
  
  const timelineContent = document.createElement('div');
  timelineContent.className = 'timeline-content';
  
  timelineContent.innerHTML = `
    <div class="assignment-header">
      <h4 class="assignment-title-main">${assignment.title}</h4>
      <div class="assignment-badges">
        ${badges.map(badge => `<span class="badge ${badge}">${badge.replace('-', ' ')}</span>`).join('')}
      </div>
    </div>
    <div class="assignment-details">
      ${associatedClass ? `
        <div class="assignment-class-info">
          <span class="class-indicator" style="background: ${associatedClass.color}"></span>
          <span>${associatedClass.name}</span>
        </div>
      ` : ''}
      <div class="assignment-time">
        <i class="fas fa-clock"></i>
        <span>${formatTimeFromDate(dueDate)}</span>
      </div>
    </div>
    ${assignment.description ? `<p class="assignment-description">${assignment.description}</p>` : ''}
  `;
  
  // Add click handler to navigate to calendar
  timelineContent.addEventListener('click', () => {
    window.location.href = '/views/calender.html';
  });
  
  return timelineContent;
}

function getCurrentFilter() {
  return currentFilter;
}
function setCurrentFilter(filter) {
  currentFilter = filter;
}

export {
  initTimeline,
  updateTimelineTasks,
  updateTimelineClasses,
  setupUpcomingFilters,
  renderUpcomingTimeline,
  getFilteredUpcomingAssignments,
  createTimelineItem,
  createTimelineContent,
  getCurrentFilter,
  setCurrentFilter
};
