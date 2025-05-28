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

// --- Додано: сторінка входу ---
app.get('/login', (req, res) => {
  const content = `
    <h1>Вхід</h1>
    <form method="POST" action="/login">
      <label for="username">Логін:</label>
      <input id="username" name="username" type="text" required />
      <label for="password">Пароль:</label>
      <input id="password" name="password" type="password" required />
      <input type="submit" value="Увійти" />
    </form>
  `;
  render(res, content);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return render(res, '', { error: 'Помилка бази даних' });
    if (!user) return render(res, '', { error: 'Користувача не знайдено' });

    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = user.is_admin === 1;
        return res.redirect('/');
      } else {
        render(res, '', { error: 'Невірний пароль' });
      }
    });
  });
});

// --- Додано: сторінка реєстрації ---
app.get('/register', (req, res) => {
  const content = `
    <h1>Реєстрація</h1>
    <form method="POST" action="/register">
      <label for="username">Логін:</label>
      <input id="username" name="username" type="text" required />
      <label for="password">Пароль:</label>
      <input id="password" name="password" type="password" required />
      <label for="password2">Підтвердження пароля:</label>
      <input id="password2" name="password2" type="password" required />
      <input type="submit" value="Зареєструватися" />
    </form>
  `;
  render(res, content);
});

app.post('/register', (req, res) => {
  const { username, password, password2 } = req.body;
  if (password !== password2) {
    return render(res, '', { error: 'Паролі не співпадають' });
  }
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return render(res, '', { error: 'Помилка хешування' });
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return render(res, '', { error: 'Логін вже зайнятий' });
        }
        return render(res, '', { error: 'Помилка бази даних' });
      }
      res.redirect('/login');
    });
  });
});

// --- Вихід ---
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// --- Сторінка товару ---
app.get('/product/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT products.*, categories.name AS category_name,
    (SELECT AVG(rating) FROM reviews WHERE product_id=products.id) AS avg_rating
    FROM products
    LEFT JOIN categories ON products.category_id = categories.id
    WHERE products.id = ?`, [id], (err, product) => {
    if (err || !product) return res.status(404).send('Товар не знайдено');

    db.all('SELECT filename FROM product_images WHERE product_id = ?', [id], (err, images) => {
      db.all(`SELECT reviews.*, users.username FROM reviews
        LEFT JOIN users ON reviews.user_id = users.id
        WHERE product_id = ? ORDER BY created_at DESC`, [id], (err, reviews) => {

        let imagesHtml = images.map(img => `<img src="/uploads/${img.filename}" style="max-width:100%;border-radius:12px;margin-bottom:8px;" />`).join('');

        let ratingDisplay = product.avg_rating ? product.avg_rating.toFixed(2) : '—';

        let reviewsHtml = reviews.map(r => `
          <div class="review">
            <strong>${r.username}</strong> — рейтинг: ${r.rating}<br/>
            ${r.comment ? r.comment : ''}
          </div>`).join('');

        const content = `
          <h1>${product.name}</h1>
          <div>${imagesHtml}</div>
          <p><b>Ціна:</b> ${product.price.toFixed(2)} грн</p>
          <p><b>Категорія:</b> ${product.category_name || 'Без категорії'}</p>
          <p><b>Середній рейтинг:</b> ${ratingDisplay}</p>

          <h2>Відгуки</h2>
          <div class="reviews">${reviewsHtml || '<p>Відгуків немає.</p>'}</div>

          ${req.session.userId ? `
          <h3>Додати відгук</h3>
          <form method="POST" action="/product/${product.id}/review">
            <label for="rating">Рейтинг (1-5):</label>
            <input id="rating" name="rating" type="number" min="1" max="5" required />
            <label for="comment">Коментар:</label>
            <textarea id="comment" name="comment"></textarea>
            <input type="submit" value="Додати відгук" />
          </form>
          ` : `<p><a href="/login">Увійдіть</a>, щоб залишити відгук.</p>`}
        `;

        render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
      });
    });
  });
});

app.post('/product/:id/review', requireAuth, (req, res) => {
  const id = req.params.id;
  const userId = req.session.userId;
  const rating = parseInt(req.body.rating);
  const comment = req.body.comment || '';

  if (rating < 1 || rating > 5) {
    return res.redirect(`/product/${id}`);
  }

  db.run('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)', [id, userId, rating, comment], err => {
    res.redirect(`/product/${id}`);
  });
});

// --- Адмін панель (спрощено) ---
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  const content = `
    <h1>Адмін панель</h1>
    <ul>
      <li><a href="/admin/products">Управління товарами</a></li>
      <li><a href="/admin/categories">Управління категоріями</a></li>
    </ul>
  `;
  render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
