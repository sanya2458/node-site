// server.js (приклад спрощеного і виправленого)

// Імпорт модулів
const express = require('express');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());            // Виправлено: додано дужки
app.use(express.urlencoded({ extended: true }));

// Статичні файли
app.use(express.static(path.join(__dirname, 'public')));

// Роутер (приклад)
app.get('/', (req, res) => {
  res.send('Hello, world!');
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
