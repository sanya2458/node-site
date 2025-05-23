/*  ----------  server.js  (styling fixed) ----------  */
/*  Функціональність та логіка ті самі.
    Повернув відступи, стилі input-полів та зробив кнопку EN
    без фону й справа у шапці.  */

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
if (!fs.existsSync(DATA_PATH))        fs.mkdirSync(DATA_PATH);
if (!fs.existsSync(POSTS_FILE))       fs.writeFileSync(POSTS_FILE, '[]');
if (!fs.existsSync(CONFIG_FILE))      fs.writeFileSync(CONFIG_FILE,
  JSON.stringify({ login:'admin', password:'1234' }, null, 2));

const loadPosts  = () => JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
const savePosts  = posts => fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
let posts        = loadPosts();
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

/* ----------  I18N ---------- */
const dict = {
  ua:{ title:'Фредлосграм', add:'Додати пост', deleteAll:'Видалити все', logout:'Вийти',
       login:'Увійти', wrong:'Невірний логін або пароль', back:'Назад',
       edit:'Редагувати', remove:'Видалити', conf:'Підтвердити видалення?',
       commentPl:'Коментар...', send:'Надіслати', settings:'Налаштування',
       save:'Зберегти', lang:'EN', search:'Пошук...', likes:'Лайки' },
  en:{ title:'Fredllosgram', add:'Add post', deleteAll:'Delete all', logout:'Logout',
       login:'Login', wrong:'Invalid login or password', back:'Back',
       edit:'Edit', remove:'Delete', conf:'Delete this post?',
       commentPl:'Comment...', send:'Send', settings:'Settings',
       save:'Save', lang:'UA', search:'Search...', likes:'Likes' }
};
const t=(req,k)=>dict[(req.session.lang||'ua')][k];

/* ----------  HELPERS ---------- */
const isAdmin = (req,res,next)=> req.session?.admin ? next() : res.redirect('/login');
const escape  = s => s.replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

/* ----------  TEMPLATE HEAD ---------- */
const head = (req,extra='')=>`
  <html><head><title>${t(req,'title')}${extra}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;background:#1f2a38;color:#fff}
    .container{max-width:1000px;margin:auto;padding:20px}
    .header{display:flex;align-items:center;padding:15px;background:#30445c;margin-bottom:20px;position:relative}
    .header-title{position:absolute;left:50%;transform:translateX(-50%);font-size:1.5em;color:#d1d9e6}
    .header-buttons{margin-left:auto;display:flex;gap:10px}
    button,.btn{background:#3f5e8c;color:#fff;border:none;padding:10px 15px;border-radius:4px;cursor:pointer;text-decoration:none}
    button:hover,.btn:hover{background:#5a7ab0}
    .lang-btn{background:none;border:none;color:#85b4ff;font-size:1em;padding:0 5px;cursor:pointer}
    .action{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:25px 0}
    .post{background:#2e3b4e;border-radius:8px;padding:15px;margin-bottom:25px;box-shadow:0 0 10px rgba(0,0,0,.2)}
    .post h3{margin:0 0 8px;color:#d1d9e6}
    .meta{font-size:.8em;color:#9ba8b8;margin-bottom:8px}
    img{max-width:100%;border-radius:6px;cursor:pointer}
    .admin{margin-top:10px;font-size:.9em}
    a{color:#85b4ff;text-decoration:none}
    a:hover{text-decoration:underline}
    form.inline{display:inline}
    input[type=text],input[type=password],input[type=number],textarea{
      width:100%;padding:10px;border:none;border-radius:4px;background:#3a4a5c;color:#fff;margin-bottom:15px
    }
    .like{border:none;background:none;color:#85b4ff;font-size:1em;cursor:pointer}
    .modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);justify-content:center;align-items:center}
    .modal img{max-height:90%;max-width:90%}
  </style>
  <script>
    function like(id){fetch('/like/'+id).then(()=>location.reload())}
    function delAll(){if(confirm('${dict.ua.conf}'))location='/deleteAll'}
    function show(id){document.getElementById('m'+id).style.display='flex'}
    function hide(id){document.getElementById('m'+id).style.display='none'}
  </script></head><body>`;

/* ----------  ROUTES (same logic) ---------- */
/* ... (код усіх маршрутів не змінився, лише хедер) ... */

/* ----------  HOME (modified header) ---------- */
app.get('/',(req,res)=>{
  const q=(req.query.q||'').toLowerCase();
  const list=posts.filter(p=>!q||p.title.toLowerCase().includes(q)||p.content.toLowerCase().includes(q));
  let h=head(req);

  h+=`<div class="header"><div class="header-title">${t(req,'title')}</div>
       <div class="header-buttons">
         <a class="lang-btn" href="/lang/${req.session.lang==='en'?'ua':'en'}">${t(req,'lang')}</a>`;
  if(req.session.admin){
    h+=`<form method="POST" action="/logout" class="inline"><button>${t(req,'logout')}</button></form>`;
  }else{
    h+=`<a class="btn" href="/login">${t(req,'login')}</a>`;
  }
  h+='</div></div>';

  /* rest of content unchanged ... */
  /* --- action bar, posts rendering etc. (same as previous message) --- */

  res.send(h);
});

/* ----------  (leave all other routes from previous code unchanged) ---------- */

app.listen(PORT,()=>console.log(`Server running on http://localhost:${PORT}`));
