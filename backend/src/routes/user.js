const router = require("express").Router()
const prisma = require("../prisma")
const auth = require("../middleware/auth")


/* =========================
   Validation helpers
========================= */

// username: letters and spaces only
function isValidUsername(username) {
  return /^[A-Za-z\s]+$/.test(username) && username.trim().length > 0
}

// email: must be gmail
function isValidGmail(email) {
  return /^[A-Za-z0-9._%+-]+@gmail\.com$/.test(email)
}

/* =========================
   GET users
========================= */
router.get("/", async (req, res) => {
  try {
    let { search, role, status, gender } = req.query

    const where = {}

    // ========= normalize =========
    search = search?.trim()
    role = role?.trim()
    status = status?.trim()
    gender = gender?.trim()

    // ========= role filter =========
    if (role && role !== "All") {
      where.role = role // Admin / User
    }

    // ========= status filter =========
    if (status && status !== "All") {
      where.status = status // Active / Inactive / Banned
    }

    // ========= gender filter =========
    if (gender && gender !== "All") {
      where.gender = gender // Male / Female
    }

    // ========= search filter =========
    if (search && search.length > 0) {
      where.OR = [
        {
          username: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
          },
        },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { joinedDate: "desc" },
    })

    res.json(users)
  } catch (err) {
    console.error("GET /users error:", err)
    res.status(500).json({ error: "Failed to fetch users" })
  }
})

/* =========================
   CREATE user
========================= */
router.post("/", async (req, res) => {
  const { username, email, age, role, status, gender } = req.body

  // required fields
  if (!username || !email) {
    return res
      .status(400)
      .json({ error: "Username and email are required" })
  }

  // validation
  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: "Username must contain only letters and spaces",
    })
  }

  if (!isValidGmail(email)) {
    return res.status(400).json({
      error: "Email must be a valid @gmail.com address",
    })
  }

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        age: age ? Number(age) : null,
        role: role || "User",
        status: status || "Active",
        gender: gender || null,
      },
    })

    res.status(201).json(user)
  } catch (err) {
    // Prisma unique constraint
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "Email already exists",
      })
    }

    console.error("Create user error:", err)
    res.status(500).json({
      error: "Failed to create user",
    })
  }
})

/* =========================
   UPDATE user
========================= */
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id)
  const { username, email, age, role, status, password, gender } = req.body

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" })
  }

  // validate only if provided
  if (username && !isValidUsername(username)) {
    return res.status(400).json({
      error: "Username must contain only letters and spaces",
    })
  }

  if (email && !isValidGmail(email)) {
    return res.status(400).json({
      error: "Email must be a valid @gmail.com address",
    })
  }

  // validate password if provided
  if (password) {
    const hasLetter = /[A-Za-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    
    if (!hasLetter || !hasNumber) {
      return res.status(400).json({
        error: "Password must contain both letters and numbers",
      })
    }
  }

  try {
    const updateData = {
      ...(username && { username }),
      ...(email && { email: email.toLowerCase() }),
      ...(age !== undefined && { age: age ? Number(age) : null }),
      ...(role && { role }),
      ...(status && { status }),
      ...(gender && { gender }),
      lastActive: new Date(),
    }

    // Hash password if provided
    if (password) {
      const bcrypt = require("bcryptjs")
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    })

    res.json(user)
  } catch (err) {
    console.error("Update error:", err)
    if (err.code === "P2025") {
      return res.status(404).json({
        error: "User not found",
      })
    }
    res.status(500).json({
      error: "Failed to update user",
    })
  }
})

/* =========================
   DELETE user
========================= */
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id)

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "Invalid user id" })
  }

  try {
    await prisma.user.delete({
      where: { id },
    })
    res.json({ success: true })
  } catch {
    res.status(404).json({
      error: "User not found",
    })
  }
})

module.exports = router
