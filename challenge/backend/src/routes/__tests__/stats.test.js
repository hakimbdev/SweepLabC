const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const statsRouter = require('../stats');

// Create test app
const app = express();
app.use('/api/stats', statsRouter);

// Error handler middleware
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

const TEST_DATA_PATH = path.join(__dirname, '../../../../data/items.json');
let originalData;

describe('Stats Routes', () => {
  // Backup original data before tests
  beforeAll(async () => {
    originalData = await fs.promises.readFile(TEST_DATA_PATH, 'utf-8');
  });

  // Restore original data after tests
  afterAll(async () => {
    await fs.promises.writeFile(TEST_DATA_PATH, originalData, 'utf-8');
    // Cleanup watcher
    if (statsRouter._cleanup) {
      statsRouter._cleanup();
    }
  });

  // Reset data before each test
  beforeEach(async () => {
    await fs.promises.writeFile(TEST_DATA_PATH, originalData, 'utf-8');
    // Wait a bit for file watcher to detect change
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('GET /api/stats', () => {
    it('should return statistics with correct structure', async () => {
      const res = await request(app).get('/api/stats');
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('averagePrice');
      expect(res.body).toHaveProperty('totalValue');
      expect(res.body).toHaveProperty('categories');
      expect(res.body).toHaveProperty('priceRange');
      expect(typeof res.body.total).toBe('number');
      expect(typeof res.body.averagePrice).toBe('number');
    });

    it('should calculate correct statistics', async () => {
      const res = await request(app).get('/api/stats');
      
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(5); // Based on original data
      expect(res.body.averagePrice).toBeGreaterThan(0);
      expect(res.body.totalValue).toBeGreaterThan(0);
    });

    it('should include category breakdown', async () => {
      const res = await request(app).get('/api/stats');
      
      expect(res.status).toBe(200);
      expect(res.body.categories).toHaveProperty('Electronics');
      expect(res.body.categories).toHaveProperty('Furniture');
      expect(res.body.categories.Electronics).toHaveProperty('count');
      expect(res.body.categories.Electronics).toHaveProperty('totalValue');
    });

    it('should include price range', async () => {
      const res = await request(app).get('/api/stats');
      
      expect(res.status).toBe(200);
      expect(res.body.priceRange).toHaveProperty('min');
      expect(res.body.priceRange).toHaveProperty('max');
      expect(res.body.priceRange.min).toBeLessThanOrEqual(res.body.priceRange.max);
    });

    it('should use cache on subsequent requests', async () => {
      // First request
      const res1 = await request(app).get('/api/stats');
      expect(res1.status).toBe(200);
      
      // Second request should be cached
      const res2 = await request(app).get('/api/stats');
      expect(res2.status).toBe(200);
      expect(res2.body).toHaveProperty('cached', true);
      expect(res2.body).toHaveProperty('cacheAge');
      expect(res2.body.cacheAge).toBeGreaterThanOrEqual(0);
    });

    it('should invalidate cache when data file changes', async () => {
      // First request to populate cache
      const res1 = await request(app).get('/api/stats');
      expect(res1.status).toBe(200);
      const originalTotal = res1.body.total;

      // Modify the data file
      const data = JSON.parse(originalData);
      data.push({ id: 999, name: 'New Item', category: 'Test', price: 100 });
      await fs.promises.writeFile(TEST_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
      
      // Wait for file watcher to detect change and refresh cache
      await new Promise(resolve => setTimeout(resolve, 200));

      // Next request should have updated stats
      const res2 = await request(app).get('/api/stats');
      expect(res2.status).toBe(200);
      expect(res2.body.total).toBe(originalTotal + 1);
    });

    it('should handle empty data file gracefully', async () => {
      await fs.promises.writeFile(TEST_DATA_PATH, '[]', 'utf-8');
      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await request(app).get('/api/stats');
      
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.averagePrice).toBe(0);
      expect(res.body.totalValue).toBe(0);
    });
  });
});

