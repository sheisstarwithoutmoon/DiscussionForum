if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const passport = require('passport')
const bodyParser = require('body-parser')
const path = require('path')
const flash = require('express-flash')
const session = require('express-session')
const methodOverride = require('method-override')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const { ensureAuth } = require('./config/auth.js')

// Express App
const app = express()

// Create HTTP server
const server = app.listen(3000, () => console.log("server running"))

// ✅ Correct way to set up socket.io
const { Server } = require('socket.io')
const io = new Server(server)

// MongoDB connection
const db = require('./config/keys.js').MongoURI
mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("db connected"))
  .catch(err => console.log(err))

// View engine
app.set("view engine", "ejs")

// Body Parser & Static files
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname + '/public'))

// Express session
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}))

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

// Flash
app.use(flash())

// Global vars
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg')
  res.locals.error_msg = req.flash('error_msg')
  res.locals.error = req.flash('error')
  next()
})

// Passport Config
require('./config/passport.js')(passport)

// User model
const User = require('./model/Users.js')

// ---------------------- ROUTES ----------------------

app.get("/", (req, res) => {
  res.render("home_page")
})

app.get("/about", (req, res) => {
  res.render("about")
})

app.get("/contact_us", (req, res) => {
  res.render("contact_us")
})

app.get("/login", (req, res) => {
  res.render("login")
})

app.get("/register", (req, res) => {
  res.render("register")
})

app.get("/userprofile", ensureAuth, (req, res) => {
  res.render("user_profile", {
    name: req.user.name
  })
})

app.get("/userprofile/chat", ensureAuth, (req, res) => {
  res.render("index.ejs")
})

// ------------------ Registration Logic ------------------

app.post('/register', (req, res) => {
  const { name, email, password, passwordrepeat } = req.body
  let errors = []

  if (!name || !email || !password || !passwordrepeat) {
    errors.push({ msg: "Please fill in all fields" })
  }

  if (password !== passwordrepeat) {
    errors.push({ msg: "Passwords do not match" })
  }

  if (password.length < 6) {
    errors.push({ msg: "Password must be at least 6 characters" })
  }

  if (errors.length > 0) {
    return res.render('register', {
      errors, name, email, password, passwordrepeat
    })
  }

  // Validation passed
  User.findOne({ email: email })
    .then(user => {
      if (user) {
        errors.push({ msg: "Email is already registered" })
        return res.render('register', {
          errors, name, email, password, passwordrepeat
        })
      }

      const newUser = new User({ name, email, password })

      bcrypt.genSalt(10, (err, salt) =>
        bcrypt.hash(newUser.password, salt, (err, hash) => {
          if (err) throw err
          newUser.password = hash
          newUser.save()
            .then(user => {
              req.flash('success_msg', "You are now registered")
              res.redirect('/login')
            })
            .catch(err => console.log(err))
        })
      )
    })
})

// ------------------ Login Logic ------------------

app.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/userprofile',
    failureRedirect: '/login',
    failureFlash: true
  })(req, res, next)
})

// ------------------ Logout Logic ------------------

app.get('/logout', (req, res) => {
  req.logout(() => {
    req.flash('success_msg', "You are logged out")
    res.redirect('/login')
  })
})

// ------------------ Socket.IO Logic ------------------

io.on("connection", socket => {
  console.log("A user connected.")

  socket.on("chatMessage", sent_msg => {
    const messageWithTimestamp = "[ " + getCurrentDate() + " ]: " + sent_msg
    socket.broadcast.emit("message", messageWithTimestamp)
  })

  socket.on("disconnect", () => {
    console.log("A user disconnected.")
  })
})

// Utility: Get current date in string
function getCurrentDate() {
  const currentDate = new Date()
  const day = (currentDate.getDate() < 10 ? '0' : '') + currentDate.getDate()
  const month = ((currentDate.getMonth() + 1) < 10 ? '0' : '') + (currentDate.getMonth() + 1)
  const year = currentDate.getFullYear()
  const hour = (currentDate.getHours() < 10 ? '0' : '') + currentDate.getHours()
  const minute = (currentDate.getMinutes() < 10 ? '0' : '') + currentDate.getMinutes()
  const second = (currentDate.getSeconds() < 10 ? '0' : '') + currentDate.getSeconds()

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}
