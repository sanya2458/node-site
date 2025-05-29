/* server.js — мінімальний повністю робочий магазин Fredlos (з оновленими кольорами, центруванням і 1:1 фото) */
const express = require('express');
const session = require('express-session');
const multer  = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- база ---------- */
const db = new sqlite3.Database('shop.db');
db.serialize(()=>{
  db.run(`PRAGMA foreign_keys=ON`);
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY, email TEXT UNIQUE, pass TEXT,
    first TEXT, last TEXT, role TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS categories(
    id INTEGER PRIMARY KEY, name TEXT UNIQUE)`);
  db.run(`CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY, name TEXT, price REAL, descr TEXT,
    cat INTEGER, rating REAL DEFAULT 0,
    FOREIGN KEY(cat) REFERENCES categories(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS images(
    id INTEGER PRIMARY KEY, prod INTEGER, file TEXT,
    FOREIGN KEY(prod) REFERENCES products(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews(
    id INTEGER PRIMARY KEY, prod INTEGER, user INTEGER,
    rating INTEGER, comment TEXT,
    FOREIGN KEY(prod) REFERENCES products(id),
    FOREIGN KEY(user) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS cart(
    uid INTEGER, pid INTEGER, qty INTEGER, PRIMARY KEY(uid,pid))`);

  db.get(`SELECT id FROM users WHERE role='admin'`, (e, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin', 10);
      db.run(`INSERT INTO users(email,pass,first,last,role)
              VALUES('admin@example.com', ?, 'Admin','Admin','admin')`, hash);
    }
  });
});

/* ---------- файли ---------- */
const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, f, cb) => cb(null, Date.now() + path.extname(f.originalname))
  })
});

/* ---------- middleware ---------- */
app.use('/public', express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'fredlos', resave: false, saveUninitialized: false }));

const user = (req) => req.session.user;
const mustLogin = (r, s, n) => (user(r) ? n() : s.redirect('/login'));
const mustAdmin = (r, s, n) =>
  user(r) && user(r).role === 'admin' ? n() : s.sendStatus(403);

/* ---------- шаблон ---------- */
const page = (title, body, u = '') => `<!doctype html><html lang="uk"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
/* базові кольори (трохи світліші) */
:root{
  --bg:#1b2639;
  --bg-header:#182545;
  --card:#24304d;
  --accent:#7db4ff;
  --accent-text:#0f1e35;
  --link:#8db7ff;
}
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:var(--bg);color:#dde1e7;display:flex;flex-direction:column;min-height:100vh}
header{background:var(--bg-header);padding:1rem;display:flex;gap:1rem;flex-wrap:wrap;justify-content:center}
header a{color:var(--link);text-decoration:none;font-weight:600}
header a:hover{text-decoration:underline}
main{padding:1rem;width:100%;max-width:900px;margin:0 auto;text-align:center}
h1,h2,h3{margin:.5rem 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;justify-items:center}
.card{background:var(--card);border-radius:6px;padding:.5rem;width:200px;cursor:pointer;display:flex;flex-direction:column;align-items:center}
.card img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:4px}
input,select,textarea,button{border-radius:6px;padding:.4rem;border:none;font-family:inherit}
button{background:var(--accent);color:var(--accent-text);font-weight:700;cursor:pointer}
button:hover{filter:brightness(1.1)}
.slider{position:relative;width:300px;height:300px;overflow:hidden;margin:0 auto 1rem}
.slider img{position:absolute;top:0;width:100%;height:100%;object-fit:contain;transition:left .4s}
.sbtn{position:absolute;top:50%;transform:translateY(-50%);background:var(--bg-header);color:#dde1e7;border:none;padding:.3rem .5rem;border-radius:4px}
#prev{left:4px}#next{right:4px}
</style></head><body>
<header>
  <a href="/">Головна</a><a href="/cats">Категорії</a>
  ${
    u
      ? `<a href="/cart">Кошик</a>${u.role === 'admin' ? '<a href="/admin">Адмін</a>' : ''}<a href="/logout">Вийти</a>`
      : '<a href="/login">Вхід</a> / <a href="/reg">Реєстрація</a>'
  }
</header>${body}</body></html>`;

/* ---------- маршрути (логіка НЕ чіпалась) ---------- */
/* ... увесь подальший код залишається без змін ... */

/* ---------- Головна ---------- */
app.get('/', (req, res) => {
  db.all(
    `SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img,
            IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate
     FROM products p`,
    [],
    (e, rows) => {
      const cards = rows
        .map(
          (r) => `
    <div class="card" onclick="location='/prod/${r.id}'">
      ${r.img ? `<img src="/public/uploads/${r.img}" alt="">` : ''}
      <h3>${r.name}</h3>
      <p>₴${r.price}</p>
      <p>★ ${r.rate}</p>
    </div>`
        )
        .join('');
      res.send(
        page(
          'Fredlos',
          `<main><h2>Товари</h2><div class="grid">${
            cards || 'Нема'
          }</div></main>`,
          user(req)
        )
      );
    }
  );
});

/* ---------- решта маршрутів і логіки БЕЗ ЗМІН (залишити як у твоєму коді) ---------- */
/* ... (усі маршрути /cats, /cat/:id, /prod/:id, відгуки, кошик, авторизація, адмінка, старт) ... */

/* ---------- старт ---------- */
app.listen(PORT, () => console.log('Fredlos запущено на', PORT));
