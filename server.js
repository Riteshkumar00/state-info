// Updated server.js without profile.html redirect after Google/Facebook login
// Keeps Google/Facebook login username optional and enforces username for email/password signup

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_key',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Static paths
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(__dirname));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/', express.static(path.join(__dirname, 'Pages')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'Pages', 'index.html'));
});

// ✅ MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ MySQL connected');
});

// ✅ Passport Serialization
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.query('SELECT * FROM users WHERE id = ?', [id], (err, results) => {
    if (err) return done(err);
    done(null, results[0]);
  });
});

// ✅ Google OAuth Strategy (no username enforced)
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const photo = profile.photos[0].value;
  const name = profile.displayName;
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return done(err);
    if (results.length > 0) {
      return done(null, results[0]);
    } else {
      db.query('INSERT INTO users (name, email, auth_provider, profile_picture) VALUES (?, ?, ?, ?)',
        [name, email, 'google', photo],
        (err, result) => {
          if (err) return done(err);
          db.query('SELECT * FROM users WHERE id = ?', [result.insertId], (err2, rows) => {
            if (err2) return done(err2);
            return done(null, rows[0]);
          });
        });
    }
  });
}));

// ✅ Facebook OAuth Strategy (no username enforced)
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "/auth/facebook/callback",
  profileFields: ['id', 'emails', 'name', 'displayName', 'photos']
}, (accessToken, refreshToken, profile, done) => {
  const email = profile.emails ? profile.emails[0].value : `${profile.id}@facebook.com`;
  const photo = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
  db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return done(err);
    if (results.length > 0) {
      return done(null, results[0]);
    } else {
      db.query('INSERT INTO users (name, email, auth_provider, profile_picture) VALUES (?, ?, ?)',
        [name, email, 'facebook', photo],
        (err, result) => {
          if (err) return done(err);
          db.query('SELECT * FROM users WHERE id = ?', [result.insertId], (err2, rows) => {
            if (err2) return done(err2);
            return done(null, rows[0]);
          });
        });
    }
  });
}));

// ✅ OAuth Routes without profile.html
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/Pages/login.html' }),
  (req, res) => {
    res.redirect('/'); // ✅ redirect to home page after Google login
  }
);

app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/Pages/login.html' }),
  (req, res) => {
    res.redirect('/'); // ✅ redirect to home page after Facebook login
  }
);

// ✅ /api/signup (username required only for email/password)
app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Username, email, and password are required' });

  const hashedPassword = await bcrypt.hash(password, 10);
  db.query('INSERT INTO users (username, email, password, auth_provider) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, 'local'],
    (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'User with this email already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      // res.json({ message: 'Signup successful' });
      db.query('SELECT * FROM users WHERE email = ?', [email], (err2, results) => {
        if (err2) return res.status(500).json({ error: 'Database error during login' });
        req.login(results[0], err3 => {
          if (err3) return res.status(500).json({ error: 'Login error after signup' });
          res.json({ message: 'Signup and login successful' });
        });
      });

    });
});

// ✅ /api/login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(400).json({ error: 'User not found' });

    const user = results[0];
    if (user.auth_provider !== 'local') {
      return res.status(400).json({ error: `Please login with ${user.auth_provider}` });
    }

    const match = await bcrypt.compare(password, user.password);
    // if (match) {
    //   req.session.userId = user.id;
    //   res.json({ message: 'Login successful' });
    // } 
    if (match) {
      req.login(user, err => {
        if (err) return res.status(500).json({ error: 'Login error' });
        res.json({ message: 'Login successful' });
      });
    }else {
          res.status(400).json({ error: 'Incorrect password' });
        }
      });
    });

// ✅ /api/forgot-password
app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) {
      return res.status(400).json({ error: 'You are not a registered user' });
    }

    const resetToken = Math.random().toString(36).substring(2, 15);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      text: `You requested to reset your password. Use this token: ${resetToken}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to send email' });
      }
      res.json({ message: 'Reset email sent successfully' });
    });
  });
});

// ✅ API to fetch state data with CM and districts
app.get('/api/state', (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'State name is required' });

  db.query('SELECT * FROM states WHERE name = ?', [name], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'State not found' });

    const state = results[0];

    db.query('SELECT * FROM cms WHERE LOWER(state) = LOWER(?)', [name], (err2, cmResults) => {
      if (err2) return res.status(500).json({ error: 'Database error (CM)' });

      if (cmResults.length > 0) {
        const cmRow = cmResults[0];
        state.cm = {
          name: cmRow.name,
          photo: cmRow.photo,
          bio: cmRow.bio
        };
      } else {
        state.cm = null;
      }

      db.query('SELECT name, division FROM districts WHERE state = ?', [name], (err3, districtResults) => {
        if (err3) return res.status(500).json({ error: 'Database error (districts)' });

        const groupedDistricts = {};
        districtResults.forEach(({ name, division }) => {
          if (!groupedDistricts[division]) groupedDistricts[division] = [];
          groupedDistricts[division].push(name);
        });

        state.districtList = groupedDistricts;
        state.districts = districtResults.length;

        res.json(state);
      });
    });
  });
});

// ✅ API to fetch district
app.get('/api/district', (req, res) => {
  const { district } = req.query;
  if (!district) return res.status(400).json({ error: 'District is required' });

  db.query('SELECT * FROM dist WHERE name = ?', [district], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'District not found' });

    res.json(results[0]);
  });
});

//  Login and logout api
app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) return next(err);
    res.redirect('/');
  });
});


// app.get('/api/me', (req, res) => {
//   if (req.isAuthenticated && req.isAuthenticated()) {
//     return res.json({ loggedIn: true, email: req.user.email });
//   }
//   res.json({ loggedIn: false });
// });


app.get('/api/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({
      loggedIn: true,
      name: req.user.name || req.user.username || req.user.email.split('@')[0],
      email: req.user.email,
      profile_picture: req.user.profile_picture || null
    });
  }
  res.json({ loggedIn: false });
});


// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
