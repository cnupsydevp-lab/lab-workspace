const fs = require('fs');
const path = require('path');

function safeJsonRead(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Could not load ${path.basename(file)}: ${err.message}`);
    return fallback;
  }
}

function safeJsonWrite(file, value) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  } catch (err) {
    console.warn(`Could not save ${path.basename(file)}: ${err.message}`);
  }
}

class FileStorage {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.profilesFile = path.join(dataDir, 'profiles.json');
    this.todosFile = path.join(dataDir, 'todos.json');
    this.noticesFile = path.join(dataDir, 'notices.json');
    this.messagesFile = path.join(dataDir, 'messages.json');
  }

  async loadProfiles() {
    const parsed = safeJsonRead(this.profilesFile, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  async saveProfiles(profiles) {
    safeJsonWrite(this.profilesFile, profiles);
  }

  async loadTodos(defaultTodos) {
    const parsed = safeJsonRead(this.todosFile, null);
    if (Array.isArray(parsed)) return parsed;
    return defaultTodos.map((todo, idx) => ({
      id: `sample-${idx + 1}`,
      text: todo.text,
      owner: todo.owner,
      done: false,
      createdAt: new Date().toISOString(),
      sample: true,
    }));
  }

  async saveTodos(todos) {
    safeJsonWrite(this.todosFile, todos);
  }

  async loadNotices(defaultNotices) {
    const parsed = safeJsonRead(this.noticesFile, null);
    if (Array.isArray(parsed)) return parsed;
    return defaultNotices.map((notice, idx) => ({
      id: `sample-notice-${idx + 1}`,
      title: notice.title,
      body: notice.body,
      createdAt: new Date().toISOString(),
      sample: true,
    }));
  }

  async saveNotices(notices) {
    safeJsonWrite(this.noticesFile, notices);
  }

  async loadMessages() {
    const parsed = safeJsonRead(this.messagesFile, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  async saveMessages(messages) {
    safeJsonWrite(this.messagesFile, messages);
  }

  async appendMessage(messages, message) {
    await this.saveMessages(messages);
    return message;
  }
}

class FirestoreStorage {
  constructor({ collection }) {
    const { Firestore } = require('@google-cloud/firestore');
    this.db = new Firestore();
    this.state = this.db.collection(collection);
    this.messages = this.db.collection(`${collection}_messages`);
  }

  async loadProfiles() {
    const snap = await this.state.doc('profiles').get();
    const data = snap.exists ? snap.data() : null;
    return data?.items && typeof data.items === 'object' && !Array.isArray(data.items) ? data.items : {};
  }

  async saveProfiles(profiles) {
    await this.state.doc('profiles').set({ items: profiles, updatedAt: new Date().toISOString() });
  }

  async loadTodos(defaultTodos) {
    const snap = await this.state.doc('todos').get();
    const data = snap.exists ? snap.data() : null;
    if (Array.isArray(data?.items)) return data.items;
    return defaultTodos.map((todo, idx) => ({
      id: `sample-${idx + 1}`,
      text: todo.text,
      owner: todo.owner,
      done: false,
      createdAt: new Date().toISOString(),
      sample: true,
    }));
  }

  async saveTodos(todos) {
    await this.state.doc('todos').set({ items: todos, updatedAt: new Date().toISOString() });
  }

  async loadNotices(defaultNotices) {
    const snap = await this.state.doc('notices').get();
    const data = snap.exists ? snap.data() : null;
    if (Array.isArray(data?.items)) return data.items;
    return defaultNotices.map((notice, idx) => ({
      id: `sample-notice-${idx + 1}`,
      title: notice.title,
      body: notice.body,
      createdAt: new Date().toISOString(),
      sample: true,
    }));
  }

  async saveNotices(notices) {
    await this.state.doc('notices').set({ items: notices, updatedAt: new Date().toISOString() });
  }

  async loadMessages(limit = 200) {
    const snap = await this.messages.orderBy('at', 'desc').limit(limit).get();
    return snap.docs.map(doc => doc.data()).reverse();
  }

  async saveMessages(messages) {
    const batch = this.db.batch();
    messages.slice(-200).forEach(message => {
      batch.set(this.messages.doc(message.id), message);
    });
    await batch.commit();
  }

  async appendMessage(_messages, message) {
    await this.messages.doc(message.id).set(message);
    return message;
  }
}

function createStorage({ dataDir, backend = process.env.PIXELLAB_STORAGE, collection = process.env.PIXELLAB_FIRESTORE_COLLECTION || 'pixellab_state' }) {
  if (backend === 'firestore') {
    return new FirestoreStorage({ collection });
  }
  return new FileStorage(dataDir);
}

module.exports = { createStorage };
