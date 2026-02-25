const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const prisma = new PrismaClient();

// Get user's watchlist
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const watchlist = await prisma.watchlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Return just the symbols as an array
    const symbols = watchlist.map(item => item.symbol);
    res.json(symbols);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add stock to watchlist
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Check if already exists
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol
        }
      }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Stock already in watchlist' });
    }
    
    // Add to watchlist
    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId,
        symbol
      }
    });
    
    res.status(201).json(watchlistItem);
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// Remove stock from watchlist
router.delete('/:symbol', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { symbol } = req.params;
    
    await prisma.watchlist.deleteMany({
      where: {
        userId,
        symbol
      }
    });
    
    res.json({ message: 'Stock removed from watchlist' });
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// Toggle stock in watchlist (add if not exists, remove if exists)
router.post('/toggle', authenticateToken, async (req, res) => {
  console.log('🔄 Toggle watchlist endpoint hit')
  try {
    const userId = req.user.id;
    const { symbol } = req.body;
    
    console.log('👤 User ID:', userId)
    console.log('📊 Symbol:', symbol)
    
    if (!symbol) {
      console.log('❌ No symbol provided')
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Check if already exists
    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_symbol: {
          userId,
          symbol
        }
      }
    });
    
    console.log('🔍 Existing:', existing ? 'Found' : 'Not found')
    
    if (existing) {
      // Remove from watchlist
      await prisma.watchlist.delete({
        where: {
          userId_symbol: {
            userId,
            symbol
          }
        }
      });
      console.log('✅ Removed from watchlist')
      res.json({ action: 'removed', symbol });
    } else {
      // Add to watchlist
      await prisma.watchlist.create({
        data: {
          userId,
          symbol
        }
      });
      console.log('✅ Added to watchlist')
      res.json({ action: 'added', symbol });
    }
  } catch (error) {
    console.error('❌ Error toggling watchlist:', error);
    res.status(500).json({ error: 'Failed to toggle watchlist' });
  }
});

module.exports = router;
