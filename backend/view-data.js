const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('📊 查看数据库内容...\n')

  // 查看所有用户
  const users = await prisma.user.findMany()
  
  console.log('👥 用户数据 (User):')
  console.log(`总数: ${users.length}`)
  console.log('---')
  
  if (users.length > 0) {
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.username}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Role: ${user.role}`)
      console.log(`   Status: ${user.status}`)
      console.log(`   Gender: ${user.gender || 'N/A'}`)
      console.log(`   Age: ${user.age || 'N/A'}`)
      console.log(`   Created: ${user.createdAt}`)
      console.log('---')
    })
  } else {
    console.log('   (数据库为空)')
  }

  console.log('\n⚠️  注意: 目前数据库中没有 Portfolio 或 Order 相关的表')
  console.log('📍 Portfolio 数据目前存储在浏览器的 localStorage 中')
}

main()
  .catch((e) => {
    console.error('错误:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
