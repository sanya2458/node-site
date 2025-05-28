const express=require('express'),session=require('express-session'),bcrypt=require('bcrypt'),sqlite=require('sqlite3').verbose(),multer=require('multer'),path=require('path'),fs=require('fs');
const app=express(),PORT=process.env.PORT||3000,DIR=path.join(__dirname,'uploads');fs.existsSync(DIR)||fs.mkdirSync(DIR);
const upload=multer({storage:multer.diskStorage({destination:(_,__,cb)=>cb(null,DIR),filename:(_,f,cb)=>cb(null,Date.now()+path.extname(f.originalname))})});
const db=new sqlite.Database(path.join(__dirname,'shop.db'));
const q=e=>{if(e)console.error(e)};
const htmlStyle=`body{margin:0;padding:0 15px;background:#0a1e4d;color:#fff;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif}nav{display:flex;gap:15px;align-items:center;flex-wrap:wrap;padding:15px;background:#142f6c;border-radius:0 0 10px 10px}nav a{color:#fff;text-decoration:none;padding:8px 12px;border-radius:6px;transition:.3s}nav a:hover{background:#2f4dab}nav .u{margin-left:auto}h1{margin:20px 0 10px}button,input[type=submit]{background:#2f4dab;color:#fff;border:none;padding:8px 16px;margin-top:10px;cursor:pointer;border-radius:8px;font-size:1rem}button:hover,input[type=submit]:hover{background:#4561d6}input,select,textarea{width:100%;max-width:400px;padding:8px;margin:6px 0 10px;border-radius:6px;border:none}input[type=number]{max-width:150px}.err{color:#ff6868;margin-bottom:15px}.c{max-width:960px;margin:20px auto}.p{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px}.card{background:#142f6c;border-radius:12px;padding:15px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;transition:.3s}.card:hover{background:#2f4dab}.card img{width:100%;height:140px;object-fit:contain;border-radius:8px;background:#fff}.card .price{font-weight:bold;margin-bottom:8px}.rating{color:gold;font-weight:bold}@media(max-width:600px){nav{gap:10px}nav a{padding:6px 8px;font-size:14px}}`;
const page=(res,body,{t='Магазин',u=null,a=false,e=null}={})=>res.send(`<!DOCTYPE html><html lang=uk><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${t}</title><style>${htmlStyle}</style></head><body><nav><a href="/">Головна</a><a href="/categories">Категорії</a>${a?'<a href="/admin">Адмінка</a>':''}<div class=u>${u?`Привіт, <b>${u}</b> | <a href="/logout">Вийти</a>`:`<a href="/login">Вхід</a> | <a href="/register">Реєстрація</a>`}</div></nav><div class=c>${e?`<p class=err>${e}</p>`:''}${body}</div></body></html>`);
const auth=(req,res,next)=>req.session.userId?next():res.redirect('/login'),adm=(req,res,next)=>req.session.isAdmin?next():res.sendStatus(403);
app.use(express.urlencoded({extended:true}),express.static('public'),session({secret:'secret',resave:false,saveUninitialized:false}));
/* DB init */
db.serialize(()=>{
 db.run(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT,is_admin INTEGER DEFAULT 0)`,q);
 db.run(`CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE)`,q);
 db.run(`CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT,description TEXT,price REAL,category_id INTEGER,rating REAL DEFAULT 0,FOREIGN KEY(category_id)REFERENCES categories(id))`,q);
 db.run(`CREATE TABLE IF NOT EXISTS product_images(id INTEGER PRIMARY KEY,product_id INTEGER,filename TEXT,FOREIGN KEY(product_id)REFERENCES products(id))`,q);
 db.run(`CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY,product_id INTEGER,user_id INTEGER,rating INTEGER,comment TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(product_id)REFERENCES products(id),FOREIGN KEY(user_id)REFERENCES users(id))`,q);
 db.get(`SELECT 1 FROM users WHERE username='admin'`,(err,row)=>{if(!row)bcrypt.hash('admin123',10,(e,h)=>db.run(`INSERT INTO users(username,password,is_admin)VALUES('admin',?,1)`,h,q));});
});
/* Routes */
app.get('/',(req,res)=>{
 const cat=req.query.category,params=[],where=cat?' WHERE categories.name=?':'';if(cat)params.push(cat);
 const sql=`SELECT products.*,categories.name AS cat,(SELECT AVG(rating) FROM reviews WHERE product_id=products.id) AS r FROM products LEFT JOIN categories ON products.category_id=categories.id${where} ORDER BY products.id DESC`;
 db.all(sql,params,(e,prods)=>{
  db.all('SELECT name FROM categories ORDER BY name',(e,cats)=>{
   const opts=['<option value="">Всі категорії</option>',...cats.map(c=>`<option${c.name===cat?' selected':''}>${c.name}</option>`)].join('');
   const cards=prods.map(p=>`<div class=card onclick="location='/product/${p.id}'"><img src="/uploads/${p.id}_1.jpg" onerror="this.src='/uploads/default.png'"><h3>${p.name}</h3><div class=price>${p.price.toFixed(2)} грн</div><div>Категорія: ${p.cat||'Без категорії'}</div><div class=rating>${p.r?p.r.toFixed(1):'—'}</div></div>`).join('');
   page(res,`<h1>Магазин товарів</h1><form><label>Фільтр:</label><select name=category onchange="this.form.submit()">${opts}</select></form><div class=p>${cards||'<p>Товарів не знайдено.</p>'}</div>`,{u:req.session.username,a:req.session.isAdmin});
  });
 });
});
app.get('/categories',(req,res)=>db.all('SELECT name FROM categories ORDER BY name',(e,r)=>page(res,`<h1>Категорії</h1><ul>${r.map(c=>`<li><a href="/?category=${encodeURIComponent(c.name)}">${c.name}</a></li>`).join('')}</ul>`,{u:req.session.username,a:req.session.isAdmin})));
const authForm=(title,action,fields)=>`<h1>${title}</h1><form method=post action=${action}>${fields}<input type=submit value="${title}"></form>`;
app.route('/register').get((_,res)=>page(res,authForm('Реєстрація','/register','<label>Логін</label><input name=username required pattern="[A-Za-z0-9_]{3,20}"><label>Пароль</label><input name=password type=password required minlength=5>'))).post((req,res)=>{const{username:u,password:p}=req.body;if(!u||!p)return page(res,'',{e:'Заповніть усі поля'});db.get('SELECT 1 FROM users WHERE username=?',[u],(e,r)=>r?page(res,'',{e:'Логін зайнятий'}):bcrypt.hash(p,10,(e,h)=>db.run('INSERT INTO users(username,password)VALUES(?,?)',[u,h],e=>res.redirect('/login'))));});
app.route('/login').get((_,res)=>page(res,authForm('Вхід','/login','<label>Логін</label><input name=username required><label>Пароль</label><input name=password type=password required>'))).post((req,res)=>{const{username:u,password:p}=req.body;db.get('SELECT * FROM users WHERE username=?',[u],(e,r)=>!r?page(res,'',{e:'Невірний логін або пароль'}):bcrypt.compare(p,r.password,(e,v)=>!v?page(res,'',{e:'Невірний логін або пароль'}):(req.session.userId=r.id,req.session.username=r.username,req.session.isAdmin=r.is_admin==1,res.redirect('/'))));});
app.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));
/* Start */
app.listen(PORT,()=>console.log('Running:'+PORT));
