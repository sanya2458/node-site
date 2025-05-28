const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Автоматичне створення папок
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const viewsDir = path.join(__dirname, 'views');
const publicDir = path.join(__dirname, 'public');
const imagesDir = path.join(publicDir, 'images');
const uploadsDir = path.join(publicDir, 'uploads');

ensureDir(viewsDir);
ensureDir(publicDir);
ensureDir(imagesDir);
ensureDir(uploadsDir);

// Шаблони
const templates = {
  'index.ejs': `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Онлайн магазин</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; background:#1e1e2f; color:#eee; }
  header { background:#121226; padding:15px; display:flex; align-items:center; justify-content:space-between; }
  header h1 { margin:0; font-size:24px; }
  nav button { margin-left:10px; padding:8px 12px; background:#3a3a5c; border:none; border-radius:4px; color:#eee; cursor:pointer; }
  nav button:hover { background:#4b4b7a; }
  main { padding:15px; }
  .filters { margin-bottom:15px; }
  .filters select { padding:6px; margin-right:10px; background:#33334d; color:#eee; border:none; border-radius:4px; }
  .products { display:grid; grid-template-columns: repeat(auto-fill,minmax(180px,1fr)); gap:15px; }
  .product { background:#2c2c4d; border-radius:8px; padding:10px; cursor:pointer; display:flex; flex-direction:column; }
  .product img { max-width:100%; border-radius:6px; object-fit:cover; height:120px; }
  .product .name { margin:8px 0 4px; font-weight:bold; font-size:16px; }
  .product .price { color:#aaf; font-weight:bold; }
  footer { background:#121226; text-align:center; padding:10px; margin-top:20px; font-size:14px; color:#777; }
  @media (max-width: 600px) {
    .products { grid-template-columns: repeat(auto-fill,minmax(140px,1fr)); }
    header h1 { font-size: 20px; }
  }
</style>
</head>
<body>
<header>
  <h1>Магазин</h1>
  <nav>
    <% if (user) { %>
      <button onclick="location.href='/cart'">Кошик (<%= cartCount %>)</button>
      <button onclick="location.href='/logout'">Вийти (<%= user.username %>)</button>
    <% } else { %>
      <button onclick="location.href='/login'">Увійти</button>
      <button onclick="location.href='/register'">Реєстрація</button>
    <% } %>
  </nav>
</header>
<main>
  <div class="filters">
    <form method="GET" action="/">
      <select name="category" onchange="this.form.submit()">
        <option value="">Всі категорії</option>
        <% categories.forEach(cat => { %>
          <option value="<%= cat %>" <%= cat===selectedCategory?'selected':'' %>><%= cat %></option>
        <% }) %>
      </select>
      <select name="brand" onchange="this.form.submit()">
        <option value="">Всі бренди</option>
        <% brands.forEach(br => { %>
          <option value="<%= br %>" <%= br===selectedBrand?'selected':'' %>><%= br %></option>
        <% }) %>
      </select>
    </form>
  </div>
  <div class="products">
    <% products.forEach(product => { %>
      <div class="product" onclick="location.href='/product/<%= product.id %>'">
        <img src="<%= product.images[0] %>" alt="Фото <%= product.name %>" />
        <div class="name"><%= product.name %></div>
        <div class="price"><%= product.price.toFixed(2) %> ₴</div>
      </div>
    <% }) %>
  </div>
</main>
<footer>Онлайн магазин &copy; 2025</footer>
</body>
</html>
`,
  'product.ejs': `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title><%= product.name %></title>
<style>
  body { font-family: Arial, sans-serif; margin:0; background:#1e1e2f; color:#eee; }
  header { background:#121226; padding:15px; display:flex; align-items:center; justify-content:space-between; }
  header h1 { margin:0; font-size:20px; cursor:pointer; }
  main { padding:15px; }
  .gallery { display:flex; flex-direction: column; max-width:400px; margin-bottom:20px; }
  .gallery-main { width:100%; height:300px; border-radius:8px; object-fit:contain; background:#33334d; }
  .gallery-thumbs { margin-top:10px; display:flex; gap:10px; }
  .gallery-thumbs img { width:60px; height:60px; border-radius:6px; object-fit:cover; cursor:pointer; border: 2px solid transparent; }
  .gallery-thumbs img.active { border-color:#66aaff; }
  .details { max-width:400px; }
  .details h2 { margin-top:0; }
  .details p { margin-bottom:10px; }
  button { padding:10px 15px; background:#3a3a5c; border:none; border-radius:6px; color:#eee; cursor:pointer; }
  button:hover { background:#4b4b7a; }
  footer { background:#121226; text-align:center; padding:10px; margin-top:20px; font-size:14px; color:#777; }
  @media (max-width: 600px) {
    .gallery { max-width: 100%; }
    .gallery-main { height: 250px; }
  }
</style>
</head>
<body>
<header>
  <h1 onclick="location.href='/'">← Назад</h1>
  <div>
    <% if (user) { %>
      <button onclick="location.href='/cart'">Кошик (<%= cartCount %>)</button>
      <button onclick="location.href='/logout'">Вийти (<%= user.username %>)</button>
    <% } else { %>
      <button onclick="location.href='/login'">Увійти</button>
      <button onclick="location.href='/register'">Реєстрація</button>
    <% } %>
  </div>
</header>
<main>
  <div class="gallery">
    <img id="mainImage" class="gallery-main" src="<%= product.images[0] %>" alt="Фото товару" />
    <div class="gallery-thumbs">
      <% product.images.forEach((img, i) => { %>
        <img src="<%= img %>" class="<%= i===0 ? 'active' : '' %>" onclick="setMainImage(this)" />
      <% }) %>
    </div>
  </div>
  <div class="details">
    <h2><%= product.name %></h2>
    <p><%= product.description %></p>
    <p><strong>Ціна: </strong><%= product.price.toFixed(2) %> ₴</p>
    <% if (user) { %>
      <form method="POST" action="/cart/add">
        <input type="hidden" name="id" value="<%= product.id %>" />
        <button type="submit">Додати в кошик</button>
      </form>
    <% } else { %>
      <p>Будь ласка, <a href="/login">увійдіть</a>, щоб додати товар у кошик.</p>
    <% } %>
  </div>
</main>
<footer>Онлайн магазин &copy; 2025</footer>
<script>
  function setMainImage(elem) {
    document.getElementById('mainImage').src = elem.src;
    document.querySelectorAll('.gallery-thumbs img').forEach(img => img.classList.remove('active'));
    elem.classList.add('active');
  }
</script>
</body>
</html>
`,
  'cart.ejs': `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Кошик</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; background:#1e1e2f; color:#eee; }
  header { background:#121226; padding:15px; display:flex; align-items:center; justify-content:space-between; }
  header h1 { margin:0; font-size:20px; cursor:pointer; }
  main { padding:15px; max-width:600px; margin:auto; }
  table { width: 100%; border-collapse: collapse; margin-bottom:20px; }
  th, td { padding:8px; text-align:left; border-bottom:1px solid #444466; }
  th { background:#2c2c4d; }
  button { padding:8px 12px; background:#3a3a5c; border:none; border-radius:6px; color:#eee; cursor:pointer; }
  button:hover { background:#4b4b7a; }
  footer { background:#121226; text-align:center; padding:10px; margin-top:20px; font-size:14px; color:#777; }
</style>
</head>
<body>
<header>
  <h1 onclick="location.href='/'">← Назад</h1>
  <div>
    <button onclick="location.href='/'">Головна</button>
    <button onclick="location.href='/logout'">Вийти (<%= user.username %>)</button>
  </div>
</header>
<main>
  <h2>Ваш кошик</h2>
  <% if(cart.length === 0) { %>
    <p>Кошик порожній.</p>
  <% } else { %>
    <form method="POST" action="/cart/update">
      <table>
        <thead>
          <tr>
            <th>Товар</th>
            <th>Ціна</th>
            <th>Кількість</th>
            <th>Разом</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <% cart.forEach(item => { %>
            <tr>
              <td><%= item.product.name %></td>
              <td><%= item.product.price.toFixed(2) %> ₴</td>
              <td>
                <input type="number" name="qty_<%= item.product.id %>" value="<%= item.qty %>" min="1" style="width:50px;" />
              </td>
              <td><%= (item.product.price * item.qty).toFixed(2) %> ₴</td>
              <td>
                <button name="remove" value="<%= item.product.id %>" type="submit">Видалити</button>
              </td>
            </tr>
          <% }) %>
        </tbody>
      </table>
      <p><strong>Загальна сума: <%= total.toFixed(2) %> ₴</strong></p>
      <button type="submit" name="action" value="update">Оновити кількість</button>
      <button type="submit" name="action" value="clear">Очистити кошик</button>
    </form>
  <% } %>
</main>
<footer>Онлайн магазин &copy; 2025</footer>
</body>
</html>
`,
  'login.ejs': `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Вхід</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; background:#1e1e2f; color:#eee; display:flex; justify-content:center; align-items:center; height:100vh; }
  form { background:#2c2c4d; padding:30px; border-radius:8px; width:300px; }
  label { display:block; margin-bottom:8px; }
  input { width:100%; padding:8px; margin-bottom:15px; border:none; border-radius:4px; }
  button { width:100%; padding:10px; background:#3a3a5c; border:none; border-radius:6px; color:#eee; cursor:pointer; }
  button:hover { background:#4b4b7a; }
  .error { color:#ff6666; margin-bottom:15px; }
</style>
</head>
<body>
<form method="POST" action="/login">
  <h2>Вхід</h2>
  <% if (error) { %>
    <div class="error"><%= error %></div>
  <% } %>
  <label>Логін:</label>
  <input type="text" name="username" required />
  <label>Пароль:</label>
  <input type="password" name="password" required />
  <button type="submit">Увійти</button>
  <p>Немає акаунту? <a href="/register" style="color:#66aaff;">Зареєструватися</a></p>
</form>
</body>
</html>
`,
  'register.ejs': `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Реєстрація</title>
<style>
  body { font-family: Arial, sans-serif; margin:0; background:#1e1e2f; color:#eee; display:flex; justify-content:center; align-items:center; height:100vh; }
  form { background:#2c2c4d; padding:30px; border-radius:8px; width:300px; }
  label { display:block; margin-bottom:8px; }
  input { width:100%; padding:8px; margin-bottom:15px; border:none; border-radius:4px; }
  button { width:100%; padding:10px; background:#3a3a5c; border:none; border-radius:6px; color:#eee; cursor:pointer; }
  button:hover { background:#4b4b7a; }
  .error { color:#ff6666; margin-bottom:15px; }
</style>
</head>
<body>
<form method="POST" action="/register">
  <h2>Реєстрація</h2>
  <% if (error) { %>
    <div class="error"><%= error %></div>
  <% } %>
  <label>Логін:</label>
  <input type="text" name="username" required />
  <label>Пароль:</label>
  <input type="password" name="password" required />
  <button type="submit">Зареєструватися</button>
  <p>Вже є акаунт? <a href="/login" style="color:#66aaff;">Увійти</a></p>
</form>
</body>
</html>
`
};

for (const [fileName, content] of Object.entries(templates)) {
  const filePath = path.join(viewsDir, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content.trim());
  }
}

app.set('view engine', 'ejs');
app.set('views', viewsDir);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'supersecretkey12345',
  resave: false,
  saveUninitialized: false,
}));
app.use(express
