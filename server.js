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
body{margin:0;font-family:Arial;background:#131a21;color:#dde1e7}
header{background:#0f1621;padding:1rem;display:flex;gap:1rem;flex-wrap:wrap}
header a{color:#6ea8ff;text-decoration:none;font-weight:600}
h1,h2,h3{margin:.5rem 0}main{padding:1rem;max-width:900px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
.card{background:#1e2630;border-radius:6px;padding:.5rem;cursor:pointer}
.card img{width:100%;border-radius:4px}button{cursor:pointer}
input,select,textarea,button{border-radius:6px;padding:.4rem;border:none}
button{background:#6ea8ff;color:#0f1621;font-weight:700}
.slider{position:relative;width:300px;height:300px;overflow:hidden;margin:0 auto 1rem}
.slider img{position:absolute;top:0;width:100%;height:100%;object-fit:contain;transition:left .4s}
.sbtn{position:absolute;top:50%;transform:translateY(-50%);background:#0f1621;color:#dde1e7;border:none}
#prev{left:4px}#next{right:4px}
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
<textarea name=comment required></textarea><button>Додати</button></form>`:'<p>Щоб залишити відгук — увійдіть</p>'}
</main>
<script>
(()=>{const imgs=[...document.querySelectorAll('.slider img')];let i=0;
const show=n=>imgs.forEach((im,idx)=>im.style.left=(idx===n?'0':'100%'));
prev.onclick=_=>{i=(i-1+imgs.length)%imgs.length;show(i)};
next.onclick=_=>{i=(i+1)%imgs.length;show(i)};
})();
</script>`,user(req)));
      });
    });
  });
});

/* ---------- відгук ---------- */
app.post('/rev/:id',(req,res)=>mustLogin(req,res,()=>{
  db.run(`INSERT INTO reviews(prod,user,rating,comment) VALUES(?,?,?,?)`,
    [req.params.id,user(req).id,req.body.rating,req.body.comment],()=>res.redirect('/prod/'+req.params.id));
}));

/* ---------- кошик ---------- */
app.post('/cart/add',(req,res)=>mustLogin(req,res,()=>{
  db.run(`INSERT INTO cart(uid,pid,qty) VALUES(?,?,1)
         ON CONFLICT(uid,pid) DO UPDATE SET qty=qty+1`,
         [user(req).id,req.body.pid],()=>res.redirect('/cart'));
}));
app.get('/cart',(req,res)=>mustLogin(req,res,()=>{
  db.all(`SELECT c.*,p.name,p.price,(SELECT file FROM images WHERE prod=p.id LIMIT 1) img
          FROM cart c JOIN products p ON p.id=c.pid WHERE uid=?`,[user(req).id],(e,rows)=>{
    const total=rows.reduce((s,r)=>s+r.price*r.qty,0);
    const list=rows.map(r=>`<div class=card style="display:flex;gap:.5rem">
      ${r.img?`<img src="/public/uploads/${r.img}" style="width:80px">`:''}
      <div><h3>${r.name}</h3><p>${r.qty} x ₴${r.price}</p></div></div>`).join('');
    res.send(page('Кошик',`<main><h2>Кошик</h2>${list||'Порожній'}<h3>Всього: ₴${total.toFixed(2)}</h3></main>`,user(req)));
  });
}));

/* ---------- авторизація ---------- */
app.get('/login',(req,res)=>res.send(page('Вхід',`
<main><form method=POST>
<input name=email placeholder="Email" required>
<input type=password name=pass placeholder="Пароль" required>
<button>Увійти</button></form></main>`)));

app.post('/login',(req,res)=>{
  db.get(`SELECT * FROM users WHERE email=?`,[req.body.email],(e,u)=>{
    if(u&&bcrypt.compareSync(req.body.pass,u.pass)){req.session.user=u;return res.redirect('/');}
    res.send(page('Помилка','<main><p>Невірні дані</p><a href=/login>Назад</a></main>'));
  });
});

app.get('/reg',(r,s)=>s.send(page('Реєстрація',`
<main><form method=POST>
<input name=first placeholder="Ім’я" required>
<input name=last placeholder="Прізвище" required>
<input name=email type=email placeholder="Email" required>
<input name=pass type=password placeholder="Пароль" required>
<button>Зареєструватись</button></form></main>`)));

app.post('/reg',(req,res)=>{
  const {first,last,email,pass}=req.body;
  db.get(`SELECT id FROM users WHERE email=?`,[email],(e,row)=>{
    if(row)return res.send(page('Є','<main>Email зайнятий</main>'));
    db.run(`INSERT INTO users(email,pass,first,last,role) VALUES(?,?,?,?,?)`,
      [email,bcrypt.hashSync(pass,10),first,last,'user'],function(){
        db.get(`SELECT * FROM users WHERE id=?`,[this.lastID],(e,u)=>{req.session.user=u;res.redirect('/')});
      });
  });
});

app.get('/logout',(r,s)=>{r.session.destroy(()=>s.redirect('/'))});

/* ---------- адмінка ---------- */
app.get('/admin',mustAdmin,(req,res)=>{
  db.all(`SELECT * FROM categories`,[],(e,cats)=>{
    db.all(`SELECT p.*,c.name cat FROM products p LEFT JOIN categories c ON c.id=p.cat`,[],(e,prods)=>{
      const catList=cats.map(c=>`<li>${c.name}
        <form style="display:inline" method=POST action="/admin/delcat">
        <input type=hidden name=id value=${c.id}><button>✖</button></form></li>`).join('');
      const prodList=prods.map(p=>`<li>${p.name} (₴${p.price}) [${p.cat||'—'}]
        <form style="display:inline" method=POST action="/admin/delprod">
        <input type=hidden name=id value=${p.id}><button>✖</button></form></li>`).join('');
      const catOpt=cats.map(c=>`<option value=${c.id}>${c.name}</option>`).join('');
      res.send(page('Адмін',`
<main>
<h2>Категорії</h2><ul>${catList||'Нема'}</ul>
<form method=POST action="/admin/addcat"><input name=name required><button>Додати</button></form>
<hr><h2>Товари</h2><ul>${prodList||'Нема'}</ul>
<form method=POST enctype="multipart/form-data" action="/admin/addprod">
<input name=name placeholder="Назва" required>
<input name=price type=number step=0.01 placeholder="Ціна" required>
<select name=cat><option value="">—</option>${catOpt}</select>
<textarea name=descr placeholder="Опис"></textarea>
<input type=file name=img multiple required accept="image/*">
<button>Додати товар</button></form>
</main>`,user(req)));
    });
  });
});

app.post('/admin/addcat',mustAdmin,(req,res)=>{
  db.run(`INSERT INTO categories(name) VALUES(?)`,[req.body.name.trim()],()=>res.redirect('/admin'));
});
app.post('/admin/delcat',mustAdmin,(req,res)=>{
  db.run(`DELETE FROM categories WHERE id=?`,[req.body.id],()=>res.redirect('/admin'));
});
app.post('/admin/addprod',mustAdmin,upload.array('img',5),(req,res)=>{
  const {name,price,descr,cat}=req.body;
  db.run(`INSERT INTO products(name,price,descr,cat) VALUES(?,?,?,?)`,
    [name,price,descr,cat||null],function(){
      req.files.forEach(f=>db.run(`INSERT INTO images(prod,file) VALUES(?,?)`,
        [this.lastID,f.filename]));
      res.redirect('/admin');
    });
});
app.post('/admin/delprod',mustAdmin,(req,res)=>{
  db.run(`DELETE FROM products WHERE id=?`,[req.body.id],()=>res.redirect('/admin'));
});

/* ---------- старт ---------- */
app.listen(PORT,()=>console.log('Fredlos запущено на',PORT));
