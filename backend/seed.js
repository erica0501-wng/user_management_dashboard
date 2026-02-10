const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash("password123", 10)

  await prisma.user.deleteMany()

  const users = await prisma.user.createMany({
    data: [
      {
        username: "Alice",
        email: "alice@gmail.com",
        password: hashedPassword,
        age: 30,
        gender: "Female",
      },
      {
        username: "Bob",
        email: "bob@gmail.com",
        password: hashedPassword,
        age: 25,
        gender: "Male",
      },
      {
        username: "Charlie",
        email: "charlie@gmail.com",
        password: hashedPassword,
        age: 35,
        gender: "Male",
      },
      {
        username: "Erica",
        email: "ericawong@gmail.com",
        password: hashedPassword,
        age: 28,
        gender: "Female",
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
