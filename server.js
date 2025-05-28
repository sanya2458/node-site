const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Папки
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  })
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: false }));
app.use('/uploads', express.static(UPLOAD_DIR));

// База (в пам'яті)
let products = [];
let admin = { login: 'admin', password: '1234' };

// Сторінки
const layout = (content, admin=false) => `
<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <title>Магазин</title>
  <style>
    body { background:#121721; color:#fff; font-family:sans-serif; margin:0; padding:2rem; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:1rem; }
    .card { background:#1e2633; padding:1rem; border-radius:1rem; }
    img { max-width:100%; border-radius:0.5rem; }
    form { display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem; }
    input, textarea, select, button {
      padding:0.5rem; border-radius:0.5rem; border:none; font-size:1rem;
    }
    a { color:#4ae; text-decoration:none; }
    nav { margin-bottom:1rem; }
  </style>
</head>
<body>
  <nav>
    <a href="/">Головна</a> |
    ${admin ? `<a href="/add">Додати товар</a> | <a href="/logout">Вийти</a>` : `<a href="/login">Вхід для адміна</a>`}
  </nav>
  ${content}
</body>
</html>`;

// Головна
app.get('/', (req, res) => {
  const cards = products.map(p => `
    <div class="card">
      <img src="${p.image}" alt="">
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <b>${p.price} грн</b>
    </div>`).join('');
  res.send(layout(`<div class="grid">${cards || '<p>Товарів ще нема</p>'}</div>`, req.session.admin));
});

// Вхід
app.get('/login', (req, res) => {
  res.send(layout(`
    <h2>Вхід для адміністратора</h2>
    <form method="POST" action="/login">
      <input name="login" placeholder="Логін" required>
      <input name="password" placeholder="Пароль" type="password" required>
      <button>Увійти</button>
    </form>
  `));
});

app.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (login === admin.login && password === admin.password) {
    req.session.admin = true;
    res.redirect('/');
  } else {
    res.send(layout(`<p>Невірні дані. <a href="/login">Спробувати ще</a></p>`));
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Додати товар
app.get('/add', (req, res) => {
  if (!req.session.admin) return res.redirect('/');
  res.send(layout(`
    <h2>Додати товар</h2>
    <form method="POST" enctype="multipart/form-data" action="/add">
      <input name="name" placeholder="Назва" required>
      <textarea name="desc" placeholder="Опис" required></textarea>
      <input name="price" placeholder="Ціна" required type="number">
      <input name="image" type="file" accept="image/*" required>
      <button>Додати</button>
    </form>
  `, true));
});

app.post('/add', upload.single('image'), (req, res) => {
  if (!req.session.admin) return res.redirect('/');
  const { name, desc, price } = req.body;
  const image = '/uploads/' + req.file.filename;
  products.push({ name, desc, price, image });
  res.redirect('/');
});

app.listen(PORT, () => console.log('Сервер запущено на порту ' + PORT));
