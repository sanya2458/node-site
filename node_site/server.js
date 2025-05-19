const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Папка для завантажень
const upload = multer({ dest: 'uploads/' });

// Статичні файли
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// EJS шаблон
app.set('view engine', 'ejs');

// Дані з постами (у памʼяті, можна замінити на базу)
let posts = [];

// Головна сторінка
app.get('/', (req, res) => {
  res.render('index', { posts });
});

// Сторінка додавання посту (проста форма)
app.get('/admin', (req, res) => {
  res.render('admin');
});

// Обробка форми
app.post('/add', upload.single('image'), (req, res) => {
  const image = req.file ? '/uploads/' + req.file.filename : null;
  const caption = req.body.caption || '';
  const date = new Date().toLocaleString();

  if (image) {
    posts.unshift({ image, caption, date });
  }
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Сервер працює на порті ${PORT}`);
});