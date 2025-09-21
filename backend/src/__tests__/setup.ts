import mongoose from 'mongoose';

// Mock mongoose for tests to avoid memory issues
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  connection: {
    collections: {}
  },
  model: jest.fn(() => ({
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn()
  })),
  Schema: jest.fn(),
  Document: jest.fn()
}));
