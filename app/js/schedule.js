// scheduling algorithm

/**
 * Build a Firestore task object from the calendar event form data
 * @param {FormData} formData
 */
function buildTaskFromEventForm(formData) {
  const title = formData.get('title')?.toString() || 'Untitled Event';
  const start = formData.get('start')?.toString() || '';
  const end = (formData.get('end')?.toString()) || start;
  const description = formData.get('description')?.toString() || '';
  const type = formData.get('type')?.toString() || 'other';
  const important = formData.get('important') ? true : false;

  return {
    title,
    description,
    // Choose end as due if provided, else start
    dueAt: end || start || null,
    type,
    status: 'pending',
    important,
  };
}

export { buildTaskFromEventForm };