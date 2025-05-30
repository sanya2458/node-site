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
  ${u?`<a href="/cart">Кошик</a>${u.role==='admin'?'<a href="/admin">Адмін</a>':''}<a href="/logout">Вихід</a>`
      :'<a href="/login">Вхід</a><a href="/reg">Реєстрація</a>'}
</header>
${body}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-EL3QCTCHHX"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.del-photo').forEach(btn => {
      btn.addEventListener('click', async e => {
        const imgId = e.target.dataset.id;
        const prodId = window.location.pathname.split('/').pop();

        const res = await fetch(`/delete-photo/${prodId}/${imgId}`, { method: 'DELETE' });
        if (res.ok) {
          e.target.parentElement.remove(); // видалити фото з DOM
        } else {
          alert('Помилка видалення фото');
        }
      });
    });
  });

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-EL3QCTCHHX');
  
  // Слайдер фото товару
  let currentSlide = 0;
  function showSlide(i){
    const slides = document.querySelectorAll('.slider img');
    if (!slides.length) return;
    if(i<0) i=slides.length-1;
    if(i>=slides.length) i=0;
    currentSlide=i;
    slides.forEach((s,index)=>{
      s.style.left = (index - currentSlide) * 100 + '%';
    });
  }
  function nextSlide(){
    showSlide(currentSlide + 1);
  }
  function prevSlide(){
    showSlide(currentSlide - 1);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(document.querySelectorAll('.slider img').length){
      showSlide(0);
      document.getElementById('next')?.addEventListener('click',nextSlide);
      document.getElementById('prev')?.addEventListener('click',prevSlide);
    }
  });
</script>
</body></html>`;

/* ---------- маршрути ---------- */

app.get('/',(req,res)=>{
  db.all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img,
          IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate
          FROM products p`,[],(e,rows)=>{
    if(e) return res.sendStatus(500);
    const cards=rows.map(r=>`
    <div class=card onclick="location='/prod/${r.id}'">
      <h3>${r.name}</h3>
      ${r.img?`<img src="/public/uploads/${r.img}" alt="${r.name}">`
           :'<div style="height:150px;background:#566dff44;border-radius:4px;"></div>'}
      <div class=info>
        <p>${r.price.toFixed(2)} ₴</p>
        <p>⭐ ${r.rate}</p>
      </div>
    </div>`).join('');
    res.send(page('Головна',`<main><h1>Товари</h1><div class=grid>${cards}</div></main>`, user(req)));
  });
});

app.get('/cats', (req,res)=>{
  db.all(`SELECT * FROM categories ORDER BY name`,[],(e,cats)=>{
    if(e) return res.sendStatus(500);
    let catList = cats.map(c=>`<li><a href="/cats/${c.id}">${c.name}</a></li>`).join('');
    res.send(page('Категорії',`<main><h1>Категорії</h1><ul>${catList}</ul></main>`, user(req)));
  });
});

app.get('/cats/:id', (req,res)=>{
  const catId = req.params.id;
  db.all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img,
          IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate
          FROM products p WHERE p.cat=?`,[catId],(e,rows)=>{
    if(e) return res.sendStatus(500);
    const cards=rows.map(r=>`
    <div class=card onclick="location='/prod/${r.id}'">
      <h3>${r.name}</h3>
      ${r.img?`<img src="/public/uploads/${r.img}" alt="${r.name}">`
           :'<div style="height:150px;background:#566dff44;border-radius:4px;"></div>'}
      <div class=info>
        <p>${r.price.toFixed(2)} ₴</p>
        <p>⭐ ${r.rate}</p>
      </div>
    </div>`).join('');
    res.send(page('Товари категорії',`<main><h1>Категорія</h1><div class=grid>${cards}</div></main>`, user(req)));
  });
});

app.get('/prod/:id', (req,res)=>{
  const prodId = req.params.id;
  db.get(`SELECT p.*, IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate FROM products p WHERE p.id=?`, [prodId], (e,prod)=>{
    if(e || !prod) return res.sendStatus(404);
    db.all(`SELECT file FROM images WHERE prod=? ORDER BY id LIMIT 7`, [prodId], (e2, imgs)=>{
      if(e2) return res.sendStatus(500);
      db.all(`SELECT r.*, u.first, u.last FROM reviews r LEFT JOIN users u ON r.user=u.id WHERE r.prod=? ORDER BY r.id DESC`, [prodId], (e3, reviews)=>{
        if(e3) return res.sendStatus(500);

        const stars = (n) => '★'.repeat(n) + '☆'.repeat(5-n);

        const imgsHtml = imgs.length ? imgs.map((im,i) => `<img src="/public/uploads/${im.file}" style="left:${i*100}%" alt="Фото ${i+1}">`).join('') : `<div style="height:300px;background:#566dff44;border-radius:4px;"></div>`;

        const reviewsHtml = reviews.length ? reviews.map(r=>`
          <div class="review">
            <p><b>${r.first} ${r.last}</b> - <span class="stars">${stars(r.rating)}</span></p>
            <p>${r.comment||''}</p>
          </div>
        `).join('') : '<p>Відгуків немає</p>';

        let reviewForm = '';
        if(user(req)){
          reviewForm = `<form method="POST" action="/prod/${prodId}/review">
            <h3>Додати відгук</h3>
            <label>Рейтинг (1-5): <input type="number" name="rating" min="1" max="5" required></label>
            <label>Коментар: <textarea name="comment"></textarea></label>
            <button type="submit">Відправити</button>
          </form>`;
        } else {
          reviewForm = `<p><a href="/login">Увійдіть</a>, щоб залишити відгук.</p>`;
        }

        res.send(page(prod.name,`
          <main>
            <h1>${prod.name}</h1>
            <div class="slider">
              ${imgsHtml}
              ${imgs.length>1 ? `<button class="sbtn" id="prev">&#10094;</button><button class="sbtn" id="next">&#10095;</button>` : ''}
            </div>
            <p><b>Ціна:</b> ${prod.price.toFixed(2)} ₴</p>
            <p><b>Рейтинг:</b> ${prod.rate} ⭐</p>
            <p><b>Опис:</b> ${prod.descr || 'Немає опису'}</p>
            <section class="reviews">
              <h2>Відгуки</h2>
              ${reviewsHtml}
            </section>
            ${reviewForm}
          </main>
        `, user(req)));

      });
    });
  });
});

app.post('/prod/:id/review', mustLogin, (req,res)=>{
  const uid = user(req).id;
  const prodId = req.params.id;
  let rating = +req.body.rating;
  let comment = req.body.comment || '';
  if(rating<1) rating=1;
  if(rating>5) rating=5;

  db.run(`INSERT INTO reviews(prod,user,rating,comment) VALUES(?,?,?,?)`,
    [prodId, uid, rating, comment], (e)=>{
      if(e) return res.sendStatus(500);
      // оновлюємо середній рейтинг продукту (необов'язково)
      db.get(`SELECT ROUND(AVG(rating),1) avgR FROM reviews WHERE prod=?`, [prodId], (e,r)=>{
        if(!e && r){
          db.run(`UPDATE products SET rating=? WHERE id=?`, [r.avgR, prodId]);
        }
        res.redirect('/prod/'+prodId);
      });
    });
});

/* ---------- аутентифікація ---------- */

app.get('/login',(req,res)=>{
  res.send(page('Вхід',`
    <main>
      <h1>Вхід</h1>
      <form method="POST" action="/login">
        <input type="email" name="email" placeholder="Email" required autofocus>
        <input type="password" name="pass" placeholder="Пароль" required>
        <button>Увійти</button>
      </form>
    </main>
  `));
});

app.post('/login',(req,res)=>{
  const email = req.body.email;
  const pass = req.body.pass;
  db.get(`SELECT * FROM users WHERE email=?`, [email], (e,u)=>{
    if(e || !u) return res.redirect('/login');
    if(!bcrypt.compareSync(pass, u.pass)) return res.redirect('/login');
    req.session.user = {id: u.id, email:u.email, first:u.first, last:u.last, role:u.role};
    res.redirect('/');
  });
});

app.get('/reg',(req,res)=>{
  res.send(page('Реєстрація',`
    <main>
      <h1>Реєстрація</h1>
      <form method="POST" action="/reg">
        <input type="text" name="first" placeholder="Ім'я" required>
        <input type="text" name="last" placeholder="Прізвище" required>
        <input type="email" name="email" placeholder="Email" required>
        <input type="password" name="pass" placeholder="Пароль" required>
        <button>Зареєструватися</button>
      </form>
    </main>
  `));
});

app.post('/reg',(req,res)=>{
  const {first,last,email,pass} = req.body;
  if(!first || !last || !email || !pass) return res.redirect('/reg');
  const hash = bcrypt.hashSync(pass,10);
  db.run(`INSERT INTO users(first,last,email,pass,role) VALUES(?,?,?,?,?)`,
    [first,last,email,hash,'user'],(e)=>{
      if(e) return res.redirect('/reg');
      res.redirect('/login');
    });
});

app.get('/logout',(req,res)=>{
  req.session.destroy(()=>res.redirect('/'));
});

/* ---------- адмін ---------- */

app.get('/admin', mustAdmin, (req,res)=>{
  db.all(`SELECT * FROM categories ORDER BY name`,[],(e,cats)=>{
    if(e) return res.sendStatus(500);
    db.all(`SELECT p.*, c.name catname,
            (SELECT file FROM images WHERE prod=p.id LIMIT 1) img
            FROM products p LEFT JOIN categories c ON p.cat=c.id
            ORDER BY p.name`,[],(e2, prods)=>{
      if(e2) return res.sendStatus(500);

      let catList = cats.map(c=>`
        <li>
          ${c.name}
          <form style="display:inline" method="POST" action="/admin/cat/delete" onsubmit="return confirm('Видалити категорію?')">
            <input type="hidden" name="id" value="${c.id}">
            <button type="submit">Видалити</button>
          </form>
          <form style="display:inline" method="POST" action="/admin/cat/edit">
            <input type="hidden" name="id" value="${c.id}">
            <input type="text" name="name" value="${c.name}" required>
            <button type="submit">Редагувати</button>
          </form>
        </li>
      `).join('');

      let prodList = prods.map(p=>`
        <div style="background:#566dff44; border-radius:6px; margin-bottom:1rem; padding:0.5rem;">
          <h3>${p.name} (${p.catname||'Без категорії'})</h3>
          ${p.img?`<img src="/public/uploads/${p.img}" alt="${p.name}" style="max-width:150px;">` : ''}
          <p>Ціна: ${p.price.toFixed(2)} ₴</p>
          <p>Опис: ${p.descr?p.descr.replace(/</g,"&lt;").replace(/>/g,"&gt;") : ''}</p>
          <form style="display:inline-block" method="POST" action="/admin/prod/delete" onsubmit="return confirm('Видалити товар?')">
            <input type="hidden" name="id" value="${p.id}">
            <button>Видалити</button>
          </form>
          <button onclick="document.getElementById('edit-prod-${p.id}').style.display='block'">Редагувати</button>
          <div id="edit-prod-${p.id}" style="display:none; background:#39455a; padding:1rem; border-radius:6px; margin-top:0.5rem;">
            <form method="POST" action="/admin/prod/edit" enctype="multipart/form-data">
              <input type="hidden" name="id" value="${p.id}">
              <input type="text" name="name" value="${p.name}" required placeholder="Назва">
              <input type="number" step="0.01" min="0" name="price" value="${p.price}" required placeholder="Ціна">
              <select name="cat">
                <option value="">Без категорії</option>
                ${cats.map(c=>`<option value="${c.id}" ${p.cat===c.id?'selected':''}>${c.name}</option>`).join('')}
              </select>
              <textarea name="descr" placeholder="Опис">${p.descr || ''}</textarea>
              <label>Додати фото (до 7): <input type="file" name="photos" accept="image/*" multiple></label>
              <button type="submit">Зберегти</button>
            </form>
            <form method="POST" action="/admin/prod/imgdelete">
              <input type="hidden" name="prod" value="${p.id}">
              <p>Фото товару:</p>
              ${(() => {
                // отримати фото для продукту
                let html = '';
                const imgs = [];
                // Потрібно зробити запит за фото окремо, тому буде ajax або інший маршрут, але у адміністраторському інтерфейсі - це трішки складно, тому зробимо простіше:
                return `<p>Щоб видалити фото, зайди у адмін через інший маршрут</p>`;
              })()}
            </form>
          </div>
        </div>
      `).join('');

      res.send(page('Адмін',`
        <main>
          <h1>Адмін панель</h1>
          <section>
            <h2>Категорії</h2>
            <ul style="list-style:none; padding:0;">${catList}</ul>
            <form method="POST" action="/admin/cat/add">
              <input type="text" name="name" placeholder="Нова категорія" required>
              <button>Додати категорію</button>
            </form>
          </section>
          <section style="margin-top:2rem;">
            <h2>Товари</h2>
            <form method="POST" action="/admin/prod/add" enctype="multipart/form-data" style="margin-bottom:1rem;">
              <input type="text" name="name" placeholder="Назва" required>
              <input type="number" step="0.01" min="0" name="price" placeholder="Ціна" required>
              <select name="cat">
                <option value="">Без категорії</option>
                ${cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
              <textarea name="descr" placeholder="Опис"></textarea>
              <label>Фото (до 7): <input type="file" name="photos" accept="image/*" multiple required></label>
              <button>Додати товар</button>
            </form>
            ${prodList}
          </section>
        </main>
      `, user(req)));
    });
  });
});

/* --- Категорії --- */

app.post('/admin/cat/add', mustAdmin, (req,res)=>{
  const name = req.body.name?.trim();
  if(!name) return res.redirect('/admin');
  db.run(`INSERT INTO categories(name) VALUES(?)`, [name], (e)=>{
    res.redirect('/admin');
  });
});

app.post('/admin/cat/edit', mustAdmin, (req,res)=>{
  const id = +req.body.id;
  const name = req.body.name?.trim();
  if(!id || !name) return res.redirect('/admin');
  db.run(`UPDATE categories SET name=? WHERE id=?`, [name, id], (e)=>{
    res.redirect('/admin');
  });
});

app.post('/admin/cat/delete', mustAdmin, (req,res)=>{
  const id = +req.body.id;
  if(!id) return res.redirect('/admin');
  db.run(`DELETE FROM categories WHERE id=?`, [id], (e)=>{
    res.redirect('/admin');
  });
});

/* --- Товари --- */

app.post('/admin/prod/add', mustAdmin, upload.array('photos', 7), (req,res)=>{
  const {name, price, cat, descr} = req.body;
  if(!name || !price) return res.redirect('/admin');
  db.run(`INSERT INTO products(name,price,cat,descr,rating) VALUES(?,?,?,?,0)`,
    [name.trim(), +price, cat ? +cat : null, descr.trim()], function(e){
    if(e) return res.redirect('/admin');
    const prodId = this.lastID;
    if(req.files && req.files.length){
      const stmt = db.prepare(`INSERT INTO images(prod,file) VALUES(?,?)`);
      for(const f of req.files){
        stmt.run(prodId, f.filename);
      }
      stmt.finalize();
    }
    res.redirect('/admin');
  });
});

app.delete('/delete-photo/:prodId/:imgId', async (req, res) => {
  const { prodId, imgId } = req.params;

  try {
    const product = await db.get('SELECT images FROM products WHERE id = ?', [prodId]);
    if (!product) return res.status(404).send('Товар не знайдено');

    const imgs = JSON.parse(product.images || '[]');
    const imgToDelete = imgs.find(i => i.id == imgId);
    if (!imgToDelete) return res.status(404).send('Фото не знайдено');

    // Видаляємо файл з файлової системи
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'public/uploads', imgToDelete.file);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Оновлюємо список фото в БД
    const newImgs = imgs.filter(i => i.id != imgId);
    await db.run('UPDATE products SET images = ? WHERE id = ?', [JSON.stringify(newImgs), prodId]);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});


app.post('/admin/prod/edit', mustAdmin, upload.array('photos', 7), (req,res)=>{
  const {id, name, price, cat, descr} = req.body;
  if(!id || !name || !price) return res.redirect('/admin');
  db.run(`UPDATE products SET name=?, price=?, cat=?, descr=? WHERE id=?`,
    [name.trim(), +price, cat ? +cat : null, descr.trim(), +id], (e)=>{
    if(e) return res.redirect('/admin');
    if(req.files && req.files.length){
      // додати фото, не видаляючи старі
      const stmt = db.prepare(`INSERT INTO images(prod,file) VALUES(?,?)`);
      for(const f of req.files){
        stmt.run(+id, f.filename);
      }
      stmt.finalize();
    }
    res.redirect('/admin');
  });
});

app.post('/admin/prod/delete', mustAdmin, (req,res)=>{
  const id = +req.body.id;
  if(!id) return res.redirect('/admin');
  db.run(`DELETE FROM products WHERE id=?`, [id], (e)=>{
    if(e) return res.redirect('/admin');
    // видалити фото товару
    db.all(`SELECT file FROM images WHERE prod=?`, [id], (e2, rows)=>{
      if(!e2 && rows && rows.length){
        for(const r of rows){
          try { fs.unlinkSync(path.join(__dirname, 'public', 'uploads', r.file)); } catch{}
        }
      }
      db.run(`DELETE FROM images WHERE prod=?`, [id], (e3)=>{
        res.redirect('/admin');
      });
    });
  });
});

app.post('/admin/prod/imgdelete', mustAdmin, (req,res)=>{
  const prod = +req.body.prod;
  const file = req.body.file;
  if(!prod || !file) return res.redirect('/admin');
  db.run(`DELETE FROM images WHERE prod=? AND file=?`, [prod,file], (e)=>{
    if(!e){
      try { fs.unlinkSync(path.join(__dirname, 'public', 'uploads', file)); } catch{}
    }
    res.redirect('/admin');
  });
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`Server running on http://localhost:${port}`));
