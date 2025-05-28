// --- Потрібні залежності ---
const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('public'));

// --- Приклад продуктів ---
const products = [
  {
    id: 1,
    name: 'Товар 1',
    price: 100,
    description: 'Опис товару 1',
    images: ['prod1-1.jpg', 'prod1-2.jpg'],
    reviews: [],
    rating: 0,
  },
  // Додай інші товари...
];

// --- Функції для користувача і HTML-шаблону ---
function getCurrentUser(req) {
  // Заглушка - заміни логіку автентифікації
  return { username: 'Іван' };
}

function renderHeader(user) {
  return `
    <header class="header">
      <nav>
        <a href="/">Головна</a>
        <a href="/category/1">Категорія 1</a>
        <a href="/category/2">Категорія 2</a>
        ${user ? `<span>Привіт, ${user.username}</span>` : `<a href="/login">Увійти</a>`}
      </nav>
    </header>
  `;
}

function htmlPage(title, content) {
  return `
<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  /* Загальні стилі */
  body {
    margin: 0; padding: 0; font-family: Arial, sans-serif;
    background: #12181f; color: #dde1e7;
    display: flex; flex-direction: column; min-height: 100vh;
  }
  a {
    color: #80b3ff; text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  .header nav {
    background: #0f1621;
    padding: 1rem 2rem;
    display: flex; gap: 1.5rem; align-items: center;
  }
  .header nav a, .header nav span {
    color: #dde1e7;
    font-weight: 600;
  }
  main {
    flex-grow: 1;
    padding: 2rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    flex-direction: column;
  }
  .centered-content {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
  }

  /* Стилі для форм та елементів вводу */
  input[type="text"],
  select,
  textarea {
    width: 100%;
    max-width: 320px;
    padding: 0.5rem 0.75rem;
    margin-top: 0.25rem;
    margin-bottom: 1rem;
    border-radius: 6px;
    border: 1px solid #394753;
    background-color: #1c262f;
    color: #dde1e7;
    font-size: 1rem;
    box-sizing: border-box;
    resize: vertical;
  }
  input[readonly] {
    background-color: #2a3747;
    cursor: default;
  }
  label {
    display: block;
    font-weight: 600;
    text-align: left;
  }

  /* Стилі кнопок */
  button {
    cursor: pointer;
    background-color: #80b3ff;
    border: none;
    color: #0f1621;
    font-weight: 700;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    transition: background-color 0.3s ease;
  }
  button:hover {
    background-color: #5a8ddd;
  }
  button:disabled {
    background-color: #526e97;
    cursor: default;
  }

  /* Спеціальні кнопки для кількості */
  .btn-quantity {
    width: 30px;
    padding: 0;
    font-weight: 900;
    font-size: 1.2rem;
    line-height: 1;
    background-color: #394753;
    color: #dde1e7;
  }
  .btn-quantity:hover {
    background-color: #526e97;
  }

  /* Кнопки каруселі */
  .btn-slider {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: #0f1621;
    color: #dde1e7;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    user-select: none;
    font-size: 1.5rem;
    border-radius: 4px;
  }
  #prevBtn {
    left: 5px;
  }
  #nextBtn {
    right: 5px;
  }

  /* Форми */
  form.form-styled {
    max-width: 320px;
    margin: 0 auto 2rem auto;
    text-align: left;
  }

  ul {
    list-style-type: none;
    padding-left: 0;
    max-width: 600px;
    margin: 0 auto 2rem auto;
    text-align: left;
  }
  li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #394753;
  }
</style>
</head>
<body>
  <div class="header">${content.startsWith('<header') ? content : ''}</div>
  ${content}
</body>
</html>
  `;
}

// --- Маршрут для категорій ---
app.get('/', (req, res) => {
  const user = getCurrentUser(req);
  res.send(htmlPage('Головна', renderHeader(user) + `
    <main class="centered-content">
      <h1>Вітаємо в магазині!</h1>
      <p>Оберіть категорію товарів для перегляду.</p>
      <ul style="max-width:300px; margin:0 auto; text-align:left;">
        <li><a href="/category/1">Категорія 1</a></li>
        <li><a href="/category/2">Категорія 2</a></li>
      </ul>
    </main>
  `));
});

app.get('/category/:id', (req, res) => {
  const user = getCurrentUser(req);
  const catId = req.params.id;
  // Фільтруємо товари за категорією, тут приклад заглушки
  const filteredProducts = products.filter(p => p.categoryId == catId);
  // Якщо нема категорії, можна показати загальний список або повідомлення
  const productsListHtml = filteredProducts.length ? filteredProducts.map(p => `
    <div style="margin-bottom:1rem;">
      <a href="/product/${p.id}" style="color:#80b3ff; font-weight:bold;">${p.name}</a>
      <p>Ціна: ${p.price.toFixed(2)} ₴</p>
    </div>
  `).join('') : '<p>Товарів у цій категорії немає.</p>';

  res.send(htmlPage(`Категорія ${catId}`, renderHeader(user) + `
    <main class="centered-content">
      <h1>Товари категорії: ${catId}</h1>
      ${productsListHtml}
    </main>
  `));
});

// --- Детальна сторінка товару з каруселлю та відгуками і рейтингом ---
app.get('/product/:id', (req, res) => {
  const user = getCurrentUser(req);
  const prodId = Number(req.params.id);
  const p = products.find(x => x.id === prodId);
  if (!p) return res.status(404).send('Товар не знайдено');

  // Карусель картинок
  const sliderHtml = `
    <div id="slider" style="position:relative; width:300px; height:300px; overflow:hidden; margin-bottom:1rem; margin-left:auto; margin-right:auto;">
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
      <button id="prevBtn" class="btn-slider">&#8592;</button>
      <button id="nextBtn" class="btn-slider">&#8594;</button>
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
    <main class="centered-content">
      <h2>${p.name}</h2>
      ${sliderHtml}
      <p><b>Ціна:</b> ${p.price.toFixed(2)} ₴</p>
      <p><b>Середній рейтинг:</b> ${p.rating.toFixed(1)} / 5</p>
      <p><b>Опис:</b><br/>${p.description || 'Немає опису'}</p>
      
      <section id="reviews" style="max-width: 600px; margin: 0 auto;">
        <h3>Відгуки</h3>
        ${reviewsHtml}
        ${user ? `
          <form id="reviewForm" method="POST" action="/product/${p.id}/review" class="form-styled">
            <label>Рейтинг:
              <select name="rating" required>
                <option value="">Оцініть</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </label>
            <label>Відгук:
              <textarea name="comment" rows="3" required></textarea>
            </label>
            <button type="submit" class="btn-main">Додати відгук</button>
          </form>
        ` : `<p>Ви маєте увійти, щоб залишити відгук.</p>`}
      </section>

      <form id="addToCartForm" method="POST" action="/cart/add" class="form-styled" style="margin-top:1rem; max-width: 320px;">
        <input type="hidden" name="productId" value="${p.id}" />
        <label>Кількість:</label>
        <div style="display:flex; justify-content:center; align-items:center; gap: 0.5rem; margin-bottom: 1rem;">
          <button type="button" id="minusBtn" class="btn-quantity">-</button>
          <input type="text" id="quantityInput" name="quantity" value="1" readonly />
          <button type="button" id="plusBtn" class="btn-quantity">+</button>
        </div>
        <button type="submit" class="btn-main" style="width: 100%;">Додати до кошика</button>
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

// --- Запуск сервера ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));
