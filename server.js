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

  db.get(`SELECT id FROM users WHERE role='admin'`,(e,row)=>{
    if(!row){
      const hash=bcrypt.hashSync('admin',10);
      db.run(`INSERT INTO users(email,pass,first,last,role)
              VALUES('admin@example.com',?, 'Admin','Admin','admin')`,hash);
    }
  });
});

/* ---------- файли ---------- */
const uploadDir = path.join(__dirname,'public','uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const upload = multer({storage:multer.diskStorage({
  destination:(_,__,cb)=>cb(null,uploadDir),
  filename:(_,f,cb)=>cb(null,Date.now()+'_'+Math.round(Math.random()*1E9)+path.extname(f.originalname))
})});

/* ---------- middleware ---------- */
app.use('/public',express.static('public'));
app.use(express.urlencoded({extended:true}));
app.use(session({secret:'fredlos',resave:false,saveUninitialized:false}));

const user=(req)=>req.session.user;
const mustLogin=(r,s,n)=> user(r)?n():s.redirect('/login');
const mustAdmin=(r,s,n)=> user(r)&&user(r).role==='admin'?n():s.sendStatus(403);

/* ---------- шаблон ---------- */
const page=(title,body,u='')=>`<!doctype html><html lang="uk"><head>
<meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #27303f;
    color: #e0e3e9;
    text-align: center;
  }
  header {
    background: #3a4460;
    padding: 1rem;
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: nowrap;
  }
  header a {
    color: #91b2ff;
    text-decoration: none;
    font-weight: 600;
    display: inline-block;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    transition: background-color 0.3s;
    white-space: nowrap;
  }
  header a:hover {
    background-color: #566dff44;
  }
  h1,h2,h3 {
    margin: 0.5rem 0;
  }
  main {
    padding: 1rem;
    max-width: 900px;
    margin: 0 auto;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill,minmax(200px,1fr));
    gap: 1rem;
  }
  .card {
    background: #39455a;
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  .card img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  .card h3 {
    margin-bottom: 0.5rem;
  }
  .card .info {
    display: flex;
    justify-content: space-between;
    padding: 0 0.3rem;
  }
  button {
    cursor: pointer;
    background: #91b2ff;
    color: #27303f;
    font-weight: 700;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    margin-top: 0.5rem;
    transition: background-color 0.3s;
  }
  button:hover {
    background: #6b8dff;
  }
  input, select, textarea, button {
    border-radius: 6px;
    padding: 0.5rem;
    border: none;
    font-size: 1rem;
    width: 100%;
    max-width: 300px;
    margin: 0.3rem auto;
    display: block;
    box-sizing: border-box;
  }
  textarea {
    resize: vertical;
    min-height: 60px;
  }
  form {
    margin-top: 1rem;
  }
  .slider {
    position: relative;
    width: 300px;
    height: 300px;
    overflow: hidden;
    margin: 0 auto 1rem;
  }
  .slider img {
    position: absolute;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: left 0.4s;
  }
  .sbtn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: #3a4460;
    color: #e0e3e9;
    border: none;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.5rem;
    user-select: none;
  }
  #prev {
    left: 4px;
  }
  #next {
    right: 4px;
  }
  .reviews {
    max-width: 700px;
    margin: 1rem auto;
    text-align: left;
    background: #39455a;
    padding: 1rem;
    border-radius: 6px;
  }
  .review {
    border-bottom: 1px solid #566dff44;
    padding: 0.5rem 0;
  }
  .review:last-child {
    border-bottom: none;
  }
  .stars {
    color: #f5c518;
    font-weight: bold;
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr;
      gap: 0.6rem;
    }
    main {
      padding: 0.5rem;
    }
    .card {
      text-align: left;
    }
    .card h3 {
      order: -1;
      margin-bottom: 0.3rem;
    }
    .card img {
      aspect-ratio: auto;
      margin-bottom: 0.3rem;
      width: 100%;
    }
    .card .info {
      justify-content: space-between;
      font-weight: 700;
      font-size: 0.9rem;
      margin-top: 0.2rem;
    }
    .card .info p {
      margin: 0;
      color: #c8d1ff;
    }
    input, select, textarea, button {
      max-width: 100%;
      font-size: 0.9rem;
      padding: 0.4rem;
    }
    button {
      padding: 0.4rem 0.8rem;
    }
    .slider {
      width: 100%;
      max-width: 300px;
      height: 300px;
    }
    header {
      flex-wrap: nowrap;
    }
  }
</style>
</head><body>
<header>
  <a href="/">Головна</a><a href="/cats">Категорії</a>
  ${u?`<a href="/cart">Кошик</a>${u.role==='admin'?'<a href="/admin">Адмін</a>':''}<a href="/logout">Вихід</a><span style="color:#91b2ff;padding-left:1rem;">${u.first}</span>`:
    '<a href="/login">Вхід</a><a href="/register">Реєстрація</a>'}
</header><main>${body}</main>
</body></html>`;

/* ---------- головна сторінка ---------- */
app.get('/', (req, res) => {
  db.all(`SELECT p.id, p.name, p.price, p.rating,
          i.file FROM products p
          LEFT JOIN images i ON i.prod = p.id
          GROUP BY p.id LIMIT 20`, (e, products) => {
    if (e) return res.send('Помилка БД');
    const html = products.map(p => `
      <div class="card" onclick="location.href='/product/${p.id}'">
        ${p.file ? `<img src="/public/uploads/${p.file}" alt="Фото">` : ''}
        <h3>${p.name}</h3>
        <div class="info">
          <p>${p.price.toFixed(2)} ₴</p>
          <p>⭐${p.rating ? p.rating.toFixed(1) : '0'}</p>
        </div>
      </div>`).join('');
    res.send(page('Головна - Фредлос', `<h1>Товари</h1><div class="grid">${html}</div>`, user(req)));
  });
});

/* ---------- категорії ---------- */
app.get('/cats', (req, res) => {
  db.all(`SELECT * FROM categories ORDER BY name`, (e, cats) => {
    if (e) return res.send('Помилка БД');
    const html = cats.map(c => `<li><a href="/cat/${c.id}">${c.name}</a></li>`).join('');
    res.send(page('Категорії - Фредлос', `<h1>Категорії</h1><ul>${html}</ul>`, user(req)));
  });
});

/* ---------- товари по категорії ---------- */
app.get('/cat/:id', (req, res) => {
  const id = +req.params.id;
  db.all(`SELECT p.id, p.name, p.price, p.rating,
          i.file FROM products p
          LEFT JOIN images i ON i.prod = p.id
          WHERE p.cat=? GROUP BY p.id`, [id], (e, products) => {
    if (e) return res.send('Помилка БД');
    db.get(`SELECT name FROM categories WHERE id=?`, [id], (e2, cat) => {
      if (e2 || !cat) return res.send('Категорія не знайдена');
      const html = products.map(p => `
        <div class="card" onclick="location.href='/product/${p.id}'">
          ${p.file ? `<img src="/public/uploads/${p.file}" alt="Фото">` : ''}
          <h3>${p.name}</h3>
          <div class="info">
            <p>${p.price.toFixed(2)} ₴</p>
            <p>⭐${p.rating ? p.rating.toFixed(1) : '0'}</p>
          </div>
        </div>`).join('');
      res.send(page(`${cat.name} - Фредлос`, `<h1>Категорія: ${cat.name}</h1><div class="grid">${html}</div>`, user(req)));
    });
  });
});

/* ---------- показ одного товару з описом і відгуками ---------- */
app.get('/product/:id', (req, res) => {
  const id = +req.params.id;
  db.get(`SELECT p.*, c.name catname FROM products p
          LEFT JOIN categories c ON c.id = p.cat
          WHERE p.id=?`, [id], (e, prod) => {
    if (e || !prod) return res.send('Товар не знайдено');
    db.all(`SELECT file FROM images WHERE prod=?`, [id], (e2, imgs) => {
      if (e2) imgs = [];
      db.all(`SELECT r.rating, r.comment, u.first, u.last FROM reviews r
              LEFT JOIN users u ON u.id = r.user
              WHERE r.prod=? ORDER BY r.id DESC`, [id], (e3, revs) => {
        if (e3) revs = [];
        const imgsHtml = imgs.length ?
          `<div class="slider" id="slider">${imgs.map((im,i) =>
            `<img src="/public/uploads/${im.file}" style="left:${i*100}%">`).join('')}
            <button id="prev" class="sbtn">&#10094;</button>
            <button id="next" class="sbtn">&#10095;</button>
          </div>` : '';
        const revHtml = revs.length ? revs.map(r =>
          `<div class="review"><div class="stars">${'★'.repeat(r.rating)}</div>
           <p>${r.comment}</p><p><b>${r.first} ${r.last}</b></p></div>`).join('') :
          '<p>Відгуків поки немає.</p>';
        const cartBtn = user(req) ? `<form method="post" action="/cart/add">
          <input type="hidden" name="pid" value="${id}">
          <button type="submit">Додати в кошик</button>
        </form>` : '<p><a href="/login">Увійдіть</a>, щоб додати в кошик.</p>';

        res.send(page(prod.name + ' - Фредлос', `
          <h1>${prod.name}</h1>
          ${imgsHtml}
          <p><b>Ціна:</b> ${prod.price.toFixed(2)} ₴</p>
          <p><b>Категорія:</b> <a href="/cat/${prod.cat}">${prod.catname}</a></p>
          <p>${prod.descr}</p>
          ${cartBtn}
          <h2>Відгуки</h2>
          <div class="reviews">${revHtml}</div>
        `, user(req)));
      });
    });
  });
});

/* ---------- кошик ---------- */
app.get('/cart', mustLogin, (req, res) => {
  const uid = user(req).id;
  db.all(`SELECT c.pid, c.qty, p.name, p.price, i.file FROM cart c
          LEFT JOIN products p ON p.id = c.pid
          LEFT JOIN images i ON i.prod = p.id
          WHERE c.uid=? GROUP BY c.pid`, [uid], (e, items) => {
    if (e) return res.send('Помилка БД');
    if (items.length === 0) return res.send(page('Кошик порожній - Фредлос', '<h1>Кошик порожній</h1>', user(req)));
    const total = items.reduce((a,i)=>a+i.price*i.qty,0);
    const html = items.map(i => `
      <div class="card">
        ${i.file ? `<img src="/public/uploads/${i.file}" alt="Фото">` : ''}
        <h3>${i.name}</h3>
        <p>Ціна: ${i.price.toFixed(2)} ₴</p>
        <p>Кількість: ${i.qty}</p>
        <form method="post" action="/cart/remove" style="display:inline;">
          <input type="hidden" name="pid" value="${i.pid}">
          <button type="submit">Видалити</button>
        </form>
      </div>`).join('');
    res.send(page('Кошик - Фредлос', `<h1>Ваш кошик</h1><div class="grid">${html}</div><h3>Загалом: ${total.toFixed(2)} ₴</h3>`, user(req)));
  });
});

app.post('/cart/add', mustLogin, (req, res) => {
  const uid = user(req).id;
  const pid = +req.body.pid;
  db.get(`SELECT qty FROM cart WHERE uid=? AND pid=?`, [uid, pid], (e, row) => {
    if (e) return res.send('Помилка');
    if (row) {
      db.run(`UPDATE cart SET qty=qty+1 WHERE uid=? AND pid=?`, [uid, pid], () => res.redirect('/cart'));
    } else {
      db.run(`INSERT INTO cart(uid, pid, qty) VALUES(?,?,1)`, [uid, pid], () => res.redirect('/cart'));
    }
  });
});

app.post('/cart/remove', mustLogin, (req, res) => {
  const uid = user(req).id;
  const pid = +req.body.pid;
  db.run(`DELETE FROM cart WHERE uid=? AND pid=?`, [uid, pid], () => res.redirect('/cart'));
});

/* ---------- реєстрація ---------- */
app.get('/register', (req, res) => {
  if (user(req)) return res.redirect('/');
  res.send(page('Реєстрація - Фредлос', `
    <h1>Реєстрація</h1>
    <form method="post" action="/register">
      <input name="email" type="email" placeholder="Email" required>
      <input name="first" placeholder="Ім'я" required>
      <input name="last" placeholder="Прізвище" required>
      <input name="pass" type="password" placeholder="Пароль" required minlength="4">
      <button type="submit">Зареєструватись</button>
    </form>
  `));
});

app.post('/register', (req, res) => {
  if (user(req)) return res.redirect('/');
  const { email, first, last, pass } = req.body;
  if (!email || !first || !last || !pass) return res.send('Заповніть всі поля');
  const hash = bcrypt.hashSync(pass, 10);
  db.run(`INSERT INTO users(email, pass, first, last, role) VALUES(?,?,?,?, 'user')`,
    [email, hash, first, last], function(err) {
      if (err) return res.send('Цей email вже зареєстровано');
      req.session.user = { id: this.lastID, email, first, last, role: 'user' };
      res.redirect('/');
  });
});

/* ---------- вхід ---------- */
app.get('/login', (req, res) => {
  if (user(req)) return res.redirect('/');
  res.send(page('Вхід - Фредлос', `
    <h1>Вхід</h1>
    <form method="post" action="/login">
      <input name="email" type="email" placeholder="Email" required>
      <input name="pass" type="password" placeholder="Пароль" required minlength="4">
      <button type="submit">Увійти</button>
    </form>
  `));
});

app.post('/login', (req, res) => {
  if (user(req)) return res.redirect('/');
  const { email, pass } = req.body;
  db.get(`SELECT * FROM users WHERE email=?`, [email], (e, row) => {
    if (e || !row) return res.send('Неправильний email або пароль');
    if (bcrypt.compareSync(pass, row.pass)) {
      req.session.user = { id: row.id, email: row.email, first: row.first, last: row.last, role: row.role };
      res.redirect('/');
    } else {
      res.send('Неправильний email або пароль');
    }
  });
});

/* ---------- вихід ---------- */
app.get('/logout', (req, res) => {
  req.session.destroy(()=>res.redirect('/'));
});

/* ---------- панель адміністратора ---------- */
app.get('/admin', mustAdmin, (req, res) => {
  db.all(`SELECT * FROM categories ORDER BY name`, (e, cats) => {
    if (e) return res.send('Помилка БД');
    db.all(`SELECT p.*, c.name catname FROM products p LEFT JOIN categories c ON p.cat=c.id ORDER BY p.name`, (e2, prods) => {
      if (e2) return res.send('Помилка БД');
      const catsHtml = cats.map(c => `<li>${c.name} 
        <form method="post" action="/admin/catdel" style="display:inline;">
          <input type="hidden" name="id" value="${c.id}">
          <button type="submit" onclick="return confirm('Видалити категорію?')">Видалити</button>
        </form></li>`).join('');
      const prodsHtml = prods.map(p => `<li>${p.name} (${p.catname || 'Без категорії'}) - ${p.price.toFixed(2)} ₴
        <a href="/admin/prodedit/${p.id}">Редагувати</a>
        <form method="post" action="/admin/proddel" style="display:inline;">
          <input type="hidden" name="id" value="${p.id}">
          <button type="submit" onclick="return confirm('Видалити товар?')">Видалити</button>
        </form></li>`).join('');
      res.send(page('Адмін - Фредлос', `
        <h1>Адмін панель</h1>
        <section>
          <h2>Категорії</h2>
          <ul>${catsHtml}</ul>
          <form method="post" action="/admin/catadd">
            <input name="name" placeholder="Нова категорія" required>
            <button type="submit">Додати категорію</button>
          </form>
        </section>
        <section>
          <h2>Товари</h2>
          <a href="/admin/prodadd">Додати новий товар</a>
          <ul>${prodsHtml}</ul>
        </section>
      `, user(req)));
    });
  });
});

/* ---------- додавання категорії ---------- */
app.post('/admin/catadd', mustAdmin, (req, res) => {
  const name = req.body.name.trim();
  if (!name) return res.redirect('/admin');
  db.run(`INSERT INTO categories(name) VALUES(?)`, [name], err => {
    res.redirect('/admin');
  });
});

/* ---------- видалення категорії ---------- */
app.post('/admin/catdel', mustAdmin, (req, res) => {
  const id = +req.body.id;
  db.run(`DELETE FROM categories WHERE id=?`, [id], err => {
    res.redirect('/admin');
  });
});

/* ---------- сторінка додавання товару ---------- */
app.get('/admin/prodadd', mustAdmin, (req, res) => {
  db.all(`SELECT * FROM categories ORDER BY name`, (e, cats) => {
    if (e) return res.send('Помилка БД');
    const opts = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    res.send(page('Додати товар - Адмін - Фредлос', `
      <h1>Додати товар</h1>
      <form method="post" action="/admin/prodadd" enctype="multipart/form-data">
        <input name="name" placeholder="Назва" required>
        <input name="price" type="number" step="0.01" min="0" placeholder="Ціна" required>
        <textarea name="descr" placeholder="Опис"></textarea>
        <select name="cat">${opts}</select>
        <input type="file" name="imgs" accept="image/*" multiple>
        <button type="submit">Додати</button>
      </form>
      <p><a href="/admin">Назад</a></p>
    `, user(req)));
  });
});

/* ---------- обробка додавання товару ---------- */
app.post('/admin/prodadd', mustAdmin, upload.array('imgs', 6), (req, res) => {
  const { name, price, descr, cat } = req.body;
  db.run(`INSERT INTO products(name, price, descr, cat) VALUES(?,?,?,?)`,
    [name, price, descr, cat], function(err) {
      if (err) return res.send('Помилка додавання товару');
      const prodId = this.lastID;
      if (req.files && req.files.length > 0) {
        const stmt = db.prepare(`INSERT INTO images(prod, file) VALUES(?,?)`);
        for (const f of req.files) {
          stmt.run(prodId, f.filename);
        }
        stmt.finalize(() => res.redirect('/admin'));
      } else {
        res.redirect('/admin');
      }
    });
});

/* ---------- сторінка редагування товару ---------- */
app.get('/admin/prodedit/:id', mustAdmin, (req, res) => {
  const id = +req.params.id;
  db.get(`SELECT * FROM products WHERE id=?`, [id], (e, prod) => {
    if (e || !prod) return res.send('Товар не знайдено');
    db.all(`SELECT * FROM categories ORDER BY name`, (e2, cats) => {
      if (e2) return res.send('Помилка БД');
      db.all(`SELECT * FROM images WHERE prod=?`, [id], (e3, imgs) => {
        if (e3) imgs = [];
        const opts = cats.map(c => `<option value="${c.id}" ${c.id===prod.cat?'selected':''}>${c.name}</option>`).join('');
        const imgsHtml = imgs.map(img => `
          <div>
            <img src="/public/uploads/${img.file}" alt="Фото" style="max-width:150px;max-height:150px;">
            <form method="post" action="/admin/imgdel" style="display:inline;">
              <input type="hidden" name="id" value="${img.id}">
              <button type="submit" onclick="return confirm('Видалити фото?')">Видалити</button>
            </form>
          </div>`).join('');
        res.send(page('Редагувати товар - Адмін - Фредлос', `
          <h1>Редагувати товар</h1>
          <form method="post" action="/admin/prodedit/${id}" enctype="multipart/form-data">
            <input name="name" placeholder="Назва" value="${prod.name}" required>
            <input name="price" type="number" step="0.01" min="0" value="${prod.price}" required>
            <textarea name="descr" placeholder="Опис">${prod.descr||''}</textarea>
            <select name="cat">${opts}</select>
            <p>Існуючі фото:</p>
            ${imgsHtml || '<p>Фото немає</p>'}
            <p>Додати нові фото (максимум 6):</p>
            <input type="file" name="imgs" accept="image/*" multiple>
            <button type="submit">Зберегти</button>
          </form>
          <p><a href="/admin">Назад</a></p>
        `, user(req)));
      });
    });
  });
});

/* ---------- обробка редагування товару ---------- */
app.post('/admin/prodedit/:id', mustAdmin, upload.array('imgs', 6), (req, res) => {
  const id = +req.params.id;
  const { name, price, descr, cat } = req.body;
  db.run(`UPDATE products SET name=?, price=?, descr=?, cat=? WHERE id=?`,
    [name, price, descr, cat, id], err => {
      if (err) return res.send('Помилка оновлення товару');
      if (req.files && req.files.length > 0) {
        const stmt = db.prepare(`INSERT INTO images(prod, file) VALUES(?,?)`);
        for (const f of req.files) {
          stmt.run(id, f.filename);
        }
        stmt.finalize(() => res.redirect('/admin'));
      } else {
        res.redirect('/admin');
      }
    });
});

/* ---------- видалення фото ---------- */
app.post('/admin/imgdel', mustAdmin, (req, res) => {
  const id = +req.body.id;
  db.get(`SELECT file FROM images WHERE id=?`, [id], (e, row) => {
    if (e || !row) return res.redirect('/admin');
    const filePath = path.join(__dirname, 'public', 'uploads', row.file);
    fs.unlink(filePath, () => {
      db.run(`DELETE FROM images WHERE id=?`, [id], () => res.redirect('/admin'));
    });
  });
});

/* ---------- додавання відгуку ---------- */
app.post('/review/add', mustLogin, (req, res) => {
  const uid = user(req).id;
  const pid = +req.body.pid;
  const rating = +req.body.rating;
  const comment = req.body.comment.trim();
  if (!pid || !rating || rating < 1 || rating > 5) return res.send('Невірні дані');
  db.run(`INSERT INTO reviews(user, prod, rating, comment) VALUES(?,?,?,?)`,
    [uid, pid, rating, comment], err => {
      if (err) return res.send('Помилка додавання відгуку');
      // Оновлення рейтингу товару
      db.get(`SELECT AVG(rating) avg FROM reviews WHERE prod=?`, [pid], (e, row) => {
        if (!e && row) {
          db.run(`UPDATE products SET rating=? WHERE id=?`, [row.avg, pid]);
        }
      });
      res.redirect('/product/' + pid);
  });
});

/* ---------- запуск сервера ---------- */
app.listen(port, () => {
  console.log(`Сервер запущено на http://localhost:${port}`);
});
