const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Papier API 服务运行中' })
})

// Start server
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
})
