const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('site.db');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: false
}));

// Налаштування multer для завантаження зображень
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Ініціалізація бази даних
db.run(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caption TEXT,
  image TEXT,
  date TEXT
)`);
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT,
  password TEXT
)`);

// Реєстрація (тільки для ручного використання)
app.get('/register', (req, res) => {
  const hash = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, ['admin@site.com', hash], err => {
    if (err) {
      console.error('Помилка при створенні користувача:', err);
      return res.send('Помилка реєстрації');
    }
    res.send('Адмін створений');
  });
});

// Головна сторінка
app.get('/', (req, res) => {
  db.all(`SELECT * FROM posts ORDER BY id DESC`, (err, posts) => {
    if (err) {
      console.error('Помилка при отриманні постів:', err);
      return res.status(500).send('Помилка сервера');
    }
    res.send(`
      <html>
        <head>
          <title>Пости</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { background: #121212; color: white; font-family: sans-serif; margin: 0; padding: 20px; }
            .post { background: #1e1e1e; border-radius: 12px; margin: 20px 0; padding: 15px; }
            .post img { max-width: 100%; border-radius: 8px; }
            .date { font-size: 0.9em; color: #bbb; margin-top: 5px; }
          </style>
        </head>
        <body>
          ${posts.map(post => `
            <div class="post">
              <img src="/uploads/${post.image}">
              <p>${post.caption}</p>
              <div class="date">${post.date}</div>
            </div>
          `).join('')}
        </body>
      </html>
    `);
  });
});

// Форма входу
app.get('/login', (req, res) => {
  res.send(`
    <form method="post" action="/login">
      <input name="email" placeholder="Email"><br>
      <input type="password" name="password" placeholder="Пароль"><br>
      <button>Увійти</button>
    </form>
  `);
});

// Вхід
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email=?`, [email], (err, user) => {
    if (err) {
      console.error('Помилка в /login:', err);
      return res.status(500).send('Помилка входу');
    }
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      return res.redirect('/admin');
    }
    res.send('Невірні дані');
  });
});

// Адмінка
app.get('/admin', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  db.all(`SELECT * FROM posts ORDER BY id DESC`, (err, posts) => {
    if (err) {
      console.error('Помилка при завантаженні постів у /admin:', err);
      return res.status(500).send('Помилка сервера');
    }
    res.send(`
      <h1>Додати пост</h1>
      <form method="post" action="/add" enctype="multipart/form-data">
        <input name="caption" placeholder="Підпис"><br>
        <input type="file" name="image"><br>
        <button>Додати</button>
      </form>
      <h2>Пости</h2>
      ${posts.map(p => `
        <div>
          <img src="/uploads/${p.image}" width="200"><br>
          <form method="post" action="/edit/${p.id}" enctype="multipart/form-data">
            <input name="caption" value="${p.caption}"><br>
            <input type="file" name="image"><br>
            <button>Редагувати</button>
          </form>
          <form method="post" action="/delete/${p.id}">
            <button>Видалити</button>
          </form>
        </div>
      `).join('')}
    `);
  });
});

// Додавання поста
app.post('/add', upload.single('image'), (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const caption = req.body.caption;
  const image = req.file?.filename;
  const date = new Date().toLocaleString();
  if (!image) return res.send('Зображення не вибране');

  db.run(`INSERT INTO posts (caption, image, date) VALUES (?, ?, ?)`, [caption, image, date], err => {
    if (err) {
      console.error('Помилка при додаванні поста:', err);
      return res.status(500).send('Помилка сервера');
    }
    res.redirect('/admin');
  });
});

// Редагування поста
app.post('/edit/:id', upload.single('image'), (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const id = req.params.id;
  const caption = req.body.caption;

  db.get(`SELECT image FROM posts WHERE id=?`, [id], (err, row) => {
    if (err || !row) {
      console.error('Помилка при отриманні старого зображення:', err);
      return res.status(500).send('Помилка сервера');
    }

    let image = row.image;
    if (req.file) {
      fs.unlinkSync(`public/uploads/${image}`);
      image = req.file.filename;
    }

    db.run(`UPDATE posts SET caption=?, image=? WHERE id=?`, [caption, image, id], err => {
      if (err) {
        console.error('Помилка при оновленні поста:', err);
        return res.status(500).send('Помилка сервера');
      }
      res.redirect('/admin');
    });
  });
});

// Видалення поста
app.post('/delete/:id', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const id = req.params.id;

  db.get(`SELECT image FROM posts WHERE id=?`, [id], (err, row) => {
    if (err || !row) {
      console.error('Помилка при отриманні зображення для видалення:', err);
      return res.status(500).send('Помилка сервера');
    }

    fs.unlinkSync(`public/uploads/${row.image}`);
    db.run(`DELETE FROM posts WHERE id=?`, [id], err => {
      if (err) {
        console.error('Помилка при видаленні поста:', err);
        return res.status(500).send('Помилка сервера');
      }
      res.redirect('/admin');
    });
  });
});

// Запуск сервера
app.listen(3000, () => {
  console.log('Сервер запущено на http://localhost:3000');
});
