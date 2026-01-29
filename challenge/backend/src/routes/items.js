const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

/**
 * Utility to read data asynchronously (non-blocking)
 * @returns {Promise<Array>} Array of items
 */
async function readData() {
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Utility to write data asynchronously (non-blocking)
 * @param {Array} data - Array of items to write
 * @returns {Promise<void>}
 */
async function writeData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * GET /api/items
 * Supports pagination and search via query params:
 * - page: page number (default: 1)
 * - limit: items per page (default: 10)
 * - q: search query (searches in name and category)
 */
router.get('/', async (req, res, next) => {
  try {
    const data = await readData();
    const { page = 1, limit = 10, q } = req.query;
    let results = data;

    // Search filter - searches in both name and category for better UX
    if (q) {
      const searchTerm = q.toLowerCase().trim();
      results = results.filter(item =>
        item.name.toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
      );
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    const paginatedResults = results.slice(startIndex, endIndex);

    // Return paginated response with metadata
    res.json({
      data: paginatedResults,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: results.length,
        totalPages: Math.ceil(results.length / limitNum),
        hasMore: endIndex < results.length
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/items/:id
 * Retrieves a single item by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const data = await readData();
    const item = data.find(i => i.id === parseInt(req.params.id, 10));

    if (!item) {
      const err = new Error('Item not found');
      err.status = 404;
      throw err;
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/items
 * Creates a new item with validation
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, category, price } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      const err = new Error('Name is required and must be a non-empty string');
      err.status = 400;
      throw err;
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      const err = new Error('Category is required and must be a non-empty string');
      err.status = 400;
      throw err;
    }

    if (price === undefined || typeof price !== 'number' || price < 0) {
      const err = new Error('Price is required and must be a non-negative number');
      err.status = 400;
      throw err;
    }

    const data = await readData();
    const newItem = {
      id: Date.now(),
      name: name.trim(),
      category: category.trim(),
      price
    };

    data.push(newItem);
    await writeData(data);

    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

module.exports = router;