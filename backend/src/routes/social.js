const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');

const prisma = new PrismaClient();

// ==================== Shared Watchlists ====================

// Get all public shared watchlists
router.get('/shared-watchlists', async (req, res) => {
  try {
    const { search, ownerId } = req.query;
    
    const where = {
      isPublic: true
    };
    
    if (ownerId) {
      where.ownerId = parseInt(ownerId);
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const sharedWatchlists = await prisma.sharedWatchlist.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        likes: true,
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(sharedWatchlists);
  } catch (error) {
    console.error('Error fetching shared watchlists:', error);
    res.status(500).json({ error: 'Failed to fetch shared watchlists' });
  }
});

// Get user's own shared watchlists (both public and private)
router.get('/my-shared-watchlists', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const sharedWatchlists = await prisma.sharedWatchlist.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(sharedWatchlists);
  } catch (error) {
    console.error('Error fetching my shared watchlists:', error);
    res.status(500).json({ error: 'Failed to fetch shared watchlists' });
  }
});

// Get a specific shared watchlist by ID
router.get('/shared-watchlists/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sharedWatchlist = await prisma.sharedWatchlist.findUnique({
      where: { id: parseInt(id) },
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        likes: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true
          }
        }
      }
    });
    
    if (!sharedWatchlist) {
      return res.status(404).json({ error: 'Shared watchlist not found' });
    }
    
    // Check if the watchlist is public or belongs to the requesting user
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        userId = decoded.id;
      } catch (err) {
        // Token invalid, treat as unauthenticated
      }
    }
    
    if (!sharedWatchlist.isPublic && sharedWatchlist.ownerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(sharedWatchlist);
  } catch (error) {
    console.error('Error fetching shared watchlist:', error);
    res.status(500).json({ error: 'Failed to fetch shared watchlist' });
  }
});

// Create a new shared watchlist
router.post('/shared-watchlists', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, symbols, isPublic } = req.body;
    
    if (!title || !symbols || symbols.length === 0) {
      return res.status(400).json({ error: 'Title and symbols are required' });
    }
    
    const sharedWatchlist = await prisma.sharedWatchlist.create({
      data: {
        ownerId: userId,
        title,
        description: description || null,
        symbols,
        isPublic: isPublic !== undefined ? isPublic : true
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    
    res.status(201).json(sharedWatchlist);
  } catch (error) {
    console.error('Error creating shared watchlist:', error);
    res.status(500).json({ error: 'Failed to create shared watchlist' });
  }
});

// Update shared watchlist
router.put('/shared-watchlists/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { title, description, symbols, isPublic } = req.body;
    
    // Check ownership
    const existing = await prisma.sharedWatchlist.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Shared watchlist not found' });
    }
    
    if (existing.ownerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (symbols !== undefined) updateData.symbols = symbols;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    
    const updated = await prisma.sharedWatchlist.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating shared watchlist:', error);
    res.status(500).json({ error: 'Failed to update shared watchlist' });
  }
});

// Delete shared watchlist
router.delete('/shared-watchlists/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Check ownership
    const existing = await prisma.sharedWatchlist.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Shared watchlist not found' });
    }
    
    if (existing.ownerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.sharedWatchlist.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Shared watchlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting shared watchlist:', error);
    res.status(500).json({ error: 'Failed to delete shared watchlist' });
  }
});

// ==================== Comments ====================

// Add comment to shared watchlist
router.post('/shared-watchlists/:id/comments', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Check if shared watchlist exists and is accessible
    const sharedWatchlist = await prisma.sharedWatchlist.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!sharedWatchlist) {
      return res.status(404).json({ error: 'Shared watchlist not found' });
    }
    
    if (!sharedWatchlist.isPublic && sharedWatchlist.ownerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const comment = await prisma.watchlistComment.create({
      data: {
        sharedWatchlistId: parseInt(id),
        userId,
        content
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Update comment
router.put('/comments/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Comment content is required' });
    }
    
    // Check ownership
    const existing = await prisma.watchlistComment.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const updated = await prisma.watchlistComment.update({
      where: { id: parseInt(id) },
      data: { content },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// Delete comment
router.delete('/comments/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Check ownership
    const existing = await prisma.watchlistComment.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.watchlistComment.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// ==================== Likes ====================

// Toggle like on shared watchlist
router.post('/shared-watchlists/:id/like', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // Check if shared watchlist exists
    const sharedWatchlist = await prisma.sharedWatchlist.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!sharedWatchlist) {
      return res.status(404).json({ error: 'Shared watchlist not found' });
    }
    
    if (!sharedWatchlist.isPublic && sharedWatchlist.ownerId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if already liked
    const existing = await prisma.watchlistLike.findUnique({
      where: {
        sharedWatchlistId_userId: {
          sharedWatchlistId: parseInt(id),
          userId
        }
      }
    });
    
    if (existing) {
      // Unlike
      await prisma.watchlistLike.delete({
        where: {
          sharedWatchlistId_userId: {
            sharedWatchlistId: parseInt(id),
            userId
          }
        }
      });
      res.json({ action: 'unliked', liked: false });
    } else {
      // Like
      await prisma.watchlistLike.create({
        data: {
          sharedWatchlistId: parseInt(id),
          userId
        }
      });
      res.json({ action: 'liked', liked: true });
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Check if user liked a shared watchlist
router.get('/shared-watchlists/:id/is-liked', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    const like = await prisma.watchlistLike.findUnique({
      where: {
        sharedWatchlistId_userId: {
          sharedWatchlistId: parseInt(id),
          userId
        }
      }
    });
    
    res.json({ liked: !!like });
  } catch (error) {
    console.error('Error checking like status:', error);
    res.status(500).json({ error: 'Failed to check like status' });
  }
});

module.exports = router;
