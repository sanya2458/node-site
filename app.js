const express = require('express');
const multer = require('multer');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('./database.db');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: false
}));

const upload = multer({ dest: 'public/uploads/' });

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    caption TEXT NOT NULL,
    date TEXT NOT NULL
  )`);
});

const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.redirect('/login');
};

app.get('/', (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", (err, posts) => {
    res.render('index', { posts });
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.send('Невірний пароль');
  }
});

app.get('/admin', isAdmin, (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", (err, posts) => {
    res.render('admin', { posts });
  });
});

app.post('/add', isAdmin, upload.single('image'), (req, res) => {
  const { caption } = req.body;
  const date = new Date().toLocaleString();
  const image = req.file.filename;

  db.run("INSERT INTO posts (image, caption, date) VALUES (?, ?, ?)", [image, caption, date], () => {
    res.redirect('/admin');
  });
});

app.get('/edit/:id', isAdmin, (req, res) => {
  db.get("SELECT * FROM posts WHERE id = ?", [req.params.id], (err, post) => {
    res.render('edit', { post });
  });
});

app.post('/edit/:id', isAdmin, (req, res) => {
  const { caption } = req.body;
  db.run("UPDATE posts SET caption = ? WHERE id = ?", [caption, req.params.id], () => {
    res.redirect('/admin');
  });
});

app.post('/delete/:id', isAdmin, (req, res) => {
  db.get("SELECT image FROM posts WHERE id = ?", [req.params.id], (err, post) => {
    if (post) {
      fs.unlinkSync(path.join(__dirname, 'public/uploads', post.image));
    }
    db.run("DELETE FROM posts WHERE id = ?", [req.params.id], () => {
      res.redirect('/admin');
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
