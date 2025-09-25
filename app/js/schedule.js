// scheduling algorithm

function buildTaskFromEventForm(formData) {
  const title = formData.get('title')?.toString() || 'Untitled Event';
  const start = formData.get('start')?.toString() || '';
  const end = (formData.get('end')?.toString()) || start;
  const description = formData.get('description')?.toString() || '';
  const type = formData.get('type')?.toString() || 'other';

  return {
    title,
    description,
    // Choose end as due if provided, else start
    dueAt: end || start || null,
    type,
    status: 'pending',
  };
}

export { buildTaskFromEventForm };