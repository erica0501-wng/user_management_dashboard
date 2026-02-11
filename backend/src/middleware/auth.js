const jwt = require("jsonwebtoken")

module.exports = (req, res, next) => {
  console.log('Auth middleware hit:', req.method, req.path)
  console.log('Headers:', req.headers.authorization ? 'Authorization header present' : 'NO Authorization header')
  
  const authHeader = req.headers.authorization
  if (!authHeader) {
    console.log('❌ No token provided')
    return res.status(401).json({ message: "No token provided" })
  }

  const token = authHeader.split(" ")[1]
  if (!token) {
    console.log('❌ Invalid token format')
    return res.status(401).json({ message: "Invalid token format" })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
    console.log('✅ Token verified for user:', decoded.id)
    req.user = decoded
    next()
  } catch (error) {
    console.error("❌ Token verification failed:", error.message)
    res.status(401).json({ message: "Invalid or expired token" })
  }
}
