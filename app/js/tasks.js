// add/get tasks from Firestore
import { auth, db } from '/js/firebase-config.js';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';

const COLLECTION = 'tasks'; // stored under users/{uid}/tasks

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user;
}

function userTasksColRef(uid) {
  return collection(db, 'users', uid, COLLECTION);
}

async function addTask(task) {
  const { uid } = requireUser();
  const ref = await addDoc(userTasksColRef(uid), {
    title: task.title || 'Untitled Task',
    description: task.description || '',
    dueAt: task.dueAt || null,
    type: task.type || 'assignment', // Default to assignment for academic focus
    classId: task.classId || null, // Associated class ID
    calendarEventId: task.calendarEventId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: task.status || 'pending', // pending | done
    important: !!task.important,
  });
  return ref.id;
}

async function listTasks() {
  const { uid } = requireUser();
  const q = query(userTasksColRef(uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function upsertTask(id, updates) {
  const { uid } = requireUser();
  const ref = doc(db, 'users', uid, COLLECTION, id);
  await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
}

async function removeTask(id) {
  const { uid } = requireUser();
  const ref = doc(db, 'users', uid, COLLECTION, id);
  await deleteDoc(ref);
}

export { addTask, listTasks, upsertTask, removeTask };