const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Get auth token
const getToken = () => localStorage.getItem('token')

// Helper to handle unauthorized responses
const handleUnauthorized = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.location.href = '/login'
}

// Get account balance
export const getAccountBalance = async () => {
  const token = getToken()
  console.log('🔑 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'NULL')
  
  if (!token) throw new Error('No authentication token')

  console.log('📤 Fetching balance from:', `${API_URL}/portfolio/balance`)
  console.log('📤 Authorization header:', `Bearer ${token.substring(0, 20)}...`)
  
  const response = await fetch(`${API_URL}/portfolio/balance`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  console.log('📥 Balance response status:', response.status)

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Balance error response:', errorText)
    throw new Error('Failed to fetch balance')
  }

  return response.json()
}

// Top up balance
export const topUpBalance = async (amount, paymentMethod) => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const response = await fetch(`${API_URL}/portfolio/topup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ amount, paymentMethod })
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to top up balance')
  }

  return response.json()
}

// Withdraw balance
export const withdrawBalance = async (amount, paymentMethod) => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const response = await fetch(`${API_URL}/portfolio/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ amount, paymentMethod })
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to withdraw balance')
  }

  return response.json()
}

// Get transaction history
export const getTransactions = async () => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const response = await fetch(`${API_URL}/portfolio/transactions`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    throw new Error('Failed to fetch transactions')
  }

  return response.json()
}

// Get all orders
export const getOrders = async (filters = {}) => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const params = new URLSearchParams()
  if (filters.status) params.append('status', filters.status)
  if (filters.direction) params.append('direction', filters.direction)

  const response = await fetch(`${API_URL}/portfolio/orders?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    throw new Error('Failed to fetch orders')
  }

  return response.json()
}

// Create new order
export const createOrder = async (orderData) => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const response = await fetch(`${API_URL}/portfolio/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(orderData)
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create order')
  }

  return response.json()
}

// Update order status (fill or cancel)
export const updateOrderStatus = async (orderId, status) => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const response = await fetch(`${API_URL}/portfolio/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update order')
  }

  return response.json()
}

// Get holdings
export const getHoldings = async () => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const response = await fetch(`${API_URL}/portfolio/holdings`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch holdings')
  }

  return response.json()
}

// Get holdings for a specific symbol
export const getHoldingsBySymbol = async (symbol) => {
  const holdings = await getHoldings()
  return holdings.find(h => h.symbol === symbol) || { quantity: 0 }
}

// Run strategy backtest
export const runStrategyBacktest = async (symbol, years) => {
  const token = getToken()
  if (!token) throw new Error('No authentication token')

  const response = await fetch(`${API_URL}/portfolio/strategy-backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ symbol, years })
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to run backtest')
  }

  return response.json()
}
