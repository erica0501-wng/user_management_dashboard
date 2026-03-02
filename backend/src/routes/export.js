const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const prisma = new PrismaClient();

// Helper function to convert data to CSV
function convertToCSV(data, headers) {
  if (!data || data.length === 0) {
    return '';
  }
  
  const csvHeaders = headers.join(',');
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Escape commas and quotes
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

// Export watchlist to CSV
router.get('/watchlist/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const watchlist = await prisma.watchlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    const data = watchlist.map(item => ({
      symbol: item.symbol,
      added_date: item.createdAt.toISOString().split('T')[0]
    }));
    
    const csv = convertToCSV(data, ['symbol', 'added_date']);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="watchlist_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting watchlist:', error);
    res.status(500).json({ error: 'Failed to export watchlist' });
  }
});

// Export portfolio to CSV
router.get('/portfolio/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all filled buy orders
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: 'Filled',
        direction: 'Buy'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Calculate holdings
    const holdings = {};
    orders.forEach(order => {
      if (!holdings[order.symbol]) {
        holdings[order.symbol] = {
          symbol: order.symbol,
          name: order.name || order.symbol,
          shares: 0,
          total_cost: 0
        };
      }
      holdings[order.symbol].shares += order.quantity;
      holdings[order.symbol].total_cost += order.price * order.quantity;
    });
    
    // Calculate average price
    const data = Object.values(holdings).map(holding => ({
      symbol: holding.symbol,
      name: holding.name,
      shares: holding.shares,
      average_price: (holding.total_cost / holding.shares).toFixed(2),
      total_cost: holding.total_cost.toFixed(2)
    }));
    
    const csv = convertToCSV(data, ['symbol', 'name', 'shares', 'average_price', 'total_cost']);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="portfolio_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting portfolio:', error);
    res.status(500).json({ error: 'Failed to export portfolio' });
  }
});

// Export transactions to CSV
router.get('/transactions/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    const data = transactions.map(tx => ({
      date: tx.createdAt.toISOString().split('T')[0],
      time: tx.createdAt.toISOString().split('T')[1].split('.')[0],
      type: tx.type,
      amount: tx.amount.toFixed(2),
      payment_method: tx.paymentMethod || 'N/A'
    }));
    
    const csv = convertToCSV(data, ['date', 'time', 'type', 'amount', 'payment_method']);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting transactions:', error);
    res.status(500).json({ error: 'Failed to export transactions' });
  }
});

// Export orders to CSV
router.get('/orders/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    const data = orders.map(order => ({
      date: order.createdAt.toISOString().split('T')[0],
      time: order.createdAt.toISOString().split('T')[1].split('.')[0],
      symbol: order.symbol,
      name: order.name || order.symbol,
      direction: order.direction,
      quantity: order.quantity,
      price: order.price.toFixed(2),
      total: (order.price * order.quantity).toFixed(2),
      type: order.orderType,
      status: order.status
    }));
    
    const csv = convertToCSV(data, ['date', 'time', 'symbol', 'name', 'direction', 'quantity', 'price', 'total', 'type', 'status']);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting orders:', error);
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

// Export account summary to CSV
router.get('/account/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = req.user;
    
    const accountBalance = await prisma.accountBalance.findUnique({
      where: { userId }
    });
    
    // Get portfolio value
    const orders = await prisma.order.findMany({
      where: {
        userId,
        status: 'Filled',
        direction: 'Buy'
      }
    });
    
    const totalInvested = orders.reduce((sum, order) => sum + (order.price * order.quantity), 0);
    
    const data = [{
      username: user.username,
      email: user.email,
      available_cash: accountBalance?.availableCash.toFixed(2) || '0.00',
      total_invested: totalInvested.toFixed(2),
      total_value: ((accountBalance?.availableCash || 0) + totalInvested).toFixed(2),
      account_created: user.createdAt.toISOString().split('T')[0]
    }];
    
    const csv = convertToCSV(data, ['username', 'email', 'available_cash', 'total_invested', 'total_value', 'account_created']);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="account_summary_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting account summary:', error);
    res.status(500).json({ error: 'Failed to export account summary' });
  }
});

// Export all data as a ZIP file (comprehensive export)
router.get('/all/csv', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = req.user;
    
    // Fetch all data
    const [watchlist, orders, transactions, accountBalance] = await Promise.all([
      prisma.watchlist.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.accountBalance.findUnique({ where: { userId } })
    ]);
    
    // Create a comprehensive CSV with all data
    const sections = [];
    
    // Account Summary
    sections.push('=== ACCOUNT SUMMARY ===');
    sections.push(`Username,${user.username}`);
    sections.push(`Email,${user.email}`);
    sections.push(`Available Cash,${accountBalance?.availableCash.toFixed(2) || '0.00'}`);
    sections.push(`Account Created,${user.createdAt.toISOString().split('T')[0]}`);
    sections.push('');
    
    // Watchlist
    sections.push('=== WATCHLIST ===');
    if (watchlist.length > 0) {
      const watchlistData = watchlist.map(item => ({
        symbol: item.symbol,
        added_date: item.createdAt.toISOString().split('T')[0]
      }));
      sections.push(convertToCSV(watchlistData, ['symbol', 'added_date']));
    } else {
      sections.push('No watchlist items');
    }
    sections.push('');
    
    // Orders
    sections.push('=== ORDERS ===');
    if (orders.length > 0) {
      const ordersData = orders.map(order => ({
        date: order.createdAt.toISOString().split('T')[0],
        symbol: order.symbol,
        name: order.name || order.symbol,
        direction: order.direction,
        quantity: order.quantity,
        price: order.price.toFixed(2),
        total: (order.price * order.quantity).toFixed(2),
        status: order.status
      }));
      sections.push(convertToCSV(ordersData, ['date', 'symbol', 'name', 'direction', 'quantity', 'price', 'total', 'status']));
    } else {
      sections.push('No orders');
    }
    sections.push('');
    
    // Transactions
    sections.push('=== TRANSACTIONS ===');
    if (transactions.length > 0) {
      const txData = transactions.map(tx => ({
        date: tx.createdAt.toISOString().split('T')[0],
        type: tx.type,
        amount: tx.amount.toFixed(2),
        payment_method: tx.paymentMethod || 'N/A'
      }));
      sections.push(convertToCSV(txData, ['date', 'type', 'amount', 'payment_method']));
    } else {
      sections.push('No transactions');
    }
    
    const csv = sections.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="complete_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting all data:', error);
    res.status(500).json({ error: 'Failed to export all data' });
  }
});

module.exports = router;
