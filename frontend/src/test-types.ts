import type { AuthResponse } from './types/index.js';

const test: AuthResponse = {
  message: 'test',
  token: 'test',
  user: {
    id: 'test',
    phone: 'test',
    credits: 0,
    isAdmin: false
  }
};

console.log('Types working:', test);
