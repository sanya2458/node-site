const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

/* ----------  ЗБЕРІГАННЯ ПОСТІВ У ФАЙЛІ  ---------- */
const DATA_PATH = path.join(__dirname, 'data');
const POSTS_FILE = path.join(DATA_PATH, 'posts.json');
if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH);

let posts = [];
if (fs.existsSync(POSTS_FILE)) {
  posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
}
function savePosts() {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
}

/* ----------  КОНСТАНТИ ДЛЯ АДМІНА  ---------- */
const ADMIN_LOGIN = 'admin';
const ADMIN_PASS = '1234';

/* ----------  МІДЛВЕРИ  ---------- */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'simple-secret',
  resave: false,
  saveUninitialized: false,
}));

/* ----------  НАЛАШТУВАННЯ MULTER  ---------- */
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/* ----------  СТАТИКА  ---------- */
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ----------  ХЕЛПЕР ДЛЯ ПЕРЕВІРКИ АДМІНА  ---------- */
function isAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/login');
}

/* ----------  БАЗОВІ СТИЛІ  ---------- */
const baseStyles = `
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      margin: 0;
      padding: 0;
      background-color: #1f2a38;
      color: #ffffff;
    }
    .container {
      max-width: 960px;      /* ширше, щоб 2-в-ряд помістились */
      margin: auto;
      padding: 20px;
    }
    /* ----------- ШАПКА ----------- */
    .header {
      display: flex;
      align-items: center;
      padding: 15px;
      background-color: #30445c;
      margin-bottom: 10px;
      position: relative;
    }
    .header-title {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      font-size: 1.5em;
      color: #d1d9e6;
      white-space: nowrap;
    }
    .header-buttons {
      margin-left: auto;
      display: flex;
      gap: 10px;
    }
    /* ----------- КНОПКИ ----------- */
    button, .button-link {
      background-color: #3f5e8c;
      color: white;
      border: none;
      padding: 10px 15px;
      text-decoration: none;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.3s ease;
    }
    button:hover, .button-link:hover {
      background-color: #5a7ab0;
    }
    /* ----------- БЛОК ДІЙ ПІД ШАПКОЮ ----------- */
    .action-buttons {
      text-align: center;
      margin: 25px auto;   /* більший відступ під шапкою */
    }
    .action-buttons .button-link { margin: 0 6px; }

    /* ----------- ПОСТИ (List) ----------- */
    .post {
      background-color: #2e3b4e;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
    }
    .post h3       { margin-top: 0; color: #d1d9e6; }
    .post p        { color: #c0cad6; }
    .admin-controls{ margin-top: 10px; }
    img {
      max-width: 100%;
      height: auto;
      margin-top: 10px;
      border-radius: 6px;
    }
    a { color: #85b4ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .form-group { margin-bottom: 15px; }
    input[type="text"], input[type="password"], input[type="number"], textarea {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 4px;
      background-color: #3a4a5c;
      color: white;
    }
    .add-button { text-align: center; margin-top: 20px; }

    /* ----------- ГРИД 2-В-РЯД ----------- */
    .posts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .posts-grid .post {
      margin-bottom: 0;
      padding: 10px;
    }
    .posts-grid .post h3 { font-size: 1em; text-align: center; }
    .posts-grid .post p  { display: none; } /* ховаємо підпис */
    @media (max-width: 700px) {
      .posts-grid { grid-template-columns: 1fr; }
    }
  </style>
`;

/* ----------  ГОЛОВНА  ---------- */
app.get('/', (req, res) => {
  const view = req.query.view === 'grid' ? 'grid' : 'list';
  const toggleLabel = view === 'grid' ? 'Список' : '2-в-ряд';
  const toggleView  = view === 'grid' ? 'list' : 'grid';

  /* сортування за order */
  const sortedPosts = [...posts].sort(
    (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)
  );

  let html = `
    <html>
      <head>
        <title>Фредлосграм</title>
        ${baseStyles}
      </head>
      <body>
        <div class="header">
          <div class="header-title">Фредлосграм</div>
          <div class="header-buttons">
  `;

  /* ----------  КНОПКИ В ХЕДЕРІ  ---------- */
  if (req.session.admin) {
    html += `
      <form method="POST" action="/logout" style="margin:0;">
        <button type="submit">Вийти</button>
      </form>
    `;
  } else {
    html += `<a href="/login" class="button-link">Увійти</a>`;
  }

  html += `</div></div>`;

  /* ----------  КНОПКИ ПІД ШАПКОЮ (тільки для адміна)  ---------- */
  if (req.session.admin) {
    html += `
      <div class="action-buttons">
        <a href="/?view=${toggleView}" class="button-link">${toggleLabel}</a>
        <a href="/add" class="button-link">Додати пост</a>
      </div>
    `;
  }

  /* ----------  ВИВІД ПОСТІВ  ---------- */
  html += `<div class="container ${view === 'grid' ? 'posts-grid' : ''}">`;

  if (sortedPosts.length === 0) {
    html += `<p>Постів поки що немає.</p>`;
  } else {
    sortedPosts.forEach(post => {
      const idx = posts.indexOf(post);
      html += `
        <div class="post">
          <h3>${post.title}</h3>
          <img src="${post.image}" alt="Image for post">
          ${view === 'list' ? `<p>${post.content}</p>` : ''}
          ${req.session.admin ? `
            <div class="admin-controls">
              <a href="/edit/${idx}">Редагувати</a> |
              <a href="/delete/${idx}" onclick="return confirm('Видалити цей пост?')">Видалити</a>
            </div>` : ''}
        </div>
      `;
    });
  }

  html += `</div></body></html>`;
  res.send(html);
});

/* ----------  ЛОГІН  ---------- */
app.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/');
  res.send(`
    <html>
      <head>
        <title>Увійти</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <h2>Увійти як адмін</h2>
          <form method="POST" action="/login">
            <div class="form-group">
              <input type="text" name="login" placeholder="Логін" required>
            </div>
            <div class="form-group">
              <input type="password" name="password" placeholder="Пароль" required>
            </div>
            <button type="submit">Увійти</button>
          </form>
          <div class="add-button">
            <a href="/" class="button-link">Назад</a>
          </div>
        </div>
      </body>
    </html>
  `);
});
app.post('/login', (req, res) => {
  const { login, password } = req.body;
  if (login === ADMIN_LOGIN && password === ADMIN_PASS) {
    req.session.admin = true;
    res.redirect('/');
  } else {
    res.send('Невірний логін або пароль. <a href="/login">Спробуйте знову</a>');
  }
});
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* ----------  ДОДАТИ ПОСТ  ---------- */
app.get('/add', isAdmin, (_, res) => {
  res.send(`
    <html>
      <head>
        <title>Додати пост</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <h2>Додати пост</h2>
          <form method="POST" action="/add" enctype="multipart/form-data">
            <div class="form-group">
              <input name="title" placeholder="Заголовок" required>
            </div>
            <div class="form-group">
              <textarea name="content" placeholder="Контент" rows="5" required></textarea>
            </div>
            <div class="form-group">
              <input type="number" name="order" placeholder="Позиція (1,2,3…)" min="1" required>
            </div>
            <div class="form-group">
              <input type="file" name="image" accept="image/*" required>
            </div>
            <button type="submit">Додати</button>
          </form>
          <div class="add-button">
            <a href="/" class="button-link">Назад</a>
          </div>
        </div>
      </body>
    </html>
  `);
});
app.post('/add', isAdmin, upload.single('image'), (req, res) => {
  const { title, content, order } = req.body;
  if (!req.file) return res.send('Помилка: потрібно завантажити картинку');
  posts.push({
    title,
    content,
    order: parseInt(order, 10),
    image: `/public/uploads/${req.file.filename}`
  });
  savePosts();
  res.redirect('/');
});

/* ----------  РЕДАГУВАТИ ПОСТ  ---------- */
app.get('/edit/:id', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id < 0 || id >= posts.length) return res.send('Пост не знайдено.');
  const post = posts[id];
  res.send(`
    <html>
      <head>
        <title>Редагувати пост</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <h2>Редагувати пост</h2>
          <form method="POST" action="/edit/${id}" enctype="multipart/form-data">
            <div class="form-group">
              <input name="title" value="${post.title}" required>
            </div>
            <div class="form-group">
              <textarea name="content" rows="5" required>${post.content}</textarea>
            </div>
            <div class="form-group">
              <input type="number" name="order" value="${post.order ?? ''}" min="1" required>
            </div>
            <div class="form-group">
              Поточна картинка:<br>
              ${post.image ? `<img src="${post.image}" style="max-width:100%; margin-top:10px;"><br>` : 'Немає картинки'}
            </div>
            <div class="form-group">
              Змінити картинку:<br>
              <input type="file" name="image" accept="image/*">
            </div>
            <button type="submit">Зберегти</button>
          </form>
          <div class="add-button">
            <a href="/" class="button-link">Назад</a>
          </div>
        </div>
      </body>
    </html>
  `);
});
app.post('/edit/:id', isAdmin, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  if (id < 0 || id >= posts.length) return res.send('Пост не знайдено.');
  posts[id].title   = req.body.title;
  posts[id].content = req.body.content;
  posts[id].order   = parseInt(req.body.order, 10);
  if (req.file) posts[id].image = `/public/uploads/${req.file.filename}`;
  savePosts();
  res.redirect('/');
});

/* ----------  ВИДАЛИТИ ПОСТ  ---------- */
app.get('/delete/:id', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id < 0 || id >= posts.length) return res.send('Пост не знайдено.');
  posts.splice(id, 1);
  savePosts();
  res.redirect('/');
});

/* ----------  СТАРТ СЕРВЕРА  ---------- */
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
