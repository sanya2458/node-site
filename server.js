const express = require('express');
const multer = require('multer');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('./database.db');

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
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

// Middleware для перевірки авторизації
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.redirect('/login');
};

// Головна сторінка з постами та кнопкою увійти
app.get('/', (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", (err, posts) => {
    if (err) return res.status(500).send("Помилка бази даних");
    res.render('index', { posts, isAdmin: req.session.isAdmin });
  });
});

// Форма логіну
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Обробка логіну
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('login', { error: 'Невірний пароль' });
  }
});

// Адмінка — список постів і форма додавання
app.get('/admin', isAdmin, (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", (err, posts) => {
    if (err) return res.status(500).send("Помилка бази даних");
    res.render('admin', { posts });
  });
});

// Додавання поста
app.post('/add', isAdmin, upload.single('image'), (req, res) => {
  const { caption } = req.body;
  const date = new Date().toLocaleString();
  if (!req.file) return res.status(400).send("Виберіть зображення");
  const image = req.file.filename;

  db.run("INSERT INTO posts (image, caption, date) VALUES (?, ?, ?)", [image, caption, date], (err) => {
    if (err) return res.status(500).send("Помилка при додаванні поста");
    res.redirect('/admin');
  });
});

// Вихід з адмінки
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});

