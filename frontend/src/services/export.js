const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// Helper function to download file
const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

// ==================== Export Functions ====================

export const exportWatchlist = async () => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/watchlist/csv`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const filename = `watchlist_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('Error exporting watchlist:', error);
    throw error;
  }
};

export const exportPortfolio = async () => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/portfolio/csv`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const filename = `portfolio_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('Error exporting portfolio:', error);
    throw error;
  }
};

export const exportTransactions = async () => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/transactions/csv`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('Error exporting transactions:', error);
    throw error;
  }
};

export const exportOrders = async () => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/orders/csv`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('Error exporting orders:', error);
    throw error;
  }
};

export const exportAccountSummary = async () => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/account/csv`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const filename = `account_summary_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('Error exporting account summary:', error);
    throw error;
  }
};

export const exportAllData = async () => {
  try {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/export/all/csv`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Export failed');
    }
    
    const blob = await response.blob();
    const filename = `complete_export_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(blob, filename);
  } catch (error) {
    console.error('Error exporting all data:', error);
    throw error;
  }
};
