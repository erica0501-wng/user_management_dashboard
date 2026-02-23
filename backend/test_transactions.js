const express = require('express')
require('dotenv').config()

const app = express()
app.use(express.json())

// Load the portfolio routes
const portfolioRoutes = require('./src/routes/portfolio')
app.use('/portfolio', portfolioRoutes)

// List all routes
function listRoutes(app) {
  const routes = []
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      })
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          const path = middleware.regexp.toString()
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/g, '')
            .replace(/\$/g, '')
          
          routes.push({
            path: path + handler.route.path,
            methods: Object.keys(handler.route.methods)
          })
        }
      })
    }
  })
  return routes
}

const routes = listRoutes(app)
console.log('\n📋 Available Routes:')
routes.forEach(route => {
  console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`)
})

process.exit(0)
