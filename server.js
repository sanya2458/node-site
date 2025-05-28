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
  @media (max-width: 600px) {
    nav {
      flex-direction: column;
      align-items: flex-start;
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

// --- Головна сторінка, список товарів з фільтром ---
app.get('/', (req, res) => {
  const filterCat = req.query.category || null;
  const sqlParams = [];
  let sql = `SELECT products.*, categories.name AS category_name,
    (SELECT AVG(rating) FROM reviews WHERE product_id=products.id) AS avg_rating
    FROM products
    LEFT JOIN categories ON products.category_id = categories.id`;
  if (filterCat) {
    sql += ' WHERE categories.name = ?';
    sqlParams.push(filterCat);
  }
  sql += ' ORDER BY products.id DESC';

  db.all(sql, sqlParams, (err, products) => {
    if (err) return res.status(500).send('Помилка бази даних');
    db.all('SELECT * FROM categories ORDER BY name', [], (err2, categories) => {
      if (err2) return res.status(500).send('Помилка бази даних');

      let filterOptions = `<option value="">Всі категорії</option>` + categories.map(c =>
        `<option value="${c.name}" ${c.name === filterCat ? 'selected' : ''}>${c.name}</option>`
      ).join('');

      let cards = products.map(p => {
        let rating = p.avg_rating ? p.avg_rating.toFixed(1) : '—';
        return `
        <div class="product-card" onclick="window.location='/product/${p.id}'" title="Переглянути товар">
          <img src="/uploads/${p.id}_1.jpg" onerror="this.src='/uploads/default.png';" alt="${p.name}" />
          <h3>${p.name}</h3>
          <div class="price">${p.price.toFixed(2)} грн</div>
          <div>Категорія: ${p.category_name || 'Без категорії'}</div>
          <div class="rating">Рейтинг: ${rating}</div>
        </div>`;
      }).join('');

      const content = `
        <h1>Магазин товарів</h1>
        <form method="GET" action="/">
          <label>Фільтр за категорією:</label>
          <select name="category" onchange="this.form.submit()">${filterOptions}</select>
        </form>
        <div class="products">${cards || '<p>Товарів не знайдено.</p>'}</div>
      `;

      render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
    });
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

// --- Реєстрація ---
app.get('/register', (req, res) => {
  const form = `
  <h1>Реєстрація</h1>
  <form method="POST" action="/register">
    <label>Логін</label>
    <input name="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" title="Логін має містити лише букви, цифри або _" />
    <label>Пароль</label>
    <input type="password" name="password" required minlength="5" />
    <button type="submit">Зареєструватися</button>
  </form>`;
  render(res, form);
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return render(res, '', { error: 'Заповніть усі поля' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
    if (row) return render(res, '', { error: 'Користувач з таким логіном вже існує' });
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return render(res, '', { error: 'Помилка сервера' });
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], err => {
        if (err) return render(res, '', { error: 'Помилка додавання користувача' });
        res.redirect('/login');
      });
    });
  });
});

// --- Логін ---
app.get('/login', (req, res) => {
  const form = `
  <h1>Вхід</h1>
  <form method="POST" action="/login">
    <label>Логін</label>
    <input name="username" required />
    <label>Пароль</label>
    <input type="password" name="password" required />
    <button type="submit">Увійти</button>
  </form>`;
  render(res, form);
});
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (!user) return render(res, '', { error: 'Невірний логін або пароль' });
    bcrypt.compare(password, user.password, (err, valid) => {
      if (!valid) return render(res, '', { error: 'Невірний логін або пароль' });
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAdmin = user.is_admin === 1;
      res.redirect('/');
    });
  });
});

// --- Вихід ---
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// --- Сторінка одного товару ---
app.get('/product/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT products.*, categories.name AS category_name
          FROM products LEFT JOIN categories ON products.category_id = categories.id
          WHERE products.id = ?`, [id], (err, product) => {
    if (!product) return res.status(404).send('Товар не знайдено');

    db.all('SELECT filename FROM product_images WHERE product_id = ?', [id], (err, images) => {
      db.all(`SELECT reviews.*, users.username FROM reviews
              LEFT JOIN users ON reviews.user_id = users.id
              WHERE product_id = ? ORDER BY created_at DESC`, [id], (err, reviews) => {
        // Вираховуємо середній рейтинг
        let avgRating = 0;
        if (reviews.length) {
          avgRating = (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1);
        }
        const imagesHtml = images.length
          ? images.map(img => `<img src="/uploads/${img.filename}" style="max-width:200px; margin-right:10px; border-radius:8px;" />`).join('')
          : '<p>Фото відсутні</p>';

        const reviewsHtml = reviews.length
          ? reviews.map(r => `<div class="review"><strong>${r.username}</strong> (${r.rating}/5):<br>${r.comment}</div>`).join('')
          : '<p>Відгуків немає</p>';

        const content = `
          <h1>${product.name}</h1>
          <div><b>Категорія:</b> ${product.category_name || 'Без категорії'}</div>
          <div><b>Ціна:</b> ${product.price.toFixed(2)} грн</div>
          <div><b>Рейтинг:</b> ${avgRating}</div>
          <div style="margin-top: 15px;">${imagesHtml}</div>
          <p style="margin-top: 20px;">${product.description || 'Опис відсутній'}</p>

          <h3>Відгуки</h3>
          <div class="reviews">${reviewsHtml}</div>
          ${req.session.userId ? `
            <form method="POST" action="/product/${id}/review">
              <label>Рейтинг (1-5):</label>
              <input type="number" name="rating" min="1" max="5" required />
              <label>Коментар:</label>
              <textarea name="comment" rows="3"></textarea>
              <input type="submit" value="Додати відгук" />
            </form>
          ` : '<p>Щоб додати відгук, будь ласка, увійдіть.</p>'}
        `;

        render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
      });
    });
  });
});

// --- Додавання відгуку ---
app.post('/product/:id/review', requireAuth, (req, res) => {
  const id = req.params.id;
  const userId = req.session.userId;
  const { rating, comment } = req.body;
  const r = parseInt(rating);
  if (r < 1 || r > 5) return res.redirect(`/product/${id}`);

  db.run('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
    [id, userId, r, comment], err => {
      res.redirect(`/product/${id}`);
    });
});

// --- Адмінка: список категорій і товарів ---
app.get('/admin', requireAdmin, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', [], (err, categories) => {
    db.all(`SELECT products.*, categories.name AS category_name FROM products
            LEFT JOIN categories ON products.category_id = categories.id ORDER BY products.id DESC`, [], (err, products) => {

      const categoriesList = categories.map(c => `
        <li>${c.name} 
          <a href="/admin/category/edit/${c.id}">Редагувати</a> | 
          <a href="/admin/category/delete/${c.id}" onclick="return confirm('Видалити категорію?')">Видалити</a>
        </li>`).join('');

      const productsList = products.map(p => `
        <li>${p.name} (${p.category_name || 'Без категорії'}) - ${p.price.toFixed(2)} грн
          <a href="/admin/product/edit/${p.id}">Редагувати</a> | 
          <a href="/admin/product/delete/${p.id}" onclick="return confirm('Видалити товар?')">Видалити</a>
        </li>`).join('');

      const content = `
        <h1>Адмінка</h1>

        <h2>Категорії</h2>
        <ul>${categoriesList || '<li>Категорії відсутні</li>'}</ul>
        <a href="/admin/category/new"><button>Додати категорію</button></a>

        <h2>Товари</h2>
        <ul>${productsList || '<li>Товари відсутні</li>'}</ul>
        <a href="/admin/product/new"><button>Додати товар</button></a>
      `;
      render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
    });
  });
});

// --- Категорії: Додати ---
app.get('/admin/category/new', requireAdmin, (req, res) => {
  const content = `
    <h1>Додати категорію</h1>
    <form method="POST" action="/admin/category/new">
      <label>Назва категорії:</label>
      <input name="name" required />
      <button type="submit">Додати</button>
    </form>
    <a href="/admin">Назад</a>
  `;
  render(res, content, { user: req.session.username, isAdmin: true });
});
app.post('/admin/category/new', requireAdmin, (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO categories (name) VALUES (?)', [name], err => {
    if (err) return render(res, '', { error: 'Категорія з такою назвою вже існує' });
    res.redirect('/admin');
  });
});

// --- Категорії: Редагувати ---
app.get('/admin/category/edit/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM categories WHERE id = ?', [id], (err, cat) => {
    if (!cat) return res.redirect('/admin');
    const content = `
      <h1>Редагувати категорію</h1>
      <form method="POST" action="/admin/category/edit/${id}">
        <label>Назва категорії:</label>
        <input name="name" value="${cat.name}" required />
        <button type="submit">Зберегти</button>
      </form>
      <a href="/admin">Назад</a>
    `;
    render(res, content, { user: req.session.username, isAdmin: true });
  });
});
app.post('/admin/category/edit/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const { name } = req.body;
  db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id], err => {
    if (err) return render(res, '', { error: 'Помилка оновлення' });
    res.redirect('/admin');
  });
});

// --- Категорії: Видалити ---
app.get('/admin/category/delete/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM categories WHERE id = ?', [id], err => {
    if (err) return res.send('Помилка видалення');
    res.redirect('/admin');
  });
});

// --- Товари: Додати ---
app.get('/admin/product/new', requireAdmin, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', [], (err, categories) => {
    const catsOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const content = `
      <h1>Додати товар</h1>
      <form method="POST" action="/admin/product/new" enctype="multipart/form-data">
        <label>Назва:</label><input name="name" required />
        <label>Опис:</label><textarea name="description"></textarea>
        <label>Ціна (грн):</label><input name="price" type="number" min="0" step="0.01" required />
        <label>Категорія:</label>
        <select name="category_id" required><option value="">Виберіть</option>${catsOptions}</select>
        <label>Фото (до 5, не обов’язково):</label>
        <input type="file" name="images" multiple accept="image/*" />
        <button type="submit">Додати</button>
      </form>
      <a href="/admin">Назад</a>
    `;
    render(res, content, { user: req.session.username, isAdmin: true });
  });
});
app.post('/admin/product/new', requireAdmin, upload.array('images', 5), (req, res) => {
  const { name, description, price, category_id } = req.body;
  const priceNum = parseFloat(price);
  if (!name || !category_id || isNaN(priceNum)) return render(res, '', { error: 'Заповніть всі поля' });

  db.run('INSERT INTO products (name, description, price, category_id) VALUES (?, ?, ?, ?)',
    [name, description, priceNum, category_id], function(err) {
      if (err) return render(res, '', { error: 'Помилка додавання товару' });
      const productId = this.lastID;

      // Збереження фото
      if (req.files && req.files.length) {
        const stmt = db.prepare('INSERT INTO product_images (product_id, filename) VALUES (?, ?)');
        req.files.forEach(f => {
          stmt.run(productId, f.filename);
        });
        stmt.finalize();
      }
      res.redirect('/admin');
    });
});

// --- Товари: Редагувати ---
app.get('/admin/product/edit/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
    if (!product) return res.redirect('/admin');
    db.all('SELECT * FROM categories ORDER BY name', [], (err, categories) => {
      db.all('SELECT * FROM product_images WHERE product_id = ?', [id], (err, images) => {
        const catsOptions = categories.map(c => `<option value="${c.id}" ${c.id === product.category_id ? 'selected' : ''}>${c.name}</option>`).join('');
        const imagesHtml = images.map(img => `
          <div style="margin-bottom: 5px;">
            <img src="/uploads/${img.filename}" style="width:80px; border-radius:6px;"/>
            <a href="/admin/product/image/delete/${img.id}?product=${id}" onclick="return confirm('Видалити фото?')">Видалити</a>
          </div>`).join('');
        const content = `
          <h1>Редагувати товар</h1>
          <form method="POST" action="/admin/product/edit/${id}" enctype="multipart/form-data">
            <label>Назва:</label><input name="name" value="${product.name}" required />
            <label>Опис:</label><textarea name="description">${product.description || ''}</textarea>
            <label>Ціна (грн):</label><input name="price" type="number" min="0" step="0.01" value="${product.price}" required />
            <label>Категорія:</label>
            <select name="category_id" required><option value="">Виберіть</option>${catsOptions}</select>
            <label>Додати фото (до 5):</label>
            <input type="file" name="images" multiple accept="image/*" />
            <div><b>Існуючі фото:</b><br>${imagesHtml || 'Фото відсутні'}</div>
            <button type="submit">Зберегти</button>
          </form>
          <a href="/admin">Назад</a>
        `;
        render(res, content, { user: req.session.username, isAdmin: true });
      });
    });
  });
});
app.post('/admin/product/edit/:id', requireAdmin, upload.array('images', 5), (req, res) => {
  const id = req.params.id;
  const { name, description, price, category_id } = req.body;
  const priceNum = parseFloat(price);
  if (!name || !category_id || isNaN(priceNum)) return render(res, '', { error: 'Заповніть всі поля' });

  db.run('UPDATE products SET name=?, description=?, price=?, category_id=? WHERE id=?',
    [name, description, priceNum, category_id, id], err => {
      if (err) return render(res, '', { error: 'Помилка оновлення товару' });

      if (req.files && req.files.length) {
        const stmt = db.prepare('INSERT INTO product_images (product_id, filename) VALUES (?, ?)');
        req.files.forEach(f => {
          stmt.run(id, f.filename);
        });
        stmt.finalize();
      }
      res.redirect('/admin');
    });
});

// --- Видалення фото товару ---
app.get('/admin/product/image/delete/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  const productId = req.query.product;
  db.get('SELECT filename FROM product_images WHERE id = ?', [id], (err, img) => {
    if (!img) return res.redirect(`/admin/product/edit/${productId}`);
    const filePath = path.join(__dirname, 'uploads', img.filename);
    fs.unlink(filePath, () => {
      db.run('DELETE FROM product_images WHERE id = ?', [id], () => {
        res.redirect(`/admin/product/edit/${productId}`);
      });
    });
  });
});

// --- Видалення товару ---
app.get('/admin/product/delete/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  db.all('SELECT filename FROM product_images WHERE product_id = ?', [id], (err, imgs) => {
    imgs.forEach(img => {
      const filePath = path.join(__dirname, 'uploads', img.filename);
      fs.unlink(filePath, () => {});
    });
    db.run('DELETE FROM product_images WHERE product_id = ?', [id], () => {
      db.run('DELETE FROM reviews WHERE product_id = ?', [id], () => {
        db.run('DELETE FROM products WHERE id = ?', [id], () => {
          res.redirect('/admin');
        });
      });
    });
  });
});

// --- Запуск сервера ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));
