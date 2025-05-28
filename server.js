// server.js (оновлено)
// Головні правки:
// 1. Для карток товарів отримуємо перше фото з БД і показуємо його (mobile + desktop).
// 2. Фільтр категорій під заголовком прибрано.
// 3. Навігація на мобільних залишається в один рядок (зменшено розмір та «падінги» кнопок).

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Автоматичне створення папки для зображень ---
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// --- Налаштування multer ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// --- База SQLite ---
const dbFile = path.join(__dirname, 'shop.db');
const db = new sqlite3.Database(dbFile);

// --- Ініціалізація бази ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    is_admin INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    price REAL,
    category_id INTEGER,
    rating REAL DEFAULT 0,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    filename TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    user_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Створюємо адміна, якщо немає
  const adminUser = 'admin';
  const adminPass = 'admin123';
  db.get('SELECT * FROM users WHERE username = ?', [adminUser], (err, row) => {
    if (!row) {
      bcrypt.hash(adminPass, 10, (err, hash) => {
        db.run('INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)', [adminUser, hash]);
        console.log(`Адмін створений: ${adminUser} / ${adminPass}`);
      });
    }
  });
});

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: false,
}));

// --- Перевірка авторизації ---
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).send('Доступ заборонено');
  next();
}

// --- Відправка сторінок з шаблонами (без ejs, чисто HTML у рядках) ---
function render(res, content, options = {}) {
  const { title = 'Магазин', user = null, isAdmin = false, error = null } = options;
  res.send(`<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  /* Базові стилі */
  body {
    background: #0a1e4d;
    color: white;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0; padding: 0 15px;
  }
  nav {
    background: #142f6c;
    padding: 15px;
    display: flex;
    gap: 15px;
    align-items: center;
    flex-wrap: wrap;
    border-radius: 0 0 10px 10px;
  }
  nav a {
    color: white;
    text-decoration: none;
    padding: 8px 12px;
    border-radius: 6px;
    transition: background 0.3s;
  }
  nav a:hover {
    background: #2f4dab;
  }
  nav .user-info {
    margin-left: auto;
  }
  h1 {
    margin-top: 20px;
    margin-bottom: 10px;
  }
  button, input[type=submit] {
    background: #2f4dab;
    color: white;
    border: none;
    padding: 8px 16px;
    margin-top: 10px;
    cursor: pointer;
    border-radius: 8px;
  }
  button:hover, input[type=submit]:hover {
    background: #4561d6;
  }
  input, select, textarea {
    width: 100%;
    max-width: 400px;
    padding: 8px;
    margin: 6px 0 10px 0;
    border-radius: 6px;
    border: none;
  }
  input[type=number] {
    max-width: 150px;
  }
  .error {
    color: #ff6868;
    margin-bottom: 15px;
  }
  .container {
    max-width: 960px;
    margin: 20px auto;
  }
  .products {
    display: grid;
    grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
    gap: 15px;
  }
  .product-card {
    background: #142f6c;
    border-radius: 12px;
    padding: 15px;
    cursor: pointer;
    transition: background 0.3s;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .product-card:hover {
    background: #2f4dab;
  }
  .product-card img {
    width: 100%;
    height: 140px;
    object-fit: contain;
    border-radius: 8px;
    background: white;
  }
  .product-card h3 {
    margin: 10px 0 6px 0;
  }
  .product-card .price {
    font-weight: bold;
    margin-bottom: 8px;
  }
  .rating {
    color: gold;
    font-weight: bold;
  }
  form label {
    font-weight: bold;
  }
  .reviews {
    margin-top: 20px;
  }
  .review {
    background: #0d204a;
    padding: 10px;
    border-radius: 10px;
    margin-bottom: 10px;
  }
  .review strong {
    color: #a3d1ff;
  }
  /* Мобільні налаштування */
  @media (max-width: 600px) {
    nav {
      gap: 10px;
    }
    nav a {
      padding: 6px 8px;
      font-size: 14px;
    }
  }
</style>
</head>
<body>
<nav>
  <a href="/">Головна</a>
  <a href="/categories">Категорії</a>
  ${isAdmin ? `<a href="/admin">Адмінка</a>` : ''}
  <div class="user-info">
  ${user ? `Привіт, <b>${user}</b> | <a href="/logout">Вийти</a>` : `<a href="/login">Вхід</a> | <a href="/register">Реєстрація</a>`}
  </div>
</nav>
<div class="container">
${error ? `<p class="error">${error}</p>` : ''}
${content}
</div>
</body>
</html>`);
}

// --- Головна сторінка, список товарів ---
app.get('/', (req, res) => {
  const filterCat = req.query.category || null;
  const sqlParams = [];
  let sql = `SELECT products.*, categories.name AS category_name,
    (SELECT AVG(rating) FROM reviews WHERE product_id=products.id) AS avg_rating,
    (SELECT filename FROM product_images WHERE product_id=products.id ORDER BY id ASC LIMIT 1) AS first_img
    FROM products
    LEFT JOIN categories ON products.category_id = categories.id`;
  if (filterCat) {
    sql += ' WHERE categories.name = ?';
    sqlParams.push(filterCat);
  }
  sql += ' ORDER BY products.id DESC';

  db.all(sql, sqlParams, (err, products) => {
    if (err) return res.status(500).send('Помилка бази даних');

    let cards = products.map(p => {
      let rating = p.avg_rating ? p.avg_rating.toFixed(1) : '—';
      const imgSrc = p.first_img ? `/uploads/${p.first_img}` : '/uploads/default.png';
      return `
        <div class="product-card" onclick="window.location='/product/${p.id}'" title="Переглянути товар">
          <img src="${imgSrc}" alt="${p.name}" />
          <h3>${p.name}</h3>
          <div class="price">${p.price.toFixed(2)} грн</div>
          <div>Категорія: ${p.category_name || 'Без категорії'}</div>
          <div class="rating">Рейтинг: ${rating}</div>
        </div>`;
    }).join('');

    const content = `
      <h1>Магазин товарів</h1>
      <div class="products">${cards || '<p>Товарів не знайдено.</p>'}</div>
    `;

    render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
  });
});

// --- Сторінка категорій ---
app.get('/categories', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', [], (err, categories) => {
    if (err) return res.status(500).send('Помилка БД');
    const content = `<h1>Категорії</h1>
      <ul>${categories.map(c => `<li><a href="/?category=${encodeURIComponent(c.name)}">${c.name}</a></li>`).join('')}</ul>`;
    render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
  });
});

// --- Реєстрація, Логін, Продукти, Адмінка ... (НЕ ЗМІНЮВАЛОСЬ) ---
// Весь подальший код (register/login/product/admin маршрути) залишається без змін,
// тому опущено тут заради компактності. Просто переконайся, що він іде одразу після цього блоку,
// як у твоєму оригінальному файлі.

// --- Запуск сервера ---
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));
