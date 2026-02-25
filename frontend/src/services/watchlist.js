const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Get watchlist for the current user
export const getWatchlist = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/watchlist`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch watchlist');
  }
  
  return response.json();
};

// Toggle a stock in the watchlist (add if not exists, remove if exists)
export const toggleWatchlist = async (symbol) => {
  console.log('🔧 toggleWatchlist service called with:', symbol)
  const token = localStorage.getItem('token');
  console.log('🔑 Token:', token ? 'Found' : 'Missing')
  
  const url = `${API_URL}/watchlist/toggle`
  console.log('📍 API URL:', url)
  
  const response = await fetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ symbol })
    }
  );
  
  console.log('📥 Response status:', response.status)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ API Error:', errorText)
    throw new Error('Failed to toggle watchlist');
  }
  
  const result = await response.json()
  console.log('✅ API Success:', result)
  return result;
};

// Add a stock to the watchlist
export const addToWatchlist = async (symbol) => {
  const token = localStorage.getItem('token');
  const response = await fetch(
    `${API_URL}/watchlist`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ symbol })
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to add to watchlist');
  }
  
  return response.json();
};

// Remove a stock from the watchlist
export const removeFromWatchlist = async (symbol) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}/watchlist/${symbol}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to remove from watchlist');
  }
  
  return response.json();
};
