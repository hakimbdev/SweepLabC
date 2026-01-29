import React, { createContext, useCallback, useContext, useState } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasMore: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch items with pagination and search support
   * @param {Object} options - Fetch options
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @param {string} options.q - Search query
   * @param {AbortSignal} options.signal - Abort signal for cancellation
   * @returns {Promise<Object>} Response data
   */
  const fetchItems = useCallback(async ({ page = 1, limit = 20, q = '', signal } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (q) {
        params.append('q', q);
      }

      const res = await fetch(`http://localhost:3001/api/items?${params}`, { signal });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const json = await res.json();

      // Handle new API response format with pagination
      if (json.data && json.pagination) {
        setItems(json.data);
        setPagination(json.pagination);
      } else {
        // Fallback for old format (backward compatibility)
        setItems(Array.isArray(json) ? json : []);
      }

      setLoading(false);
      return json;
    } catch (err) {
      // Don't set error if request was aborted (component unmounted)
      if (err.name !== 'AbortError') {
        setError(err.message);
        setLoading(false);
      }
      throw err;
    }
  }, []);

  /**
   * Fetch a single item by ID
   * @param {number} id - Item ID
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @returns {Promise<Object>} Item data
   */
  const fetchItem = useCallback(async (id, signal) => {
    try {
      const res = await fetch(`http://localhost:3001/api/items/${id}`, { signal });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching item:', err);
      }
      throw err;
    }
  }, []);

  const value = {
    items,
    pagination,
    loading,
    error,
    fetchItems,
    fetchItem
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);