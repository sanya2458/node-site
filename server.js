<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Каталог товарів</title>
<style>
  .product-cell {
    width: 200px;
    height: 200px;
    border: 1px solid #ccc;
    cursor: pointer;
    display: inline-block;
    margin: 10px;
    position: relative;
    overflow: hidden;
  }
  .product-cell img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  /* Модальне вікно */
  .modal {
    display: none; /* приховано за замовчуванням */
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.6);
    justify-content: center;
    align-items: center;
  }
  .modal.active {
    display: flex;
  }
  .modal-content {
    background: white;
    padding: 20px;
    max-width: 500px;
    width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }
  .modal-img-container {
    position: relative;
    width: 100%;
    height: 300px;
    overflow: hidden;
  }
  .modal-img-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: none;
  }
  .modal-img-container img.active {
    display: block;
  }
  .btn-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0,0,0,0.3);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 5px 10px;
  }
  .btn-left {
    left: 0;
  }
  .btn-right {
    right: 0;
  }
  .close-btn {
    position: absolute;
    top: 5px; right: 5px;
    background: #f00;
    border: none;
    color: white;
    font-weight: bold;
    cursor: pointer;
    padding: 5px 10px;
  }

  .rating {
    display: flex;
    gap: 5px;
    margin: 10px 0;
  }
  .rating span {
    font-size: 24px;
    cursor: pointer;
    color: #ccc;
  }
  .rating span.selected {
    color: gold;
  }

  .review-list {
    max-height: 100px;
    overflow-y: auto;
    border: 1px solid #ddd;
    padding: 5px;
    margin-bottom: 10px;
  }
  .review-item {
    border-bottom: 1px solid #eee;
    padding: 5px 0;
  }

  .qty-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .qty-controls button {
    width: 30px;
    height: 30px;
    font-size: 20px;
  }
  .qty-display {
    min-width: 30px;
    text-align: center;
    font-size: 18px;
  }
</style>
</head>
<body>

<div id="productList">
  <!-- Приклад товару -->
  <div class="product-cell" data-id="1">
    <img src="https://via.placeholder.com/200x200?text=Товар+1" alt="Товар 1" />
  </div>
  <div class="product-cell" data-id="2">
    <img src="https://via.placeholder.com/200x200?text=Товар+2" alt="Товар 2" />
  </div>
</div>

<!-- Модальне вікно товару -->
<div id="productModal" class="modal">
  <div class="modal-content">
    <button class="close-btn" id="modalCloseBtn">&times;</button>

    <div class="modal-img-container">
      <button class="btn-arrow btn-left" id="prevImgBtn">&#8592;</button>
      <button class="btn-arrow btn-right" id="nextImgBtn">&#8594;</button>
      <!-- Картинки динамічно додаються тут -->
    </div>

    <!-- Відгуки -->
    <div>
      <h3>Відгуки</h3>
      <div class="review-list" id="reviewList"></div>

      <h4>Додати відгук</h4>
      <textarea id="reviewText" rows="3" style="width: 100%;"></textarea>
      <div class="rating" id="ratingStars">
        <span data-value="1">&#9733;</span>
        <span data-value="2">&#9733;</span>
        <span data-value="3">&#9733;</span>
        <span data-value="4">&#9733;</span>
        <span data-value="5">&#9733;</span>
      </div>
      <button id="addReviewBtn">Додати</button>
    </div>

    <!-- Кількість -->
    <div class="qty-controls">
      <button id="qtyMinus">−</button>
      <div class="qty-display" id="qtyDisplay">1</div>
      <button id="qtyPlus">+</button>
    </div>

    <button id="addToCartBtn">Додати в корзину</button>
  </div>
</div>

<script>
  // Дані товарів (в реальності можна отримувати з бекенду)
  const products = {
    1: {
      images: [
        "https://via.placeholder.com/400x300?text=Товар+1+-+Фото+1",
        "https://via.placeholder.com/400x300?text=Товар+1+-+Фото+2",
        "https://via.placeholder.com/400x300?text=Товар+1+-+Фото+3"
      ],
      reviews: [
        {text: "Добрий товар!", rating: 4},
        {text: "Підходить, рекомендую", rating: 5}
      ]
    },
    2: {
      images: [
        "https://via.placeholder.com/400x300?text=Товар+2+-+Фото+1",
        "https://via.placeholder.com/400x300?text=Товар+2+-+Фото+2"
      ],
      reviews: []
    }
  };

  const productCells = document.querySelectorAll('.product-cell');
  const modal = document.getElementById('productModal');
  const modalImgContainer = modal.querySelector('.modal-img-container');
  const reviewList = document.getElementById('reviewList');
  const reviewText = document.getElementById('reviewText');
  const ratingStars = document.getElementById('ratingStars');
  const addReviewBtn = document.getElementById('addReviewBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  const qtyMinus = document.getElementById('qtyMinus');
  const qtyPlus = document.getElementById('qtyPlus');
  const qtyDisplay = document.getElementById('qtyDisplay');
  const addToCartBtn = document.getElementById('addToCartBtn');

  let currentProductId = null;
  let currentImageIndex = 0;
  let currentRating = 0;
  let currentQty = 1;

  // Відкрити модалку товару
  productCells.forEach(cell => {
    cell.addEventListener('click', () => {
      currentProductId = cell.dataset.id;
      currentImageIndex = 0;
      currentQty = 1;
      qtyDisplay.textContent = currentQty;

      // Очищаємо і додаємо фото
      modalImgContainer.querySelectorAll('img').forEach(img => img.remove());
      products[currentProductId].images.forEach((src, i) => {
        const img = document.createElement('img');
        img.src = src;
        if(i === currentImageIndex) img.classList.add('active');
        modalImgContainer.appendChild(img);
      });

      // Показуємо відгуки
      renderReviews();

      // Скидаємо рейтинг відгуку, текст
      currentRating = 0;
      setRatingStars(currentRating);
      reviewText.value = '';

      // Показати модалку
      modal.classList.add('active');
    });
  });

  // Функції для гортання фото
  function showImage(index) {
    const imgs = modalImgContainer.querySelectorAll('img');
    imgs.forEach(img => img.classList.remove('active'));
    if (imgs[index]) imgs[index].classList.add('active');
  }

  document.getElementById('prevImgBtn').addEventListener('click', () => {
    const imgs = products[currentProductId].images;
    currentImageIndex = (currentImageIndex - 1 + imgs.length) % imgs.length;
    showImage(currentImageIndex);
  });
  document.getElementById('nextImgBtn').addEventListener('click', () => {
    const imgs = products[currentProductId].images;
    currentImageIndex = (currentImageIndex + 1) % imgs.length;
    showImage(currentImageIndex);
  });

  // Закрити модалку
  modalCloseBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Відгуки і рейтинг
  ratingStars.querySelectorAll('span').forEach(star => {
    star.addEventListener('click', () => {
      currentRating = parseInt(star.dataset.value);
      setRatingStars(currentRating);
    });
  });

  function setRatingStars(rating) {
    ratingStars.querySelectorAll('span').forEach(star => {
      star.classList.toggle('selected', parseInt(star.dataset.value) <= rating);
    });
  }

  function renderReviews() {
    reviewList.innerHTML = '';
    const reviews = products[currentProductId].reviews;
    if (reviews.length === 0) {
      reviewList.textContent = 'Відгуків немає';
      return;
    }
    reviews.forEach(r => {
      const div = document.createElement('div');
      div.className = 'review-item';
      div.innerHTML = `<b>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</b><br>${r.text}`;
      reviewList.appendChild(div);
    });
  }

  addReviewBtn.addEventListener('click', () => {
    const text = reviewText.value.trim();
    if(text === '' || currentRating === 0){
      alert('Будь ласка, введіть текст відгуку та оберіть рейтинг');
      return;
    }
    products[currentProductId].reviews.push({text, rating: currentRating});
    reviewText.value = '';
    currentRating = 0;
    setRatingStars(0);
    renderReviews();
  });

  // Кількість товару
  qtyMinus.addEventListener('click', () => {
    if(currentQty > 1){
      currentQty--;
      qtyDisplay.textContent = currentQty;
    }
  });
  qtyPlus.addEventListener('click', () => {
    currentQty++;
    qtyDisplay.textContent = currentQty;
  });

  addToCartBtn.addEventListener('click', () => {
    alert(`Додано товар ID ${currentProductId} у кількості ${currentQty} до корзини!`);
    // Тут виклик логіки додавання у корзину, наприклад через AJAX / fetch
  });

</script>
</body>
</html>
