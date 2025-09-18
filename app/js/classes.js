// Classes management for Academic Calendar
import { auth, db } from '/js/firebase-config.js';
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, setDoc, deleteDoc } from 'firebase/firestore';

const COLLECTION = 'classes'; // stored under users/{uid}/classes

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user;
}

function userClassesColRef(uid) {
  return collection(db, 'users', uid, COLLECTION);
}

async function addClass(classData) {
  const { uid } = requireUser();
  const ref = await addDoc(userClassesColRef(uid), {
    name: classData.name || 'Untitled Class',
    instructor: classData.instructor || '',
    color: classData.color || '#3788d8',
    description: classData.description || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

async function listClasses() {
  const { uid } = requireUser();
  const q = query(userClassesColRef(uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateClass(id, updates) {
  const { uid } = requireUser();
  const ref = doc(db, 'users', uid, COLLECTION, id);
  await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
}

async function removeClass(id) {
  const { uid } = requireUser();
  const ref = doc(db, 'users', uid, COLLECTION, id);
  await deleteDoc(ref);
}

// Predefined color palette for classes
const CLASS_COLORS = [
  '#3788d8', // Blue
  '#e74c3c', // Red
  '#2ecc71', // Green
  '#f39c12', // Orange
  '#9b59b6', // Purple
  '#1abc9c', // Teal
  '#e67e22', // Dark Orange
  '#34495e', // Dark Blue Gray
  '#f1c40f', // Yellow
  '#e91e63', // Pink
  '#795548', // Brown
  '#607d8b'  // Blue Gray
];

export { addClass, listClasses, updateClass, removeClass, CLASS_COLORS };
