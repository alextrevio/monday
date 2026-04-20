// localStorage wrapper with the same API shape as the previous artifact storage
// Returns { key, value } from get() and set() to keep component code unchanged.

export const storage = {
  async get(key) {
    if (typeof window === 'undefined') return null;
    try {
      const value = window.localStorage.getItem(key);
      if (value === null) return null;
      return { key, value };
    } catch (err) {
      console.error('storage.get error', err);
      return null;
    }
  },

  async set(key, value) {
    if (typeof window === 'undefined') return null;
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (err) {
      console.error('storage.set error', err);
      return null;
    }
  },

  async delete(key) {
    if (typeof window === 'undefined') return null;
    try {
      window.localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (err) {
      console.error('storage.delete error', err);
      return null;
    }
  },
};
