const { Prisma } = require("@prisma/client")
const express = require("express")
const cors = require("cors")
const prisma = require("./prisma")
const app = express()

/* ========================
   Global Middlewares
======================== */
require("dotenv").config()

// CORS must be enabled BEFORE routes
app.use(cors())                 
app.use(express.json())

// Favicon handler
app.get('/favicon.ico', (req, res) => res.status(204).end())

// Routes
const marketRoutes = require("./routes/market")
app.use("/market", marketRoutes)
app.use("/auth", require("./routes/auth"))
app.use("/users", require("./routes/user"))   
    

// Optional: explicit headers (safe, but cors() already covers this)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type")
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }
  next()
})

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


app.get('/', (req, res) => {
  res.send('Express on Vercel is running!');
});

// 重點修改區域：
const port = process.env.PORT || 3000;

// 只有在本地開發時才監聽 Port，Vercel 環境下不需要
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// 關鍵：必須匯出 app
module.exports = app;