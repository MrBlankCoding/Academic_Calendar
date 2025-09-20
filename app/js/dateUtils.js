export function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d;
}

export function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().slice(0, 16);
}

export function toLocalDateKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

export function endOfWeek() {
  const startWeek = startOfWeek();
  const endWeek = new Date(startWeek);
  endWeek.setDate(startWeek.getDate() + 6);
  endWeek.setHours(23, 59, 59, 999);
  return endWeek;
}

export function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function endOfMonth() {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  return endOfMonth;
}

export function formatTimeFromDate(date) {
  if (!date) return '';
  const d = parseDate(date);
  if (!d) return '';
  
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

export function formatDueDate(dueAt) {
  const due = parseDate(dueAt);
  if (!due) return '';
  
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  
  if (due >= today && due < tomorrow) {
    return 'Today';
  } else if (due >= tomorrow && due < dayAfterTomorrow) {
    return 'Tomorrow';
  } else {
    return due.toLocaleDateString();
  }
}

export function formatCurrentDate() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return now.toLocaleDateString('en-US', options);
}

export function isToday(date) {
  const d = parseDate(date);
  if (!d) return false;
  
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

export function isTomorrow(date) {
  const d = parseDate(date);
  if (!d) return false;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.toDateString() === tomorrow.toDateString();
}

export function isDueToday(task) {
  const d = parseDate(task.dueAt);
  if (!d) return false;
  
  const start = startOfToday();
  const end = endOfToday();
  return d >= start && d <= end;
}

export function isOverdue(date) {
  const d = parseDate(date);
  if (!d) return false;
  
  const now = new Date();
  return d < now;
}

export function isDueSoon(date) {
  const d = parseDate(date);
  if (!d) return false;
  
  const now = new Date();
  const timeDiff = d - now;
  return timeDiff > 0 && timeDiff < 24 * 60 * 60 * 1000; // 24 hours in milliseconds
}

export function groupAssignmentsByDate(assignments) {
  const grouped = {};
  
  assignments.forEach(assignment => {
    const dueDate = parseDate(assignment.dueAt);
    if (!dueDate) return;
    
    const dateKey = dueDate.toDateString();
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(assignment);
  });
  
  return grouped;
}

export function getTodayStorageKey(uid = 'anon') {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `dashboard-completed-${uid}-${yyyy}-${mm}-${dd}`;
}

export function getTimeUntil(date) {
  const d = parseDate(date);
  if (!d) return '';
  
  const now = new Date();
  const diff = d - now;
  
  if (diff < 0) return 'Overdue';
  
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} left`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} left`;
  } else {
    return 'Due now';
  }
}
