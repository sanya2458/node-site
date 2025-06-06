const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secure123', resave: false, saveUninitialized: true }));

// ========== ЗМІННІ ==========
let photo = '';
let promises = 'Обіцяю покращити інфраструктуру, зробити місто чистим та безпечним.';
let votes = { yes: 0, no: 0 };
let comments = [];

// ========== ЗАВАНТАЖЕННЯ ФОТО ==========
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads'),
  filename: (_, file, cb) => cb(null, 'candidate' + path.extname(file.originalname))
});
const upload = multer({ storage });

// ========== ГОЛОВНА СТОРІНКА ==========
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <title>Кандидат на мера</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: sans-serif; margin: 0; background: #fdfdfd; color: #222; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: sticky; top: 0; }
    .burger { display: flex; flex-direction: column; cursor: pointer; }
    .burger span { width: 25px; height: 3px; margin: 3px 0; background: #333; }
    #menu { display: none; position: absolute; top: 60px; right: 1rem; background: white; border: 1px solid #ddd; border-radius: 6px; }
    #menu a { display: block; padding: 0.7rem 1rem; text-decoration: none; color: #333; }
    .container { padding: 1rem; max-width: 600px; margin: auto; }
    img { width: 100%; border-radius: 10px; margin-bottom: 1rem; }
    .promises { background: #f5f5f5; padding: 1rem; border-radius: 10px; }
    .vote { display: flex; gap: 1rem; margin: 1rem 0; justify-content: center; }
    .vote button { flex: 1; padding: 1rem; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; }
    .yes { background: #4caf50; color: white; }
    .no { background: #f44336; color: white; }
    form input, form textarea { width: 100%; padding: 0.7rem; margin: 0.5rem 0; border: 1px solid #ccc; border-radius: 5px; }
    .comment { background: #fff; padding: 0.5rem; margin-top: 0.5rem; border: 1px solid #eee; border-radius: 5px; }
    footer { text-align: center; padding: 1rem; font-size: 0.9rem; color: #777; margin-top: 2rem; }
  </style>
</head>
<body>
<header>
  <div><strong>Кандидат на мера</strong></div>
  <div class="burger" onclick="toggleMenu()">
    <span></span><span></span><span></span>
  </div>
  <div id="menu">
    <a href="/admin">Адмін</a>
  </div>
</header>

<div class="container">
  ${photo ? `<img src="${photo}" alt="Кандидат">` : ''}
  <div class="promises">
    <h3>Передвиборчі обіцянки</h3>
    <p>${promises}</p>
  </div>

  <form method="POST" action="/vote" class="vote">
    <button class="yes" name="vote" value="yes">Я за</button>
    <button class="no" name="vote" value="no">Я проти</button>
  </form>
  <p style="text-align:center;">Голосів: За — ${votes.yes}, Проти — ${votes.no}</p>

  <form method="POST" action="/comment">
    <input name="name" placeholder="Ім’я (необов’язково)">
    <textarea name="text" placeholder="Коментар..." required></textarea>
    <button type="submit">Надіслати</button>
  </form>

  ${comments.map(c => `<div class="comment"><b>${c.name}</b>: ${c.text}</div>`).join('')}
</div>

<footer>© 2025 Кандидат на мера</footer>
<script>
function toggleMenu() {
  const m = document.getElementById('menu');
  m.style.display = m.style.display === 'block' ? 'none' : 'block';
}
</script>
</body>
</html>`);
});

// ========== ОБРОБКА ГОЛОСУ ==========
app.post('/vote', (req, res) => {
  if (req.body.vote === 'yes') votes.yes++;
  else if (req.body.vote === 'no') votes.no++;
  res.redirect('/');
});

// ========== ДОДАТИ КОМЕНТАР ==========
app.post('/comment', (req, res) => {
  const name = req.body.name || 'Анонім';
  const text = req.body.text.trim();
  if (text) comments.push({ name, text });
  res.redirect('/');
});

// ========== ЛОГІН ==========
app.get('/admin', (req, res) => {
  if (req.session.admin) {
    res.send(`
      <h2>Адмін-панель</h2>
      <form method="POST" action="/update-text">
        <textarea name="promises" rows="6" style="width:300px;">${promises}</textarea><br>
        <button type="submit">Оновити обіцянки</button>
      </form><br>
      <form method="POST" action="/upload-photo" enctype="multipart/form-data">
        <input type="file" name="photo" accept="image/*" required>
        <button type="submit">Завантажити фото</button>
      </form>
      <br><a href="/">← Назад</a>
    `);
  } else {
    res.send(`
      <h2>Вхід в адмінку</h2>
      <form method="POST" action="/login">
        <input name="username" placeholder="Логін"><br>
        <input type="password" name="password" placeholder="Пароль"><br>
        <button type="submit">Увійти</button>
      </form>
    `);
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === '1234') {
    req.session.admin = true;
    res.redirect('/admin');
  } else res.send('Невірно. <a href="/admin">Назад</a>');
});

app.post('/update-text', (req, res) => {
  if (req.session.admin) {
    promises = req.body.promises || promises;
    res.redirect('/admin');
  } else res.sendStatus(403);
});

app.post('/upload-photo', upload.single('photo'), (req, res) => {
  if (req.session.admin) {
    photo = '/uploads/' + req.file.filename;
    res.redirect('/admin');
  } else res.sendStatus(403);
});

app.listen(port, () => console.log(`http://localhost:${port}`));
