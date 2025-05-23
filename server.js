const express = require('express');
const session  = require('express-session');
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
const UPLOAD_DIR  = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(DATA_PATH))  fs.mkdirSync(DATA_PATH);
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]');
if (!fs.existsSync(CONFIG_FILE))
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ login:'admin', password:'1234' }, null, 2));
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive:true });

const loadPosts = () => JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
const savePosts = p => fs.writeFileSync(POSTS_FILE, JSON.stringify(p, null, 2));
let posts = loadPosts();

const { login:ADMIN_LOGIN, password:ADMIN_PASS } = JSON.parse(fs.readFileSync(CONFIG_FILE,'utf-8'));

/* ----------  MULTER ---------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: (_,__,cb)=>cb(null, UPLOAD_DIR),
    filename:   (_,f ,cb)=>cb(null, Date.now()+path.extname(f.originalname))
  })
});

/* ----------  APP SETUP ---------- */
app.use(bodyParser.urlencoded({ extended:true }));
app.use(session({ secret:'simple-secret', resave:false, saveUninitialized:false }));
app.use('/public', express.static(path.join(__dirname,'public')));

/* ----------  I18N ---------- */
const dict={
 ua:{title:'Фредлосграм',add:'Додати пост',deleteAll:'Видалити все',logout:'Вийти',login:'Увійти',
     wrong:'Невірний логін або пароль',back:'Назад',edit:'Редагувати',remove:'Видалити',conf:'Видалити цей пост?',
     commentPl:'Коментар...',send:'Надіслати',settings:'Налаштування',save:'Зберегти',lang:'EN',
     search:'Пошук...',likes:'Лайки',delCommentConf:'Видалити цей коментар?',namePrompt:'Введіть ваше ім\'я',
     showComments:'Показати коментарі',hideComments:'Сховати коментарі'},
 en:{title:'Fredllosgram',add:'Add post',deleteAll:'Delete all',logout:'Logout',login:'Login',
     wrong:'Invalid login or password',back:'Back',edit:'Edit',remove:'Delete',conf:'Delete this post?',
     commentPl:'Comment...',send:'Send',settings:'Settings',save:'Save',lang:'UA',
     search:'Search...',likes:'Likes',delCommentConf:'Delete this comment?',namePrompt:'Enter your name',
     showComments:'Show comments',hideComments:'Hide comments'}
};
const t=(req,k)=>dict[req.session.lang||'ua'][k];

/* ----------  HELPERS ---------- */
const isAdmin=(req,res,next)=>req.session?.admin?next():res.redirect('/');
const esc=s=>String(s).replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

/* ----------  PAGE TEMPLATE ---------- */
function page(req,content,title=''){
return `<!DOCTYPE html><html lang="${req.session.lang||'ua'}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t(req,'title')}${title}</title>
<style>
 body{font-family:'Segoe UI',sans-serif;background:#1f2a38;color:#fff;margin:0}
 .container{max-width:1000px;margin:auto;padding:20px}
 .header{display:flex;justify-content:center;align-items:center;background:#30445c;padding:15px;position:relative;margin-bottom:20px}
 .header-left{position:absolute;left:15px}.header-title{font-size:1.5em;color:#d1d9e6}
 .header-buttons{position:absolute;right:15px;display:flex;gap:10px}
 button,.btn{background:#3f5e8c;color:#fff;border:none;padding:10px 15px;border-radius:4px;cursor:pointer;font-size:1em}
 button:hover,.btn:hover{background:#5a7ab0}.lang-btn{background:none;border:none;color:#85b4ff;font-size:1em;cursor:pointer}
 input,textarea{width:100%;padding:10px;background:#3a4a5c;color:#fff;border:none;border-radius:4px;margin-bottom:15px}
 .post{background:#2e3b4e;border-radius:8px;padding:15px;margin-bottom:25px;box-shadow:0 0 10px rgba(0,0,0,.2)}
 .post h3{margin:0 0 10px;color:#d1d9e6}.meta{display:flex;justify-content:space-between;font-size:.85em;color:#9ba8b8;margin-top:8px}
 img{max-width:100%;border-radius:6px;cursor:pointer;margin-bottom:10px}
 .like{background:none;border:none;color:#85b4ff;font-size:1em;cursor:pointer}
 .comments{display:none;margin-top:10px}
 .comment-admin{margin-left:8px;color:#f66;cursor:pointer}
 .toggle-btn{background:none;border:none;color:#85b4ff;cursor:pointer;margin-top:5px}
 .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);justify-content:center;align-items:center}
 .modal img{max-height:90%;max-width:90%}
</style>
<script>
 function like(id){
   fetch('/like/'+id, {method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store'})
     .then(r=>r.json())
     .then(j=>{
       const likeCount = document.getElementById('lk'+id);
       if(likeCount) likeCount.innerText = j.likes;
     })
     .catch(()=>alert('Error liking post'));
 }

 function toggleComments(id){
   const box=document.getElementById('c'+id);
   const btn=document.getElementById('b'+id);
   if(!box || !btn) return;
   if(box.style.display==='block'){
     box.style.display='none';
     btn.textContent='${t({session:{lang:req.session.lang||'ua'}},'showComments')}';
   }
   else{
     box.style.display='block';
     btn.textContent='${t({session:{lang:req.session.lang||'ua'}},'hideComments')}';
   }
 }

 function confirmDelComment(p,c){
   if(confirm('${t({session:{lang:req.session.lang||'ua'}},'delCommentConf')}')){
     fetch('/comment/delete/'+p+'/'+c,{method:'POST'}).then(()=>location.reload());
   }
 }
 function submitComment(f){
   const n=prompt('${t({session:{lang:req.session.lang||'ua'}},'namePrompt')}');
   if(!n)return false;
   const i=document.createElement('input');i.type='hidden';i.name='name';i.value=n;f.appendChild(i);
   return true;
 }
 function delAll(){if(confirm('${t({session:{lang:req.session.lang||'ua'}},'conf')}'))location='/deleteAll'}
 function sh(i){document.getElementById('m'+i).style.display='flex'}
 function hi(i){document.getElementById('m'+i).style.display='none'}
</script>
</head><body>
<div class="header">
  <div class="header-left"><a class="lang-btn" href="/lang/${req.session.lang==='en'?'ua':'en'}">${t(req,'lang')}</a></div>
  <div class="header-title">${t(req,'title')}</div>
  <div class="header-buttons">
    ${req.session.admin?`<button onclick="location='/add'">${t(req,'add')}</button><button onclick="delAll()">${t(req,'deleteAll')}</button><button onclick="location='/logout'">${t(req,'logout')}</button>`:
      `<button onclick="location='/login'">${t(req,'login')}</button>`}
  </div>
</div>
<div class="container">${content}</div></body></html>`;
}

/* ----------  ROUTES ---------- */
app.get('/', (req, res) => {
  // Фільтр пошуку (хоч ти просив без зміни, але залишу для сумісності)
  const q = req.query.q?.toLowerCase() || '';
  let filtered = posts.filter(p => p.text.toLowerCase().includes(q) || p.title.toLowerCase().includes(q));
  // Відповідь
  const postsHtml = filtered.map(p => `
    <div class="post">
      <h3>${esc(p.title)}</h3>
      ${p.image ? `<img src="/public/uploads/${p.image}" alt="${esc(p.title)}" onclick="sh(${p.id})">` : ''}
      <p>${esc(p.text)}</p>
      <div class="meta">
        <button class="like" onclick="like(${p.id})">❤️ <span id="lk${p.id}">${p.likes || 0}</span></button>
        <button class="toggle-btn" id="b${p.id}" onclick="toggleComments(${p.id})">${t(req,'showComments')}</button>
      </div>
      <div class="comments" id="c${p.id}">
        ${(p.comments||[]).map((c,i) => `
          <p><b>${esc(c.name)}:</b> ${esc(c.text)}${req.session.admin ? ` <span class="comment-admin" onclick="confirmDelComment(${p.id},${i})">✖</span>` : ''}</p>
        `).join('')}
        <form onsubmit="return submitComment(this)" method="POST" action="/comment/${p.id}">
          <input name="text" placeholder="${t(req,'commentPl')}" required>
          <button type="submit">${t(req,'send')}</button>
        </form>
      </div>
      <div class="modal" id="m${p.id}" onclick="hi(${p.id})"><img src="/public/uploads/${p.image}" alt=""></div>
    </div>
  `).join('');
  res.send(page(req, postsHtml));
});

app.get('/like/:id', (req, res) => res.redirect('/')); // на всяк випадок

app.post('/like/:id', (req, res) => {
  const id = Number(req.params.id);
  const post = posts.find(p => p.id === id);
  if (post) {
    post.likes = (post.likes || 0) + 1;
    savePosts(posts);
    res.json({likes: post.likes});
  } else res.status(404).json({error:'Post not found'});
});

/* ----------  COMMENT DELETE ---------- */
app.post('/comment/delete/:postId/:commentIdx', isAdmin, (req, res) => {
  const pId = Number(req.params.postId);
  const cIdx = Number(req.params.commentIdx);
  const post = posts.find(p => p.id === pId);
  if(post && post.comments && post.comments[cIdx]){
    post.comments.splice(cIdx,1);
    savePosts(posts);
  }
  res.end();
});

/* ----------  COMMENT ADD ---------- */
app.post('/comment/:postId', (req, res) => {
  const pId = Number(req.params.postId);
  const post = posts.find(p => p.id === pId);
  if(post){
    const name = req.body.name || 'Anonymous';
    const text = req.body.text || '';
    if(!post.comments) post.comments = [];
    post.comments.push({name, text});
    savePosts(posts);
  }
  res.redirect('/');
});

/* ----------  LANG SWITCH ---------- */
app.get('/lang/:code', (req,res)=>{
  if(['ua','en'].includes(req.params.code)) req.session.lang = req.params.code;
  res.redirect('back');
});

/* ----------  LOGIN ---------- */
app.get('/login', (req,res) => {
  if(req.session.admin) return res.redirect('/');
  res.send(page(req, `<form method="POST" action="/login">
    <input name="login" placeholder="${t(req,'login')}" required>
    <input name="password" type="password" placeholder="Password" required>
    <button type="submit">${t(req,'login')}</button>
  </form>`, ' - '+t(req,'login')));
});
app.post('/login', (req,res) => {
  if(req.body.login === ADMIN_LOGIN && req.body.password === ADMIN_PASS){
    req.session.admin = true;
    res.redirect('/');
  } else {
    res.send(page(req, `<p style="color:red">${t(req,'wrong')}</p><a href="/login">${t(req,'back')}</a>`, ' - '+t(req,'login')));
  }
});
app.get('/logout', (req,res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* ----------  DELETE ALL POSTS ---------- */
app.get('/deleteAll', isAdmin, (req,res) => {
  posts = [];
  savePosts(posts);
  res.redirect('/');
});

/* ----------  START ---------- */
app.listen(PORT, ()=>console.log(`Server started on http://localhost:${PORT}`));
