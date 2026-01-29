const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const DATA_PATH = path.join(__dirname, '../../../data/items.json');

/**
 * Stats cache with file watching for automatic invalidation
 * This prevents recalculating stats on every request
 */
let statsCache = null;
let cacheTimestamp = null;

/**
 * Calculate statistics from items data
 * @param {Array} items - Array of items
 * @returns {Object} Statistics object
 */
function calculateStats(items) {
  if (!items || items.length === 0) {
    return {
      total: 0,
      averagePrice: 0,
      totalValue: 0,
      categories: {},
      priceRange: { min: 0, max: 0 }
    };
  }

  const total = items.length;
  const totalValue = items.reduce((acc, cur) => acc + cur.price, 0);
  const averagePrice = totalValue / total;

  // Calculate category breakdown
  const categories = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = { count: 0, totalValue: 0 };
    }
    acc[item.category].count++;
    acc[item.category].totalValue += item.price;
    return acc;
  }, {});

  // Calculate price range
  const prices = items.map(item => item.price);
  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices)
  };

  return {
    total,
    averagePrice: Math.round(averagePrice * 100) / 100, // Round to 2 decimal places
    totalValue: Math.round(totalValue * 100) / 100,
    categories,
    priceRange
  };
}

/**
 * Load and cache statistics
 * @returns {Promise<Object>} Statistics object
 */
async function loadStats() {
  return new Promise((resolve, reject) => {
    fs.readFile(DATA_PATH, 'utf-8', (err, raw) => {
      if (err) return reject(err);

      try {
        const items = JSON.parse(raw);
        const stats = calculateStats(items);

        // Update cache
        statsCache = stats;
        cacheTimestamp = Date.now();

        resolve(stats);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

/**
 * Watch the data file for changes and invalidate cache
 * Using fs.watch for efficient file system monitoring
 */
let watcher = null;
function setupFileWatcher() {
  if (watcher) {
    return; // Already watching
  }

  try {
    watcher = fs.watch(DATA_PATH, async (eventType) => {
      if (eventType === 'change') {
        console.log('Data file changed, invalidating stats cache...');
        statsCache = null;
        cacheTimestamp = null;

        // Preload cache for next request
        try {
          await loadStats();
          console.log('Stats cache refreshed');
        } catch (err) {
          console.error('Error refreshing stats cache:', err);
        }
      }
    });

    console.log('File watcher initialized for stats caching');
  } catch (err) {
    console.error('Error setting up file watcher:', err);
  }
}

// Initialize file watcher
setupFileWatcher();

/**
 * GET /api/stats
 * Returns cached statistics, recalculates only if cache is invalid
 */
router.get('/', async (req, res, next) => {
  try {
    // Return cached stats if available
    if (statsCache) {
      return res.json({
        ...statsCache,
        cached: true,
        cacheAge: Date.now() - cacheTimestamp
      });
    }

    // Load and cache stats if not available
    const stats = await loadStats();
    res.json({
      ...stats,
      cached: false
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Cleanup watcher on module unload (for testing)
 */
router._cleanup = () => {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
};

module.exports = router;