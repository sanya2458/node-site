const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_,__,cb)=>cb(null, UPLOAD_DIR),
    filename:   (_,f ,cb)=>cb(null, Date.now()+path.extname(f.originalname))
  })
});

app.use(bodyParser.urlencoded({ extended:true }));
app.use(session({ secret:'simple-secret', resave:false, saveUninitialized:false }));
app.use('/public', express.static(path.join(__dirname,'public')));

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
const isAdmin=(req,res,next)=>req.session?.admin?next():res.redirect('/');
const esc=s=>String(s).replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

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
 .comment-admin{margin-left:8px;color:#f66;cursor:pointer}
 .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);justify-content:center;align-items:center}
 .modal img{max-height:90%;max-width:90%}
 .comments{display:none}
</style>
<script>
 function sh(i){document.getElementById('m'+i).style.display='flex'}
 function hi(i){document.getElementById('m'+i).style.display='none'}
 function confirmDelComment(p,c){if(confirm('${dict.ua.delCommentConf}'))fetch('/comment/delete/'+p+'/'+c,{method:'POST'}).then(()=>location.reload())}
 function submitComment(f){
   const nameInput = f.querySelector('input[name="name"]');
   if(!nameInput.value.trim()){
     alert('${dict.ua.namePrompt}');
     nameInput.focus();
     return false;
   }
   return true;
 }
 function toggleComments(id){
   const el = document.getElementById('comments'+id);
   const btn = document.getElementById('toggleBtn'+id);
   if(el.style.display==='none'){
     el.style.display='block';
     btn.textContent='${dict.ua.hideComments}';
   }else{
     el.style.display='none';
     btn.textContent='${dict.ua.showComments}';
   }
 }
 function delAll(){if(confirm('${dict.ua.conf}'))location='/deleteAll'}
</script>
</head><body>
<div class="header">
  <div class="header-left"><a class="lang-btn" href="/lang/${req.session.lang==='en'?'ua':'en'}">${t(req,'lang')}</a></div>
  <div class="header-title">${t(req,'title')}</div>
  <div class="header-buttons">
   ${req.session.admin?`<a href="/add" class="btn">${t(req,'add')}</a>
    <button class="btn" onclick="delAll()">${t(req,'deleteAll')}</button>
    <a href="/logout" class="btn">${t(req,'logout')}</a>`:
    `<a href="/login" class="btn">${t(req,'login')}</a>`}
  </div>
</div>
<div class="container">
${content}
</div></body></html>`}

app.get('/',(req,res)=>{
 const q=(req.query.search||'').toLowerCase();
 const lang=req.session.lang||'ua';
 const list=posts.filter(p=>!q||p.title.toLowerCase().includes(q)||p.body.toLowerCase().includes(q))
                 .sort((a,b)=>b.date - a.date);
 const postsHtml=list.map((p,i)=>{
  const date=new Date(p.date).toLocaleString(lang==='ua'?'uk-UA':'en-US',{dateStyle:'medium',timeStyle:'short'});
  return `<div class="post">
    <h3>${esc(p.title)}</h3>
    ${p.img?`<img src="/public/uploads/${esc(p.img)}" alt="img" onclick="sh(${i})">`:''}
    <div class="meta"><span>${date}</span></div>
    <p>${esc(p.body)}</p>
    <button id="toggleBtn${p.id}" onclick="toggleComments(${p.id})">${t(req,'showComments')}</button>
    <div class="comments" id="comments${p.id}">
      ${(p.comments||[]).map((c,j)=>`<p>${esc(c.name)}: ${esc(c.body)}${req.session.admin?`<span class="comment-admin" onclick="confirmDelComment(${p.id},${j})">×</span>`:''}</p>`).join('')}
      <form method="POST" action="/comment/${p.id}" onsubmit="return submitComment(this)">
        <input name="name" placeholder="${t(req,'namePrompt')}" required autocomplete="off">
        <input name="comment" placeholder="${t(req,'commentPl')}" required autocomplete="off">
        <button>${t(req,'send')}</button>
      </form>
    </div>
    ${req.session.admin?`<div><a href="/edit/${p.id}">${t(req,'edit')}</a> | <a href="/delete/${p.id}" onclick="return confirm('${t(req,'conf')}')">${t(req,'remove')}</a></div>`:''}
    <div id="m${i}" class="modal" onclick="hi(${i})"><img src="/public/uploads/${esc(p.img)}"></div>
  </div>`;}).join('');
 res.send(page(req,`
 <form method="GET" style="margin-bottom:20px"><input type="search" name="search" placeholder="${t(req,'search')}" value="${esc(req.query.search||'')}">
 <button>${t(req,'search')}</button></form>
 ${postsHtml||'<p>No posts</p>'}`));
});

app.get('/lang/:lang',(req,res)=>{if(['ua
::contentReference[oaicite:0]{index=0}
 
app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
