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
       enterName:'Введіть ваше ім’я', deleteCommentConf:'Видалити цей коментар?', 
       editDate:'Редагувати дату публікації (ISO формат)', updateDate:'Оновити дату' },
  en:{ title:'Fredllosgram', add:'Add post', deleteAll:'Delete all', logout:'Logout',
       login:'Login', wrong:'Invalid login or password', back:'Back',
       edit:'Edit', remove:'Delete', conf:'Delete this post?',
       commentPl:'Comment...', send:'Send', settings:'Settings',
       save:'Save', lang:'UA', search:'Search...', likes:'Likes',
       enterName:'Enter your name', deleteCommentConf:'Delete this comment?', 
       editDate:'Edit publish date (ISO format)', updateDate:'Update date' }
};
const t = (req,k)=>dict[(req.session.lang||'ua')][k];

/* ----------  HELPERS ---------- */
const isAdmin = (req,res,next)=> req.session?.admin ? next() : res.redirect('/login');
const esc = s=>String(s).replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

/* ----------  COMMON PAGE HEAD ---------- */
function head(req,title=''){
  return `<html><head><title>${t(req,'title')}${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;background:#1f2a38;color:#fff}
    .container{max-width:1000px;margin:auto;padding:20px}
    .header {
      display:flex; align-items:center; padding:15px; background:#30445c; margin-bottom:20px; 
      justify-content:center; position:relative;
      font-size: 1.5em; font-weight: 700; color:#d1d9e6;
      user-select:none;
    }
    .header-left {
      position:absolute; left:20px; top:50%; transform: translateY(-50%);
    }
    .header-buttons {
      position:absolute; right:20px; top:50%; transform: translateY(-50%);
      display:flex; gap:10px;
    }
    button,.btn {
      background:#3f5e8c; color:#fff; border:none; padding:10px 15px; border-radius:4px; cursor:pointer; text-decoration:none;
      font-size:1em;
      transition: background 0.3s;
    }
    button:hover,.btn:hover { background:#5a7ab0 }
    .lang-btn {
      background:none; border:none; color:#85b4ff; font-size:1em; padding:0 6px; cursor:pointer;
      user-select:none;
    }
    .action {
      display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin:25px 0;
    }
    .post {
      background:#2e3b4e; border-radius:8px; padding:15px; margin-bottom:25px; box-shadow:0 0 10px rgba(0,0,0,.2);
    }
    .post h3 {
      margin:0 0 10px; color:#d1d9e6;
      user-select:none;
    }
    .meta {
      font-size:.8em; color:#9ba8b8; margin:8px 0 4px 0;
      text-align:center;
    }
    .image-container {
      text-align:center; margin-bottom: 8px;
      position: relative;
    }
    img {
      max-width:100%; border-radius:6px; cursor:pointer;
      user-select:none;
      max-height: 400px;
      object-fit: contain;
    }
    .like {
      border:none; background:none; color:#85b4ff; font-size:1.2em; cursor:pointer;
      display:block; margin: 0 auto;
      user-select:none;
    }
    .admin {
      margin-top:10px; font-size:.9em; text-align:right;
    }
    a {
      color:#85b4ff; text-decoration:none;
      user-select:none;
    }
    a:hover { text-decoration:underline }
    form.inline {
      display:inline;
    }
    input[type=text], input[type=password], input[type=number], textarea {
      width:100%; padding:10px; border:none; border-radius:4px; background:#3a4a5c; color:#fff; margin-bottom:15px;
      font-size:1em; box-sizing: border-box;
    }
    input[type=number] {
      width:90px;
    }
    button.btn {
      width: auto;
      padding: 10px 20px;
    }
    /* modal */
    .modal {
      display:none; position:fixed; inset:0; background:rgba(0,0,0,.8);
      justify-content:center; align-items:center; z-index: 999;
    }
    .modal img {
      max-height:90%; max-width:90%;
    }
    /* comments */
    .comments-container {
      margin-top:12px; border-top:1px solid #3a4a5c; padding-top:10px;
    }
    .comment-single {
      background:#3a4a5c; padding:8px 10px; border-radius:6px; cursor:pointer;
      user-select:none;
      margin-bottom: 8px;
      position: relative;
    }
    .comment-single:hover {
      background:#50677a;
    }
    .comment-full-list {
      display:none;
      background:#2a3951; padding:10px; border-radius:6px; margin-top:5px;
      max-height: 200px; overflow-y: auto;
    }
    .comment-full-list p {
      margin: 6px 0; font-size: 0.9em;
    }
    .comment-full-list p b {
      color:#85b4ff;
    }
    .comment-delete {
      position: absolute;
      top: 5px;
      right: 10px;
      color: #ff6b6b;
      cursor: pointer;
      font-weight: bold;
      user-select:none;
    }
    .comment-delete:hover {
      color: #ff4c4c;
    }
    /* date edit */
    .date-edit-container {
      margin: 10px 0 20px 0;
    }
    .date-edit-container input[type=text] {
      width: 100%;
      margin-bottom: 10px;
      font-family: monospace;
    }
    .date-edit-container button {
      margin-left: 0;
      width: 100%;
    }
    /* search */
    .search-bar {
      margin: 15px auto;
      max-width: 400px;
    }
  </style>
  </head><body><div class="container">`;
}

function foot(){
  return `</div></body></html>`;
}

/* ----------  ROUTES ---------- */

app.get('/', (req,res)=>{
  try {
    const posts = loadPosts();

    let html = head(req);
    html += `<div class="header">${t(req,'title')}
      <div class="header-left"></div>
      <div class="header-buttons">
        ${req.session.admin ? `<a href="/add" class="btn">${t(req,'add')}</a>
        <a href="/settings" class="btn">${t(req,'settings')}</a>
        <a href="/logout" class="btn">${t(req,'logout')}</a>` :
        `<a href="/login" class="btn">${t(req,'login')}</a>`}
        <form method="post" action="/lang" style="display:inline;">
          <button type="submit" class="lang-btn">${t(req,'lang')}</button>
        </form>
      </div>
    </div>`;

    html += `<form method="GET" action="/" class="search-bar">
      <input type="text" name="q" placeholder="${t(req,'search')}" value="${esc(req.query.q||'')}">
      <button class="btn" type="submit">🔍</button>
    </form>`;

    // filter posts by search query if present
    let filtered = posts;
    if (req.query.q) {
      const q = req.query.q.toLowerCase();
      filtered = posts.filter(p=>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.comments.some(c=>c.text.toLowerCase().includes(q) || c.author.toLowerCase().includes(q))
      );
    }

    if(filtered.length === 0) {
      html += `<p style="text-align:center; margin-top:50px; font-size:1.2em;">No posts found.</p>`;
    }

    filtered.forEach(post=>{
      html += `<div class="post" id="post-${post.id}">
        <h3>${esc(post.title)}</h3>
        <div class="image-container">
          <img src="${post.image}" alt="${esc(post.title)}" loading="lazy" onclick="showModal('${post.image}')">
        </div>
        <div class="meta">${new Date(post.date).toLocaleString()}</div>
        <button class="like" data-id="${post.id}" title="${t(req,'likes')}">${t(req,'likes')}: ${post.likes||0} ❤️</button>`;

      // comments section
      html += `<div class="comments-container">`;
      if(post.comments.length>0){
        // show last comment only, rest hidden and toggle on click
        const lastComment = post.comments[post.comments.length - 1];
        html += `<div class="comment-single" onclick="toggleComments(${post.id})">
          <b>${esc(lastComment.author)}</b>: ${esc(lastComment.text)} (${new Date(lastComment.date).toLocaleString()})
          ${req.session.admin ? `<span class="comment-delete" onclick="event.stopPropagation(); deleteComment(${post.id},${post.comments.length-1})" title="${t(req,'deleteCommentConf')}">×</span>` : ''}
        </div>`;

        if(post.comments.length>1){
          html += `<div class="comment-full-list" id="comments-full-${post.id}">`;
          post.comments.slice(0,-1).forEach((c,i)=>{
            html += `<p><b>${esc(c.author)}</b>: ${esc(c.text)} (${new Date(c.date).toLocaleString()})
              ${req.session.admin ? `<span class="comment-delete" onclick="event.stopPropagation(); deleteComment(${post.id},${i})" title="${t(req,'deleteCommentConf')}">×</span>` : ''}
              </p>`;
          });
          html += `</div>`;
        }
      } else {
        html += `<p style="font-style: italic;">No comments yet.</p>`;
      }

      // add comment form
      html += `<form method="POST" action="/comment/${post.id}">
        <input type="text" name="author" placeholder="${t(req,'enterName')}" required maxlength="30" />
        <textarea name="comment" placeholder="${t(req,'commentPl')}" required maxlength="300"></textarea>
        <button type="submit" class="btn">${t(req,'send')}</button>
      </form>`;

      // admin edit date section
      if(req.session.admin){
        html += `<form method="POST" action="/editdate/${post.id}" class="date-edit-container">
          <label>${t(req,'editDate')}</label><br>
          <input type="text" name="newdate" value="${esc(post.date)}" placeholder="YYYY-MM-DDTHH:mm:ssZ" />
          <button type="submit" class="btn">${t(req,'updateDate')}</button>
        </form>`;
      }

      // admin buttons: edit, delete
      if(req.session.admin){
        html += `<div class="admin">
          <a href="/edit/${post.id}" class="btn">${t(req,'edit')}</a>
          <form method="POST" action="/delete/${post.id}" class="inline" onsubmit="return confirm('${t(req,'conf')}');">
            <button type="submit" class="btn">${t(req,'remove')}</button>
          </form>
        </div>`;
      }

      html += `</div></div>`;
    });

    html += foot();

    res.send(html);
  } catch(e){
    console.error('Error in /:', e);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/lang', (req,res)=>{
  req.session.lang = (req.session.lang === 'ua') ? 'en' : 'ua';
  res.redirect('back');
});

app.get('/login', (req,res)=>{
  const html = head(req, ' - '+t(req,'login')) + `
    <h2>${t(req,'login')}</h2>
    <form method="POST" action="/login">
      <input name="login" placeholder="${t(req,'login')}" required />
      <input name="password" type="password" placeholder="******" required />
      <button class="btn" type="submit">${t(req,'login')}</button>
    </form>
    <p><a href="/">⬅ ${t(req,'back')}</a></p>
  ` + foot();
  res.send(html);
});

app.post('/login', (req,res)=>{
  if(req.body.login === ADMIN_LOGIN && req.body.password === ADMIN_PASS){
    req.session.admin = true;
    res.redirect('/');
  } else {
    const html = head(req) + `<p style="color:red">${t(req,'wrong')}</p><a href="/login">${t(req,'back')}</a>` + foot();
    res.send(html);
  }
});

app.get('/logout', (req,res)=>{
  req.session.destroy(()=>res.redirect('/'));
});

/* ----------  ADD POST ---------- */
app.get('/add', isAdmin, (req,res)=>{
  const html = head(req, ' - '+t(req,'add')) + `
    <h2>${t(req,'add')}</h2>
    <form method="POST" action="/add" enctype="multipart/form-data">
      <input name="title" placeholder="Title" required maxlength="100" />
      <textarea name="description" placeholder="Description" maxlength="1000"></textarea>
      <input type="file" name="image" accept="image/*" required />
      <button type="submit" class="btn">${t(req,'add')}</button>
    </form>
    <p><a href="/">⬅ ${t(req,'back')}</a></p>
  ` + foot();
  res.send(html);
});

app.post('/add', isAdmin, upload.single('image'), (req,res)=>{
  try{
    const { title, description } = req.body;
    if(!req.file) throw new Error('Image required');
    const post = {
      id: Date.now(),
      title,
      description: description||'',
      image: `/public/uploads/${req.file.filename}`,
      date: new Date().toISOString(),
      likes: 0,
      comments: []
    };
    posts.push(post);
    savePosts(posts);
    res.redirect('/');
  } catch(e){
    res.status(400).send('Error: ' + e.message);
  }
});

/* ----------  DELETE POST ---------- */
app.post('/delete/:id', isAdmin, (req,res)=>{
  try{
    const id = Number(req.params.id);
    posts = posts.filter(p=>p.id !== id);
    savePosts(posts);
    res.redirect('/');
  } catch(e){
    res.status(500).send('Error deleting post');
  }
});

/* ----------  EDIT DATE ---------- */
app.post('/editdate/:id', isAdmin, (req,res)=>{
  try {
    const id = Number(req.params.id);
    const newdate = req.body.newdate;
    if (!new Date(newdate).toString() === "Invalid Date"){
      // skip invalid date update
      throw new Error('Invalid date format');
    }
    let post = posts.find(p=>p.id === id);
    if(post){
      post.date = newdate;
      savePosts(posts);
    }
    res.redirect('/');
  } catch(e){
    res.status(400).send('Error updating date');
  }
});

/* ----------  COMMENT ---------- */
app.post('/comment/:id', (req,res)=>{
  try{
    const id = Number(req.params.id);
    let post = posts.find(p=>p.id===id);
    if(!post) throw new Error('Post not found');
    const author = req.body.author.trim().substring(0,30);
    const text = req.body.comment.trim().substring(0,300);
    if(!author || !text) throw new Error('Author and comment required');
    post.comments.push({ author, text, date: new Date().toISOString() });
    savePosts(posts);
    res.redirect('/');
  } catch(e){
    res.status(400).send('Error adding comment');
  }
});

/* ----------  DELETE COMMENT ---------- */
app.post('/comment/delete/:postId/:commIdx', isAdmin, (req,res)=>{
  try{
    const postId = Number(req.params.postId);
    const commIdx = Number(req.params.commIdx);
    let post = posts.find(p=>p.id === postId);
    if(post && post.comments[commIdx]){
      post.comments.splice(commIdx,1);
      savePosts(posts);
    }
    res.redirect('/');
  } catch(e){
    res.status(500).send('Error deleting comment');
  }
});

/* ----------  STATIC FILES ---------- */
app.use(express.static('public'));

/* ----------  JS FOR COMMENTS, MODAL, LIKE ---------- */
app.get('/script.js', (req,res)=>{
  res.type('application/javascript');
  res.send(`
    function toggleComments(postId){
      const fullList = document.getElementById('comments-full-' + postId);
      if(fullList) fullList.style.display = fullList.style.display === 'block' ? 'none' : 'block';
    }
    function showModal(imgSrc){
      let modal = document.getElementById('modal');
      if(!modal){
        modal = document.createElement('div');
        modal.id = 'modal';
        modal.className = 'modal';
        modal.onclick = e => {
          if(e.target.id === 'modal') modal.style.display = 'none';
        };
        const img = document.createElement('img');
        img.id = 'modal-img';
        modal.appendChild(img);
        document.body.appendChild(modal);
      }
      document.getElementById('modal-img').src = imgSrc;
      modal.style.display = 'flex';
    }
    // delete comment via POST form (simulate)
    function deleteComment(postId, commIdx){
      if(confirm('${t({lang:'ua'},'deleteCommentConf')}')){
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/comment/delete/' + postId + '/' + commIdx;
        document.body.appendChild(form);
        form.submit();
      }
    }
  `);
});

/* ----------  SERVER START ---------- */
app.listen(PORT, ()=>{
  console.log(`Server started on http://localhost:${PORT}`);
});
