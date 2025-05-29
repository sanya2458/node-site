/* server.js — мінімальний повністю робочий магазин Fredlos */
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
    flex-wrap: wrap;
  }
  header a {
    color: #91b2ff;
    text-decoration: none;
    font-weight: 600;
    display: inline-block;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    transition: background-color 0.3s;
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
  }
  #prev {
    left: 4px;
  }
  #next {
    right: 4px;
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: repeat(auto-fill,minmax(140px,1fr));
      gap: 0.6rem;
    }
    main {
      padding: 0.5rem;
    }
    .card img {
      aspect-ratio: 1 / 1;
      margin-bottom: 0.3rem;
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
  }
</style></head><body>
<header>
  <a href="/">Головна</a><a href="/cats">Категорії</a>
  ${u?`<a href="/cart">Кошик</a>${u.role==='admin'?'<a href="/admin">Адмін</a>':''}<a href="/logout">Вихід</a>`
      :'<a href="/login">Вхід</a> / <a href="/reg">Реєстрація</a>'}
</header>${body}</body></html>`;

/* ---------- маршрути ---------- */
app.get('/',(req,res)=>{
  db.all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img,
          IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate
          FROM products p`,[],(e,rows)=>{
    const cards=rows.map(r=>`
    <div class=card onclick="location='/prod/${r.id}'">
      ${r.img?`<img src="/public/uploads/${r.img}">`:''}
      <h3>${r.name}</h3><p>₴${r.price}</p><p>★ ${r.rate}</p>
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
        ${r.img?`<img src="/public/uploads/${r.img}">`:''}
        <h3>${r.name}</h3><p>₴${r.price}</p><p>★ ${r.rate}</p>
      </div>`).join('');
    res.send(page('Товари',`<main><div class=grid>${cards||'Нема'}</div></main>`,user(req)));
  });
});

app.get('/prod/:id',(req,res)=>{
  const id=req.params.id;
  db.get(`SELECT * FROM products WHERE id=?`,[id],(e,p)=>{
    if(!p)return res.sendStatus(404);
    db.all(`SELECT file FROM images WHERE prod=?`,[id],(e,imgs)=>{
      const slides=imgs.map((im,i)=>`<img src="/public/uploads/${im.file}" style="left:${i?'100%':'0'}">`).join('');
      db.all(`SELECT r.*,u.first,u.last FROM reviews r JOIN users u ON u.id=r.user WHERE prod=?`,[id],(e,revs)=>{
        const revHTML=revs.length?`<ul>${revs.map(r=>`<li>★${r.rating} – <b>${r.first} ${r.last}</b>: ${r.comment}</li>`).join('')}</ul>`:'Нема';
        res.send(page(p.name,`
<main>
<h2>${p.name}</h2>
<div class=slider>${slides}<button class=sbtn id=prev>&larr;</button><button class=sbtn id=next>&rarr;</button></div>
<p><b>₴${p.price}</b></p><p>${p.descr||''}</p>
<form method=POST action="/cart/add">
<input type=hidden name=pid value="${p.id}">
<button name=qty value=1>До кошика</button>
</form>
<h3>Відгуки</h3>${revHTML}
${user(req)?`<form method=POST action="/rev/${p.id}">
<select name=rating required><option value="">★</option>${[1,2,3,4,5].map(n=>`<option>${n}</option>`)}</select>
<textarea name=comment placeholder="Коментар" required></textarea>
<button>Додати відгук</button>
</form>`:''}
</main>
<script>
const slides=document.querySelectorAll('.slider img');
let cur=0;
document.getElementById('next').onclick=()=> {
  slides[cur].style.left='-100%';
  cur=(cur+1)%slides.length;
  slides[cur].style.left='0';
};
document.getElementById('prev').onclick=()=> {
  slides[cur].style.left='100%';
  cur=(cur-1+slides.length)%slides.length;
  slides[cur].style.left='0';
};
</script>
`,user(req)));
      });
    });
  });
});

app.post('/rev/:id',mustLogin,(req,res)=>{
  const uid=user(req).id;
  const pid =req.params.id;
  const rating=parseInt(req.body.rating);
  const comment=req.body.comment;
  if(!rating || !comment) return res.redirect(`/prod/${pid}`);
  db.run(`INSERT INTO reviews(prod,user,rating,comment) VALUES(?,?,?,?)`,[pid,uid,rating,comment],(e)=>{
    res.redirect(`/prod/${pid}`);
  });
});

app.get('/cart',mustLogin,(req,res)=>{
  const uid = user(req).id;
  db.all(`SELECT c.qty, p.id, p.name, p.price, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img
          FROM cart c JOIN products p ON p.id=c.pid WHERE c.uid=?`,[uid],(e,rows)=>{
    if(e) return res.sendStatus(500);
    let sum=0;
    const items=rows.map(r=>{
      sum+=r.qty*r.price;
      return `<li>${r.qty}× <a href="/prod/${r.id}">${r.name}</a> — ₴${r.price*r.qty}
      <form style="display:inline" method=POST action="/cart/rem">
      <input type=hidden name=pid value="${r.id}">
      <button>Видалити</button></form></li>`;
    }).join('');
    res.send(page('Кошик',`<main><h2>Кошик</h2>
    <ul>${items||'Порожній'}</ul>
    <p><b>Всього: ₴${sum}</b></p>
    <form method=POST action="/cart/clear"><button>Очистити кошик</button></form>
    </main>`,user(req)));
  });
});

app.post('/cart/add',mustLogin,(req,res)=>{
  const uid=user(req).id;
  const pid=parseInt(req.body.pid);
  const qty=parseInt(req.body.qty)||1;
  if(!pid || qty<1) return res.redirect('/');
  db.get(`SELECT qty FROM cart WHERE uid=? AND pid=?`,[uid,pid],(e,row)=>{
    if(row){
      db.run(`UPDATE cart SET qty=qty+? WHERE uid=? AND pid=?`,[qty,uid,pid],()=>res.redirect('/cart'));
    } else {
      db.run(`INSERT INTO cart(uid,pid,qty) VALUES(?,?,?)`,[uid,pid,qty],()=>res.redirect('/cart'));
    }
  });
});

app.post('/cart/rem',mustLogin,(req,res)=>{
  const uid=user(req).id;
  const pid=parseInt(req.body.pid);
  if(!pid) return res.redirect('/cart');
  db.run(`DELETE FROM cart WHERE uid=? AND pid=?`,[uid,pid],()=>res.redirect('/cart'));
});

app.post('/cart/clear',mustLogin,(req,res)=>{
  const uid=user(req).id;
  db.run(`DELETE FROM cart WHERE uid=?`,[uid],()=>res.redirect('/cart'));
});

/* ---------- авторизація ---------- */
app.get('/login',(req,res)=>{
  if(user(req)) return res.redirect('/');
  res.send(page('Вхід',`<main><h2>Вхід</h2>
  <form method=POST action="/login">
  <input name=email type=email placeholder="Email" required autofocus>
  <input name=pass type=password placeholder="Пароль" required>
  <button>Увійти</button></form></main>`));
});

app.post('/login',(req,res)=>{
  const {email, pass} = req.body;
  db.get(`SELECT * FROM users WHERE email=?`,[email],(e,u)=>{
    if(!u || !bcrypt.compareSync(pass,u.pass)) {
      return res.send(page('Вхід','<main><p>Неправильний email або пароль</p><a href="/login">Спробувати знову</a></main>'));
    }
    req.session.user = {id: u.id, email: u.email, first: u.first, last: u.last, role: u.role};
    res.redirect('/');
  });
});

app.get('/logout',(req,res)=>{
  req.session.destroy(()=>res.redirect('/'));
});

/* ---------- реєстрація ---------- */
app.get('/reg',(req,res)=>{
  if(user(req)) return res.redirect('/');
  res.send(page('Реєстрація',`<main><h2>Реєстрація</h2>
  <form method=POST action="/reg">
  <input name=email type=email placeholder="Email" required autofocus>
  <input name=first placeholder="Ім'я" required>
  <input name=last placeholder="Прізвище" required>
  <input name=pass type=password placeholder="Пароль" required>
  <input name=pass2 type=password placeholder="Підтвердження пароля" required>
  <button>Зареєструватися</button></form></main>`));
});

app.post('/reg',(req,res)=>{
  const {email, first, last, pass, pass2} = req.body;
  if(pass !== pass2) return res.send(page('Реєстрація','<main><p>Паролі не співпадають</p><a href="/reg">Назад</a></main>'));
  const hash = bcrypt.hashSync(pass,10);
  db.run(`INSERT INTO users(email,first,last,pass,role) VALUES(?,?,?,?,?)`,
    [email,first,last,hash,'user'],function(e){
      if(e){
        return res.send(page('Реєстрація',`<main><p>Помилка: ${e.message}</p><a href="/reg">Назад</a></main>`));
      }
      res.redirect('/login');
    });
});

/* ---------- адмін ---------- */
app.get('/admin',mustAdmin,(req,res)=>{
  // список категорій і продуктів
  db.all(`SELECT * FROM categories ORDER BY id`,[],(e,cats)=>{
    db.all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img FROM products p ORDER BY p.id`,[],(e,prods)=>{
      let catOptions = cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
      let catList = cats.map(c=>`<li>${c.id}: ${c.name}</li>`).join('');
      let prodList = prods.map(p=>`
      <li><b>${p.id}</b> ${p.name} - ₴${p.price} (Категорія ${p.cat})
      ${p.img?`<br><img src="/public/uploads/${p.img}" style="max-width:150px">`:''}
      </li>`).join('');
      res.send(page('Адмін панель',`
      <main>
      <h2>Адмін панель</h2>
      <section>
        <h3>Категорії</h3>
        <ul>${catList||'Порожньо'}</ul>
        <form method=POST action="/admin/cat">
          <input name=name placeholder="Нова категорія" required>
          <button>Додати категорію</button>
        </form>
      </section>
      <section>
        <h3>Товари</h3>
        <ul>${prodList||'Порожньо'}</ul>
        <form method=POST action="/admin/prod" enctype="multipart/form-data">
          <input name=name placeholder="Назва товару" required>
          <input name=price type=number step=0.01 min=0 placeholder="Ціна" required>
          <textarea name=descr placeholder="Опис"></textarea>
          <select name=cat required>${catOptions}</select>
          <input type=file name=img accept="image/*">
          <button>Додати товар</button>
        </form>
      </section>
      </main>`,'admin'));
    });
  });
});

app.post('/admin/cat',mustAdmin,(req,res)=>{
  const name = req.body.name.trim();
  if(!name) return res.redirect('/admin');
  db.run(`INSERT INTO categories(name) VALUES(?)`,[name],(e)=>{
    res.redirect('/admin');
  });
});

app.post('/admin/prod',mustAdmin,upload.single('img'),(req,res)=>{
  const {name, price, descr, cat} = req.body;
  if(!name || !price || !cat) return res.redirect('/admin');
  db.run(`INSERT INTO products(name,price,descr,cat) VALUES(?,?,?,?)`,
    [name, parseFloat(price), descr, parseInt(cat)], function(e){
      if(e) return res.redirect('/admin');
      if(req.file){
        db.run(`INSERT INTO images(prod,file) VALUES(?,?)`,[this.lastID,req.file.filename]);
      }
      res.redirect('/admin');
  });
});

/* ---------- запуск ---------- */
app.listen(PORT,()=>console.log(`Fredlos магазин працює на http://localhost:${PORT}`));
