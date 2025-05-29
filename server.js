/* server.js — Fredlos магазин (адмін CRUD, мульти‑зображення, мобільна верстка) */
const express = require('express');
const session = require('express-session');
const multer  = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- база ---------- */
const db = new sqlite3.Database('shop.db');
const run = (q, p=[])=> new Promise(r=>db.run(q,p,()=>r()));
const all = (q, p=[])=> new Promise(r=>db.all(q,p,(e,rows)=>r(rows)));
const get = (q, p=[])=> new Promise(r=>db.get(q,p,(e,row)=>r(row)));

db.serialize(async ()=>{
  db.run(`PRAGMA foreign_keys=ON`);
  await run(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,pass TEXT,first TEXT,last TEXT,role TEXT)`);
  await run(`CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE)`);
  await run(`CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT,price REAL,descr TEXT,cat INTEGER,rating REAL DEFAULT 0,FOREIGN KEY(cat) REFERENCES categories(id))`);
  await run(`CREATE TABLE IF NOT EXISTS images(id INTEGER PRIMARY KEY,prod INTEGER,file TEXT,FOREIGN KEY(prod) REFERENCES products(id) ON DELETE CASCADE)`);
  await run(`CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY,prod INTEGER,user INTEGER,rating INTEGER,comment TEXT,FOREIGN KEY(prod) REFERENCES products(id) ON DELETE CASCADE,FOREIGN KEY(user) REFERENCES users(id))`);
  await run(`CREATE TABLE IF NOT EXISTS cart(uid INTEGER,pid INTEGER,qty INTEGER,PRIMARY KEY(uid,pid))`);
  const admin = await get(`SELECT id FROM users WHERE role='admin'`);
  if(!admin){
    const hash=bcrypt.hashSync('admin',10);
    await run(`INSERT INTO users(email,pass,first,last,role) VALUES('admin@example.com',?,'Admin','Admin','admin')`,[hash]);
  }
});

/* ---------- файли ---------- */
const uploadDir = path.join(__dirname,'public','uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const storage = multer.diskStorage({
  destination:(_,__,cb)=>cb(null,uploadDir),
  filename:(_,file,cb)=>cb(null,Date.now()+"_"+file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({storage});

/* ---------- middleware ---------- */
app.use('/public',express.static('public'));
app.use(express.urlencoded({extended:true}));
app.use(session({secret:'fredlos',resave:false,saveUninitialized:false}));

const user = req=>req.session.user;
const mustLogin=(req,res,next)=> user(req)?next():res.redirect('/login');
const mustAdmin=(req,res,next)=> user(req)&&user(req).role==='admin'?next():res.sendStatus(403);

/* ---------- шаблон ---------- */
const page=(t,b,u='')=>`<!doctype html><html lang="uk"><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${t}</title><style>
body{margin:0;font-family:Arial;background:#27303f;color:#e0e3e9;text-align:center}
header{background:#3a4460;padding:1rem;display:flex;justify-content:center;gap:1rem;flex-wrap:nowrap}
header a{color:#91b2ff;text-decoration:none;font-weight:600;padding:.3rem .6rem;border-radius:6px;white-space:nowrap;transition:background .3s}
header a:hover{background:#566dff44}
main{max-width:900px;margin:0 auto;padding:1rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
.card{background:#39455a;border-radius:6px;padding:.5rem;cursor:pointer;display:flex;flex-direction:column;align-items:center}
.card img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:6px;margin-bottom:.5rem}
.info-row{display:flex;justify-content:space-between;width:100%;font-weight:700;color:#91b2ff}
button{cursor:pointer;background:#91b2ff;color:#27303f;font-weight:700;border:none;border-radius:6px;padding:.5rem 1rem;margin-top:.5rem;transition:background .3s}
button:hover{background:#6b8dff}
input,select,textarea{width:100%;max-width:300px;padding:.5rem;border:none;border-radius:6px;margin:.3rem auto;box-sizing:border-box}
textarea{resize:vertical;min-height:60px}
.slider{position:relative;width:300px;height:300px;margin:0 auto 1rem;overflow:hidden}
.slide{position:absolute;top:0;width:100%;height:100%;object-fit:contain;transition:left .4s}
.sbtn{position:absolute;top:50%;transform:translateY(-50%);background:#3a4460;color:#e0e3e9;border:none;padding:.3rem .6rem;border-radius:6px}
#prev{left:4px}#next{right:4px}
@media(max-width:600px){.grid{grid-template-columns:1fr}.card{text-align:left;padding:.8rem .6rem}.card h3{margin:.4rem 0;font-size:1.2rem;width:100%}.card img{margin-bottom:.3rem}button,input,select,textarea{max-width:100%;font-size:.9rem;padding:.4rem}}
</style></head><body>
<header><a href="/">Головна</a><a href="/cats">Категорії</a>${u?`<a href="/cart">Кошик</a>${u.role==='admin'?'<a href="/admin">Адмін</a>':''}<a href="/logout">Вийти</a>`:'<a href="/login">Вхід</a> / <a href="/reg">Реєстрація</a>'}</header>${b}</body></html>`;

/* ---------- допоміжне ---------- */
const firstImg=(imgs)=> imgs.length?imgs[0].file:null;

/* ---------- маршрути ---------- */

// Головна
app.get('/',async (req,res)=>{
  const rows=await all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img, IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate FROM products p`);
  const cards=rows.map(r=>`<div class="card" onclick="location='/prod/${r.id}'"><h3>${r.name}</h3>${r.img?`<img src="/public/uploads/${r.img}">`:''}<div class="info-row"><span>₴${r.price}</span><span>★ ${r.rate}</span></div></div>`).join('');
  res.send(page('Fredlos',`<main><div class="grid">${cards||'Нема'}</div></main>`,user(req)));
});

// Категорії
app.get('/cats',async (req,res)=>{
  const cats=await all(`SELECT * FROM categories`);
  const list=cats.map(c=>`<li><a href="/cat/${c.id}">${c.name}</a></li>`).join('');
  res.send(page('Категорії',`<main><ul>${list||'Нема'}</ul></main>`,user(req)));
});

app.get('/cat/:id',async (req,res)=>{
  const rows=await all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img, IFNULL((SELECT ROUND(AVG(rating),1) FROM reviews WHERE prod=p.id),0) rate FROM products p WHERE cat=?`,[req.params.id]);
  const cards=rows.map(r=>`<div class="card" onclick="location='/prod/${r.id}'"><h3>${r.name}</h3>${r.img?`<img src="/public/uploads/${r.img}">`:''}<div class="info-row"><span>₴${r.price}</span><span>★ ${r.rate}</span></div></div>`).join('');
  res.send(page('Товари',`<main><div class="grid">${cards||'Нема'}</div></main>`,user(req)));
});

// Сторінка товару зі слайдером
app.get('/prod/:id',async (req,res)=>{
  const p=await get(`SELECT * FROM products WHERE id=?`,[req.params.id]);
  if(!p) return res.send(page('Не знайдено','<main><h2>Товар не знайдено</h2></main>',user(req)));
  const imgs=await all(`SELECT file FROM images WHERE prod=?`,[p.id]);
  const slides=imgs.map((im,i)=>`<img class="slide" src="/public/uploads/${im.file}" style="left:${i?'100%':'0'}">`).join('');
  const reviews=await all(`SELECT r.*,u.first FROM reviews r JOIN users u ON u.id=r.user WHERE prod=?`,[p.id]);
  const revHTML=reviews.map(r=>`<p><b>${r.first}</b> ★${r.rating}<br>${r.comment}</p>`).join('')||'Нема';
  const form=user(req)?`<form method="POST" action="/review/${p.id}"><select name="rating">${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}</select><textarea name="comment" placeholder="Відгук"></textarea><button>Надіслати</button></form>`:'<p>Увійдіть щоб оцінити</p>';
  res.send(page(p.name,`<main><h2>${p.name}</h2><div class="slider">${slides}<button class="sbtn" id="prev">&#8592;</button><button class="sbtn" id="next">&#8594;</button></div><p><b>₴${p.price}</b></p><p>${p.descr||''}</p><form method="POST" action="/cart/add/${p.id}"><button>До кошика</button></form><h3>Відгуки</h3>${revHTML}${form}</main><script>const imgs=[...document.querySelectorAll('.slide')];let i=0;const show=n=>imgs.forEach((im,idx)=>im.style.left=idx===n?'0':'100%');document.getElementById('prev').onclick=_=>{i=(i-1+imgs.length)%imgs.length;show(i)};document.getElementById('next').onclick=_=>{i=(i+1)%imgs.length;show(i)};</script>`,user(req)));
});

// Review POST
app.post('/review/:id',mustLogin,async (req,res)=>{
  await run(`INSERT INTO reviews(prod,user,rating,comment) VALUES(?,?,?,?)`,[req.params.id,user(req).id,req.body.rating,req.body.comment]);
  res.redirect('/prod/'+req.params.id);
});

// Кошик
app.get('/cart',mustLogin,async (req,res)=>{
  const rows=await all(`SELECT c.qty,p.id,p.name,p.price,(SELECT file FROM images WHERE prod=p.id LIMIT 1) img FROM cart c JOIN products p ON p.id=c.pid WHERE c.uid=?`,[user(req).id]);
  const total=rows.reduce((s,r)=>s+r.price*r.qty,0);
  const items=rows.map(r=>`<div class="card" style="flex-direction:row;gap:.5rem"><img src="/public/uploads/${r.img}" style="width:80px"><div><h3>${r.name}</h3><p>${r.qty} × ₴${r.price} = ₴${(r.qty*r.price).toFixed(2)}</p></div></div>`).join('')||'Порожній';
  res.send(page('Кошик',`<main><h2>Кошик</h2>${items}<h3>Всього: ₴${total.toFixed(2)}</h3></main>`,user(req)));
});

app.post('/cart/add/:id',mustLogin,async (req,res)=>{
  await run(`INSERT INTO cart(uid,pid,qty) VALUES(?,?,1) ON CONFLICT(uid,pid) DO UPDATE SET qty=qty+1`,[user(req).id,req.params.id]);
  res.redirect('/cart');
});

// Login / Reg / Logout
app.post('/login',async (req,res)=>{
  const {email,pass}=req.body;
  const u=await get(`SELECT * FROM users WHERE email=?`,[email]);
  if(u&&bcrypt.compareSync(pass,u.pass)){req.session.user=u;res.redirect('/');}
  else res.send(page('Помилка','<main><p>Невірні дані</p></main>'));
});

app.post('/reg',async (req,res)=>{
  const {first,last,email,pass}=req.body;
  try{
    await run(`INSERT INTO users(first,last,email,pass,role) VALUES(?,?,?,?,?)`,[first,last,email,bcrypt.hashSync(pass,10),'user']);
    res.redirect('/login');
  }catch{res.send(page('Помилка','<main><p>Email зайнятий</p></main>'))}
});

app.get('/logout',(req,res)=>{req.session.destroy(()=>res.redirect('/'));});

/* ---------- Адмін ---------- */
app.get('/admin',mustAdmin,async (req,res)=>{
  const cats=await all(`SELECT * FROM categories`);
  const prods=await all(`SELECT p.*, (SELECT file FROM images WHERE prod=p.id LIMIT 1) img FROM products p`);
  const catList=cats.map(c=>`<li>${c.name} <form style="display:inline" method="POST" action="/admin/cat/del"><input type="hidden" name="id" value="${c.id}"><button>✖</button></form><form style="display:inline" method="POST" action="/admin/cat/edit"><input type="hidden" name="id" value="${c.id}"><input name="name" value="${c.name}" style="width:120px"><button>💾</button></form></li>`).join('');
  const prodList=prods.map(p=>`<li>${p.name} (₴${p.price})<form style="display:inline" enctype="multipart/form-data" method="POST" action="/admin/prod/edit/${p.id}"><input name="name" value="${p.name}" style="width:120px"><input name="price" type="number" step="0.01" value="${p.price}" style="width:80px"><button>💾</button></form><form style="display:inline" method="POST" action="/admin/prod/del"><input type="hidden" name="id" value="${p.id}"><button>✖</button></form></li>`).join('');
  const catOpts=cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  res.send(page('Адмін',`<main><h2>Категорії</h2><ul>${catList||'Нема'}</ul><form method="POST" action="/admin/cat/add"><input name="name" placeholder="Нова" required><button>Додати</button></form><hr><h2>Товари</h2><ul>${prodList||'Нема'}</ul><h3>Новий товар</h3><form method="POST" enctype="multipart/form-data" action="/admin/prod/add"><input name="name" placeholder="Назва" required><input name="price" type="number" step="0.01" placeholder="Ціна" required><textarea name="descr" placeholder="Опис"></textarea><select name="cat" required>${catOpts}</select><input type="file" name="imgs" multiple accept="image/*"><button>Додати</button></form></main>`,user(req)));
});

app.post('/admin/cat/add',mustAdmin,async (req,res)=>{await run(`INSERT INTO categories(name) VALUES(?)`,[req.body.name]);res.redirect('/admin');});
app.post('/admin/cat/edit',mustAdmin,async (req,res)=>{await run(`UPDATE categories SET name=? WHERE id=?`,[req.body.name,req.body.id]);res.redirect('/admin');});
app.post('/admin/cat/del',mustAdmin,async (req,res)=>{await run(`DELETE FROM categories WHERE id=?`,[req.body.id]);res.redirect('/admin');});

app.post('/admin/prod/add',mustAdmin,upload.array('imgs',5),async (req,res)=>{
  const {name,price,descr,cat}=req.body;
  await run(`INSERT INTO products(name,price,descr,cat) VALUES(?,?,?,?)`,[name,price,descr,cat]);
  const pid=(await get(`SELECT last_insert_rowid() as id`)).id;
  req.files.forEach(f=>run(`INSERT INTO images(prod,file) VALUES(?,?)`,[pid,path.basename(f.path)]));
  res.redirect('/admin');
});
app.post('/admin/prod/edit/:id',mustAdmin,upload.array('imgs',5),async (req,res)=>{
  const {name,price,descr,cat}=req.body;
  await run(`UPDATE products SET name=?,price=?,descr=?,cat=? WHERE id=?`,[name,price,descr,cat,req.params.id]);
  req.files.forEach(f=>run(`INSERT INTO images(prod,file) VALUES(?,?)`,[req.params.id,path.basename(f.path)]));
  res.redirect('/admin');
});
app.post('/admin/prod/del',mustAdmin,async (req,res)=>{await run(`DELETE FROM products WHERE id=?`,[req.body.id]);res.redirect('/admin');});
<form method="POST" enctype="multipart/form-data" action="/admin/prod/add">
  <input name="name" placeholder="Назва" required>
  <input name="price" type="number" step="0.01" placeholder="Ціна" required>
  <textarea name="descr" placeholder="Опис"></textarea>
  <select name="cat" required>${catOpts}</select>
  <input name="imgs" type="file" multiple required>
  <button>Додати</button>
</form></main>`, user(req)));
});

app.post('/admin/cat/add', mustAdmin, async (req, res) => {
  await run(`INSERT INTO categories(name) VALUES(?)`, [req.body.name]);
  res.redirect('/admin');
});

app.post('/admin/cat/del', mustAdmin, async (req, res) => {
  await run(`DELETE FROM categories WHERE id=?`, [req.body.id]);
  res.redirect('/admin');
});

app.post('/admin/cat/edit', mustAdmin, async (req, res) => {
  await run(`UPDATE categories SET name=? WHERE id=?`, [req.body.name, req.body.id]);
  res.redirect('/admin');
});

app.post('/admin/prod/add', mustAdmin, upload.array('imgs'), async (req, res) => {
  const { name, price, descr, cat } = req.body;
  const r = await new Promise(r => {
    db.run(`INSERT INTO products(name, price, descr, cat) VALUES(?,?,?,?)`, [name, price, descr, cat], function() {
      r(this.lastID);
    });
  });
  for (const f of req.files) {
    await run(`INSERT INTO images(prod, file) VALUES(?,?)`, [r, f.filename]);
  }
  res.redirect('/admin');
});

app.post('/admin/prod/edit/:id', mustAdmin, async (req, res) => {
  await run(`UPDATE products SET name=?, price=? WHERE id=?`, [req.body.name, req.body.price, req.params.id]);
  res.redirect('/admin');
});

app.post('/admin/prod/del', mustAdmin, async (req, res) => {
  await run(`DELETE FROM products WHERE id=?`, [req.body.id]);
  res.redirect('/admin');
});

/* ---------- запуск ---------- */
app.listen(PORT, () => console.log(`Сервер Fredlos працює на порту ${PORT}`));
