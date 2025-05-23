/* ------------  server.js  ------------ */
/*  Функції:
      – постійне зберігання постів (data/posts.json);
      – адмін-авторизація (login/pass у data/config.json);
      – пошук, лайки, коментарі, дати;
      – EN / UA перемикач (кнопка зліва у шапці);
      – налаштування (зміна логіну/паролю), «видалити все».
*/

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ----------  DATA & CONFIG  ---------- */
const DATA_PATH   = path.join(__dirname, 'data');
const POSTS_FILE  = path.join(DATA_PATH, 'posts.json');
const CONFIG_FILE = path.join(DATA_PATH, 'config.json');
if (!fs.existsSync(DATA_PATH))   fs.mkdirSync(DATA_PATH);
if (!fs.existsSync(POSTS_FILE))  fs.writeFileSync(POSTS_FILE, '[]');
if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE,
  JSON.stringify({ login:'admin', password:'1234' }, null, 2));

const loadPosts = () => JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
const savePosts = posts => fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
let posts = loadPosts();
let { login:ADMIN_LOGIN, password:ADMIN_PASS } = JSON.parse(fs.readFileSync(CONFIG_FILE,'utf-8'));

/* ----------  MULTER (uploads/)  ---------- */
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive:true });
const upload = multer({ storage: multer.diskStorage({
  destination: (_,__,cb)=>cb(null, uploadDir),
  filename:   (_,f ,cb)=>cb(null, Date.now()+path.extname(f.originalname))
})});

/* ----------  APP SETUP  ---------- */
app.use(bodyParser.urlencoded({ extended:true }));
app.use(session({ secret:'simple-secret', resave:false, saveUninitialized:false }));
app.use('/public', express.static(path.join(__dirname,'public')));

/* ----------  I18N (UA / EN)  ---------- */
const dict = {
  ua:{ title:'Фредлосграм', add:'Додати пост', deleteAll:'Видалити все', logout:'Вийти',
       login:'Увійти', wrong:'Невірний логін або пароль', back:'Назад',
       edit:'Редагувати', remove:'Видалити', conf:'Видалити цей пост?',
       commentPl:'Коментар...', send:'Надіслати', settings:'Налаштування',
       save:'Зберегти', lang:'EN', search:'Пошук...', likes:'Лайки' },
  en:{ title:'Fredllosgram', add:'Add post', deleteAll:'Delete all', logout:'Logout',
       login:'Login', wrong:'Invalid login or password', back:'Back',
       edit:'Edit', remove:'Delete', conf:'Delete this post?',
       commentPl:'Comment...', send:'Send', settings:'Settings',
       save:'Save', lang:'UA', search:'Search...', likes:'Likes' }
};
const t = (req,k)=>dict[(req.session.lang||'ua')][k];

/* ----------  HELPERS ---------- */
const isAdmin = (req,res,next)=> req.session?.admin ? next() : res.redirect('/login');
const esc = s=>s.replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

/* ----------  COMMON PAGE HEAD ---------- */
function head(req,title=''){
  return `<html><head><title>${t(req,'title')}${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;background:#1f2a38;color:#fff}
    .container{max-width:1000px;margin:auto;padding:20px}
    .header{display:flex;align-items:center;padding:15px;background:#30445c;margin-bottom:20px;position:relative}
    .header-left{display:flex;gap:10px}
    .header-title{margin-left:15px;font-size:1.5em;color:#d1d9e6}
    .header-buttons{margin-left:auto;display:flex;gap:10px}
    button,.btn{background:#3f5e8c;color:#fff;border:none;padding:10px 15px;border-radius:4px;cursor:pointer;text-decoration:none}
    button:hover,.btn:hover{background:#5a7ab0}
    .lang-btn{background:none;border:none;color:#85b4ff;font-size:1em;padding:0 6px;cursor:pointer}
    .action{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:25px 0}
    .post{background:#2e3b4e;border-radius:8px;padding:15px;margin-bottom:25px;box-shadow:0 0 10px rgba(0,0,0,.2)}
    .post h3{margin:0 0 10px;color:#d1d9e6}
    .meta{font-size:.8em;color:#9ba8b8;margin-bottom:8px}
    img{max-width:100%;border-radius:6px;cursor:pointer}
    .admin{margin-top:10px;font-size:.9em}
    a{color:#85b4ff;text-decoration:none}
    a:hover{text-decoration:underline}
    form.inline{display:inline}
    input[type=text],input[type=password],textarea{
      width:100%;padding:10px;border:none;border-radius:4px;background:#3a4a5c;color:#fff;margin-bottom:15px
    }
    input[type=number]{width:90px;padding:8px;border:none;border-radius:4px;background:#3a4a5c;color:#fff;margin-bottom:15px}
    .like{border:none;background:none;color:#85b4ff;font-size:1em;cursor:pointer}
    .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);justify-content:center;align-items:center}
    .modal img{max-height:90%;max-width:90%}
  </style>
  <script>
    function like(id){fetch('/like/'+id).then(()=>location.reload())}
    function delAll(){if(confirm('${dict.ua.conf}'))location='/deleteAll'}
    function sh(i){document.getElementById('m'+i).style.display='flex'}
    function hi(i){document.getElementById('m'+i).style.display='none'}
  </script></head><body>`;
}

/* ----------  HOME + SEARCH ---------- */
app.get('/',(req,res)=>{
  const q=(req.query.q||'').toLowerCase();
  const list = posts.filter(p=>!q||p.title.toLowerCase().includes(q)||p.content.toLowerCase().includes(q));

  let h=head(req);
  /* --- header --- */
  h+=`<div class="header">
        <div class="header-left">
          <a class="lang-btn" href="/lang/${req.session.lang==='en'?'ua':'en'}">${t(req,'lang')}</a>
          <div class="header-title">${t(req,'title')}</div>
        </div>
        <div class="header-buttons">`;
  if(req.session.admin){
    h+=`<form method="POST" action="/logout" class="inline"><button>${t(req,'logout')}</button></form>`;
  }else{
    h+=`<a class="btn" href="/login">${t(req,'login')}</a>`;
  }
  h+='</div></div>';

  /* --- action bar --- */
  h+='<div class="action">';
  if(req.session.admin){
    h+=`<a class="btn" href="/add">${t(req,'add')}</a>
        <button class="btn" onclick="delAll()">${t(req,'deleteAll')}</button>
        <a class="btn" href="/settings">${t(req,'settings')}</a>`;
  }
  h+=`<form class="inline" method="GET" action="/">
        <input type="text" name="q" placeholder="${t(req,'search')}" value="${esc(q)}">
      </form></div>`;

  /* --- posts --- */
  h+='<div class="container">';
  list.sort((a,b)=>(a.order??1e9)-(b.order??1e9))
      .forEach((p,i)=>{
        h+=`<div class="post">
               <h3>${esc(p.title)}</h3>
               <div class="meta">${new Date(p.date).toLocaleString(req.session.lang==='en'?'en-US':'uk-UA')}
                 • <button class="like" onclick="like(${i})">❤️ ${p.likes||0} ${t(req,'likes')}</button>
               </div>
               <img src="${p.image}" onclick="sh(${i})">
               <div id="m${i}" class="modal" onclick="hi(${i})"><img src="${p.image}"></div>
               <p>${esc(p.content)}</p>`;
        if(req.session.admin){
          h+=`<div class="admin">
                 <a href="/edit/${i}">${t(req,'edit')}</a> |
                 <a href="/delete/${i}" onclick="return confirm('${t(req,'conf')}')">${t(req,'remove')}</a>
               </div>`;
        }
        /* comments */
        h+=`<div style="margin-top:12px;border-top:1px solid #3a4a5c;padding-top:10px">`;
        (p.comments||[]).forEach(c=>{
          h+=`<p style="margin:4px 0"><b>${esc(c.when)}</b>: ${esc(c.text)}</p>`;
        });
        h+=`<form method="POST" action="/comment/${i}">
               <input type="text" name="text" placeholder="${t(req,'commentPl')}" required>
               <button class="btn" style="margin-top:6px">${t(req,'send')}</button>
             </form></div></div>`;
      });
  h+='</div></body></html>';
  res.send(h);
});

/* ----------  LANG ---------- */
app.get('/lang/:code',(req,res)=>{ req.session.lang=req.params.code==='en'?'en':'ua'; res.redirect('/'); });

/* ----------  LIKE ---------- */
app.get('/like/:id',(req,res)=>{
  const id=+req.params.id;
  if(id>=0&&id<posts.length){ posts[id].likes=(posts[id].likes||0)+1; savePosts(); }
  res.sendStatus(200);
});

/* ----------  COMMENT ---------- */
app.post('/comment/:id',(req,res)=>{
  const id=+req.params.id;
  if(id>=0&&id<posts.length){
    posts[id].comments = posts[id].comments||[];
    posts[id].comments.push({ text:req.body.text, when:new Date().toLocaleString( req.session.lang==='en'?'en-US':'uk-UA' )});
    savePosts();
  }
  res.redirect('/');
});

/* ----------  LOGIN / LOGOUT ---------- */
app.get('/login',(req,res)=>{
  if(req.session.admin) return res.redirect('/');
  res.send(head(req,' - Login')+`
    <div class="container">
      <h2>${t(req,'login')}</h2>
      <form method="POST" action="/login">
        <input type="text"    name="login"    placeholder="Login"    required>
        <input type="password" name="password" placeholder="Password" required>
        <button class="btn">${t(req,'login')}</button>
      </form>
      <div style="margin-top:15px"><a class="btn" href="/">${t(req,'back')}</a></div>
    </div></body></html>`);
});
app.post('/login',(req,res)=>{
  if(req.body.login===ADMIN_LOGIN && req.body.password===ADMIN_PASS){
    req.session.admin=true; return res.redirect('/');
  }
  res.send(head(req,' - Wrong')+`
    <div class="container"><h2 style="color:#f66">${t(req,'wrong')}</h2>
    <a class="btn" href="/login">${t(req,'back')}</a></div></body></html>`);
});
app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));

/* ----------  ADD ---------- */
app.get('/add',isAdmin,(req,res)=>{
  res.send(head(req,' - Add')+`
    <div class="container"><h2>${t(req,'add')}</h2>
      <form method="POST" action="/add" enctype="multipart/form-data">
        <input name="title"   placeholder="Title" required>
        <textarea name="content" rows="4" placeholder="Text" required></textarea>
        <input type="number" name="order" placeholder="Order" min="1" required>
        <input type="file"   name="image" accept="image/*" required>
        <button class="btn">${t(req,'add')}</button>
      </form>
      <div style="margin-top:15px"><a class="btn" href="/">${t(req,'back')}</a></div>
    </div></body></html>`);
});
app.post('/add',isAdmin,upload.single('image'),(req,res)=>{
  posts.push({
    title:req.body.title.trim(),
    content:req.body.content.trim(),
    order:+req.body.order,
    image:`/public/uploads/${req.file.filename}`,
    date:new Date().toISOString(), likes:0, comments:[]
  });
  savePosts(); res.redirect('/');
});

/* ----------  EDIT ---------- */
app.get('/edit/:id',isAdmin,(req,res)=>{
  const id=+req.params.id; if(id<0||id>=posts.length) return res.redirect('/');
  const p=posts[id];
  res.send(head(req,' - Edit')+`
    <div class="container"><h2>${t(req,'edit')}</h2>
      <form method="POST" action="/edit/${id}" enctype="multipart/form-data">
        <input name="title"   value="${esc(p.title)}" required>
        <textarea name="content" rows="4" required>${esc(p.content)}</textarea>
        <input type="number" name="order" value="${p.order}" required>
        <img src="${p.image}" style="max-width:100%;margin:10px 0">
        <input type="file" name="image" accept="image/*">
        <button class="btn">${t(req,'save')}</button>
      </form>
      <div style="margin-top:15px"><a class="btn" href="/">${t(req,'back')}</a></div>
    </div></body></html>`);
});
app.post('/edit/:id',isAdmin,upload.single('image'),(req,res)=>{
  const id=+req.params.id; if(id<0||id>=posts.length) return res.redirect('/');
  posts[id].title   = req.body.title.trim();
  posts[id].content = req.body.content.trim();
  posts[id].order   = +req.body.order;
  if(req.file) posts[id].image=`/public/uploads/${req.file.filename}`;
  savePosts(); res.redirect('/');
});

/* ----------  DELETE ONE ---------- */
app.get('/delete/:id',isAdmin,(req,res)=>{
  const id=+req.params.id; if(id>=0 && id<posts.length){ posts.splice(id,1); savePosts(); }
  res.redirect('/');
});

/* ----------  DELETE ALL ---------- */
app.get('/deleteAll',isAdmin,(req,res)=>{ posts=[]; savePosts(); res.redirect('/'); });

/* ----------  SETTINGS ---------- */
app.get('/settings',isAdmin,(req,res)=>{
  res.send(head(req,' - Settings')+`
    <div class="container"><h2>${t(req,'settings')}</h2>
      <form method="POST" action="/settings">
        <input name="login"    value="${esc(ADMIN_LOGIN)}" required>
        <input name="password" value="${esc(ADMIN_PASS)}" required>
        <button class="btn">${t(req,'save')}</button>
      </form>
      <div style="margin-top:15px"><a class="btn" href="/">${t(req,'back')}</a></div>
    </div></body></html>`);
});
app.post('/settings',isAdmin,(req,res)=>{
  ADMIN_LOGIN=req.body.login.trim(); ADMIN_PASS=req.body.password.trim();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({login:ADMIN_LOGIN,password:ADMIN_PASS},null,2));
  res.redirect('/');
});

/* ----------  START ---------- */
app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));
