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
  filename:(_,f,cb)=>cb(null,Date.now()+path.extname(f.originalname))
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
    flex-wrap: nowrap; /* щоб всі кнопки були в один рядок */
  }
  header a {
    color: #91b2ff;
    text-decoration: none;
    font-weight: 600;
    display: inline-block;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    transition: background-color 0.3s;
    white-space: nowrap; /* не переносити текст кнопок */
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
    align-items: center;
    text-align: center;
  }
  .card img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  /* нові стилі для мобільної версії головної сторінки */
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr !important; /* комірка по ширині сайту */
      gap: 0.6rem;
    }
    main {
      padding: 0.5rem;
    }
    .card {
      text-align: left;
      padding: 0.8rem 0.6rem;
    }
    .card h3 {
      order: -1; /* назва над фото */
      margin-bottom: 0.4rem;
      font-size: 1.2rem;
      width: 100%;
    }
    .card img {
      margin-bottom: 0.3rem;
      aspect-ratio: 1 / 1;
      width: 100%;
      border-radius: 6px;
    }
    /* контейнер для ціни та рейтингу під фото */
    .card .info-row {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-weight: 700;
      font-size: 1rem;
      color: #91b2ff;
    }
    button {
      padding: 0.4rem 0.8rem;
      max-width: 100%;
      font-size: 0.9rem;
    }
    input, select, textarea, button {
      max-width: 100%;
      font-size: 0.9rem;
      padding: 0.4rem;
    }
    .slider {
      width: 100%;
      max-width: 300px;
      height: 300px;
    }
  }
</style></head><body>
<header>
  <a href="/">Головна</a><a href="/cats">Категорії</a>
  ${u?`<a href="/cart">Кошик</a>${u.role==='admin'?'<a href="/admin">Адмін</a>':''}<a href="/logout">Вихід</a>` :'<a href="/login">Вхід</a> / <a href="/reg">Реєстрація</a>'}
</header>${body}</body></html>`;

/* ---------- маршрути ---------- */
app.get('/',(req,res)=>{
  db.all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img,
          IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate
          FROM products p`,[],(e,rows)=>{
    const cards=rows.map(r=>`
    <div class=card onclick="location='/prod/${r.id}'">
      <h3>${r.name}</h3>
      ${r.img?`<img src="/public/uploads/${r.img}">`:''}
      <div class="info-row"><span>₴${r.price}</span><span>★ ${r.rate}</span></div>
    </div>`).join('');
    res.send(page('Fredlos',`<main><h2>Товари</h2><div class=grid>${cards||'Нема'}</div></main>`,user(req)));
  });
});

app.get('/cats',(req,res)=>{
  db.all(`SELECT * FROM categories`,[],(e,cats)=>{
    const list=cats.map(c=>`<li><a href="/cat/${c.id}">${c.name}</a></li>`).join('');
    res.send(page('Категорії',`<main><h2>Категорії</h2><ul>${list||'Нема'}</ul></main>`,user(req)));
  });
});

app.get('/cat/:id',(req,res)=>{
  db.all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img,
          IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate
          FROM products p WHERE cat=?`,[req.params.id],(e,rows)=>{
    const cards=rows.map(r=>`
      <div class=card onclick="location='/prod/${r.id}'">
        <h3>${r.name}</h3>
        ${r.img?`<img src="/public/uploads/${r.img}">`:''}
        <div class="info-row"><span>₴${r.price}</span><span>★ ${r.rate}</span></div>
      </div>`).join('');
    res.send(page('Товари',`<main><h2>Категорія</h2><div class=grid>${cards||'Нема'}</div></main>`,user(req)));
  });
});

/* ---------- запуск ---------- */
app.listen(PORT,()=>console.log(`Fredlos працює на http://localhost:${PORT}`));
