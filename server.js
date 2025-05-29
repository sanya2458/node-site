const express = require('express');
const session = require('express-session');
const multer  = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Папка для завантаження зображень
const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// Multer для збереження зображень
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + ext);
    }
  })
});

// БД SQLite
const db = new sqlite3.Database('shop.db');
db.serialize(() => {
  db.run(`PRAGMA foreign_keys=ON`);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    pass TEXT,
    role TEXT DEFAULT 'user'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    description TEXT,
    category_id INTEGER,
    image TEXT,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cart (
    user_id INTEGER,
    product_id INTEGER,
    quantity INTEGER DEFAULT 1,
    PRIMARY KEY(user_id, product_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  )`);

  // Створюємо адміна, якщо нема
  db.get(`SELECT * FROM users WHERE role = 'admin'`, (e, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin', 10);
      db.run(`INSERT INTO users(email, pass, role) VALUES (?, ?, 'admin')`, ['admin@example.com', hash]);
      console.log('Створено адміна: admin@example.com / admin');
    }
  });
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'secretkey',
  resave: false,
  saveUninitialized: false
}));

// Допоміжні функції
const getUser = (req) => req.session.user || null;
const requireLogin = (req, res, next) => {
  if (!getUser(req)) return res.redirect('/login');
  next();
};
const requireAdmin = (req, res, next) => {
  if (!getUser(req) || getUser(req).role !== 'admin') return res.status(403).send('Доступ заборонено');
  next();
};

// Шаблон сторінки
function layout(title, content, user = null) {
  return `
  <!DOCTYPE html>
  <html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #27303f; color: #e0e3e9; margin:0; padding:0; }
      header { background: #3a4460; padding: 1rem; display: flex; gap: 1rem; }
      header a { color: #91b2ff; text-decoration: none; font-weight: bold; }
      header a:hover { text-decoration: underline; }
      main { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
      form { max-width: 400px; margin: 0 auto; }
      input, select, textarea, button { display: block; width: 100%; margin: 0.5rem 0; padding: 0.5rem; border-radius: 6px; border: none; }
      button { background: #91b2ff; color: #27303f; font-weight: 700; cursor: pointer; }
      button:hover { background: #6b8dff; }
      .product { border: 1px solid #566dff44; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; background: #39455a; }
      .product img { max-width: 100%; height: auto; border-radius: 6px; }
      .cart-item { margin-bottom: 1rem; border-bottom: 1px solid #566dff44; padding-bottom: 1rem; }
    </style>
  </head>
  <body>
    <header>
      <a href="/">Головна</a>
      <a href="/categories">Категорії</a>
      ${user ? `<a href="/cart">Кошик</a>` : ''}
      ${user ? (user.role === 'admin' ? `<a href="/admin">Адмін</a>` : '') : ''}
      ${user ? `<a href="/logout">Вийти (${user.email})</a>` : `<a href="/login">Увійти</a> <a href="/register">Реєстрація</a>`}
    </header>
    <main>
      ${content}
    </main>
  </body>
  </html>
  `;
}

// --- Головна сторінка --- (перелік товарів)
app.get('/', (req, res) => {
  db.all(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id`, [], (err, rows) => {
    if (err) return res.send('Помилка БД');

    let html = '';
    rows.forEach(p => {
      html += `
      <div class="product">
        <h2>${p.name}</h2>
        ${p.image ? `<img src="/public/uploads/${p.image}" alt="${p.name}">` : ''}
        <p>Категорія: ${p.category_name || 'Без категорії'}</p>
        <p>Ціна: ${p.price.toFixed(2)} ₴</p>
        <p>${p.description || ''}</p>
        <form method="post" action="/cart/add">
          <input type="hidden" name="product_id" value="${p.id}" />
          <button type="submit">Додати до кошика</button>
        </form>
      </div>
      `;
    });
    res.send(layout('Головна', html, getUser(req)));
  });
});

// --- Категорії ---
app.get('/categories', (req, res) => {
  db.all(`SELECT * FROM categories`, [], (err, cats) => {
    if (err) return res.send('Помилка БД');
    let html = '<h1>Категорії</h1><ul>';
    cats.forEach(c => {
      html += `<li><a href="/categories/${c.id}">${c.name}</a></li>`;
    });
    html += '</ul>';
    res.send(layout('Категорії', html, getUser(req)));
  });
});

app.get('/categories/:id', (req, res) => {
  const catId = req.params.id;
  db.all(`SELECT * FROM products WHERE category_id = ?`, [catId], (err, prods) => {
    if (err) return res.send('Помилка БД');
    let html = `<h1>Товари категорії</h1><a href="/categories">Назад</a><br>`;
    prods.forEach(p => {
      html += `<div class="product">
      <h2>${p.name}</h2>
      <p>Ціна: ${p.price.toFixed(2)} ₴</p>
      <form method="post" action="/cart/add">
        <input type="hidden" name="product_id" value="${p.id}" />
        <button type="submit">Додати до кошика</button>
      </form>
      </div>`;
    });
    res.send(layout('Товари категорії', html, getUser(req)));
  });
});

// --- Кошик ---
app.get('/cart', requireLogin, (req, res) => {
  const user = getUser(req);
  db.all(`
    SELECT p.*, c.quantity FROM products p
    JOIN cart c ON c.product_id = p.id
    WHERE c.user_id = ?`, [user.id], (err, items) => {
    if (err) return res.send('Помилка БД');

    if (items.length === 0) {
      return res.send(layout('Кошик', '<h1>Кошик порожній</h1>', user));
    }

    let total = 0;
    let html = '<h1>Ваш кошик</h1>';
    items.forEach(i => {
      total += i.price * i.quantity;
      html += `
      <div class="cart-item">
        <h3>${i.name}</h3>
        <p>Ціна: ${i.price.toFixed(2)} ₴ x ${i.quantity}</p>
        <form method="post" action="/cart/remove" style="display:inline;">
          <input type="hidden" name="product_id" value="${i.id}" />
          <button type="submit">Видалити</button>
        </form>
      </div>`;
    });
    html += `<h3>Загалом: ${total.toFixed(2)} ₴</h3>`;
    res.send(layout('Кошик', html, user));
  });
});

app.post('/cart/add', requireLogin, (req, res) => {
  const user = getUser(req);
  const productId = req.body.product_id;
  if (!productId) return res.redirect('/');

  db.get(`SELECT quantity FROM cart WHERE user_id = ? AND product_id = ?`, [user.id, productId], (err, row) => {
    if (row) {
      // Якщо товар вже в кошику — збільшуємо кількість
      db.run(`UPDATE cart SET quantity = quantity + 1 WHERE user_id = ? AND product_id = ?`, [user.id, productId], () => {
        res.redirect('/cart');
      });
    } else {
      // Якщо нема — додаємо з кількістю 1
      db.run(`INSERT INTO cart(user_id, product_id, quantity) VALUES (?, ?, 1)`, [user.id, productId], () => {
        res.redirect('/cart');
      });
    }
  });
});

app.post('/cart/remove', requireLogin, (req, res) => {
  const user = getUser(req);
  const productId = req.body.product_id;
  if (!productId) return res.redirect('/cart');

  db.run(`DELETE FROM cart WHERE user_id = ? AND product_id = ?`, [user.id, productId], () => {
    res.redirect('/cart');
  });
});

// --- Реєстрація ---
app.get('/register', (req, res) => {
  if (getUser(req)) return res.redirect('/');
  res.send(layout('Реєстрація', `
    <h1>Реєстрація</h1>
    <form method="post" action="/register">
      <input name="email" type="email" placeholder="Електронна пошта" required />
      <input name="password" type="password" placeholder="Пароль" required />
      <button>Зареєструватися</button>
    </form>
  `));
});

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.redirect('/register');

  const hash = bcrypt.hashSync(password, 10);
  db.run(`INSERT INTO users(email, pass) VALUES (?, ?)`, [email, hash], function(err) {
    if (err) {
      return res.send(layout('Реєстрація', `<h1>Помилка: можливо, цей email вже зареєстрований.</h1><a href="/register">Спробуйте ще раз</a>`));
    }
    res.redirect('/login');
  });
});

// --- Вхід ---
app.get('/login', (req, res) => {
  if (getUser(req)) return res.redirect('/');
  res.send(layout('Вхід', `
    <h1>Вхід</h1>
    <form method="post" action="/login">
      <input name="email" type="email" placeholder="Електронна пошта" required />
      <input name="password" type="password" placeholder="Пароль" required />
      <button>Увійти</button>
    </form>
  `));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.pass)) {
      return res.send(layout('Вхід', `<h1>Невірний логін або пароль</h1><a href="/login">Спробувати ще раз</a>`));
    }
    req.session.user = { id: user.id, email: user.email, role: user.role };
    res.redirect('/');
  });
});

// --- Вихід ---
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// --- Адмінка --- (додавання категорій та товарів)
app.get('/admin', requireAdmin, (req, res) => {
  db.all(`SELECT * FROM categories`, [], (err, cats) => {
    if (err) return res.send('Помилка БД');
    let html = `
      <h1>Адмін панель</h1>
      <h2>Додати категорію</h2>
      <form method="post" action="/admin/category/add">
        <input name="name" placeholder="Назва категорії" required />
        <button>Додати</button>
      </form>
      <h2>Додати товар</h2>
      <form method="post" action="/admin/product/add" enctype="multipart/form-data">
        <input name="name" placeholder="Назва товару" required />
        <input name="price" type="number" step="0.01" placeholder="Ціна" required />
        <textarea name="description" placeholder="Опис"></textarea>
        <select name="category_id" required>
          <option value="">-- Оберіть категорію --</option>
          ${cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
        <input type="file" name="image" accept="image/*" />
        <button>Додати товар</button>
      </form>
    `;
    res.send(layout('Адмінка', html, getUser(req)));
  });
});

app.post('/admin/category/add', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect('/admin');

  db.run(`INSERT INTO categories(name) VALUES (?)`, [name], (err) => {
    if (err) return res.send('Помилка додавання категорії');
    res.redirect('/admin');
  });
});

app.post('/admin/product/add', requireAdmin, upload.single('image'), (req, res) => {
  const { name, price, description, category_id } = req.body;
  const image = req.file ? req.file.filename : null;
  if (!name || !price || !category_id) return res.redirect('/admin');

  db.run(`INSERT INTO products(name, price, description, category_id, image) VALUES (?, ?, ?, ?, ?)`,
    [name, parseFloat(price), description, category_id, image], (err) => {
      if (err) return res.send('Помилка додавання товару');
      res.redirect('/admin');
    });
});

app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});
