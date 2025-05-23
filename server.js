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
       save:'Зберегти', lang:'EN', search:'Пошук...', likes:'Лайки',
       delCommentConf: 'Видалити цей коментар?', namePrompt: 'Введіть ваше ім\'я' },
  en:{ title:'Fredllosgram', add:'Add post', deleteAll:'Delete all', logout:'Logout',
       login:'Login', wrong:'Invalid login or password', back:'Back',
       edit:'Edit', remove:'Delete', conf:'Delete this post?',
       commentPl:'Comment...', send:'Send', settings:'Settings',
       save:'Save', lang:'UA', search:'Search...', likes:'Likes',
       delCommentConf: 'Delete this comment?', namePrompt: 'Enter your name' }
};
const t = (req,k) => dict[(req.session.lang||'ua')][k];

/* ----------  HELPERS ---------- */
const isAdmin = (req,res,next)=> req.session?.admin ? next() : res.redirect('/');

const esc = s => String(s).replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

/* ----------  COMMON PAGE HEAD ---------- */
function head(req,title=''){
  return `<html><head><title>${t(req,'title')}${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;background:#1f2a38;color:#fff}
    .container{max-width:1000px;margin:auto;padding:20px}
    .header {
      display: flex;
      align-items: center;
      justify-content: center; /* центр по горизонталі */
      padding: 15px;
      background: #30445c;
      margin-bottom: 20px;
      position: relative;
    }
    .header-left {
      position: absolute;
      left: 15px;
    }
    .header-title {
      font-size: 1.5em;
      color: #d1d9e6;
      user-select: none;
    }
    .header-buttons {
      position: absolute;
      right: 15px;
      display: flex;
      gap: 10px;
    }
    button, .btn {
      background: #3f5e8c;
      color: #fff;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      font-size: 1em;
      transition: background 0.3s;
    }
    button:hover, .btn:hover {
      background: #5a7ab0;
    }
    .lang-btn {
      background: none;
      border: none;
      color: #85b4ff;
      font-size: 1em;
      padding: 0 6px;
      cursor: pointer;
      user-select: none;
    }
    input[type=text], input[type=password], input[type=number], textarea {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 4px;
      background: #3a4a5c;
      color: #fff;
      margin-bottom: 15px;
      font-size: 1em;
      box-sizing: border-box;
      resize: vertical;
    }
    input[type=number] {
      width: 90px;
    }
    .action {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      margin: 25px 0;
    }
    .post {
      background: #2e3b4e;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 25px;
      box-shadow: 0 0 10px rgba(0,0,0,.2);
      position: relative;
    }
    .post h3 {
      margin: 0 0 10px;
      color: #d1d9e6;
    }
    .meta {
      font-size: .8em;
      color: #9ba8b8;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between; /* лайки справа */
      align-items: center;
    }
    img {
      max-width: 100%;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 10px;
    }
    .admin {
      margin-top: 10px;
      font-size: .9em;
    }
    a {
      color: #85b4ff;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    form.inline {
      display: inline;
    }
    .like {
      border: none;
      background: none;
      color: #85b4ff;
      font-size: 1em;
      cursor: pointer;
    }
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.8);
      justify-content: center;
      align-items: center;
    }
    .modal img {
      max-height: 90%;
      max-width: 90%;
    }
    .comment-admin {
      margin-left: 10px;
      color: #f66;
      cursor: pointer;
      font-size: 0.9em;
      user-select: none;
    }
  </style>
  <script>
    function like(id){fetch('/like/'+id).then(()=>location.reload())}
    function delAll(){if(confirm('${dict.ua.conf}'))location='/deleteAll'}
    function sh(i){document.getElementById('m'+i).style.display='flex'}
    function hi(i){document.getElementById('m'+i).style.display='none'}

    function confirmDelComment(postId, commentIdx) {
      if(confirm('${dict.ua.delCommentConf}')) {
        fetch('/comment/delete/' + postId + '/' + commentIdx, { method: 'POST' })
          .then(() => location.reload());
      }
    }

    function submitComment(form) {
      const name = prompt('${dict.ua.namePrompt}');
      if(!name) return false;
      const inputName = document.createElement('input');
      inputName.type = 'hidden';
      inputName.name = 'name';
      inputName.value = name;
      form.appendChild(inputName);
      return true;
    }
  </script>
  </head><body>`;
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
        </div>
        <div class="header-title">${t(req,'title')}</div>
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
               <div class="meta">
                 <div>
                   <form method="POST" action="/edit-date/${i}" style="display:inline-block;margin-right:10px;">
                     <input type="datetime-local" name="date" value="${p.date ? new Date(p.date).toISOString().slice(0,16) : ''}" required>
                     <button class="btn" type="submit" style="padding:3px 8px;font-size:0.8em;">${t(req,'save')}</button>
                   </form>
                 </div>
                 <div>
                   <button class="like" onclick="like(${i})">${t(req,'likes')} ${p.likes||0} ❤️</button>
                 </div>
               </div>`;
        if(p.image) h+=`<img src="/public/uploads/${esc(p.image)}" alt="post image" onclick="sh(${i})" style="cursor:pointer;">`;

        h+=`<p>${esc(p.content).replace(/\n/g,'<br>')}</p>`;

        if(req.session.admin){
          h+=`<div class="admin">
                <a href="/edit/${i}">${t(req,'edit')}</a> | 
                <a href="/delete/${i}" onclick="return confirm('${t(req,'conf')}')">${t(req,'remove')}</a>
              </div>`;
        }

        /* comments */
        h+='<hr><h4>Comments</h4>';
        if(p.comments && p.comments.length){
          p.comments.forEach((c,j)=>{
            h+=`<p><b>${esc(c.name)}:</b> ${esc(c.text)}`;
            if(req.session.admin){
              h+=` <span class="comment-admin" onclick="confirmDelComment(${i},${j})">[x]</span>`;
            }
            h+='</p>';
          });
        }
        if(req.session.admin){
          h+=`<form method="POST" action="/comment/${i}" onsubmit="return submitComment(this);">
                <textarea name="text" placeholder="${t(req,'commentPl')}" required></textarea>
                <button>${t(req,'send')}</button>
              </form>`;
        }
        h+='</div>';

        /* modal for image */
        if(p.image){
          h+=`<div id="m${i}" class="modal" onclick="hi(${i})">
                <img src="/public/uploads/${esc(p.image)}" alt="modal image">
              </div>`;
        }
      });
  h+='</div></body></html>';
  res.send(h);
});

/* ----------  LIKE ---------- */
app.post('/like/:id', (req,res)=>{
  const id = +req.params.id;
  if(posts[id]){
    posts[id].likes = (posts[id].likes||0) + 1;
    savePosts(posts);
  }
  res.sendStatus(200);
});
app.get('/like/:id', (req,res)=>{
  res.status(405).send('Method Not Allowed');
});

/* ----------  DELETE ALL ---------- */
app.get('/deleteAll', isAdmin, (req,res)=>{
  posts = [];
  savePosts(posts);
  res.redirect('/');
});

/* ----------  LOGIN / LOGOUT ---------- */
app.get('/login', (req,res)=>{
  if(req.session.admin) return res.redirect('/');
  let h = head(req);
  h+=`<div class="container"><h2>${t(req,'login')}</h2>
        <form method="POST" action="/login">
          <input type="text" name="login" placeholder="Login" required>
          <input type="password" name="password" placeholder="Password" required>
          <button>${t(req,'login')}</button>
        </form>
      </div></body></html>`;
  res.send(h);
});
app.post('/login', (req,res)=>{
  const { login, password } = req.body;
  if(login === ADMIN_LOGIN && password === ADMIN_PASS){
    req.session.admin = true;
    res.redirect('/');
  } else {
    let h = head(req);
    h+=`<div class="container"><h2>${t(req,'login')}</h2>
          <p style="color:#f66;">${t(req,'wrong')}</p>
          <form method="POST" action="/login">
            <input type="text" name="login" placeholder="Login" required>
            <input type="password" name="password" placeholder="Password" required>
            <button>${t(req,'login')}</button>
          </form>
        </div></body></html>`;
    res.send(h);
  }
});
app.post('/logout', (req,res)=>{
  req.session.destroy(()=>res.redirect('/'));
});

/* ----------  ADD POST ---------- */
app.get('/add', isAdmin, (req,res)=>{
  let h = head(req, ' - '+t(req,'add'));
  h+=`<div class="container">
        <h2>${t(req,'add')}</h2>
        <form method="POST" action="/add" enctype="multipart/form-data">
          <input type="text" name="title" placeholder="Title" required>
          <textarea name="content" placeholder="Content" required></textarea>
          <input type="file" name="image" accept="image/*">
          <button>${t(req,'add')}</button>
        </form>
        <a href="/">← ${t(req,'back')}</a>
      </div></body></html>`;
  res.send(h);
});
app.post('/add', isAdmin, upload.single('image'), (req,res)=>{
  const { title, content } = req.body;
  const newPost = {
    title: title.trim(),
    content: content.trim(),
    date: new Date().toISOString(),
    likes: 0,
    comments: [],
    image: req.file ? req.file.filename : null,
    order: posts.length ? Math.min(...posts.map(p=>p.order??1e9)) - 1 : 0
  };
  posts.unshift(newPost); // Нові зверху
  savePosts(posts);
  res.redirect('/');
});

/* ----------  DELETE POST ---------- */
app.get('/delete/:id', isAdmin, (req,res)=>{
  const id = +req.params.id;
  if(posts[id]){
    // видалити файл картинки
    if(posts[id].image){
      const f = path.join(uploadDir, posts[id].image);
      if(fs.existsSync(f)) fs.unlinkSync(f);
    }
    posts.splice(id, 1);
    savePosts(posts);
  }
  res.redirect('/');
});

/* ----------  EDIT POST ---------- */
app.get('/edit/:id', isAdmin, (req,res)=>{
  const id = +req.params.id;
  const p = posts[id];
  if(!p) return res.redirect('/');
  let h = head(req, ' - '+t(req,'edit'));
  h+=`<div class="container">
        <h2>${t(req,'edit')}</h2>
        <form method="POST" action="/edit/${id}" enctype="multipart/form-data">
          <input type="text" name="title" placeholder="Title" value="${esc(p.title)}" required>
          <textarea name="content" placeholder="Content" required>${esc(p.content)}</textarea>`;
  if(p.image){
    h+=`<p>Current image:<br><img src="/public/uploads/${esc(p.image)}" style="max-width:200px"></p>
        <label><input type="checkbox" name="delimg"> Delete image</label><br>`;
  }
  h+=`<input type="file" name="image" accept="image/*">
        <button>${t(req,'save')}</button>
        </form>
        <a href="/">← ${t(req,'back')}</a>
      </div></body></html>`;
  res.send(h);
});
app.post('/edit/:id', isAdmin, upload.single('image'), (req,res)=>{
  const id = +req.params.id;
  const p = posts[id];
  if(!p) return res.redirect('/');
  p.title = req.body.title.trim();
  p.content = req.body.content.trim();
  if(req.body.delimg && p.image){
    const f = path.join(uploadDir, p.image);
    if(fs.existsSync(f)) fs.unlinkSync(f);
    p.image = null;
  }
  if(req.file){
    if(p.image){
      const f = path.join(uploadDir, p.image);
      if(fs.existsSync(f)) fs.unlinkSync(f);
    }
    p.image = req.file.filename;
  }
  savePosts(posts);
  res.redirect('/');
});

/* ----------  EDIT DATE ---------- */
app.post('/edit-date/:id', isAdmin, (req,res)=>{
  const id = +req.params.id;
  const p = posts[id];
  if(!p) return res.redirect('/');
  const d = req.body.date;
  if(d && !isNaN(Date.parse(d))){
    p.date = new Date(d).toISOString();
    savePosts(posts);
  }
  res.redirect('/');
});

/* ----------  COMMENTS ---------- */
app.post('/comment/:id', isAdmin, (req,res)=>{
  const id = +req.params.id;
  const p = posts[id];
  if(!p) return res.redirect('/');
  const text = req.body.text.trim();
  const name = req.body.name ? req.body.name.trim() : 'Anon';
  if(text.length > 0){
    p.comments = p.comments || [];
    p.comments.push({ name, text });
    savePosts(posts);
  }
  res.redirect('/');
});

app.post('/comment/delete/:postId/:commentIdx', isAdmin, (req,res)=>{
  const postId = +req.params.postId;
  const commentIdx = +req.params.commentIdx;
  if(posts[postId] && posts[postId].comments && posts[postId].comments[commentIdx]){
    posts[postId].comments.splice(commentIdx,1);
    savePosts(posts);
  }
  res.sendStatus(200);
});

/* ----------  SETTINGS ---------- */
app.get('/settings', isAdmin, (req,res)=>{
  let h = head(req, ' - '+t(req,'settings'));
  h+=`<div class="container">
        <h2>${t(req,'settings')}</h2>
        <form method="POST" action="/settings">
          <label>Login:<br><input name="login" value="${esc(ADMIN_LOGIN)}" required></label><br>
          <label>Password:<br><input name="password" type="password" value="${esc(ADMIN_PASS)}" required></label><br>
          <button>${t(req,'save')}</button>
        </form>
        <a href="/">← ${t(req,'back')}</a>
      </div></body></html>`;
  res.send(h);
});
app.post('/settings', isAdmin, (req,res)=>{
  ADMIN_LOGIN = req.body.login.trim();
  ADMIN_PASS  = req.body.password.trim();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ login: ADMIN_LOGIN, password: ADMIN_PASS }, null, 2));
  res.redirect('/settings');
});

/* ----------  LANGUAGE SWITCH ---------- */
app.get('/lang/:lang', (req,res)=>{
  const lang = req.params.lang;
  if(['ua','en'].includes(lang)) req.session.lang = lang;
  res.redirect('back');
});

/* ----------  START SERVER ---------- */
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
