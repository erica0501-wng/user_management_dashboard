/* ========================
   Load Environment Variables FIRST
======================== */
require("dotenv").config()

const { Prisma } = require("@prisma/client")
const express = require("express")
const cors = require("cors")
const prisma = require("./prisma")
const app = express()

/* ========================
   Global Middlewares
======================== */

// CORS must be enabled BEFORE routes
app.use(cors())                 
app.use(express.json())

// Explicit CORS headers for Authorization
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }
  next()
})

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end())

// Routes
const marketRoutes = require("./routes/market")
const portfolioRoutes = require("./routes/portfolio")

console.log('🔌 Loading portfolio routes...')
app.use("/market", marketRoutes)
app.use("/auth", require("./routes/auth"))
app.use("/users", require("./routes/user"))
app.use("/portfolio", portfolioRoutes)
console.log('✅ Portfolio routes loaded')

/* ========================
   Root Route
======================== */
app.get('/', (req, res) => {
  res.send('Express API is running!');
});

/* ========================
   Global Error Handler
======================== */
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err)

  res.status(500).json({
    error: "Internal server error",
  })
})

module.exports = app