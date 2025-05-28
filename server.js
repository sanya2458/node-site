const express=require('express'),session=require('express-session'),bcrypt=require('bcrypt'),sqlite=require('sqlite3').verbose(),multer=require('multer'),path=require('path'),fs=require('fs');
const app=express(),PORT=process.env.PORT||3000,DIR=path.join(__dirname,'uploads');fs.existsSync(DIR)||fs.mkdirSync(DIR);
app.use(express.urlencoded({extended:true}),express.static('public'),express.static(DIR),session({secret:'secret',resave:false,saveUninitialized:false}));
const upload=multer({storage:multer.diskStorage({destination:(_,__,cb)=>cb(null,DIR),filename:(_,f,cb)=>cb(null,Date.now()+path.extname(f.originalname))})});
const db=new sqlite.Database(path.join(__dirname,'shop.db')),
 q=e=>e&&console.error(e);
/* ---------- helpers ---------- */
const css=`body{margin:0;padding:0 15px;background:#0a1e4d;color:#fff;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif}nav{display:flex;gap:15px;align-items:center;flex-wrap:wrap;padding:15px;background:#142f6c;border-radius:0 0 10px 10px}nav a{color:#fff;text-decoration:none;padding:8px 12px;border-radius:6px;transition:.3s}nav a:hover{background:#2f4dab}nav .u{margin-left:auto}h1{margin:20px 0 10px}button,input[type=submit]{background:#2f4dab;color:#fff;border:none;padding:8px 16px;margin-top:10px;cursor:pointer;border-radius:8px;font-size:1rem}button:hover,input[type=submit]:hover{background:#4561d6}input,select,textarea{width:100%;max-width:400px;padding:8px;margin:6px 0 10px;border-radius:6px;border:none}input[type=number]{max-width:150px}.err{color:#ff6868;margin-bottom:15px}.c{max-width:960px;margin:20px auto}.p{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px}.card{background:#142f6c;border-radius:12px;padding:15px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;transition:.3s}.card:hover{background:#2f4dab}.card img{width:100%;height:140px;object-fit:contain;border-radius:8px;background:#fff}.card .price{font-weight:bold;margin-bottom:8px}.rating{color:gold;font-weight:bold}@media(max-width:600px){nav{gap:10px}nav a{padding:6px 8px;font-size:14px}}`;
const page=(res,body,{t='Магазин',u=null,a=false,e=null}={})=>res.send(`<!DOCTYPE html><html lang=uk><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${t}</title><style>${css}</style></head><body><nav><a href="/">Головна</a><a href="/categories">Категорії</a>${a?'<a href="/admin">Адмінка</a>':''}<div class=u>${u?`Привіт, <b>${u}</b> | <a href="/logout">Вийти</a>`:`<a href="/login">Вхід</a> | <a href="/register">Реєстрація</a>`}</div></nav><div class=c>${e?`<p class=err>${e}</p>`:''}${body}</div></body></html>`);
const auth=(req,res,next)=>req.session.userId?next():res.redirect('/login'),adm=(req,res,next)=>req.session.isAdmin?next():res.sendStatus(403);
/* ---------- DB init ---------- */
db.serialize(()=>{
 db.run(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT,is_admin INTEGER DEFAULT 0)`,q);
 db.run(`CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE)`,q);
 db.run(`CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT,description TEXT,price REAL,category_id INTEGER,rating REAL DEFAULT 0,FOREIGN KEY(category_id)REFERENCES categories(id))`,q);
 db.run(`CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY,product_id INTEGER,filename TEXT,FOREIGN KEY(product_id)REFERENCES products(id))`,q);
 db.run(`CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY,product_id INTEGER,user_id INTEGER,rating INTEGER,comment TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(product_id)REFERENCES products(id),FOREIGN KEY(user_id)REFERENCES users(id))`,q);
 db.get(`SELECT 1 FROM users WHERE username='admin'`,(err,row)=>{if(!row)bcrypt.hash('admin123',10,(e,h)=>db.run(`INSERT INTO users(username,password,is_admin)VALUES('admin',?,1)`,h,q));});
});
/* ---------- ROUTES ---------- */
// Головна
app.get('/',(req,res)=>{
 const cat=req.query.category,params=[],where=cat?' WHERE categories.name=?':'';if(cat)params.push(cat);
 const sql=`SELECT products.*,categories.name AS cat,(SELECT AVG(rating) FROM reviews WHERE product_id=products.id) AS r,(SELECT filename FROM product_images WHERE product_id=products.id LIMIT 1) AS img FROM products LEFT JOIN categories ON products.category_id=categories.id${where} ORDER BY products.id DESC`;
 db.all(sql,params,(e,prods)=>{
  db.all('SELECT name FROM categories ORDER BY name',(e,cats)=>{
   const opts=['<option value="">Всі категорії</option>',...cats.map(c=>`<option${c.name===cat?' selected':''}>${c.name}</option>`)].join('');
   const cards=prods.map(p=>`<div class=card onclick="location='/product/${p.id}'"><img src="/uploads/${p.img||'default.png'}" onerror="this.src='/uploads/default.png'"><h3>${p.name}</h3><div class=price>${p.price.toFixed(2)} грн</div><div class=rating>${p.r?p.r.toFixed(1):'—'}</div></div>`).join('');
   page(res,`<h1>Магазин товарів</h1><form><label>Фільтр:</label><select name=category onchange="this.form.submit()">${opts}</select></form><div class=p>${cards||'<p>Товарів не знайдено.</p>'}</div>`,{u:req.session.username,a:req.session.isAdmin});
  });
 });
});
// Категорії перелік
app.get('/categories',(req,res)=>db.all('SELECT name FROM categories ORDER BY name',(e,r)=>page(res,`<h1>Категорії</h1><ul>${r.map(c=>`<li><a href="/?category=${encodeURIComponent(c.name)}">${c.name}</a></li>`).join('')}</ul>`,{u:req.session.username,a:req.session.isAdmin})));
/* ---------- ADMIN ---------- */
// Панель
app.get('/admin',adm,(req,res)=>{
 db.all('SELECT * FROM categories ORDER BY name',(e,cats)=>{
  db.all(`SELECT products.id,products.name,products.price,(SELECT filename FROM product_images WHERE product_id=products.id LIMIT 1) AS img FROM products ORDER BY id DESC`,(e,prods)=>{
   const catList=cats.map(c=>`<li>${c.name} <a href=/admin/cat/edit/${c.id}>✏️</a> <a href=/admin/cat/del/${c.id} onclick="return confirm('Del?')">🗑️</a></li>`).join('');
   const prodList=prods.map(p=>`<li><img src=/uploads/${p.img||'default.png'} style="width:40px;vertical-align:middle;border-radius:4px;"> ${p.name} - ${p.price.toFixed(2)} грн <a href=/admin/prod/edit/${p.id}>✏️</a> <a href=/admin/prod/del/${p.id} onclick="return confirm('Del?')">🗑️</a></li>`).join('');
   const body=`<h1>Адмінка</h1><h2>Категорії</h2><ul>${catList||'—'}</ul><a href=/admin/cat/new><button type=button>Додати категорію</button></a><h2>Товари</h2><ul>${prodList||'—'}</ul><a href=/admin/prod/new><button type=button>Додати товар</button></a>`;
   page(res,body,{t:'Адмінка',u:req.session.username,a:true});
  });
 });
});
/* --- Категорії CRUD --- */
app.route('/admin/cat/new').get(adm,(req,res)=>page(res,'<h1>Нова категорія</h1><form method=post><input name=name required><input type=submit value=Додати>',{u:req.session.username,a:true})).post(adm,(req,res)=>db.run('INSERT INTO categories(name)VALUES(?)',[req.body.name.trim()],e=>res.redirect('/admin')));
app.route('/admin/cat/edit/:id').get(adm,(req,res)=>db.get('SELECT * FROM categories WHERE id=?',[req.params.id],(e,c)=>page(res,`<h1>Редагувати</h1><form method=post><input name=name value="${c.name}" required><input type=submit value=Зберегти>`,{u:req.session.username,a:true}))).post(adm,(req,res)=>db.run('UPDATE categories SET name=? WHERE id=?',[req.body.name.trim(),req.params.id],e=>res.redirect('/admin')));
app.get('/admin/cat/del/:id',adm,(req,res)=>db.run('DELETE FROM categories WHERE id=?',req.params.id,e=>res.redirect('/admin')));
/* --- Товари CRUD --- */
const prodForm=(p={},cats=[],edit=false)=>{
 const opts=cats.map(c=>`<option value=${c.id}${c.id==p.category_id?' selected':''}>${c.name}</option>`).join('');
 return `<h1>${edit?'Редагувати':'Новий'} товар</h1><form method=post enctype=multipart/form-data><label>Назва</label><input name=name value="${p.name||''}" required><label>Опис</label><textarea name=description>${p.description||''}</textarea><label>Ціна</label><input name=price type=number step=0.01 value="${p.price||''}" required><label>Категорія</label><select name=category_id required>${opts}</select><label>Фото (до 5)</label><input type=file name=images multiple accept=image/*><input type=submit value="${edit?'Зберегти':'Додати'}"></form>`;
};
app.get('/admin/prod/new',adm,(req,res)=>db.all('SELECT * FROM categories ORDER BY name',(e,cats)=>page(res,prodForm({},cats),{u:req.session.username,a:true})));
app.post('/admin/prod/new',adm,upload.array('images',5),(req,res)=>{
 const {name,description,price,category_id}=req.body;if(!name||!price)return page(res,'',{e:'Поля обов’язкові',u:req.session.username,a:true});
 db.run('INSERT INTO products(name,description,price,category_id)VALUES(?,?,?,?)',[name,description||'',price,category_id],function(err){
  if(err)return page(res,'',{e:'Помилка',u:req.session.username,a:true});
  const pid=this.lastID;req.files.forEach(f=>db.run('INSERT INTO product_images(product_id,filename)VALUES(?,?)',[pid,f.filename]));
  res.redirect('/admin');
 });
});
app.get('/admin/prod/edit/:id',adm,(req,res)=>{
 db.get('SELECT * FROM products WHERE id=?',[req.params.id],(e,p)=>{
  db.all('SELECT * FROM categories ORDER BY name',(e,cats)=>{
   db.all('SELECT * FROM product_images WHERE product_id=?',[p.id],(e,imgs)=>{
    const imgsHtml=imgs.map(i=>`<div style="display:inline-block;margin:4px"><img src=/uploads/${i.filename} style="width:60px;border-radius:6px"><a href=/admin/img/del/${i.id}?pid=${p.id}>🗑️</a></div>`).join('');
    page(res,prodForm(p,cats,true)+imgsHtml,{u:req.session.username,a:true});
   });
  });
 });
});
app.post('/admin/prod/edit/:id',adm,upload.array('images',5),(req,res)=>{
 const{id}=req.params,{name,description,price,category_id}=req.body;
 db.run('UPDATE products SET name=?,description=?,price=?,category_id=? WHERE id=?',[name,description,price,category_id,id],e=>{
  req.files.forEach(f=>db.run('INSERT INTO product_images(product_id,filename)VALUES(?,?)',[id,f.filename]));
  res.redirect('/admin');
 });
});
app.get('/admin/prod/del/:id',adm,(req,res)=>{
 db.all('SELECT filename FROM product_images WHERE product_id=?',req.params.id,(e,imgs)=>{
  imgs.forEach(i=>fs.unlink(path.join(DIR,i.filename),()=>{}));
  db.run('DELETE FROM product_images WHERE product_id=?',req.params.id);db.run('DELETE FROM reviews WHERE product_id=?',req.params.id);db.run('DELETE FROM products WHERE id=?',req.params.id,(e2)=>res.redirect('/admin'));
 });
});
app.get('/admin/img/del/:id',adm,(req,res)=>{
 const pid=req.query.pid;db.get('SELECT filename,product_id FROM product_images WHERE id=?',req.params.id,(e,i)=>{if(i){fs.unlink(path.join(DIR,i.filename),()=>{});db.run('DELETE FROM product_images WHERE id=?',req.params.id,()=>res.redirect(`/admin/prod/edit/${pid}`));}else res.redirect('/admin');});
});
/* ---------- AUTH routes (unchanged) ---------- */
const authForm=(title,action,fields)=>`<h1>${title}</h1><form method=post action=${action}>${fields}<input type=submit value="${title}"></form>`;
app.route('/register').get((_,res)=>page(res,authForm('Реєстрація','/register','<label>Логін</label><input name=username required pattern="[A-Za-z0-9_]{3,20}"><label>Пароль</label><input name=password type=password required minlength=5>'))).post((req,res)=>{const{username:u,password:p}=req.body;if(!u||!p)return page(res,'',{e:'Заповніть усі поля'});db.get('SELECT 1 FROM users WHERE username=?',[u],(e,r)=>r?page(res,'',{e:'Логін зайнятий'}):bcrypt.hash(p,10,(e,h)=>db.run('INSERT INTO users(username,password)VALUES(?,?)',[u,h],e=>res.redirect('/login'))));});
app.route('/login').get((_,res)=>page(res,authForm('Вхід','/login','<label>Л
