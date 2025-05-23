const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// --- Шляхи та файли ---
const DATA_PATH   = path.join(__dirname, 'data');
const POSTS_FILE  = path.join(DATA_PATH, 'posts.json');
const CONFIG_FILE = path.join(DATA_PATH, 'config.json');
const UPLOAD_DIR  = path.join(__dirname, 'public', 'uploads');

// --- Переконаємося, що потрібні папки і файли існують ---
if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH);
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]');
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ login: 'admin', password: '1234' }, null, 2));
}
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- Завантаження та збереження постів ---
const loadPosts = () => JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
const savePosts = posts => fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
let posts = loadPosts();

// --- Конфіг адміністрування ---
const { login: ADMIN_LOGIN, password: ADMIN_PASS } = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

// --- Налаштування Multer для завантаження ---
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
  })
});

// --- Express Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'simple-secret', resave: false, saveUninitialized: false }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- Мовний словник ---
const dict = {
  ua: {
    title: 'Фредлосграм',
    add: 'Додати пост',
    deleteAll: 'Видалити все',
    logout: 'Вийти',
    login: 'Увійти',
    wrong: 'Невірний логін або пароль',
    back: 'Назад',
    edit: 'Редагувати',
    remove: 'Видалити',
    conf: 'Видалити цей пост?',
    commentPl: 'Коментар...',
    send: 'Надіслати',
    settings: 'Налаштування',
    save: 'Зберегти',
    lang: 'EN',
    search: 'Пошук...',
    likes: 'Лайки',
    delCommentConf: 'Видалити цей коментар?',
    namePrompt: 'Введіть ваше ім\'я'
  },
  en: {
    title: 'Fredllosgram',
    add: 'Add post',
    deleteAll: 'Delete all',
    logout: 'Logout',
    login: 'Login',
    wrong: 'Invalid login or password',
    back: 'Back',
    edit: 'Edit',
    remove: 'Delete',
    conf: 'Delete this post?',
    commentPl: 'Comment...',
    send: 'Send',
    settings: 'Settings',
    save: 'Save',
    lang: 'UA',
    search: 'Search...',
    likes: 'Likes',
    delCommentConf: 'Delete this comment?',
    namePrompt: 'Enter your name'
  }
};

const t = (req, key) => dict[req.session.lang || 'ua'][key];

// --- Перевірка прав адміністратора ---
const isAdmin = (req, res, next) => req.session?.admin ? next() : res.redirect('/');

// --- Функція безпечного виводу (escape) ---
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

// --- HTML шаблон ---
function renderPage(req, content, title = '') {
  return `<!DOCTYPE html>
<html lang="${req.session.lang || 'ua'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t(req,'title')}${title}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #1f2a38; color: #fff; }
  .container { max-width: 1000px; margin: auto; padding: 20px; }
  .header { display: flex; justify-content: center; align-items: center; background: #30445c; padding: 15px; position: relative; margin-bottom: 20px; }
  .header-left { position: absolute; left: 15px; }
  .header-title { font-size: 1.5em; color: #d1d9e6; user-select: none; }
  .header-buttons { position: absolute; right: 15px; display: flex; gap: 10px; }
  button, .btn { background: #3f5e8c; color: #fff; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; font-size: 1em; transition: background 0.3s; }
  button:hover, .btn:hover { background: #5a7ab0; }
  .lang-btn { background: none; border: none; color: #85b4ff; font-size: 1em; padding: 0 6px; cursor: pointer; user-select: none; }
  input, textarea { width: 100%; padding: 10px; border: none; border-radius: 4px; background: #3a4a5c; color: #fff; margin-bottom: 15px; font-size: 1em; box-sizing: border-box; resize: vertical; }
  .post { background: #2e3b4e; border-radius: 8px; padding: 15px; margin-bottom: 25px; box-shadow: 0 0 10px rgba(0,0,0,.2); position: relative; }
  .post h3 { margin: 0 0 10px; color: #d1d9e6; }
  .meta { font-size: .8em; color: #9ba8b8; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  img { max-width: 100%; border-radius: 6px; cursor: pointer; margin-bottom: 10px; }
  a { color: #85b4ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  form.inline { display: inline; }
  .like { border: none; background: none; color: #85b4ff; font-size: 1em; cursor: pointer; }
  .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.8); justify-content: center; align-items: center; }
  .modal img { max-height: 90%; max-width: 90%; }
  .comment-admin { margin-left: 10px; color: #f66; cursor: pointer; font-size: 0.9em; user-select: none; }
</style>
<script>
  function like(id) { fetch('/like/' + id, { method: 'POST' }).then(() => location.reload()); }
  function delAll() { if(confirm('${t(req, 'conf')}')) location='/deleteAll'; }
  function sh(i) { document.getElementById('m'+i).style.display = 'flex'; }
  function hi(i) { document.getElementById('m'+i).style.display = 'none'; }
  function confirmDelComment(postId, commentIdx) {
    if(confirm('${t(req,'delCommentConf')}')) {
      fetch('/comment/delete/' + postId + '/' + commentIdx, { method: 'POST' })
        .then(() => location.reload());
    }
  }
  function submitComment(form) {
    const name = prompt('${t(req,'namePrompt')}');
    if(!name) return false;
    const inputName = document.createElement('input');
    inputName.type = 'hidden';
    inputName.name = 'name';
    inputName.value = name;
    form.appendChild(inputName);
    return true;
  }
</script>
</head>
<body>
<div class="header">
  <div class="header-left">
    <a class="lang-btn" href="/lang/${req.session.lang === 'en' ? 'ua' : 'en'}">${t(req,'lang')}</a>
  </div>
  <div class="header-title">${t(req,'title')}</div>
  <div class="header-buttons">
    ${req.session.admin ? `
      <a href="/add" class="btn">${t(req,'add')}</a>
      <button class="btn" onclick="delAll()">${t(req,'deleteAll')}</button>
      <a href="/logout" class="btn">${t(req,'logout')}</a>
    ` : `
      <a href="/login" class="btn">${t(req,'login')}</a>
    `}
  </div>
</div>
<div class="container">
${content}
</div>

</body>
</html>`;
}

// --- Маршрути ---

// Головна сторінка зі списком постів і пошуком
app.get('/', (req, res) => {
  const lang = req.session.lang || 'ua';
  const search = (req.query.search || '').toLowerCase();

  let filteredPosts = posts.filter(p =>
    !search || p.title.toLowerCase().includes(search) || p.body.toLowerCase().includes(search)
  );

  const postsHtml = filteredPosts.map((post, i) => {
    // Дати в зручному форматі
    const date = new Date(post.date).toLocaleString(lang === 'ua' ? 'uk-UA' : 'en-US', {
      dateStyle: 'medium', timeStyle: 'short'
    });
    const imageTag = post.img ? `<img src="/public/uploads/${esc(post.img)}" alt="image" onclick="sh(${i})">` : '';

    // Коментарі
    let commentsHtml = '';
    if(post.comments && post.comments.length > 0) {
      commentsHtml = '<ul>';
      post.comments.forEach((c, idx) => {
        commentsHtml += `<li>${esc(c.name)}: ${esc(c.body)} ${req.session.admin ? `<span class="comment-admin" onclick="confirmDelComment(${post.id}, ${idx})">×</span>` : ''}</li>`;
      });
      commentsHtml += '</ul>';
    }

    return `<div class="post">
      <h3>${esc(post.title)}</h3>
      <div class="meta">${date} 
        <button class="like" title="${t(req,'likes')}" onclick="like(${post.id})">❤️ ${post.likes || 0}</button>
      </div>
      ${imageTag}
      <p>${esc(post.body)}</p>
      ${commentsHtml}
      <form method="POST" action="/comment/${post.id}" onsubmit="return submitComment(this)">
        <input name="comment" placeholder="${t(req,'commentPl')}" required autocomplete="off"/>
        <button type="submit">${t(req,'send')}</button>
      </form>
      ${req.session.admin ? `
      <div>
        <a href="/edit/${post.id}">${t(req,'edit')}</a> | 
        <a href="/delete/${post.id}" onclick="return confirm('${t(req,'conf')}')">${t(req,'remove')}</a>
      </div>` : ''}
      <div id="m${i}" class="modal" onclick="hi(${i})">
        <img src="/public/uploads/${esc(post.img)}" alt="image"/>
      </div>
    </div>`;
  }).join('');

  res.send(renderPage(req, `
  <form method="GET" style="margin-bottom:20px;">
    <input type="search" name="search" value="${esc(req.query.search||'')}" placeholder="${t(req,'search')}" />
    <button type="submit">${t(req,'search')}</button>
  </form>
  ${postsHtml || '<p>No posts found.</p>'}
  `));
});

// Зміна мови
app.get('/lang/:lang', (req, res) => {
  const lang = req.params.lang;
  if(['ua', 'en'].includes(lang)) req.session.lang = lang;
  res.redirect('back');
});

// Форма логіну
app.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/');
  res.send(renderPage(req, `
  <form method="POST" action="/login" style="max-width: 300px; margin: auto;">
    <label>${t(req,'login')}: <input name="login" required autofocus /></label><br><br>
    <label>${t(req,'password') || 'Password'}: <input name="password" type="password" required /></label><br><br>
    <button type="submit">${t(req,'login')}</button>
  </form>
  `, ' - Login'));
});

// Обробка логіну
app.post('/login', (req, res) => {
  const { login, password } = req.body;
  if(login === ADMIN_LOGIN && password === ADMIN_PASS) {
    req.session.admin = true;
    res.redirect('/');
  } else {
    res.send(renderPage(req, `<p style="color:red;">${t(req,'wrong')}</p><a href="/login">${t(req,'back')}</a>`, ' - Login'));
  }
});

// Вихід
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Форма додавання поста (адмін)
app.get('/add', isAdmin, (req, res) => {
  res.send(renderPage(req, `
  <form method="POST" action="/add" enctype="multipart/form-data" style="max-width:600px; margin:auto;">
    <input name="title" placeholder="Title" required autofocus /><br>
    <textarea name="body" placeholder="Content" rows="5" required></textarea><br>
    <input type="file" name="img" accept="image/*" /><br><br>
    <button type="submit">${t(req,'add')}</button>
  </form>
  `, ' - Add'));
});

// Обробка додавання поста
app.post('/add', isAdmin, upload.single('img'), (req, res) => {
  const { title, body } = req.body;
  const img = req.file ? req.file.filename : '';
  const id = posts.length ? Math.max(...posts.map(p => p.id)) + 1 : 1;
  posts.push({ id, title, body, img, date: Date.now(), likes: 0, comments: [] });
  savePosts(posts);
  res.redirect('/');
});

// Форма редагування поста
app.get('/edit/:id', isAdmin, (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.redirect('/');
  res.send(renderPage(req, `
  <form method="POST" action="/edit/${post.id}" enctype="multipart/form-data" style="max-width:600px; margin:auto;">
    <input name="title" value="${esc(post.title)}" required autofocus /><br>
    <textarea name="body" rows="5" required>${esc(post.body)}</textarea><br>
    <img src="/public/uploads/${esc(post.img)}" alt="image" style="max-width:200px; display:block; margin-bottom:10px;" />
    <input type="file" name="img" accept="image/*" /><br><br>
    <label>Date: <input type="datetime-local" name="date" value="${new Date(post.date).toISOString().slice(0,16)}" /></label><br><br>
    <button type="submit">${t(req,'save')}</button>
  </form>
  `, ' - Edit'));
});

// Обробка редагування поста
app.post('/edit/:id', isAdmin, upload.single('img'), (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.redirect('/');
  post.title = req.body.title;
  post.body = req.body.body;
  if (req.file) {
    // Видаляємо старий файл
    if (post.img) fs.unlinkSync(path.join(UPLOAD_DIR, post.img));
    post.img = req.file.filename;
  }
  if (req.body.date) post.date = new Date(req.body.date).getTime();
  savePosts(posts);
  res.redirect('/');
});

// Видалення поста
app.get('/delete/:id', isAdmin, (req, res) => {
  const idx = posts.findIndex(p => p.id == req.params.id);
  if (idx >= 0) {
    const post = posts[idx];
    if (post.img) fs.unlinkSync(path.join(UPLOAD_DIR, post.img));
    posts.splice(idx, 1);
    savePosts(posts);
  }
  res.redirect('/');
});

// Видалити всі пости (адмін)
app.get('/deleteAll', isAdmin, (req, res) => {
  posts.forEach(post => {
    if (post.img) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, post.img)); } catch {}
    }
  });
  posts = [];
  savePosts(posts);
  res.redirect('/');
});

// Лайк поста
app.post('/like/:id', (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (post) {
    post.likes = (post.likes || 0) + 1;
    savePosts(posts);
    res.status(200).send('OK');
  } else {
    res.status(404).send('Not found');
  }
});

// Додавання коментаря
app.post('/comment/:id', (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (!post) return res.redirect('/');
  const name = req.body.name ? esc(req.body.name.trim()) : 'Anonymous';
  const comment = req.body.comment ? esc(req.body.comment.trim()) : '';
  if (comment) {
    post.comments = post.comments || [];
    post.comments.push({ name, body: comment });
    savePosts(posts);
  }
  res.redirect('/');
});

// Видалення коментаря (адмін)
app.post('/comment/delete/:postId/:commentIdx', isAdmin, (req, res) => {
  const post = posts.find(p => p.id == req.params.postId);
  if (!post) return res.status(404).send('Post not found');
  const idx = Number(req.params.commentIdx);
  if (idx >= 0 && post.comments && post.comments.length > idx) {
    post.comments.splice(idx, 1);
    savePosts(posts);
    res.send('OK');
  } else {
    res.status(404).send('Comment not found');
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
