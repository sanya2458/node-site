const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: false,
}));

// ==== Дані в пам'яті ====
let users = [
  { id: 1, username: 'admin', password: 'admin', role: 'admin' }, // admin
];
let categories = [];
let products = [];
let carts = {}; // key: userId -> [{productId, quantity}]

// ==== Функції допомоги ====
function isAuth(req) { return req.session.userId != null; }
function isAdmin(req) {
  const u = users.find(u => u.id === req.session.userId);
  return u && u.role === 'admin';
}

// ==== Роутинг ====

// Головна сторінка - показує всі категорії і товари
app.get('/', (req, res) => {
  let user = users.find(u => u.id === req.session.userId);
  let cartCount = 0;
  if (user && carts[user.id]) {
    cartCount = carts[user.id].reduce((a,b) => a+b.quantity, 0);
  }
  res.send(`
<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Інтернет Магазин</title>
<style>
  body {
    margin: 0; padding: 0; font-family: Arial,sans-serif; background:#121822; color:#cfd8dc;
  }
  header {
    background: #23395d; padding: 1rem; display:flex; justify-content: space-between; align-items: center;
  }
  header nav a {
    color:#cfd8dc; text-decoration:none; margin:0 0.75rem; font-weight:bold;
    border-radius: 6px; padding: 6px 12px;
    transition: background 0.3s;
  }
  header nav a:hover {
    background: #395785;
  }
  main {
    max-width: 960px; margin: 1rem auto; padding: 0 1rem;
  }
  h1, h2 {
    color: #bbdefb;
  }
  .category-list, .product-list {
    display: flex; flex-wrap: wrap; gap: 1rem;
  }
  .category, .product {
    background: #1e2a47; border-radius: 10px; padding: 1rem; flex: 1 1 150px; box-sizing: border-box;
    min-width: 150px; color:#cfd8dc;
  }
  .product button {
    margin-top: 0.5rem; background:#395785; border:none; color:#cfd8dc; border-radius:6px;
    padding: 6px 10px; cursor:pointer;
  }
  .product button:hover {
    background:#5472d3;
  }
  footer {
    margin-top: 3rem; text-align:center; font-size:0.8rem; color:#455a64;
  }
  /* Адаптивність */
  @media (max-width: 600px) {
    header nav {
      flex-direction: column; align-items: flex-start;
    }
    .category-list, .product-list {
      flex-direction: column;
    }
  }
</style>
</head>
<body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/categories">Категорії</a>
    ${user ? `<a href="/cart">Кошик (${cartCount})</a>` : ''}
  </nav>
  <nav>
    ${user
      ? `<span style="margin-right: 1rem;">Привіт, ${user.username}</span><a href="/logout">Вийти</a>`
      : `<a href="/login">Вхід</a> | <a href="/register">Реєстрація</a>`
    }
  </nav>
</header>
<main>
  <h1>Всі товари</h1>
  <div class="product-list">
    ${products.length === 0 ? '<p>Товари відсутні</p>' : products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      return `<div class="product">
        <h3>${p.name}</h3>
        <p><i>${cat ? cat.name : 'Без категорії'}</i></p>
        <p>Ціна: ${p.price} ₴</p>
        ${user ? `<form method="POST" action="/cart/add">
          <input type="hidden" name="productId" value="${p.id}" />
          <button type="submit">Додати в кошик</button>
        </form>` : '<small>Увійдіть, щоб купувати</small>'}
      </div>`;
    }).join('')}
  </div>

  ${isAdmin(req) ? `
  <section style="margin-top: 3rem;">
    <h2>Адмін Панель</h2>
    <p>
      <a href="/admin/categories" style="color:#82b1ff;">Управління категоріями</a> | 
      <a href="/admin/products" style="color:#82b1ff;">Управління товарами</a>
    </p>
  </section>` : ''}
</main>
<footer>
  &copy; 2025 Інтернет Магазин
</footer>
</body>
</html>
  `);
});

// Сторінка реєстрації
app.get('/register', (req, res) => {
  if (isAuth(req)) return res.redirect('/');
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Реєстрація</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  form { max-width: 300px; margin: auto; background:#23395d; padding:1rem; border-radius:10px;}
  label, input {display:block; width: 100%; margin-bottom: 1rem;}
  input {padding: 8px; border-radius: 6px; border:none;}
  button {background:#395785; color:#cfd8dc; border:none; padding: 10px; border-radius: 6px; cursor:pointer;}
  button:hover {background:#5472d3;}
  a {color:#82b1ff; text-decoration:none;}
</style>
</head><body>
<h2 style="text-align:center;">Реєстрація</h2>
<form method="POST" action="/register">
  <label>Логін:<input name="username" required></label>
  <label>Пароль:<input type="password" name="password" required></label>
  <button>Зареєструватися</button>
</form>
<p style="text-align:center;"><a href="/login">Вже є аккаунт? Вхід</a></p>
</body></html>
  `);
});

app.post('/register', (req, res) => {
  if (isAuth(req)) return res.redirect('/');
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.send('<p>Користувач з таким логіном вже існує. <a href="/register">Назад</a></p>');
  }
  const newUser = { id: users.length + 1, username, password, role: 'user' };
  users.push(newUser);
  req.session.userId = newUser.id;
  res.redirect('/');
});

// Вхід
app.get('/login', (req, res) => {
  if (isAuth(req)) return res.redirect('/');
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Вхід</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  form { max-width: 300px; margin: auto; background:#23395d; padding:1rem; border-radius:10px;}
  label, input {display:block; width: 100%; margin-bottom: 1rem;}
  input {padding: 8px; border-radius: 6px; border:none;}
  button {background:#395785; color:#cfd8dc; border:none; padding: 10px; border-radius: 6px; cursor:pointer;}
  button:hover {background:#5472d3;}
  a {color:#82b1ff; text-decoration:none;}
</style>
</head><body>
<h2 style="text-align:center;">Вхід</h2>
<form method="POST" action="/login">
  <label>Логін:<input name="username" required></label>
  <label>Пароль:<input type="password" name="password" required></label>
  <button>Увійти</button>
</form>
<p style="text-align:center;"><a href="/register">Немає аккаунта? Реєстрація</a></p>
</body></html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.send('<p>Невірний логін або пароль. <a href="/login">Назад</a></p>');
  }
  req.session.userId = user.id;
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Сторінка категорій
app.get('/categories', (req, res) => {
  let user = users.find(u => u.id === req.session.userId);
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Категорії</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  header {background:#23395d; padding:1rem; display:flex; justify-content: space-between; align-items:center;}
  header nav a {color:#cfd8dc; text-decoration:none; margin:0 0.75rem; font-weight:bold; border-radius: 6px; padding: 6px 12px;}
  header nav a:hover {background: #395785;}
  main {max-width: 600px; margin: 1rem auto;}
  ul {list-style:none; padding:0;}
  li {background:#1e2a47; margin-bottom: 0.75rem; border-radius: 10px; padding: 1rem;}
  a {color:#82b1ff; text-decoration:none;}
  a:hover {text-decoration: underline;}
</style>
</head><body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/categories">Категорії</a>
  </nav>
  <nav>
    ${user ? `<span>Привіт, ${user.username}</span> | <a href="/logout">Вийти</a>` : `<a href="/login">Вхід</a>`}
  </nav>
</header>
<main>
<h1>Категорії</h1>
<ul>
  ${categories.length === 0 ? '<li>Категорії відсутні</li>' : categories.map(c => `<li>${c.name}</li>`).join('')}
</ul>
</main>
</body></html>
  `);
});

// Кошик
app.get('/cart', (req, res) => {
  if (!isAuth(req)) return res.redirect('/login');
  let user = users.find(u => u.id === req.session.userId);
  let cart = carts[user.id] || [];
  let cartItems = cart.map(ci => {
    let p = products.find(pr => pr.id === ci.productId);
    if (!p) return null;
    return { ...p, quantity: ci.quantity };
  }).filter(Boolean);

  const total = cartItems.reduce((a, i) => a + i.price * i.quantity, 0);

  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Кошик</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  header {background:#23395d; padding:1rem; display:flex; justify-content: space-between; align-items:center;}
  header nav a {color:#cfd8dc; text-decoration:none; margin:0 0.75rem; font-weight:bold; border-radius: 6px; padding: 6px 12px;}
  header nav a:hover {background: #395785;}
  main {max-width: 600px; margin: 1rem auto;}
  table {width: 100%; border-collapse: collapse;}
  th, td {padding: 8px; border-bottom: 1px solid #395785; text-align:left;}
  button {
    background:#395785; border:none; color:#cfd8dc; border-radius:6px;
    padding: 6px 10px; cursor:pointer;
  }
  button:hover {
    background:#5472d3;
  }
</style>
</head><body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/categories">Категорії</a>
    <a href="/cart">Кошик</a>
  </nav>
  <nav>
    <span>Привіт, ${user.username}</span> | <a href="/logout">Вийти</a>
  </nav>
</header>
<main>
<h1>Кошик</h1>
${cartItems.length === 0 ? '<p>Кошик порожній.</p>' : `
<table>
  <thead><tr><th>Товар</th><th>Ціна</th><th>Кількість</th><th>Разом</th><th>Дія</th></tr></thead>
  <tbody>
    ${cartItems.map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.price} ₴</td>
        <td>${i.quantity}</td>
        <td>${i.price * i.quantity} ₴</td>
        <td>
          <form style="display:inline;" method="POST" action="/cart/remove">
            <input type="hidden" name="productId" value="${i.id}" />
            <button type="submit">Видалити</button>
          </form>
        </td>
      </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr><td colspan="3" style="text-align:right;"><strong>Всього:</strong></td><td colspan="2">${total} ₴</td></tr>
  </tfoot>
</table>
<button onclick="alert('Оплата ще не реалізована')">Оплатити</button>
`}
</main>
</body>
</html>
  `);
});

app.post('/cart/add', (req, res) => {
  if (!isAuth(req)) return res.redirect('/login');
  let user = users.find(u => u.id === req.session.userId);
  const productId = Number(req.body.productId);
  if (!products.find(p => p.id === productId)) return res.redirect('/');

  if (!carts[user.id]) carts[user.id] = [];
  let item = carts[user.id].find(ci => ci.productId === productId);
  if (item) item.quantity++;
  else carts[user.id].push({ productId, quantity: 1 });
  res.redirect('back');
});

app.post('/cart/remove', (req, res) => {
  if (!isAuth(req)) return res.redirect('/login');
  let user = users.find(u => u.id === req.session.userId);
  const productId = Number(req.body.productId);
  if (!carts[user.id]) return res.redirect('/cart');
  carts[user.id] = carts[user.id].filter(ci => ci.productId !== productId);
  res.redirect('/cart');
});

// === Адмін: Управління категоріями ===
app.get('/admin/categories', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Адмін - Категорії</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  header {background:#23395d; padding:1rem; display:flex; justify-content: space-between; align-items:center;}
  header nav a {color:#cfd8dc; text-decoration:none; margin:0 0.75rem; font-weight:bold; border-radius: 6px; padding: 6px 12px;}
  header nav a:hover {background: #395785;}
  main {max-width: 600px; margin: 1rem auto;}
  ul {list-style:none; padding:0;}
  li {background:#1e2a47; margin-bottom: 0.75rem; border-radius: 10px; padding: 1rem; display:flex; justify-content: space-between; align-items: center;}
  form {display:inline;}
  button {
    background:#395785; border:none; color:#cfd8dc; border-radius:6px;
    padding: 6px 10px; cursor:pointer;
  }
  button:hover {
    background:#5472d3;
  }
  input[type=text] {
    padding: 6px; border-radius:6px; border:none; width: 80%;
    margin-right: 1rem;
  }
</style>
</head><body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/admin/categories">Категорії</a>
    <a href="/admin/products">Товари</a>
  </nav>
  <nav>
    <a href="/logout">Вийти</a>
  </nav>
</header>
<main>
<h1>Управління категоріями</h1>
<ul>
  ${categories.length === 0 ? '<li>Категорії відсутні</li>' : categories.map(c => `
    <li>
      <form method="POST" action="/admin/categories/edit" style="flex-grow:1; margin-right: 1rem;">
        <input type="hidden" name="id" value="${c.id}" />
        <input type="text" name="name" value="${c.name}" required />
        <button type="submit">Змінити</button>
      </form>
      <form method="POST" action="/admin/categories/delete" onsubmit="return confirm('Видалити категорію?');">
        <input type="hidden" name="id" value="${c.id}" />
        <button type="submit">Видалити</button>
      </form>
    </li>
  `).join('')}
</ul>
<h2>Додати нову категорію</h2>
<form method="POST" action="/admin/categories/add">
  <input type="text" name="name" placeholder="Назва категорії" required />
  <button>Додати</button>
</form>
</main>
</body>
</html>
  `);
});

app.post('/admin/categories/add', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  const name = req.body.name.trim();
  if (name) {
    categories.push({ id: categories.length + 1, name });
  }
  res.redirect('/admin/categories');
});

app.post('/admin/categories/edit', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  const id = Number(req.body.id);
  const name = req.body.name.trim();
  let cat = categories.find(c => c.id === id);
  if (cat && name) {
    cat.name = name;
  }
  res.redirect('/admin/categories');
});

app.post('/admin/categories/delete', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  const id = Number(req.body.id);
  categories = categories.filter(c => c.id !== id);
  // Видалити товари цієї категорії
  products = products.filter(p => p.categoryId !== id);
  res.redirect('/admin/categories');
});

// === Адмін: Управління товарами ===
app.get('/admin/products', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Адмін - Товари</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  header {background:#23395d; padding:1rem; display:flex; justify-content: space-between; align-items:center;}
  header nav a {color:#cfd8dc; text-decoration:none; margin:0 0.75rem; font-weight:bold; border-radius: 6px; padding: 6px 12px;}
  header nav a:hover {background: #395785;}
  main {max-width: 800px; margin: 1rem auto;}
  table {width: 100%; border-collapse: collapse;}
  th, td {padding: 8px; border-bottom: 1px solid #395785; text-align:left;}
  form {margin: 0;}
  input[type=text], input[type=number], select {
    padding: 6px; border-radius:6px; border:none; width: 100%;
  }
  button {
    background:#395785; border:none; color:#cfd8dc; border-radius:6px;
    padding: 6px 10px; cursor:pointer;
  }
  button:hover {
    background:#5472d3;
  }
</style>
</head><body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/admin/categories">Категорії</a>
    <a href="/admin/products">Товари</a>
  </nav>
  <nav>
    <a href="/logout">Вийти</a>
  </nav>
</header>
<main>
<h1>Управління товарами</h1>
<table>
  <thead>
    <tr>
      <th>Назва</th>
      <th>Категорія</th>
      <th>Ціна (₴)</th>
      <th>Дія</th>
    </tr>
  </thead>
  <tbody>
    ${products.length === 0 ? `<tr><td colspan="4">Товари відсутні</td></tr>` : products.map(p => {
      const cat = categories.find(c => c.id === p.categoryId);
      return `
      <tr>
        <form method="POST" action="/admin/products/edit">
          <td><input type="text" name="name" value="${p.name}" required /></td>
          <td>
            <select name="categoryId" required>
              ${categories.map(c => `<option value="${c.id}" ${c.id === p.categoryId ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </td>
          <td><input type="number" name="price" value="${p.price}" min="0" required /></td>
          <td>
            <input type="hidden" name="id" value="${p.id}" />
            <button type="submit">Змінити</button>
        </form>
        <form method="POST" action="/admin/products/delete" style="display:inline;" onsubmit="return confirm('Видалити товар?');">
          <input type="hidden" name="id" value="${p.id}" />
          <button type="submit">Видалити</button>
        </form>
          </td>
      </tr>
      `;
    }).join('')}
  </tbody>
</table>

<h2>Додати новий товар</h2>
<form method="POST" action="/admin/products/add" style="max-width: 400px;">
  <input type="text" name="name" placeholder="Назва товару" required style="margin-bottom: 0.5rem; width: 100%; padding: 6px; border-radius:6px; border:none;" />
  <select name="categoryId" required style="margin-bottom: 0.5rem; width: 100%; padding: 6px; border-radius:6px; border:none;">
    <option value="" disabled selected>Оберіть категорію</option>
    ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
  </select>
  <input type="number" name="price" placeholder="Ціна" min="0" required style="margin-bottom: 0.5rem; width: 100%; padding: 6px; border-radius:6px; border:none;" />
  <button>Додати</button>
</form>
</main>
</body>
</html>
  `);
});

app.post('/admin/products/add', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  const { name, categoryId, price } = req.body;
  if (!name || !categoryId || isNaN(price)) return res.redirect('/admin/products');
  const catId = Number(categoryId);
  if (!categories.find(c => c.id === catId)) return res.redirect('/admin/products');
  products.push({
    id: products.length + 1,
    name: name.trim(),
    categoryId: catId,
    price: Number(price),
  });
  res.redirect('/admin/products');
});

app.post('/admin/products/edit', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  const { id, name, categoryId, price } = req.body;
  const productId = Number(id);
  const catId = Number(categoryId);
  if (!name || !categoryId || isNaN(price)) return res.redirect('/admin/products');
  let prod = products.find(p => p.id === productId);
  if (prod) {
    prod.name = name.trim();
    if (categories.find(c => c.id === catId)) prod.categoryId = catId;
    prod.price = Number(price);
  }
  res.redirect('/admin/products');
});

app.post('/admin/products/delete', (req, res) => {
  if (!isAdmin(req)) return res.status(403).send('Доступ заборонено');
  const id = Number(req.body.id);
  products = products.filter(p => p.id !== id);
  res.redirect('/admin/products');
});

// === Користувачі: реєстрація, вхід, вихід ===
app.get('/login', (req, res) => {
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Вхід</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  main {max-width: 400px; margin: 2rem auto; background:#23395d; border-radius: 10px; padding: 1.5rem;}
  input, button {
    width: 100%; margin-bottom: 1rem; padding: 0.5rem; border-radius: 6px; border:none;
  }
  input {background:#395785; color:#cfd8dc;}
  button {
    background:#5472d3; color:#cfd8dc; font-weight: bold; cursor:pointer;
  }
  button:hover {background:#395785;}
  a {color:#a5c1f0; text-decoration:none;}
  a:hover {text-decoration:underline;}
  header {background:#23395d; padding:1rem; text-align:center;}
</style>
</head><body>
<header><h1>Вхід</h1></header>
<main>
<form method="POST" action="/login">
  <input type="text" name="username" placeholder="Логін" required autofocus />
  <input type="password" name="password" placeholder="Пароль" required />
  <button>Увійти</button>
</form>
<p>Немає акаунту? <a href="/register">Зареєструватись</a></p>
</main>
</body>
</html>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.send('<p>Невірний логін або пароль. <a href="/login">Спробувати ще</a></p>');
  }
  req.session.userId = user.id;
  req.session.isAdmin = user.isAdmin;
  res.redirect('/');
});

app.get('/register', (req, res) => {
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Реєстрація</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:1rem;}
  main {max-width: 400px; margin: 2rem auto; background:#23395d; border-radius: 10px; padding: 1.5rem;}
  input, button {
    width: 100%; margin-bottom: 1rem; padding: 0.5rem; border-radius: 6px; border:none;
  }
  input {background:#395785; color:#cfd8dc;}
  button {
    background:#5472d3; color:#cfd8dc; font-weight: bold; cursor:pointer;
  }
  button:hover {background:#395785;}
  a {color:#a5c1f0; text-decoration:none;}
  a:hover {text-decoration:underline;}
  header {background:#23395d; padding:1rem; text-align:center;}
</style>
</head><body>
<header><h1>Реєстрація</h1></header>
<main>
<form method="POST" action="/register">
  <input type="text" name="username" placeholder="Логін" required autofocus />
  <input type="password" name="password" placeholder="Пароль" required />
  <button>Зареєструватись</button>
</form>
<p>Вже є акаунт? <a href="/login">Увійти</a></p>
</main>
</body>
</html>
  `);
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (users.find(u => u.username === username)) {
    return res.send('<p>Користувач з таким логіном вже існує. <a href="/register">Спробувати інший</a></p>');
  }
  users.push({
    id: users.length + 1,
    username: username.trim(),
    password,
    isAdmin: false,
  });
  res.redirect('/login');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// === Головна сторінка ===
app.get('/', (req, res) => {
  const user = currentUser(req);
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Інтернет-магазин</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:0;}
  header {
    background:#23395d;
    padding: 1rem 2rem;
    display:flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 0 0 15px 15px;
  }
  nav a {
    color:#cfd8dc;
    text-decoration:none;
    margin: 0 1rem;
    font-weight: 600;
    border-radius: 10px;
    padding: 8px 16px;
  }
  nav a:hover {
    background:#395785;
  }
  main {max-width: 900px; margin: 2rem auto; padding: 0 1rem;}
  h1 {margin-bottom: 1rem;}
  .categories, .products {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .category, .product {
    background: #1e2a47;
    border-radius: 12px;
    padding: 1rem;
    flex: 1 1 calc(25% - 1rem);
    box-sizing: border-box;
    min-width: 150px;
    color: #cfd8dc;
  }
  .product button {
    background:#395785; border:none; color:#cfd8dc; border-radius:6px;
    padding: 6px 10px; cursor:pointer;
    margin-top: 0.5rem;
    width: 100%;
  }
  .product button:hover {
    background:#5472d3;
  }
  @media(max-width: 700px) {
    .category, .product {
      flex: 1 1 calc(50% - 1rem);
    }
  }
  @media(max-width: 400px) {
    .category, .product {
      flex: 1 1 100%;
    }
  }
</style>
</head><body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/categories">Категорії</a>
  </nav>
  <nav>
    ${user ? `
      <a href="/cart">Кошик</a>
      <a href="/logout">Вийти (${user.username}${user.isAdmin ? ' (адмін)' : ''})</a>
      ${user.isAdmin ? `<a href="/admin/categories">Адмін панель</a>` : ''}
    ` : `
      <a href="/login">Вхід</a>
      <a href="/register">Реєстрація</a>
    `}
  </nav>
</header>
<main>
<h1>Категорії товарів</h1>
<div class="categories">
  ${categories.length === 0 ? '<p>Категорії відсутні</p>' : categories.map(c => `
    <div class="category">
      <a href="/categories/${c.id}" style="color:#a5c1f0; text-decoration:none;">${c.name}</a>
    </div>
  `).join('')}
</div>
<h1>Нові товари</h1>
<div class="products">
  ${products.slice(-8).map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    return `
    <div class="product">
      <strong>${p.name}</strong>
      <p>Категорія: ${cat ? cat.name : 'Немає'}</p>
      <p>Ціна: ${p.price} ₴</p>
      ${user ? `<form method="POST" action="/cart/add">
        <input type="hidden" name="productId" value="${p.id}" />
        <button>Додати в кошик</button>
      </form>` : '<p><em>Увійдіть, щоб додавати в кошик</em></p>'}
    </div>`;
  }).join('')}
</div>
</main>
</body>
</html>
  `);
});

// === Перегляд категорії ===
app.get('/categories', (req, res) => {
  res.redirect('/');
});

app.get('/categories/:id', (req, res) => {
  const catId = Number(req.params.id);
  const category = categories.find(c => c.id === catId);
  if (!category) return res.status(404).send('Категорія не знайдена');
  const prods = products.filter(p => p.categoryId === catId);
  const user = currentUser(req);
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Категорія: ${category.name}</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:0;}
  header {
    background:#23395d;
    padding: 1rem 2rem;
    display:flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 0 0 15px 15px;
  }
  nav a {
    color:#cfd8dc;
    text-decoration:none;
    margin: 0 1rem;
    font-weight: 600;
    border-radius: 10px;
    padding: 8px 16px;
  }
  nav a:hover {
    background:#395785;
  }
  main {max-width: 900px; margin: 2rem auto; padding: 0 1rem;}
  .products {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .product {
    background: #1e2a47;
    border-radius: 12px;
    padding: 1rem;
    flex: 1 1 calc(25% - 1rem);
    box-sizing: border-box;
    min-width: 150px;
    color: #cfd8dc;
  }
  .product button {
    background:#395785; border:none; color:#cfd8dc; border-radius:6px;
    padding: 6px 10px; cursor:pointer;
    margin-top: 0.5rem;
    width: 100%;
  }
  .product button:hover {
    background:#5472d3;
  }
  @media(max-width: 700px) {
    .product {
      flex: 1 1 calc(50% - 1rem);
    }
  }
  @media(max-width: 400px) {
    .product {
      flex: 1 1 100%;
    }
  }
</style>
</head><body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/categories">Категорії</a>
  </nav>
  <nav>
    ${user ? `
      <a href="/cart">Кошик</a>
      <a href="/logout">Вийти (${user.username}${user.isAdmin ? ' (адмін)' : ''})</a>
      ${user.isAdmin ? `<a href="/admin/categories">Адмін панель</a>` : ''}
    ` : `
      <a href="/login">Вхід</a>
      <a href="/register">Реєстрація</a>
    `}
  </nav>
</header>
<main>
<h1>Категорія: ${category.name}</h1>
<div class="products">
  ${prods.length === 0 ? '<p>Товари відсутні</p>' : prods.map(p => `
    <div class="product">
      <strong>${p.name}</strong>
      <p>Ціна: ${p.price} ₴</p>
      ${user ? `<form method="POST" action="/cart/add">
        <input type="hidden" name="productId" value="${p.id}" />
        <button>Додати в кошик</button>
      </form>` : '<p><em>Увійдіть, щоб додавати в кошик</em></p>'}
    </div>
  `).join('')}
</div>
</main>
</body>
</html>
  `);
});

// === Кошик ===
app.get('/cart', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  const cart = carts[user.id] || [];
  const cartItems = cart.map(item => {
    const prod = products.find(p => p.id === item.productId);
    return {
      ...item,
      product: prod,
    };
  }).filter(i => i.product);
  const total = cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  res.send(`
<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Кошик</title>
<style>
  body {background:#121822; color:#cfd8dc; font-family: Arial,sans-serif; margin:0; padding:0;}
  header {
    background:#23395d;
    padding: 1rem 2rem;
    display:flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 0 0 15px 15px;
  }
  nav a {
    color:#cfd8dc;
    text-decoration:none;
    margin: 0 1rem;
    font-weight: 600;
    border-radius: 10px;
    padding: 8px 16px;
  }
  nav a:hover {
    background:#395785;
  }
  main {max-width: 900px; margin: 2rem auto; padding: 0 1rem;}
  table {
    width: 100%; border-collapse: collapse;
  }
  th, td {
    padding: 10px; border-bottom: 1px solid #395785; text-align:left;
  }
  input[type=number] {
    width: 60px; padding: 6px; border-radius: 6px; border:none; background:#395785; color:#cfd8dc;
  }
  button {
    background:#395785; border:none; color:#cfd8dc; border-radius:6px;
    padding: 6px 12px; cursor:pointer;
  }
  button:hover {
    background:#5472d3;
  }
</style>
</head><body>
<header>
  <nav>
    <a href="/">Головна</a>
    <a href="/categories">Категорії</a>
  </nav>
  <nav>
    <a href="/logout">Вийти (${user.username}${user.isAdmin ? ' (адмін)' : ''})</a>
  </nav>
</header>
<main>
<h1>Кошик</h1>
${cartItems.length === 0 ? '<p>Кошик порожній</p>' : `
<form method="POST" action="/cart/update">
<table>
  <thead>
    <tr><th>Товар</th><th>Ціна (₴)</th><th>Кількість</th><th>Разом (₴)</th><th>Дія</th></tr>
  </thead>
  <tbody>
  ${cartItems.map(i => `
    <tr>
      <td>${i.product.name}</td>
      <td>${i.product.price}</td>
      <td><input type="number" name="quantities[${i.product.id}]" value="${i.quantity}" min="1" /></td>
      <td>${i.product.price * i.quantity}</td>
      <td>
        <form method="POST" action="/cart/remove" style="margin:0;">
          <input type="hidden" name="productId" value="${i.product.id}" />
          <button type="submit">Видалити</button>
        </form>
      </td>
    </tr>
  `).join('')}
  </tbody>
</table>
<p><strong>Загальна сума: ${total} ₴</strong></p>
<button>Оновити кількість</button>
</form>
`}
</main>
</body>
</html>
  `);
});

app.post('/cart/add', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  const productId = Number(req.body.productId);
  const product = products.find(p => p.id === productId);
  if (!product) return res.redirect('/');
  if (!carts[user.id]) carts[user.id] = [];
  const cart = carts[user.id];
  const cartItem = cart.find(i => i.productId === productId);
  if (cartItem) {
    cartItem.quantity++;
  } else {
    cart.push({ productId, quantity: 1 });
  }
  res.redirect('back');
});

app.post('/cart/update', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  const quantities = req.body.quantities || {};
  const cart = carts[user.id] || [];
  for (const productIdStr in quantities) {
    const productId = Number(productIdStr);
    const quantity = Number(quantities[productIdStr]);
    if (quantity > 0) {
      const cartItem = cart.find(i => i.productId === productId);
      if (cartItem) cartItem.quantity = quantity;
    }
  }
  res.redirect('/cart');
});

app.post('/cart/remove', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  const productId = Number(req.body.productId);
  if (!carts[user.id]) return res.redirect('/cart');
  carts[user.id] = carts[user.id].filter(i => i.productId !== productId);
  res.redirect('/cart');
});

function currentUser(req) {
  const id = req.session.userId;
  if (!id) return null;
  return users.find(u => u.id === id) || null;
}

function isAdmin(req) {
  return req.session.isAdmin === true;
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
