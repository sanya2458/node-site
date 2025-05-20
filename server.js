const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

let posts = [];

const ADMIN_LOGIN = 'admin';
const ADMIN_PASS = '1234';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'simple-secret',
  resave: false,
  saveUninitialized: false,
}));

// Папка для зберігання картинок
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Налаштування multer для завантаження файлів
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// Робимо папку 'public' статичною
app.use('/public', express.static(path.join(__dirname, 'public')));

// Перевірка авторизації
function isAdmin(req, res, next) {
  if (req.session && req.session.admin) next();
  else res.redirect('/login');
}

// Головна сторінка — показує пости з картинками
app.get('/', (req, res) => {
  let html = `
    <html>
      <head>
        <title>Фредлосграм</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { display: flex; justify-content: flex-end; margin-bottom: 20px; }
          button, a.button-link {
            background-color: #007BFF; color: white; border: none; padding: 10px 15px;
            text-decoration: none; cursor: pointer; border-radius: 4px;
          }
          .post { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
          .admin-controls { margin-top: 10px; }
          img { max-width: 300px; height: auto; display: block; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">`;

  if (req.session.admin) {
    html += `<form method="POST" action="/logout" style="margin:0;">
               <button type="submit">Вийти</button>
             </form>`;
  } else {
    html += `<a href="/login" class="button-link">Увійти</a>`;
  }

  html += `</div><h1>Пости</h1>`;

  if (posts.length === 0) {
    html += `<p>Постів поки що немає.</p>`;
  } else {
    posts.forEach((post, i) => {
      html += `<div class="post">
        <h3>${post.title}</h3>
        <p>${post.content}</p>`;
      if (post.image) {
        html += `<img src="${post.image}" alt="Image for post">`;
      }
      if (req.session.admin) {
        html += `
          <div class="admin-controls">
            <a href="/edit/${i}">Редагувати</a> |
            <a href="/delete/${i}" onclick="return confirm('Видалити цей пост?')">Видалити</a>
          </div>`;
      }
      html += `</div>`;
    });
  }

  if (req.session.admin) {
    html += `<a href="/add"><button>Додати пост</button></a>`;
  }

  html += `</body></html>`;
  res.send(html);
});

// Логін
app.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/');
  res.send(`
    <html>
      <head><title>Увійти</title></head>
      <body>
        <h2>Увійти як адмін</h2>
        <form method="POST" action="/login">
          Логін:<br><input name="login" required><br><br>
          Пароль:<br><input type="password" name="password" required><br><br>
          <button type="submit">Увійти</button>
        </form>
        <br><a href="/">Назад</a>
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

// Логаут
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Форма додавання поста (з картинкою)
app.get('/add', isAdmin, (req, res) => {
  res.send(`
    <html>
      <head><title>Додати пост</title></head>
      <body>
        <h2>Додати пост</h2>
        <form method="POST" action="/add" enctype="multipart/form-data">
          Заголовок:<br><input name="title" required><br><br>
          Контент:<br><textarea name="content" rows="5" cols="30" required></textarea><br><br>
          Картинка:<br><input type="file" name="image" accept="image/*" required><br><br>
          <button type="submit">Додати</button>
        </form>
        <br><a href="/">Назад</a>
      </body>
    </html>
  `);
});

// Обробка додавання поста
app.post('/add', isAdmin, upload.single('image'), (req, res) => {
  const { title, content } = req.body;
  if (!req.file) return res.send('Помилка: потрібно завантажити картинку');
  const imagePath = `/public/uploads/${req.file.filename}`;
  posts.push({ title, content, image: imagePath });
  res.redirect('/');
});

// Форма редагування поста
app.get('/edit/:id', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id < 0 || id >= posts.length) return res.send('Пост не знайдено.');

  const post = posts[id];
  res.send(`
    <html>
      <head><title>Редагувати пост</title></head>
      <body>
        <h2>Редагувати пост</h2>
        <form method="POST" action="/edit/${id}" enctype="multipart/form-data">
          Заголовок:<br><input name="title" value="${post.title}" required><br><br>
          Контент:<br><textarea name="content" rows="5" cols="30" required>${post.content}</textarea><br><br>
          Поточна картинка:<br>
          ${post.image ? `<img src="${post.image}" style="max-width:200px;"><br><br>` : 'Немає картинки<br><br>'}
          Змінити картинку:<br><input type="file" name="image" accept="image/*"><br><br>
          <button type="submit">Зберегти</button>
        </form>
        <br><a href="/">Назад</a>
      </body>
    </html>
  `);
});

// Обробка редагування поста
app.post('/edit/:id', isAdmin, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  if (id < 0 || id >= posts.length) return res.send('Пост не знайдено.');

  posts[id].title = req.body.title;
  posts[id].content = req.body.content;

  if (req.file) {
    // Видаляємо стару картинку (необов’язково, можна залишити)
    // fs.unlinkSync(path.join(__dirname, posts[id].image));

    posts[id].image = `/public/uploads/${req.file.filename}`;
  }

  res.redirect('/');
});

// Видалення поста
app.get('/delete/:id', isAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id < 0 || id >= posts.length) return res.send('Пост не знайдено.');

  // Видалити картинку теж можна, якщо хочеш
  // const imgPath = path.join(__dirname, posts[id].image);
  // if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

  posts.splice(id, 1);
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

