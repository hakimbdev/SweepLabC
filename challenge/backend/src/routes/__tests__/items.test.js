const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const itemsRouter = require('../items');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/items', itemsRouter);

// Error handler middleware
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

const TEST_DATA_PATH = path.join(__dirname, '../../../../data/items.json');
let originalData;

describe('Items Routes', () => {
  // Backup original data before tests
  beforeAll(async () => {
    const raw = await fs.readFile(TEST_DATA_PATH, 'utf-8');
    originalData = raw;
  });

  // Restore original data after tests
  afterAll(async () => {
    await fs.writeFile(TEST_DATA_PATH, originalData, 'utf-8');
  });

  // Reset data before each test
  beforeEach(async () => {
    await fs.writeFile(TEST_DATA_PATH, originalData, 'utf-8');
  });

  describe('GET /api/items', () => {
    it('should return all items with pagination metadata', async () => {
      const res = await request(app).get('/api/items');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('totalPages');
      expect(res.body.pagination).toHaveProperty('hasMore');
    });

    it('should support pagination with page and limit params', async () => {
      const res = await request(app).get('/api/items?page=1&limit=2');
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });

    it('should filter items by search query (name)', async () => {
      const res = await request(app).get('/api/items?q=laptop');
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name.toLowerCase()).toContain('laptop');
    });

    it('should filter items by search query (category)', async () => {
      const res = await request(app).get('/api/items?q=electronics');
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach(item => {
        expect(item.category.toLowerCase()).toContain('electronics');
      });
    });

    it('should return empty array for non-matching search', async () => {
      const res = await request(app).get('/api/items?q=nonexistentitem12345');
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should handle pagination on second page', async () => {
      const res = await request(app).get('/api/items?page=2&limit=2');
      
      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
    });
  });

  describe('GET /api/items/:id', () => {
    it('should return a single item by id', async () => {
      const res = await request(app).get('/api/items/1');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('category');
      expect(res.body).toHaveProperty('price');
    });

    it('should return 404 for non-existent item', async () => {
      const res = await request(app).get('/api/items/99999');
      
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('not found');
    });

    it('should handle invalid id format gracefully', async () => {
      const res = await request(app).get('/api/items/invalid');
      
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/items', () => {
    it('should create a new item with valid data', async () => {
      const newItem = {
        name: 'Test Product',
        category: 'Test Category',
        price: 99.99
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Test Product');
      expect(res.body.category).toBe('Test Category');
      expect(res.body.price).toBe(99.99);
    });

    it('should trim whitespace from name and category', async () => {
      const newItem = {
        name: '  Trimmed Product  ',
        category: '  Trimmed Category  ',
        price: 50
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Trimmed Product');
      expect(res.body.category).toBe('Trimmed Category');
    });

    it('should return 400 if name is missing', async () => {
      const newItem = {
        category: 'Test Category',
        price: 99.99
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Name');
    });

    it('should return 400 if name is empty string', async () => {
      const newItem = {
        name: '   ',
        category: 'Test Category',
        price: 99.99
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Name');
    });

    it('should return 400 if category is missing', async () => {
      const newItem = {
        name: 'Test Product',
        price: 99.99
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Category');
    });

    it('should return 400 if price is missing', async () => {
      const newItem = {
        name: 'Test Product',
        category: 'Test Category'
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Price');
    });

    it('should return 400 if price is negative', async () => {
      const newItem = {
        name: 'Test Product',
        category: 'Test Category',
        price: -10
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Price');
    });

    it('should return 400 if price is not a number', async () => {
      const newItem = {
        name: 'Test Product',
        category: 'Test Category',
        price: 'invalid'
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Price');
    });

    it('should accept price of 0', async () => {
      const newItem = {
        name: 'Free Product',
        category: 'Test Category',
        price: 0
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.status).toBe(201);
      expect(res.body.price).toBe(0);
    });
  });
});

