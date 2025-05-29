/* ---------- server.js -------------------------------------------------- */
const express = require('express');
const session = require('express-session');
const multer  = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- База даних -------------------------------------------------- */
const dbFile = path.join(__dirname, 'shop.db');
const db     = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);
  db.run(`CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE, password TEXT, role TEXT
          )`);
  db.run(`CREATE TABLE IF NOT EXISTS categories(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT
          )`);
  db.run(`CREATE TABLE IF NOT EXISTS products(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT, price REAL, description TEXT,
            category_id INTEGER REFERENCES categories(id)
          )`);
  db.run(`CREATE TABLE IF NOT EXISTS product_images(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER REFERENCES products(id),
            path TEXT
          )`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER REFERENCES products(id),
            user_id INTEGER REFERENCES users(id),
            rating INTEGER, comment TEXT
          )`);
  // Якщо адміна нема — створюємо
  db.get(`SELECT id FROM users WHERE role='admin'`, (e,row)=>{
    if(!row){
      const hash = bcrypt.hashSync('admin',10);
      db.run(`INSERT INTO users(email,password,role) VALUES(?,?,?)`,
              ['admin@example.com',hash,'admin']);
    }
  });
});

/* ---------- Файлові директорії ----------------------------------------- */
const uploadDir = path.join(__dirname,'public','uploads');
fs.mkdirSync(uploadDir,{recursive:true});
const upload = multer({storage:multer.diskStorage({
  destination: (_,__,cb)=>cb(null,uploadDir),
  filename:   (_,f,cb)=>cb(null,Date.now()+'_'+f.originalname.replace(/\s+/g,'_'))
})});

/* ---------- Middleware -------------------------------------------------- */
app.use('/public',express.static(path.join(__dirname,'public')));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret:'supersecret',
  resave:false,
  saveUninitialized:false
}));

function currentUser(req){
  return req.session.user;
}
function requireAuth(req,res,next){
  if(!currentUser(req)){return res.redirect('/login');}
  next();
}
function requireAdmin(req,res,next){
  if(!currentUser(req)||currentUser(req).role!=='admin'){
    return res.status(403).send('Доступ заборонено');
  }
  next();
}

/* ---------- В’юшки (HTML генеруємо тут) ------------------------------- */
function layout(title,body,user){
return `<!DOCTYPE html><html lang="uk"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;background:#131a21;color:#dde1e7;font-family:Arial,sans-serif;display:flex;flex-direction:column;min-height:100vh}
header{background:#0f1621;padding:1rem 2rem;display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap}
header a,header span{color:#dde1e7;font-weight:600;text-decoration:none}
header a:hover{text-decoration:underline}
main{flex:1;width:100%;max-width:920px;margin:0 auto;padding:1rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
.card{background:#1e2630;border-radius:6px;padding:.5rem;cursor:pointer}
.card img{width:100%;border-radius:4px}
input,select,textarea{width:100%;padding:.5rem;border-radius:6px;border:1px solid #394753;background:#1c252e;color:#dde1e7;box-sizing:border-box;margin-bottom:.5rem}
button{background:#6ea8ff;border:none;color:#0f1621;font-weight:700;padding:.5rem 1rem;border-radius:6px;cursor:pointer}
button:hover{background:#4d8bf7}
.qty-btn{width:30px;padding:0;font-weight:900;background:#394753;color:#dde1e7}
.slider{position:relative;width:300px;height:300px;overflow:hidden;margin:0 auto 1rem}
.slide{width:100%;height:100%;object-fit:contain;position:absolute;top:0;transition:left .4s ease}
.sbtn{position:absolute;top:50%;transform:translateY(-50%);background:#0f1621;color:#dde1e7;border:none;padding:.4rem;border-radius:4px;cursor:pointer}
#prev{left:4px}#next{right:4px}
.center{display:flex;flex-direction:column;align-items:center;text-align:center}
</style></head><body>
<header>
 <a href="/">Головна</a>
 <a href="/categories">Категорії</a>
 ${user?`<a href="/cart">Кошик</a>${user.role==='admin'?'<a href="/admin">Адмін</a>':''}<a href="/logout">Вийти</a>`:`<a href="/login">Вхід</a> / <a href="/register">Реєстрація</a>`}
</header>
${body}</body></html>`}

/* ---------- Маршрути --------------------------------------------------- */
// Головна
app.get('/',(req,res)=>{
  db.all(`SELECT p.*, 
            (SELECT path FROM product_images WHERE product_id=p.id LIMIT 1) img,
            (SELECT IFNULL(ROUND(AVG(rating),1),0) FROM reviews WHERE product_id=p.id) as rate
          FROM products p`, (e,rows)=>{
    const cards = rows.map(r=>`
      <div class="card" onclick="location.href='/product/${r.id}'">
        ${r.img?`<img src="/public/uploads/${r.img}" alt="">`:''}
        <h4>${r.name}</h4>
        <p>₴${r.price.toFixed(2)}</p>
        <p>★ ${r.rate}</p>
      </div>`).join('');
    res.send(layout('Головна',`<main><div class="grid">${cards||'<p>Товарів немає</p>'}</div></main>`,currentUser(req)));
  });
});

// Список категорій
app.get('/categories',(req,res)=>{
  db.all(`SELECT * FROM categories`,(e,cats)=>{
    const list=cats.map(c=>`<li><a href="/category/${c.id}">${c.name}</a></li>`).join('');
    res.send(layout('Категорії',`<main class="center"><h2>Категорії</h2><ul>${list||'Немає'}</ul></main>`,currentUser(req)));
  })
});

// Товари категорії
app.get('/category/:id',(req,res)=>{
  const cid=req.params.id;
  db.all(`SELECT p.*, (SELECT path FROM product_images WHERE product_id=p.id LIMIT 1) img,
         (SELECT IFNULL(ROUND(AVG(rating),1),0) FROM reviews WHERE product_id=p.id) rate
         FROM products p WHERE category_id=?`,[cid],(e,rows)=>{
    const cards=rows.map(r=>`
      <div class="card" onclick="location.href='/product/${r.id}'">
        ${r.img?`<img src="/public/uploads/${r.img}" alt="">`:''}
        <h4>${r.name}</h4><p>₴${r.price.toFixed(2)}</p><p>★ ${r.rate}</p>
      </div>`).join('');
    res.send(layout('Товари',`<main><div class="grid">${cards||'Немає товарів'}</div></main>`,currentUser(req)));
  });
});

// Сторінка товару
app.get('/product/:id',(req,res)=>{
  const id=req.params.id;
  db.get(`SELECT * FROM products WHERE id=?`,[id],(e,p)=>{
    if(!p){return res.status(404).send('Не знайдено');}
    db.all(`SELECT path FROM product_images WHERE product_id=?`,[id],(e,imgs)=>{
    db.all(`SELECT r.*,u.email FROM reviews r JOIN users u ON u.id=r.user_id WHERE product_id=?`,[id],(e,revs)=>{
      const slides=imgs.map((im,i)=>`<img src="/public/uploads/${im.path}" class="slide" style="left:${i==0?'0':'100%'}">`).join('');
      const reviewsHTML=revs.length?revs.map(r=>`<li>★${r.rating} – <b>${r.email}</b>: ${r.comment}</li>`).join(''):'<p>Немає відгуків</p>';
      res.send(layout(p.name,`
<main class="center">
 <h2>${p.name}</h2>
 <div class="slider" id="slider">${slides}
   <button class="sbtn" id="prev">&#8592;</button>
   <button class="sbtn" id="next">&#8594;</button>
 </div>
 <p><b>₴${p.price.toFixed(2)}</b></p>
 <p>${p.description||''}</p>
 <form action="/cart/add" method="POST" style="display:flex;gap:.5rem;align-items:center;">
   <input type="hidden" name="id" value="${p.id}">
   <button type="button" class="qty-btn" id="minus">-</button>
   <input type="text" value="1" readonly name="qty" id="qty" class="styled-input" style="width:40px">
   <button type="button" class="qty-btn" id="plus">+</button>
   <button class="styled-button">До кошика</button>
 </form>
 <h3>Відгуки</h3>${reviewsHTML}
 ${currentUser(req)?`
 <form action="/product/${p.id}/review" method="POST" class="styled-form">
   <label>Рейтинг<select name="rating" required>
     <option value="">-</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
   </select></label>
   <textarea name="comment" required placeholder="Ваш відгук"></textarea>
   <button class="styled-button">Надіслати</button>
 </form>`:'<p>Увійдіть, щоб залишити відгук</p>'}
</main>
<script>
(()=>{const imgs=[...document.querySelectorAll('.slide')];let i=0;
const show=n=>imgs.forEach((im,idx)=>im.style.left=(idx===n?'0':'100%'));
document.getElementById('prev').onclick=_=>{i=(i-1+imgs.length)%imgs.length;show(i);};
document.getElementById('next').onclick=_=>{i=(i+1)%imgs.length;show(i);};
document.getElementById('plus').onclick=_=>{qty.value=+qty.value+1};
document.getElementById('minus').onclick=_=>{if(qty.value>1)qty.value=+qty.value-1};
})();
</script>`,currentUser(req)));
    })})
  });
});

// Додати відгук
app.post('/product/:id/review',requireAuth,(req,res)=>{
  const uid=currentUser(req).id, pid=req.params.id, {rating,comment}=req.body;
  if(rating && comment){
    db.run(`INSERT INTO reviews(product_id,user_id,rating,comment) VALUES(?,?,?,?)`,[pid,uid,rating,comment.trim()]);
  }
  res.redirect('/product/'+pid);
});

// Кошик
app.post('/cart/add',(req,res)=>{
  const {id,qty}=req.body;
  if(!req.session.cart){req.session.cart=[];}
  req.session.cart.push({id:+id,qty:+qty||1});
  res.redirect('/cart');
});
app.get('/cart',requireAuth,(req,res)=>{
  const cart=req.session.cart||[];
  if(!cart.length){return res.send(layout('Кошик',renderHeader(currentUser(req))+`<main class="center"><h2>Кошик порожній</h2></main>`,currentUser(req)));}

  const placeholders=cart.map(_=>'?').join(',');
  db.all(`SELECT id,name,price,(SELECT path FROM product_images WHERE product_id=id LIMIT 1) img FROM products WHERE id IN (${placeholders})`,
         cart.map(c=>c.id),(e,rows)=>{
    let total=0;
    const itemsHtml=rows.map(p=>{
      const qty=cart.find(c=>c.id===p.id).qty;
      total+=p.price*qty;
      return `<div class="card" style="grid-template-columns:80px 1fr;display:grid;gap:.5rem">
        ${p.img?`<img src="/public/uploads/${p.img}" style="border-radius:4px">`:''}
        <div><h4>${p.name}</h4><p>${qty} x ₴${p.price.toFixed(2)}</p></div></div>`;
    }).join('');
    res.send(layout('Кошик',renderHeader(currentUser(req))+`
      <main><h2>Ваш кошик</h2>${itemsHtml}<h3>Всього: ₴${total.toFixed(2)}</h3></main>`,currentUser(req)));
  });
});

// Авторизація
app.get('/login',(req,res)=>{
  res.send(layout('Вхід',renderHeader(currentUser(req))+`
  <main class="center"><form method="POST" class="styled-form" style="max-width:300px">
   <label>Email<input name="email" type="email" required></label>
   <label>Пароль<input name="password" type="password" required></label>
   <button class="styled-button">Увійти</button></form></main>`,currentUser(req)));
});
app.post('/login',(req,res)=>{
  const {email,password}=req.body;
  db.get(`SELECT * FROM users WHERE email=?`,[email],(e,user)=>{
    if(user&&bcrypt.compareSync(password,user.password)){
      req.session.user=user;return res.redirect('/');
    }
    res.send('Невірні дані');
  });
});
// Реєстрація
app.get('/register',(req,res)=>{
  res.send(layout('Реєстрація',renderHeader(currentUser(req))+`
  <main class="center"><form method="POST" class="styled-form" style="max-width:300px">
   <label>Email<input name="email" type="email" required></label>
   <label>Пароль<input name="password" type="password" required></label>
   <button class="styled-button">Зареєструватися</button></form></main>`,currentUser(req)));
});
app.post('/register',(req,res)=>{
  const {email,password}=req.body;
  const hash=bcrypt.hashSync(password,10);
  db.run(`INSERT INTO users(email,password,role) VALUES(?,?,?)`,[email,hash,'user'],function(err){
    if(err){return res.send('Email вже зайнятий');}
    db.get(`SELECT * FROM users WHERE id=?`,[this.lastID],(e,user)=>{
      req.session.user=user;res.redirect('/');
    });
  });
});
// Вихід
app.get('/logout',(req,res)=>{req.session.destroy(()=>res.redirect('/'));});

// Адмін-панель
app.get('/admin',requireAdmin,(req,res)=>{
  db.all(`SELECT * FROM categories`,(e,cats)=>{
    db.all(`SELECT p.*,c.name cat FROM products p LEFT JOIN categories c ON c.id=p.category_id`,(e,prods)=>{
      const catList=cats.map(c=>`
        <li>${c.name}
         <form style="display:inline" method="POST" action="/admin/category/del">
          <input type="hidden" name="id" value="${c.id}"><button>✖</button></form>
        </li>`).join('');
      const prodList=prods.map(p=>`
        <li>${p.name} (₴${p.price}) [${p.cat||'без категорії'}]
         <form style="display:inline" method="POST" action="/admin/product/del">
          <input type="hidden" name="id" value="${p.id}"><button>✖</button></form>
        </li>`).join('');
      const catOpts=cats.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
      res.send(layout('Адмін',renderHeader(currentUser(req))+`
<main class="center">
<h2>Категорії</h2><ul>${catList||'Немає'}</ul>
<form method="POST" action="/admin/category/add" class="styled-form" style="max-width:300px">
  <input name="name" placeholder="Нова категорія" required>
  <button class="styled-button">Додати</button>
</form>
<hr style="margin:2rem 0">
<h2>Товари</h2><ul>${prodList||'Немає'}</ul>
<form method="POST" action="/admin/product/add" enctype="multipart/form-data" class="styled-form" style="max-width:300px">
  <input name="name" placeholder="Назва" required>
  <input name="price" type="number" step="0.01" placeholder="Ціна" required>
  <textarea name="description" placeholder="Опис"></textarea>
  <select name="category_id"><option value="">Без категорії</option>${catOpts}</select>
  <input type="file" name="images" multiple required accept="image/*">
  <button class="styled-button">Додати товар</button>
</form>
</main>`,currentUser(req)));
    });
  });
});
// Додати/видалити категорію
app.post('/admin/category/add',requireAdmin,(req,res)=>{
  db.run(`INSERT INTO categories(name) VALUES(?)`,[req.body.name.trim()],()=>res.redirect('/admin'));
});
app.post('/admin/category/del',requireAdmin,(req,res)=>{
  db.run(`DELETE FROM categories WHERE id=?`,[req.body.id],()=>res.redirect('/admin'));
});
// Додати/видалити товар
app.post('/admin/product/add',requireAdmin,upload.array('images',5),(req,res)=>{
  const {name,price,description,category_id}=req.body;
  db.run(`INSERT INTO products(name,price,description,category_id) VALUES(?,?,?,?)`,
    [name,price,description,category_id||null],function(err){
      const pid=this.lastID;
      req.files.forEach(f=>{
        db.run(`INSERT INTO product_images(product_id,path) VALUES(?,?)`,[pid,path.basename(f.path)]);
      });
      res.redirect('/admin');
    });
});
app.post('/admin/product/del',requireAdmin,(req,res)=>{
  db.run(`DELETE FROM products WHERE id=?`,[req.body.id],()=>res.redirect('/admin'));
});

/* ---------- Запуск ------------------------------------------------------ */
app.listen(PORT,()=>console.log(`Сервер запущено на порту ${PORT}`));
/* ------------------------------------------------------------------------ */
