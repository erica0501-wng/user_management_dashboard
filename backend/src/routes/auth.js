const router = require("express").Router()
const prisma = require("../prisma")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")

const DEFAULT_PASSWORD = "password123"
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 10)

router.post("/login", async (req, res) => {
  try {
    const { email, password, username } = req.body

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email || "" },
          { username: username || "" },
        ],
      },
    })

    if (!user || !user.password)
      return res.status(401).json({ message: "Invalid credentials" })

    const match = await bcrypt.compare(password, user.password)
    if (!match)
      return res.status(401).json({ message: "Invalid credentials" })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    )

    res.json({ token, user })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Login failed: " + error.message })
  }
})

router.post("/register", async (req, res) => {
  try {
    const { username, email, password, age, gender } = req.body

    if (!username || !email || !password || age === undefined || !gender) {
      return res.status(400).json({ message: "Missing required fields" })
    }

    // Validate password format
    const hasLetter = /[A-Za-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({
        message: "Password must contain both letters and numbers",
      })
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    })

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        age: age ? Number(age) : null,
        gender,
      },
    })

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    )

    res.status(201).json({ token, user })
  } catch (err) {
    console.error("Register error:", err)
    res.status(500).json({ message: "Registration failed" })
  }
})

// One-time helper to backfill missing passwords with a default hash (for existing records without passwords)
router.post("/patch/backfill-passwords", async (_req, res) => {
  const users = await prisma.user.findMany({ where: { password: null } })
  for (const u of users) {
    await prisma.user.update({ where: { id: u.id }, data: { password: DEFAULT_PASSWORD_HASH } })
  }
  res.json({ updated: users.length, defaultPassword: DEFAULT_PASSWORD })
})

module.exports = router
