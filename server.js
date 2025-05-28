// server.js
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// --- Налаштування зберігання файлів з Multer ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Зберігаємо файл з унікальним ім'ям (час+оригінал)
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// --- Статичні файли ---
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- Парсинг форм ---
app.use(express.urlencoded({ extended: true }));

// --- Сесії ---
app.use(session({
  secret: 'Супер_секретний_ключ_123',
  resave: false,
  saveUninitialized: false,
}));

// --- Зберігання даних (тимчасово в пам'яті) ---
let categories = [];
let products = [];
let users = [
  { id: 1, username: 'admin', password: 'adminpass', role: 'admin' },
  { id: 2, username: 'user', password: 'userpass', role: 'user' }
];
let carts = {}; // ключ: userId, значення: [{productId, quantity}]

// --- Допоміжні middleware ---
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  const user = users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'admin') return res.status(403).send('Доступ заборонено');
  next();
}
function getCurrentUser(req) {
  if (!req.session.userId) return null;
  return users.find(u => u.id === req.session.userId) || null;
}

// --- Маршрути ---
app.get('/category/:categoryName', (req, res) => {
  const user = getCurrentUser(req);
  const categoryName = req.params.categoryName;

  // Фільтруємо товари за категорією (припускаю, що products - масив товарів з полем category)
  const filteredProducts = products.filter(p => p.category === categoryName);

  if (filteredProducts.length === 0) {
    return res.status(404).send(htmlPage('Помилка', renderHeader(user) + `<main><h2>Категорія "${categoryName}" не знайдена</h2></main>`));
  }

  // Генеруємо HTML списку товарів
  const productListHtml = filteredProducts.map(p => `
    <li style="list-style:none; margin-bottom:1rem; border:1px solid #ccc; border-radius:8px; padding:1rem;">
      <a href="/product/${p.id}" style="text-decoration:none; color:#0f1621; font-weight:bold;">${p.name}</a><br/>
      Ціна: ${p.price.toFixed(2)} ₴
    </li>
  `).join('');

  res.send(htmlPage(`Категорія: ${categoryName}`, renderHeader(user) + `
    <main>
      <h2>Категорія: ${categoryName}</h2>
      <ul style="padding-left:0; max-width:600px; margin:0 auto;">${productListHtml}</ul>
    </main>
  `));
});


// Головна сторінка з товарами
app.get('/', (req, res) => {
  const user = getCurrentUser(req);
  // Покупець бачить назву, першу картинку, ціну, рейтинг
  let productsHtml = products.map(p => {
    const firstImage = p.images.length > 0 ? `/public/uploads/${p.images[0]}` : '';
    return `
      <div class="product-card" onclick="location.href='/product/${p.id}'">
        <h3>${p.name}</h3>
        ${firstImage ? `<img src="${firstImage}" alt="${p.name}" />` : ''}
        <p>Ціна: ${p.price.toFixed(2)} ₴</p>
        <p>Рейтинг: ${p.rating.toFixed(1)} / 5</p>
      </div>
    `;
  }).join('');

  res.send(htmlPage('Головна', renderHeader(user) + `
    <main>
      <div class="products-grid">${productsHtml || '<p>Товари відсутні</p>'}</div>
    </main>
  `));
});

// Детальна сторінка товару
// --- Детальна сторінка товару з каруселлю та відгуками і рейтингом ---
app.get('/product/:id', (req, res) => {
  const user = getCurrentUser(req);
  const prodId = Number(req.params.id);
  const p = products.find(x => x.id === prodId);
  if (!p) return res.status(404).send('Товар не знайдено');

  // Карусель картинок
  const sliderHtml = `
    <div id="slider" style="position:relative; width:300px; height:300px; overflow:hidden; margin-bottom:1rem;">
      ${p.images.map((img, i) => `
        <img src="/public/uploads/${img}" alt="${p.name}" style="
          width:100%;
          height:100%;
          object-fit:contain;
          position:absolute;
          top:0;
          left: ${i === 0 ? '0' : '100%'};
          transition: left 0.5s ease;
        " data-index="${i}" />
      `).join('')}
      <button id="prevBtn" style="
        position:absolute; top:50%; left:5px; transform: translateY(-50%);
        background:#0f1621; color:#dde1e7; border:none; padding:0.5rem; cursor:pointer;">&#8592;</button>
      <button id="nextBtn" style="
        position:absolute; top:50%; right:5px; transform: translateY(-50%);
        background:#0f1621; color:#dde1e7; border:none; padding:0.5rem; cursor:pointer;">&#8594;</button>
    </div>
  `;

  // Відгуки
  const reviewsHtml = p.reviews.length ? `
    <ul>
      ${p.reviews.map(r => `
        <li>
          <b>${r.username}</b> (${r.rating}/5): ${r.comment}
        </li>
      `).join('')}
    </ul>
  ` : '<p>Відгуків немає</p>';

  res.send(htmlPage(p.name, renderHeader(user) + `
    <main>
      <h2>${p.name}</h2>
      ${sliderHtml}
      <p><b>Ціна:</b> ${p.price.toFixed(2)} ₴</p>
      <p><b>Середній рейтинг:</b> ${p.rating.toFixed(1)} / 5</p>
      <p><b>Опис:</b><br/>${p.description || 'Немає опису'}</p>
      
      <section id="reviews">
        <h3>Відгуки</h3>
        ${reviewsHtml}
        ${user ? `
          <form id="reviewForm" method="POST" action="/product/${p.id}/review">
            <label>Рейтинг:
              <select name="rating" required>
                <option value="">Оцініть</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label><br/>
            <label>Відгук:<br/>
              <textarea name="comment" rows="3" required></textarea>
            </label><br/>
            <button type="submit">Додати відгук</button>
          </form>
        ` : `<p>Ви маєте увійти, щоб залишити відгук.</p>`}
      </section>

      <form id="addToCartForm" method="POST" action="/cart/add" style="margin-top:1rem;">
        <input type="hidden" name="productId" value="${p.id}" />
        <label>Кількість:</label>
        <button type="button" id="minusBtn" style="width:30px;">-</button>
        <input type="text" id="quantityInput" name="quantity" value="1" readonly style="width:30px; text-align:center;" />
        <button type="button" id="plusBtn" style="width:30px;">+</button>
        <button type="submit">Додати до кошика</button>
      </form>

      <script>
        (() => {
          // Карусель
          const imgs = [...document.querySelectorAll('#slider img')];
          let current = 0;
          const showSlide = (index) => {
            imgs.forEach((img, i) => {
              img.style.left = (i === index ? '0' : '100%');
            });
          };
          document.getElementById('prevBtn').onclick = () => {
            current = (current - 1 + imgs.length) % imgs.length;
            showSlide(current);
          };
          document.getElementById('nextBtn').onclick = () => {
            current = (current + 1) % imgs.length;
            showSlide(current);
          };

          // Кнопки кількості товару
          const quantityInput = document.getElementById('quantityInput');
          document.getElementById('plusBtn').onclick = () => {
            quantityInput.value = Number(quantityInput.value) + 1;
          };
          document.getElementById('minusBtn').onclick = () => {
            if (Number(quantityInput.value) > 1) {
              quantityInput.value = Number(quantityInput.value) - 1;
            }
          };
        })();
      </script>
    </main>
  `));
});

// --- Обробка додавання відгуку ---
app.post('/product/:id/review', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.redirect('/login');

  const prodId = Number(req.params.id);
  const p = products.find(x => x.id === prodId);
  if (!p) return res.status(404).send('Товар не знайдено');

  const { rating, comment } = req.body;
  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5 || !comment) {
    return res.redirect(`/product/${prodId}`); // можна додати повідомлення про помилку
  }

  // Додаємо відгук
  p.reviews.push({
    username: user.username,
    rating: ratingNum,
    comment: comment.trim()
  });

  // Оновлюємо середній рейтинг
  const sumRatings = p.reviews.reduce((sum, r) => sum + r.rating, 0);
  p.rating = sumRatings / p.reviews.length;

  res.redirect(`/product/${prodId}`);
});


// Кошик
app.get('/cart', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const cart = carts[user.id] || [];
  if (cart.length === 0) {
    return res.send(htmlPage('Кошик', renderHeader(user) + `<main><h2>Кошик порожній</h2></main>`));
  }
  const cartHtml = cart.map(item => {
    const p = products.find(prod => prod.id === item.productId);
    if (!p) return '';
    return `
      <div class="cart-item">
        <h3>${p.name}</h3>
        <p>Ціна: ${p.price.toFixed(2)} ₴</p>
        <p>Кількість: ${item.quantity}</p>
        <form method="POST" action="/cart/remove" style="display:inline">
          <input type="hidden" name="productId" value="${p.id}" />
          <button type="submit">Видалити</button>
        </form>
      </div>
    `;
  }).join('');
  res.send(htmlPage('Кошик', renderHeader(user) + `<main><h2>Ваш кошик</h2>${cartHtml}</main>`));
});

// Додати в кошик
app.post('/cart/add', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const { productId, quantity } = req.body;
  const pid = Number(productId);
  const qty = Math.max(1, Number(quantity));
  if (!products.find(p => p.id === pid)) return res.redirect('/');

  if (!carts[user.id]) carts[user.id] = [];
  const existing = carts[user.id].find(i => i.productId === pid);
  if (existing) {
    existing.quantity += qty;
  } else {
    carts[user.id].push({ productId: pid, quantity: qty });
  }
  res.redirect('/cart');
});

// Видалити з кошика
app.post('/cart/remove', requireAuth, (req, res) => {
  const user = getCurrentUser(req);
  const pid = Number(req.body.productId);
  if (!carts[user.id]) return res.redirect('/cart');
  carts[user.id] = carts[user.id].filter(i => i.productId !== pid);
  res.redirect('/cart');
});

// --- Авторизація ---
// Логін форма
app.get('/login', (req, res) => {
  res.send(htmlPage('Вхід', renderHeader(null) + `
    <main>
      <h2>Вхід</h2>
      <form method="POST" action="/login">
        <input name="username" placeholder="Логін" required />
        <input name="password" type="password" placeholder="Пароль" required />
        <button type="submit">Увійти</button>
      </form>
    </main>
  `));
});

// Логін обробка
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.send(htmlPage('Вхід', renderHeader(null) + `
      <main>
        <h2>Вхід</h2>
        <p style="color:red;">Неправильний логін або пароль</p>
        <form method="POST" action="/login">
          <input name="username" placeholder="Логін" required />
          <input name="password" type="password" placeholder="Пароль" required />
          <button type="submit">Увійти</button>
        </form>
      </main>
    `));
  }
  req.session.userId = user.id;
  res.redirect('/');
});

// Вихід
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// --- Адмінка ---
// Головна адмінка — список категорій і товарів + форми додавання
app.get('/admin', requireAdmin, (req, res) => {
  const user = getCurrentUser(req);

  // Категорії у таблиці
  const categoriesHtml = categories.map(cat => `
    <tr>
      <td>${cat.id}</td>
      <td>${cat.name}</td>
      <td>
        <form method="POST" action="/admin/category/delete" style="display:inline">
          <input type="hidden" name="id" value="${cat.id}" />
          <button type="submit" onclick="return confirm('Видалити категорію?')">Видалити</button>
        </form>
      </td>
    </tr>
  `).join('');
  
// Форма реєстрації
app.get('/register', (req, res) => {
  res.send(htmlPage('Реєстрація', renderHeader(null) + `
    <main>
      <h2>Реєстрація</h2>
      <form method="POST" action="/register">
        <input name="username" placeholder="Логін" required />
        <input name="password" type="password" placeholder="Пароль" required />
        <button type="submit">Зареєструватися</button>
      </form>
    </main>
  `));
});

  // Обробка реєстрації
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.redirect('/register');
  }
  if (users.find(u => u.username === username)) {
    return res.send(htmlPage('Реєстрація', renderHeader(null) + `
      <main>
        <h2>Реєстрація</h2>
        <p style="color:red;">Користувач з таким логіном вже існує</p>
        <form method="POST" action="/register">
          <input name="username" placeholder="Логін" required />
          <input name="password" type="password" placeholder="Пароль" required />
          <button type="submit">Зареєструватися</button>
        </form>
      </main>
    `));
  }
  // Додаємо користувача з роллю user
  users.push({ id: users.length ? users[users.length-1].id + 1 : 1, username, password, role: 'user' });
  res.redirect('/login');
});

  
  // Товари у таблиці
  const productsHtml = products.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.name}</td>
      <td>${categories.find(c => c.id === p.categoryId)?.name || '-'}</td>
      <td>${p.price.toFixed(2)}</td>
      <td>${p.rating.toFixed(1)}</td>
      <td>
        <form method="POST" action="/admin/product/delete" style="display:inline">
          <input type="hidden" name="id" value="${p.id}" />
          <button type="submit" onclick="return confirm('Видалити товар?')">Видалити</button>
        </form>
        <form method="GET" action="/admin/product/edit" style="display:inline">
          <input type="hidden" name="id" value="${p.id}" />
          <button type="submit">Редагувати</button>
        </form>
      </td>
    </tr>
  `).join('');

  res.send(htmlPage('Адмінка', renderHeader(user) + `
    <main>
      <h2>Категорії</h2>
      <table>
        <thead><tr><th>ID</th><th>Назва</th><th>Дії</th></tr></thead>
        <tbody>${categoriesHtml || '<tr><td colspan="3">Категорії відсутні</td></tr>'}</tbody>
      </table>
      <form method="POST" action="/admin/category/add">
        <input name="name" placeholder="Нова категорія" required />
        <button type="submit">Додати категорію</button>
      </form>

      <h2>Товари</h2>
      <table>
        <thead><tr><th>ID</th><th>Назва</th><th>Категорія</th><th>Ціна</th><th>Рейтинг</th><th>Дії</th></tr></thead>
        <tbody>${productsHtml || '<tr><td colspan="6">Товари відсутні</td></tr>'}</tbody>
      </table>
      <form method="GET" action="/admin/product/add">
        <button type="submit">Додати товар</button>
      </form>
    </main>
  `));
});

// Додати категорію
app.post('/admin/category/add', requireAdmin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.redirect('/admin');
  const newCat = { id: categories.length ? categories[categories.length - 1].id + 1 : 1, name };
  categories.push(newCat);
  res.redirect('/admin');
});

// Видалити категорію
app.post('/admin/category/delete', requireAdmin, (req, res) => {
  const id = Number(req.body.id);
  categories = categories.filter(c => c.id !== id);
  // Видалити товари цієї категорії теж
  products = products.filter(p => p.categoryId !== id);
  res.redirect('/admin');
});

// Форма додавання товару
app.get('/admin/product/add', requireAdmin, (req, res) => {
  const user = getCurrentUser(req);
  const catOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  res.send(htmlPage('Додати товар', renderHeader(user) + `
    <main>
      <h2>Додати товар</h2>
      <form method="POST" action="/admin/product/add" enctype="multipart/form-data">
        <input name="name" placeholder="Назва" required />
        <select name="categoryId" required>${catOptions}</select>
        <input name="price" type="number" step="0.01" min="0" placeholder="Ціна" required />
        <input name="rating" type="number" step="0.1" min="0" max="5" placeholder="Рейтинг" required />
        <textarea name="description" placeholder="Опис"></textarea>
        <label>Картинки (макс 5): <input type="file" name="images" accept="image/*" multiple /></label>
        <button type="submit">Додати</button>
      </form>
    </main>
  `));
});

// Обробка додавання товару
app.post('/admin/product/add', requireAdmin, upload.array('images', 5), (req, res) => {
  const { name, categoryId, price, rating, description } = req.body;
  const imgs = req.files.map(f => f.filename);
  const newProd = {
    id: products.length ? products[products.length - 1].id + 1 : 1,
    name,
    categoryId: Number(categoryId),
    price: Number(price),
    rating: Number(rating),
    description,
    images: imgs,
    reviews: []
  };
  products.push(newProd);
  res.redirect('/admin');
});

// Форма редагування товару
app.get('/admin/product/edit', requireAdmin, (req, res) => {
  const user = getCurrentUser(req);
  const id = Number(req.query.id);
  const p = products.find(pr => pr.id === id);
  if (!p) return res.redirect('/admin');
  const catOptions = categories.map(c => `<option value="${c.id}"${c.id === p.categoryId ? ' selected' : ''}>${c.name}</option>`).join('');
  const existingImgs = p.images.map(img => `<li>${img}</li>`).join('');
  res.send(htmlPage('Редагувати товар', renderHeader(user) + `
    <main>
      <h2>Редагувати товар</h2>
      <form method="POST" action="/admin/product/edit" enctype="multipart/form-data">
        <input type="hidden" name="id" value="${p.id}" />
        <input name="name" value="${p.name}" placeholder="Назва" required />
        <select name="categoryId" required>${catOptions}</select>
        <input name="price" type="number" step="0.01" min="0" value="${p.price}" placeholder="Ціна" required />
        <input name="rating" type="number" step="0.1" min="0" max="5" value="${p.rating}" placeholder="Рейтинг" required />
        <textarea name="description" placeholder="Опис">${p.description}</textarea>
        <p>Існуючі картинки:</p>
        <ul>${existingImgs || '<li>Немає</li>'}</ul>
        <label>Додати картинки (макс 5): <input type="file" name="images" accept="image/*" multiple /></label>
        <button type="submit">Зберегти</button>
      </form>
    </main>
  `));
});

// Обробка редагування товару
app.post('/admin/product/edit', requireAdmin, upload.array('images', 5), (req, res) => {
  const { id, name, categoryId, price, rating, description } = req.body;
  const pid = Number(id);
  const p = products.find(pr => pr.id === pid);
  if (!p) return res.redirect('/admin');

  p.name = name;
  p.categoryId = Number(categoryId);
  p.price = Number(price);
  p.rating = Number(rating);
  p.description = description;
  if (req.files.length > 0) {
    // Додаємо нові картинки до існуючих
    p.images = p.images.concat(req.files.map(f => f.filename)).slice(0, 5);
  }
  res.redirect('/admin');
});

// Видалити товар
app.post('/admin/product/delete', requireAdmin, (req, res) => {
  const id = Number(req.body.id);
  products = products.filter(p => p.id !== id);
  res.redirect('/admin');
});

// --- Шапка сайту ---
function renderHeader(user) {
  return `
  <header>
  <nav style="display:flex; justify-content:center; gap:1rem;">
    <a href="/" style="color:#dde1e7; text-decoration:none; padding:0.5rem 1rem;">Головна</a>
    <a href="/category/electronics" style="color:#dde1e7; text-decoration:none; padding:0.5rem 1rem;">Електроніка</a>
    <a href="/category/books" style="color:#dde1e7; text-decoration:none; padding:0.5rem 1rem;">Книги</a>
    <a href="/category/clothes" style="color:#dde1e7; text-decoration:none; padding:0.5rem 1rem;">Одяг</a>
  </nav>
</header>

  `;
}

// --- Детальна сторінка товару з каруселлю ---
app.get('/product/:id', (req, res) => {
  const user = getCurrentUser(req);
  const prodId = Number(req.params.id);
  const p = products.find(x => x.id === prodId);
  if (!p) return res.status(404).send('Товар не знайдено');

  // Створюємо HTML для слайдера картинок з кнопками
  const sliderHtml = `
    <div id="slider" style="position:relative; width:300px; height:300px; overflow:hidden; margin-bottom:1rem;">
      ${p.images.map((img, i) => `
        <img src="/public/uploads/${img}" alt="${p.name}" style="
          width:100%;
          height:100%;
          object-fit:contain;
          position:absolute;
          top:0;
          left: ${i === 0 ? '0' : '100%'};
          transition: left 0.5s ease;
        " data-index="${i}" />
      `).join('')}
      <button id="prevBtn" style="
        position:absolute; top:50%; left:5px; transform: translateY(-50%);
        background:#0f1621; color:#dde1e7; border:none; padding:0.5rem; cursor:pointer;">&#8592;</button>
      <button id="nextBtn" style="
        position:absolute; top:50%; right:5px; transform: translateY(-50%);
        background:#0f1621; color:#dde1e7; border:none; padding:0.5rem; cursor:pointer;">&#8594;</button>
    </div>
  `;

  const reviewsHtml = p.reviews.length ? `<ul>${p.reviews.map(r => `<li>${r}</li>`).join('')}</ul>` : '<p>Відгуків немає</p>';

  res.send(htmlPage(p.name, renderHeader(user) + `
    <main>
      <h2>${p.name}</h2>
      ${sliderHtml}
      <p><b>Ціна:</b> ${p.price.toFixed(2)} ₴</p>
      <p><b>Рейтинг:</b> ${p.rating.toFixed(1)} / 5</p>
      <p><b>Опис:</b><br/>${p.description || 'Немає опису'}</p>
      <p><b>Відгуки:</b>${reviewsHtml}</p>

      <form method="POST" action="/cart/add">
        <input type="hidden" name="productId" value="${p.id}" />
        <label>Кількість: <input type="number" name="quantity" value="1" min="1" required /></label>
        <button type="submit">Додати до кошика</button>
      </form>

      <script>
        (() => {
          const imgs = [...document.querySelectorAll('#slider img')];
          let current = 0;
          const showSlide = (index) => {
            imgs.forEach((img, i) => {
              img.style.left = (i === index ? '0' : '100%');
            });
          };
          document.getElementById('prevBtn').onclick = () => {
            current = (current - 1 + imgs.length) % imgs.length;
            showSlide(current);
          };
          document.getElementById('nextBtn').onclick = () => {
            current = (current + 1) % imgs.length;
            showSlide(current);
          };
        })();
      </script>
    </main>
  `));
});

// --- HTML шаблон ---
function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
  body {
    background-color: #f5f7fa;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #222;
    margin: 0;
    padding: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  header {
    width: 100%;
    background-color: #0f1621;
    padding: 1rem 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    margin-bottom: 2rem;
  }

  header nav {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  header nav a {
    color: #dde1e7;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    transition: background-color 0.3s ease;
  }

  header nav a:hover {
    background-color: #192734;
  }

  main {
    width: 90%;
    max-width: 600px;
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
    box-sizing: border-box;
    margin-bottom: 2rem;
    text-align: center;
  }

  h1, h2, h3 {
    color: #0f1621;
  }

  form {
    margin-top: 1rem;
  }

  label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.3rem;
    color: #0f1621;
  }

  input[type="text"],
  input[type="number"],
  select,
  textarea {
    width: 100%;
    max-width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 1rem;
    border-radius: 6px;
    border: 1.5px solid #ccc;
    box-sizing: border-box;
    font-family: inherit;
    resize: vertical;
    transition: border-color 0.3s ease;
  }

  input[type="text"]:focus,
  input[type="number"]:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: #0f1621;
  }

  button {
    background-color: #0f1621;
    color: #dde1e7;
    border: none;
    padding: 0.6rem 1.2rem;
    font-size: 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.3s ease;
    font-family: inherit;
    margin-top: 0.5rem;
  }

  button:hover {
    background-color: #192734;
  }

  /* Кнопки мінус і плюс для кількості */
  #addToCartForm {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  #minusBtn, #plusBtn {
    background-color: #0f1621;
    color: #dde1e7;
    border: none;
    padding: 0.25rem 0.7rem;
    font-size: 1.2rem;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.3s ease;
  }

  #minusBtn:hover, #plusBtn:hover {
    background-color: #192734;
  }

  #quantityInput {
    width: 50px;
    text-align: center;
    padding: 0.3rem;
    font-size: 1rem;
  }

  /* Карусель */
  #slider {
    position: relative;
    width: 300px;
    height: 300px;
    overflow: hidden;
    margin: 0 auto 1rem auto;
  }

  #slider img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    position: absolute;
    top: 0;
    transition: left 0.5s ease;
  }

  #slider button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: #0f1621;
    color: #dde1e7;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 4px;
    user-select: none;
  }

  #prevBtn {
    left: 5px;
  }

  #nextBtn {
    right: 5px;
  }

  /* Відгуки */
  #reviews ul {
    list-style: none;
    padding-left: 0;
  }

  #reviews li {
    border-bottom: 1px solid #ccc;
    padding: 0.5rem 0;
    text-align: left;
  }

  /* Центрування форм і кнопок */
  form#reviewForm {
    max-width: 100%;
  }

  form#reviewForm label {
    text-align: left;
  }

  /* Для textarea */
  textarea {
    min-height: 60px;
  }
</style>

</head>
<body>
  ${body}
</body>
</html>`;
}

// --- Порт ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});
