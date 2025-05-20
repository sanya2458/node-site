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

// Перевіряємо і створюємо папку для завантажень, якщо нема
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Налаштовуємо multer для збереження файлів в public/uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Залишаємо оригінальне ім'я файлу або додаємо timestamp
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, basename + '-' + Date.now() + ext);
  }
});
const upload = multer({ storage: storage });

// Створюємо таблицю, якщо нема
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    caption TEXT NOT NULL,
    date TEXT NOT NULL
  )`);
});

// Middleware для перевірки адміна
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.redirect('/');
};

// Головна сторінка — показ постів + кнопка "Вхід" зверху справа, якщо не залогінений
app.get('/', (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", (err, posts) => {
    res.render('index', { posts, isAdmin: req.session.isAdmin });
  });
});

// Сторінка логіну (форму можна показувати модально або окремо)
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === 'admin123') {
    req.session.isAdmin = true;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Невірний пароль' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Адмінка — список постів + форма додавання
app.get('/admin', isAdmin, (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", (err, posts) => {
    res.render('admin', { posts });
  });
});

// Додати пост
app.post('/add', isAdmin, upload.single('image'), (req, res) => {
  const { caption } = req.body;
  const date = new Date().toLocaleString();
  const image = req.file.filename;

  db.run("INSERT INTO posts (image, caption, date) VALUES (?, ?, ?)", [image, caption, date], (err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/admin');
  });
});

// Редагувати пост — форма
app.get('/edit/:id', isAdmin, (req, res) => {
  db.get("SELECT * FROM posts WHERE id = ?", [req.params.id], (err, post) => {
    if (!post) return res.redirect('/admin');
    res.render('edit', { post });
  });
});

// Оновити пост
app.post('/edit/:id', isAdmin, (req, res) => {
  const { caption } = req.body;
  db.run("UPDATE posts SET caption = ? WHERE id = ?", [caption, req.params.id], (err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/admin');
  });
});

// Видалити пост
app.post('/delete/:id', isAdmin, (req, res) => {
  db.get("SELECT image FROM posts WHERE id = ?", [req.params.id], (err, post) => {
    if (post) {
      const filepath = path.join(uploadDir, post.image);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
    db.run("DELETE FROM posts WHERE id = ?", [req.params.id], (err) => {
      if (err) {
        console.error(err);
      }
      res.redirect('/admin');
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
