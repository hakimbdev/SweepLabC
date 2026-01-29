import { useEffect, useState, useCallback, useMemo } from 'react';
import { useData } from '../state/DataContext';
import { Link } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';

/**
 * Items component with pagination, search, and virtualization
 * Fixes memory leak by using AbortController to cancel pending requests
 */
function Items() {
  const { items, pagination, loading, error, fetchItems } = useData();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search query to avoid excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1); // Reset to first page on new search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch items with proper cleanup to prevent memory leak
  useEffect(() => {
    const abortController = new AbortController();

    fetchItems({
      page: currentPage,
      limit: 20,
      q: debouncedQuery,
      signal: abortController.signal
    }).catch(err => {
      // Only log non-abort errors
      if (err.name !== 'AbortError') {
        console.error('Error fetching items:', err);
      }
    });

    // Cleanup: abort pending request when component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [fetchItems, currentPage, debouncedQuery]);

  // Handle page navigation
  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => prev + 1);
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Virtualized row renderer
  const Row = useCallback(({ index, style }) => {
    const item = items[index];
    return (
      <div style={style} className="item-row">
        <Link to={`/items/${item.id}`} className="item-link">
          <div className="item-content">
            <span className="item-name">{item.name}</span>
            <span className="item-category">{item.category}</span>
            <span className="item-price">${item.price.toFixed(2)}</span>
          </div>
        </Link>
      </div>
    );
  }, [items]);

  // Calculate page numbers for pagination
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxPagesToShow = 5;
    const totalPages = pagination.totalPages;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }, [currentPage, pagination.totalPages]);

  // Loading state with skeleton
  if (loading && items.length === 0) {
    return (
      <div className="items-container">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search items..."
            className="search-input skeleton"
            disabled
          />
        </div>
        <div className="skeleton-list">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-item">
              <div className="skeleton-line"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="items-container">
        <div className="error-message">
          <p>Error loading items: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="items-container">
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by name or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Search items"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="clear-search"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {loading && <div className="loading-indicator">Loading...</div>}

      {items.length === 0 && !loading ? (
        <div className="no-results">
          <p>No items found{debouncedQuery ? ` for "${debouncedQuery}"` : ''}.</p>
        </div>
      ) : (
        <>
          <div className="results-info">
            Showing {items.length} of {pagination.total} items
            {debouncedQuery && ` (filtered by "${debouncedQuery}")`}
          </div>

          {/* Virtualized list for performance with large datasets */}
          <List
            height={600}
            itemCount={items.length}
            itemSize={60}
            width="100%"
            className="items-list"
          >
            {Row}
          </List>

          {/* Pagination controls */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="pagination-btn"
                aria-label="Previous page"
              >
                ← Previous
              </button>

              <div className="page-numbers">
                {pageNumbers[0] > 1 && (
                  <>
                    <button onClick={() => handlePageChange(1)} className="page-number">
                      1
                    </button>
                    {pageNumbers[0] > 2 && <span className="ellipsis">...</span>}
                  </>
                )}

                {pageNumbers.map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`page-number ${page === currentPage ? 'active' : ''}`}
                    aria-label={`Page ${page}`}
                    aria-current={page === currentPage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                ))}

                {pageNumbers[pageNumbers.length - 1] < pagination.totalPages && (
                  <>
                    {pageNumbers[pageNumbers.length - 1] < pagination.totalPages - 1 && (
                      <span className="ellipsis">...</span>
                    )}
                    <button
                      onClick={() => handlePageChange(pagination.totalPages)}
                      className="page-number"
                    >
                      {pagination.totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={handleNextPage}
                disabled={!pagination.hasMore}
                className="pagination-btn"
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Items;