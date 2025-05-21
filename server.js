const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Налаштування сесії без cookie-parser
app.use(session({
  secret: 'your_secret_key',  // Змініть на свій секрет
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // secure: true для HTTPS
}));

// Парсинг форм та json
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Налаштування Multer для завантаження файлів
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Статичні файли (наприклад, CSS, JS, картинки)
app.use(express.static(path.join(__dirname, 'public')));

// Приклад маршруту з завантаженням файлу
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Файл не завантажений');
  }
  res.send('Файл завантажено: ' + req.file.filename);
});

// Простий домашній маршрут
app.get('/', (req, res) => {
  // Можна перевіряти сесію, наприклад
  if (!req.session.views) {
    req.session.views = 0;
  }
  req.session.views++;
  res.send(`Вітаю! Ви переглянули цю сторінку ${req.session.views} разів`);
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
