const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Get auth token
const getToken = () => localStorage.getItem('token');

// ==================== Shared Watchlists ====================

export const getSharedWatchlists = async (params = {}) => {
  const queryParams = new URLSearchParams(params).toString();
  const url = `${API_URL}/social/shared-watchlists${queryParams ? `?${queryParams}` : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch shared watchlists');
  }
  
  return response.json();
};

export const getMySharedWatchlists = async () => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/my-shared-watchlists`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch my shared watchlists');
  }
  
  return response.json();
};

export const getSharedWatchlistById = async (id) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/shared-watchlists/${id}`, {
    headers: token ? {
      'Authorization': `Bearer ${token}`
    } : {}
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch shared watchlist');
  }
  
  return response.json();
};

export const createSharedWatchlist = async (data) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/shared-watchlists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Failed to create shared watchlist');
  }
  
  return response.json();
};

export const updateSharedWatchlist = async (id, data) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/shared-watchlists/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Failed to update shared watchlist');
  }
  
  return response.json();
};

export const deleteSharedWatchlist = async (id) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/shared-watchlists/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete shared watchlist');
  }
  
  return response.json();
};

// ==================== Comments ====================

export const addComment = async (sharedWatchlistId, content) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/shared-watchlists/${sharedWatchlistId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content })
  });
  
  if (!response.ok) {
    throw new Error('Failed to add comment');
  }
  
  return response.json();
};

export const updateComment = async (commentId, content) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/comments/${commentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content })
  });
  
  if (!response.ok) {
    throw new Error('Failed to update comment');
  }
  
  return response.json();
};

export const deleteComment = async (commentId) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/comments/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete comment');
  }
  
  return response.json();
};

// ==================== Likes ====================

export const toggleLike = async (sharedWatchlistId) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/shared-watchlists/${sharedWatchlistId}/like`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to toggle like');
  }
  
  return response.json();
};

export const checkIsLiked = async (sharedWatchlistId) => {
  const token = getToken();
  const response = await fetch(`${API_URL}/social/shared-watchlists/${sharedWatchlistId}/is-liked`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to check like status');
  }
  
  return response.json();
};
