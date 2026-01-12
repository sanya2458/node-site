require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

cloudinary.config({
  url: process.env.CLOUDINARY_URL
});
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app  = express();
const PORT = process.env.PORT || 3000;

/* =================== DATABASE =================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const postSchema = new mongoose.Schema({
  title: String,
  body: String,
  img: String,
  date: Number,
  likes: { type:Number, default:0 },
  comments: [{ name:String, body:String }]
});
const Post = mongoose.model('Post', postSchema);

/* =================== CLOUDINARY =================== */
cloudinary.config();
const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: { folder: 'posts' }
  })
});

/* =================== MIDDLEWARE =================== */
app.use(bodyParser.urlencoded({ extended:true }));
app.use(session({ secret:'simple-secret', resave:false, saveUninitialized:false }));

/* =================== AUTH =================== */
const ADMIN_LOGIN = 'admin';
const ADMIN_PASS  = '1234';
const isAdmin = (req,res,next)=>req.session?.admin?next():res.redirect('/');

/* =================== LANG =================== */
const dict={
 ua:{title:'fredllosgram',add:'Додати пост',deleteAll:'Видалити все',logout:'Вийти',login:'Увійти',
     wrong:'Невірний логін або пароль',back:'Назад',edit:'Редагувати',remove:'Видалити',conf:'Видалити цей пост?',
     commentPl:'Коментар...',send:'Надіслати',settings:'Налаштування',save:'Зберегти',lang:'EN',
     search:'Пошук...',likes:'Лайки',delCommentConf:'Видалити цей коментар?',namePrompt:'Введіть ваше ім\'я',
     showComments:'Показати коментарі',hideComments:'Сховати коментарі'},
 en:{title:'fredllosgram',add:'Add post',deleteAll:'Delete all',logout:'Logout',login:'Login',
     wrong:'Invalid login or password',back:'Back',edit:'Edit',remove:'Delete',conf:'Delete this post?',
     commentPl:'Comment...',send:'Send',settings:'Settings',save:'Save',lang:'UA',
     search:'Search...',likes:'Likes',delCommentConf:'Delete this comment?',namePrompt:'Enter your name',
     showComments:'Show comments',hideComments:'Hide comments'}
};
const t=(req,k)=>dict[req.session.lang||'ua'][k];
const esc=s=>String(s).replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));

/* =================== PAGE =================== */
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
 input,textarea{width:100%;padding:10px;background:#3a4a5c;color:#fff;border:none;border-radius:4px;margin-bottom:15px;box-sizing:border-box;}
 .post{background:#2e3b4e;border-radius:8px;padding:15px;margin-bottom:25px;box-shadow:0 0 10px rgba(0,0,0,.2);position:relative;}
 .post h3{margin:0 0 10px;color:#d1d9e6}
 .meta{display:flex;justify-content:space-between;font-size:.85em;color:#9ba8b8;margin-top:8px}
 img{max-width:100%;border-radius:6px;cursor:pointer;margin-bottom:10px}
 .comment-admin{margin-left:8px;color:#f66;cursor:pointer}
 details summary{cursor:pointer; font-weight:bold; margin-bottom:10px; color:#85b4ff; padding:8px 15px; border-radius:4px; background:#3f5e8c; display:inline-block; user-select:none; transition: background-color .3s;}
 details summary:hover{background:#5a7ab0;}
 details[open] summary::after {content:" ▲";} 
 details summary::after {content:" ▼";}
 .comments-block p{margin:4px 0;}
 .comments-block form{margin-top:10px;}
 .comments-block input, .comments-block textarea{margin-bottom:10px;}
 .comments-block input, .comments-block textarea {max-width: 100%; box-sizing: border-box;}
 .comments-block form { overflow: hidden; }
 .post-buttons { margin-top: 10px; display: flex; gap: 10px; }
</style>
<script>
 function submitComment(f){return true}
 function confirmDelComment(p,c){if(confirm('${dict.ua.delCommentConf}'))fetch('/comment/delete/'+p+'/'+c,{method:'POST'}).then(()=>location.reload())}
 function confirmDelPost(id){if(confirm('${dict.ua.conf}'))location='/delete/'+id}
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

/* =================== ROUTES =================== */
app.get('/',async(req,res)=>{
 const q=(req.query.search||'').toLowerCase();
 const list=await Post.find(
  !q?{}:{ $or:[{title:{$regex:q,$options:'i'}},{body:{$regex:q,$options:'i'}}] }
 ).sort({date:-1});
 const postsHtml=list.map((p,i)=>{
  const date=new Date(p.date).toLocaleString(req.session.lang==='en'?'en-US':'uk-UA',{dateStyle:'medium',timeStyle:'short'});
  return `<div class="post">
    <h3>${esc(p.title)}</h3>
    ${p.img?`<img src="${esc(p.img)}">`:''}
    <div class="meta"><span>${date}</span></div>
    <p>${esc(p.body)}</p>
    ${req.session.admin?`
      <div class="post-buttons">
        <a href="/edit/${p._id}" class="btn">${t(req,'edit')}</a>
        <button class="btn" onclick="confirmDelPost('${p._id}')">${t(req,'remove')}</button>
      </div>`:''}
    <details>
      <summary>${t(req,'showComments')}</summary>
      <div class="comments-block">
        ${(p.comments||[]).map((c,j)=>`<p>${esc(c.name)}: ${esc(c.body)}${req.session.admin?` <span class="comment-admin" onclick="confirmDelComment('${p._id}',${j})">×</span>`:''}</p>`).join('')}
        <form method="POST" action="/comment/${p._id}" onsubmit="return submitComment(this)">
          <input name="name" placeholder="${t(req,'namePrompt')}" required autocomplete="off" maxlength="50">
          <input name="comment" placeholder="${t(req,'commentPl')}" required autocomplete="off" maxlength="200">
          <button>${t(req,'send')}</button>
        </form>
      </div>
    </details>
  </div>`;}).join('');
 res.send(page(req,`
 <form method="GET" style="margin-bottom:20px"><input type="search" name="search" placeholder="${t(req,'search')}" value="${esc(req.query.search||'')}">
 <button>${t(req,'search')}</button></form>
 ${postsHtml||'<p>No posts</p>'}`));
});

app.get('/lang/:lang',(req,res)=>{if(['ua','en'].includes(req.params.lang))req.session.lang=req.params.lang;res.redirect('back');});

/* ===== LOGIN ===== */
app.get('/login',(req,res)=>{if(req.session.admin)return res.redirect('/');
 res.send(page(req,`<form method="POST" style="max-width:300px;margin:auto">
 <input name="login" placeholder="Login" required autofocus><input type="password" name="password" placeholder="Password" required>
 <button>${t(req,'login')}</button></form>`,' - Login'));});
app.post('/login',(req,res)=>{
 const {login,password}=req.body;
 if(login===ADMIN_LOGIN && password===ADMIN_PASS){req.session.admin=true;res.redirect('/');}
 else res.send(page(req,`<p style="color:#f66">${t(req,'wrong')}</p><a href="/login">${t(req,'back')}</a>`,' - Login'));});
app.get('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/')));

/* ===== ADD POST ===== */
app.get('/add',isAdmin,(req,res)=>res.send(page(req,`<form method="POST" action="/add" enctype="multipart/form-data" style="max-width:600px;margin:auto">
 <input name="title" placeholder="Title" required><textarea name="body" placeholder="Content" rows="5" required></textarea>
 <input type="file" name="img" accept="image/*"><button>${t(req,'add')}</button></form>`,' - Add')));
app.post('/add',isAdmin,upload.single('img'),async(req,res)=>{
 await Post.create({title:req.body.title,body:req.body.body,img:req.file?.path||'',date:Date.now(),likes:0,comments:[]});
 res.redirect('/');
});

/* ===== EDIT POST ===== */
app.get('/edit/:id',isAdmin,async(req,res)=>{
 const p = await Post.findById(req.params.id);
 if(!p) return res.redirect('/');
 res.send(page(req,`<form method="POST" action="/edit/${p._id}" enctype="multipart/form-data" style="max-width:600px;margin:auto">
   <input name="title" value="${esc(p.title)}" required>
   <textarea name="body" rows="5" required>${esc(p.body)}</textarea>
   ${p.img?`<img src="${esc(p.img)}" style="max-width:200px"><br>`:''}
   <input type="file" name="img" accept="image/*"><br>
   <label>Date:<input type="datetime-local" name="date" value="${new Date(p.date).toISOString().slice(0,16)}"></label><br><br>
   <button>${t(req,'save')}</button></form>`,' - Edit'));
});
app.post('/edit/:id',isAdmin,upload.single('img'),async(req,res)=>{
 const p = await Post.findById(req.params.id);
 if(!p) return res.redirect('/');
 p.title=req.body.title;
 p.body=req.body.body;
 if(req.file) p.img=req.file.path;
 if(req.body.date) p.date=new Date(req.body.date).getTime();
 await p.save();
 res.redirect('/');
});

/* ===== DELETE POST ===== */
app.get('/delete/:id',isAdmin,async(req,res)=>{
 await Post.deleteOne({_id:req.params.id});
 res.redirect('/');
});

/* ===== COMMENTS ===== */
app.post('/comment/:id',async(req,res)=>{
 await Post.updateOne({_id:req.params.id},{$push:{comments:{name:req.body.name,body:req.body.comment}}});
 res.redirect('/');
});
app.post('/comment/delete/:pid/:cid',isAdmin,async(req,res)=>{
 const p=await Post.findById(req.params.pid);
 if(p?.comments?.[req.params.cid]){p.comments.splice(req.params.cid,1); await p.save(); res.sendStatus(200);}
 else res.sendStatus(404);
});

app.listen(PORT,()=>console.log('Server running on port '+PORT));
