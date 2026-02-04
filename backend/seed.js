const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 10)

  await prisma.user.deleteMany()

  const users = await prisma.user.createMany({
    data: [
      {
        username: "alice",
        email: "alice@gmail.com",
        password: hashedPassword,
        age: 30,
      },
      {
        username: "bob",
        email: "bob@gmail.com",
        password: hashedPassword,
        age: 25,
      },
      {
        username: "charlie",
        email: "charlie@gmail.com",
        password: hashedPassword,
        age: 35,
      },
      {
        username: "erica",
        email: "erica@gmail.com",
        password: hashedPassword,
        age: 28,
      },
    ],
  })
}

main()
  .then(() => {
    console.log("🌱 Seed completed")
  })
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
