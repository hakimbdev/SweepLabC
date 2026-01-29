import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../state/DataContext';

/**
 * ItemDetail component with memory leak fix
 * Uses AbortController to cancel pending requests on unmount
 */
function ItemDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { fetchItem } = useData();

  useEffect(() => {
    const abortController = new AbortController();

    const loadItem = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchItem(id, abortController.signal);
        setItem(data);
        setLoading(false);
      } catch (err) {
        // Don't update state if request was aborted
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
          // Navigate back to list on error
          setTimeout(() => navigate('/'), 2000);
        }
      }
    };

    loadItem();

    // Cleanup: abort pending request when component unmounts
    return () => {
      abortController.abort();
    };
  }, [id, navigate, fetchItem]);

  // Loading state
  if (loading) {
    return (
      <div className="item-detail-container">
        <div className="skeleton-detail">
          <div className="skeleton-line large"></div>
          <div className="skeleton-line medium"></div>
          <div className="skeleton-line medium"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="item-detail-container">
        <div className="error-message">
          <p>Error loading item: {error}</p>
          <p>Redirecting to items list...</p>
        </div>
      </div>
    );
  }

  // No item found
  if (!item) {
    return (
      <div className="item-detail-container">
        <p>Item not found</p>
      </div>
    );
  }

  return (
    <div className="item-detail-container">
      <div className="item-detail">
        <h2 className="item-title">{item.name}</h2>
        <div className="item-info">
          <div className="info-row">
            <strong>Category:</strong>
            <span className="category-badge">{item.category}</span>
          </div>
          <div className="info-row">
            <strong>Price:</strong>
            <span className="price">${item.price.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={() => navigate('/')} className="back-button">
          ← Back to Items
        </button>
      </div>
    </div>
  );
}

export default ItemDetail;