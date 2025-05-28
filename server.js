const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'secret_key',
  resave: false,
  saveUninitialized: false
}));

// Підключення БД
const db = new sqlite3.Database('./shop.db');

// Завантаження зображень через multer
const storage = multer.diskStorage({
  destination: './public/uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --- Функція для рендеру ---
function render(res, content, options = {}) {
  const { error, user, isAdmin } = options;
  res.send(`
    <!DOCTYPE html>
    <html lang="uk">
    <head>
      <meta charset="UTF-8" />
      <title>Магазин</title>
      <style>
        body { font-family: Arial, sans-serif; background: #222; color: #eee; padding: 20px; }
        a { color: #66f; text-decoration: none; }
        a:hover { text-decoration: underline; }
        nav { margin-bottom: 20px; }
        nav a { margin-right: 15px; }
        .error { background: #f55; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
        input, textarea, select { width: 100%; padding: 6px; margin-bottom: 10px; border-radius: 4px; border: none; }
        button, input[type="submit"] { background: #4466ff; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; }
        button:hover, input[type="submit"]:hover { background: #3355dd; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; border: 1px solid #555; text-align: left; }
        .review { background: #333; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
      </style>
    </head>
    <body>
      <nav>
        <a href="/">Головна</a>
        ${user ? `<span>Привіт, ${user}!</span> | <a href="/logout">Вихід</a>` : `<a href="/login">Вхід</a> | <a href="/register">Реєстрація</a>`}
        ${isAdmin ? `| <a href="/admin">Адмінка</a>` : ''}
      </nav>

      ${error ? `<div class="error">${error}</div>` : ''}
      ${content}
    </body>
    </html>
  `);
}

// --- Middleware для авторизації ---
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.status(403).send('Доступ заборонено');
  next();
}

// --- Головна ---
app.get('/', (req, res) => {
  db.all(`SELECT products.*, categories.name AS category_name 
          FROM products LEFT JOIN categories ON products.category_id = categories.id 
          ORDER BY products.id DESC`, [], (err, products) => {
    if (err) return res.send('Помилка бази даних');

    let productList = products.map(p => `
      <div style="margin-bottom:15px; padding:10px; background:#333; border-radius:6px;">
        <h3><a href="/product/${p.id}">${p.name}</a></h3>
        <p>Категорія: ${p.category_name || 'Без категорії'}</p>
        <p>Ціна: ${p.price.toFixed(2)} грн</p>
      </div>
    `).join('');

    render(res, `<h1>Список товарів</h1>${productList}`, { user: req.session.username, isAdmin: req.session.isAdmin });
  });
});

// --- Логін ---
app.get('/login', (req, res) => {
  render(res, `
    <h1>Вхід</h1>
    <form method="POST" action="/login">
      <label>Логін:</label>
      <input name="username" type="text" required />
      <label>Пароль:</label>
      <input name="password" type="password" required />
      <input type="submit" value="Увійти" />
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return render(res, '', { error: 'Заповніть усі поля' });

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) return render(res, '', { error: 'Неправильний логін або пароль' });

    bcrypt.compare(password, user.password, (err, same) => {
      if (same) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.isAdmin = user.is_admin === 1;
        res.redirect('/');
      } else {
        render(res, '', { error: 'Неправильний логін або пароль' });
      }
    });
  });
});

// --- Реєстрація ---
app.get('/register', (req, res) => {
  render(res, `
    <h1>Реєстрація</h1>
    <form method="POST" action="/register">
      <label>Логін:</label>
      <input name="username" type="text" required />
      <label>Пароль:</label>
      <input name="password" type="password" required />
      <label>Підтвердження пароля:</label>
      <input name="password2" type="password" required />
      <input type="submit" value="Зареєструватися" />
    </form>
  `);
});

app.post('/register', (req, res) => {
  const { username, password, password2 } = req.body;
  if (!username || !password || !password2)
    return render(res, '', { error: 'Заповніть усі поля' });
  if (password !== password2)
    return render(res, '', { error: 'Паролі не співпадають' });

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return render(res, '', { error: 'Помилка сервера' });

    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint'))
          return render(res, '', { error: 'Логін вже зайнятий' });
        return render(res, '', { error: 'Помилка бази даних' });
      }
      req.session.userId = this.lastID;
      req.session.username = username;
      req.session.isAdmin = false;
      res.redirect('/');
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
  const productId = req.params.id;
  db.get(`SELECT products.*, categories.name AS category_name
          FROM products
          LEFT JOIN categories ON products.category_id = categories.id
          WHERE products.id = ?`, [productId], (err, product) => {
    if (err || !product) return res.status(404).send('Товар не знайдено');

    db.all('SELECT filename FROM product_images WHERE product_id = ?', [productId], (err, images) => {
      if (err) images = [];

      db.all(`SELECT reviews.*, users.username FROM reviews
              LEFT JOIN users ON reviews.user_id = users.id
              WHERE product_id = ? ORDER BY created_at DESC`, [productId], (err, reviews) => {
        if (err) reviews = [];

        const imagesHtml = images.length
          ? images.map(img => `<img src="/uploads/${img.filename}" style="max-width:100px; margin-right:10px; border-radius:6px;">`).join('')
          : '<p>Немає зображень</p>';

        let reviewsHtml = '';
        if (reviews.length) {
          reviewsHtml = reviews.map(r => `
            <div class="review">
              <strong>${r.username}</strong> — рейтинг: ${r.rating} <br />
              <p>${r.comment || ''}</p>
              <small>${new Date(r.created_at).toLocaleString()}</small>
            </div>`).join('');
        } else reviewsHtml = '<p>Відгуків поки немає.</p>';

        const reviewForm = req.session.userId ? `
          <h3>Додати відгук</h3>
          <form method="POST" action="/product/${productId}/review">
            <label for="rating">Рейтинг (1-5):</label>
            <input id="rating" name="rating" type="number" min="1" max="5" required />
            <label for="comment">Коментар:</label>
            <textarea id="comment" name="comment" rows="3"></textarea>
            <input type="submit" value="Додати відгук" />
          </form>` : `<p><a href="/login">Увійдіть</a>, щоб залишити відгук.</p>`;

        const content = `
          <h1>${product.name}</h1>
          <p>Категорія: ${product.category_name || 'Без категорії'}</p>
          <p>Ціна: ${product.price.toFixed(2)} грн</p>
          <p>${product.description || ''}</p>
          <div style="margin-bottom:15px;">${imagesHtml}</div>
          <div class="reviews">
            <h2>Відгуки</h2>
            ${reviewsHtml}
            ${reviewForm}
          </div>
        `;

        render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
      });
    });
  });
});

// --- Додавання відгуку (POST) ---
app.post('/product/:id/review', requireAuth, (req, res) => {
  const productId = req.params.id;
  let rating = parseInt(req.body.rating);
  const comment = req.body.comment ? req.body.comment.trim() : '';

  if (!rating || rating < 1 || rating > 5) return res.status(400).send('Неправильний рейтинг');

  db.run(`INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)`,
    [productId, req.session.userId, rating, comment],
    err => {
      if (err) return res.status(500).send('Помилка додавання відгуку');
      res.redirect(`/product/${productId}`);
    });
});

// --- Адмінка ---
app.get('/admin', requireAdmin, (req, res) => {
  db.all('SELECT * FROM products ORDER BY id DESC', [], (err, products) => {
    if (err) return res.status(500).send('Помилка БД');

    const productRows = products.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.price.toFixed(2)}</td>
        <td>
          <a href="/admin/product/edit/${p.id}">Редагувати</a> |
          <a href="/admin/product/delete/${p.id}" onclick="return confirm('Видалити цей товар?')">Видалити</a>
        </td>
      </tr>
    `).join('');

    const content = `
      <h1>Адмінка</h1>
      <a href="/admin/category/new"><button type="button">Додати категорію</button></a>
      <a href="/admin/product/new"><button type="button">Додати товар</button></a>
      <table border="1" cellpadding="5" cellspacing="0" style="margin-top:15px; width:100%; border-collapse: collapse; color:#fff;">
        <thead>
          <tr><th>ID</th><th>Назва</th><th>Ціна</th><th>Дії</th></tr>
        </thead>
        <tbody>${productRows}</tbody>
      </table>
    `;
    render(res, content, { user: req.session.username, isAdmin: req.session.isAdmin });
  });
});

// --- Форма додавання категорії ---
app.get('/admin/category/new', requireAdmin, (req, res) => {
  render(res, `
    <h1>Додати категорію</h1>
    <form method="POST" action="/admin/category/new">
      <label>Назва категорії:</label>
      <input name="name" type="text" required />
      <input type="submit" value="Додати" />
    </form>
  `, { user: req.session.username, isAdmin: req.session.isAdmin });
});

app.post('/admin/category/new', requireAdmin, (req, res) => {
  const name = req.body.name.trim();
  if (!name) return render(res, '', { error: 'Вкажіть назву категорії' });

  db.run('INSERT INTO categories (name) VALUES (?)', [name], (err) => {
    if (err) return render(res, '', { error: 'Помилка додавання категорії' });
    res.redirect('/admin');
  });
});

// --- Форма додавання товару ---
app.get('/admin/product/new', requireAdmin, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', [], (err, categories) => {
    if (err) categories = [];

    let categoriesOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (!categoriesOptions) categoriesOptions = '<option value="">Категорії відсутні</option>';

    render(res, `
      <h1>Додати товар</h1>
      <form method="POST" action="/admin/product/new" enctype="multipart/form-data">
        <label>Назва:</label>
        <input name="name" type="text" required />
        <label>Опис:</label>
        <textarea name="description" rows="4"></textarea>
        <label>Ціна:</label>
        <input name="price" type="number" step="0.01" required />
        <label>Категорія:</label>
        <select name="category_id" required>
          ${categoriesOptions}
        </select>
        <label>Зображення (можна кілька):</label>
        <input type="file" name="images" accept="image/*" multiple />
        <input type="submit" value="Додати товар" />
      </form>
    `, { user: req.session.username, isAdmin: req.session.isAdmin });
  });
});

app.post('/admin/product/new', requireAdmin, upload.array('images', 5), (req, res) => {
  const { name, description, price, category_id } = req.body;

  if (!name || !price || !category_id) {
    return render(res, '', { error: 'Заповніть всі обов\'язкові поля' });
  }

  db.run(`INSERT INTO products (name, description, price, category_id) VALUES (?, ?, ?, ?)`,
    [name.trim(), description.trim(), parseFloat(price), parseInt(category_id)], function (err) {
      if (err) return render(res, '', { error: 'Помилка додавання товару' });

      const productId = this.lastID;

      if (req.files && req.files.length > 0) {
        const stmt = db.prepare('INSERT INTO product_images (product_id, filename) VALUES (?, ?)');
        for (const file of req.files) {
          stmt.run(productId, file.filename);
        }
        stmt.finalize(() => {
          res.redirect('/admin');
        });
      } else {
        res.redirect('/admin');
      }
    });
});

// --- Запуск сервера ---
app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
