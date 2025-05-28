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
