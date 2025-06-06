const express = require('express');
const multer = require('multer');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();

// Автоматичне створення папок
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('public')) fs.mkdirSync('public');

fs.writeFileSync('public/style.css', `
body { font-family: sans-serif; margin: 0; background: #f9f9f9; color: #333; }
header { background: white; padding: 1em; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.burger { position: absolute; right: 1em; top: 1em; cursor: pointer; }
.burger div { width: 25px; height: 3px; background: #333; margin: 5px 0; }
nav { display: none; flex-direction: column; background: white; position: absolute; top: 60px; right: 0; width: 200px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
nav a { padding: 1em; text-decoration: none; color: #333; border-bottom: 1px solid #eee; }
.content { padding: 1em; max-width: 600px; margin: auto; }
img { max-width: 100%; border-radius: 8px; }
.vote-btn { margin: 0.5em; padding: 0.7em 1.2em; border: none; border-radius: 5px; cursor: pointer; }
.yes { background: #4caf50; color: white; }
.no { background: #f44336; color: white; }
footer { text-align: center; padding: 1em; font-size: 0.9em; color: #888; }
.comment { background: #fff; padding: 1em; margin: 0.5em 0; border-radius: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
input, textarea { width:100%;padding:0.5em;margin-bottom:0.5em;border-radius:4px;border:1px solid #ccc;box-sizing:border-box; }
`);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads'),
  filename: (_, __, cb) => cb(null, 'candidate.jpg')
});
const upload = multer({ storage });

let promisesText = 'Напишіть тут передвиборчі обіцянки кандидата.';
let votes = { yes: 0, no: 0 };
let comments = [];
let photoPath = '';

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="uk"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Передвиборча кампанія</title>
<link rel="stylesheet" href="/style.css"></head><body>
<header><h2>Кандидат на посаду мера</h2>
<div class="burger" onclick="toggleMenu()"><div></div><div></div><div></div></div>
<nav id="menu"><a href="/admin">Адмін</a></nav></header>
<div class="content">
${photoPath ? `<img src="${photoPath}" alt="Кандидат">` : ''}
<h3>Обіцянки</h3><p>${promisesText}</p>
<h3>Голосування</h3>
<form method="POST" action="/vote">
  <button class="vote-btn yes" name="vote" value="yes">Я за</button>
  <button class="vote-btn no" name="vote" value="no">Я проти</button>
</form>
<p>Підтримали: ${votes.yes}, Проти: ${votes.no}</p>
<h3>Коментарі</h3>
<form method="POST" action="/comment">
  <input name="name" placeholder="Ім’я (необов’язково)">
  <textarea name="text" placeholder="Ваш коментар" required></textarea>
  <button type="submit">Надіслати</button>
</form>
${comments.map(c => `<div class="comment"><b>${c.name || 'Анонім'}:</b> ${c.text}</div>`).join('')}
</div>
<footer>© 2025 Команда підтримки кандидата</footer>
<script>
function toggleMenu() {
  const menu = document.getElementById('menu');
  menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}
</script>
</body></html>`);
});

app.post('/vote', (req, res) => {
  const { vote } = req.body;
  if (vote === 'yes') votes.yes++;
  else if (vote === 'no') votes.no++;
  res.redirect('/');
});

app.post('/comment', (req, res) => {
  const { name, text } = req.body;
  if (text) comments.push({ name, text });
  res.redirect('/');
});

app.get('/admin', (req, res) => {
  res.send(`
  <h2>Адмін-панель</h2>
  <form method="POST" action="/admin/promises">
    <textarea name="promises" rows="5" style="width:300px;">${promisesText}</textarea><br>
    <button type="submit">Оновити обіцянки</button>
  </form>
  <br>
  <form method="POST" action="/admin/photo" enctype="multipart/form-data">
    <input type="file" name="photo" accept="image/*">
    <button type="submit">Завантажити фото</button>
  </form>
  <br><a href="/">← Назад</a>
  `);
});

app.post('/admin/promises', (req, res) => {
  promisesText = req.body.promises || promisesText;
  res.redirect('/admin');
});

app.post('/admin/photo', upload.single('photo'), (req, res) => {
  photoPath = '/uploads/' + req.file.filename;
  res.redirect('/admin');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер працює на http://localhost:${PORT}`));
