'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  products: [],       // master list (loaded from JSON)
  stock: {},          // live stock map: { id: qty }
  cart: {},           // { id: qty }
  activeSection: 'catalog',
  searchQuery: '',
  activeCategory: 'all',
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const productGrid = $('product-grid');
const cartList = $('cart-list');
const ordersList = $('orders-list');
const cartBadge = $('cart-badge');
const searchInput = $('search-input');
const emptyState = $('empty-state');
const emptyQuery = $('empty-query');
const filterBar = document.querySelector('.filter-bar');
const toastContainer = $('toast-container');

// ── Utility ────────────────────────────────────────────────────────────────
const fmt = n => '$' + Number(n).toFixed(2);

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  }, 3000);
}

// ── Path Resolver (Fixes Images on Local & GitHub Pages) ───────────────────
function assetUrl(rel) {
  if (!rel || rel.startsWith('http') || rel.startsWith('data:')) return rel;
  // Baştaki noktaları temizleyerek mutlak yol oluşturur
  const cleanPath = rel.replace(/^\.\//, '');
  return cleanPath;
}

// ── Inline Fallback Data (Uzantılar .jfif olarak güncellendi) ──────────────
const INLINE_PRODUCTS = [
  { id: "P001", name: "Wireless Noise-Cancel Headphones", price: 249.99, stock: 14, image: "images/headphones.jfif", category: "Audio", description: "Studio-grade sound, 30hr battery" },
  { id: "P002", name: "Gaming Headset Max", price: 139.00, stock: 7, image: "images/headphones2.jfif", category: "Audio", description: "RGB lighting, 7.1 Surround" },
  { id: "P003", name: "Pro Studio Headphones", price: 199.00, stock: 5, image: "images/headphones3.jfif", category: "Audio", description: "Flat response for mixing" },
];

// ── Fetch products ─────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    // Klasör yapına göre products.json 'data' klasörünün içinde
    const res = await fetch('./data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.products = await res.json();
    console.log('✅ Loaded from JSON');
  } catch (err) {
    console.warn('⚠️ Using inline data:', err.message);
    state.products = INLINE_PRODUCTS;
  }

  // Stokları eşitle
  state.products.forEach(p => { state.stock[p.id] = p.stock; });

  renderStats();
  renderFilters();
  renderCatalog();
}

// ── Stats ──────────────────────────────────────────────────────────────────
function renderStats() {
  const total = state.products.length;
  const inStock = state.products.filter(p => state.stock[p.id] > 0).length;
  const outStock = total - inStock;
  const cartVal = Object.entries(state.cart).reduce((sum, [id, qty]) => {
    const p = state.products.find(x => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  if ($('stat-total')) $('stat-total').textContent = total;
  if ($('stat-instock')) $('stat-instock').textContent = inStock;
  if ($('stat-outstock')) $('stat-outstock').textContent = outStock;
  if ($('stat-cartval')) $('stat-cartval').textContent = fmt(cartVal);
}

// ── Filters ────────────────────────────────────────────────────────────────
function renderFilters() {
  if (!filterBar) return;
  const cats = ['all', ...new Set(state.products.map(p => p.category))];
  filterBar.innerHTML = cats.map(c => `
    <button class="filter-btn${c === state.activeCategory ? ' active' : ''}" data-cat="${c}">
      ${c === 'all' ? 'All' : c}
    </button>
  `).join('');
}

if (filterBar) {
  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.activeCategory = btn.dataset.cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderCatalog();
  });
}

// ── Catalog ────────────────────────────────────────────────────────────────
function stockBadge(qty) {
  if (qty === 0) return `<span class="stock-badge out">Out of stock</span>`;
  if (qty <= 5) return `<span class="stock-badge low">${qty} left</span>`;
  return `<span class="stock-badge ok">${qty} in stock</span>`;
}

function renderCatalog() {
  const q = state.searchQuery.trim().toLowerCase();
  const list = state.products.filter(p => {
    const matchCat = state.activeCategory === 'all' || p.category === state.activeCategory;
    const matchQ = !q || p.name.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  emptyState.classList.toggle('hidden', list.length > 0);
  if (!list.length) {
    emptyQuery.textContent = state.searchQuery || state.activeCategory;
    productGrid.innerHTML = '';
    return;
  }

  productGrid.innerHTML = list.map((p, i) => {
    const qty = state.stock[p.id];
    const isOOS = qty === 0;
    const inCart = state.cart[p.id] || 0;
    const maxReached = inCart >= qty;
    const imgSrc = assetUrl(p.image || (p.images ? p.images[0] : ''));

    return `
      <article class="product-card${isOOS ? ' out-of-stock' : ''}" data-id="${p.id}" style="animation-delay:${i * 30}ms">
        <div class="card-img-wrap">
          <img src="${imgSrc}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/200?text=Box'">
        </div>
        <div class="card-body">
          <span class="card-category">${p.category || ''}</span>
          <h3 class="card-name">${p.name}</h3>
          <div class="card-meta">
            <span class="card-price">${fmt(p.price)}</span>
            ${stockBadge(qty)}
          </div>
        </div>
        <div class="card-footer">
          <button class="btn-add" data-id="${p.id}" ${isOOS || maxReached ? 'disabled' : ''}>
            ${isOOS ? 'Out of Stock' : (maxReached ? '✓ Max in Cart' : 'Add to Cart')}
          </button>
        </div>
      </article>`;
  }).join('');
}

// Add to Cart
productGrid.addEventListener('click', e => {
  const btn = e.target.closest('.btn-add');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  const p = state.products.find(x => x.id === id);
  if (!p) return;

  state.cart[id] = (state.cart[id] || 0) + 1;
  toast(`${p.name} added`, 'success');
  updateCartBadge();
  renderCatalog();
  renderStats();
});

// ── Cart & Orders Logic ───────────────────────────────────────────────────
function updateCartBadge() {
  const count = Object.values(state.cart).reduce((a, b) => a + b, 0);
  cartBadge.textContent = count;
  cartBadge.hidden = count === 0;
}

function renderCart() {
  const entries = Object.entries(state.cart).filter(([, qty]) => qty > 0);
  if (!entries.length) {
    cartList.innerHTML = `<div class="empty-cart"><p>Your cart is empty</p></div>`;
    $('summary-total').textContent = '$0.00';
    return;
  }

  cartList.innerHTML = entries.map(([id, qty]) => {
    const p = state.products.find(x => x.id === id);
    return `
      <div class="cart-item">
        <img class="cart-item-img" src="${assetUrl(p.image)}" alt="${p.name}">
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">${fmt(p.price)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" data-id="${id}">−</button>
          <span>${qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${id}" ${qty >= state.stock[id] ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
  }).join('');

  const total = Object.entries(state.cart).reduce((s, [id, q]) => s + (state.products.find(x => x.id === id)?.price || 0) * q, 0);
  $('summary-total').textContent = fmt(total);
}

cartList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'inc') state.cart[id]++;
  else if (action === 'dec') {
    state.cart[id]--;
    if (state.cart[id] <= 0) delete state.cart[id];
  }
  updateCartBadge(); renderCart(); renderCatalog(); renderStats();
});

// ── Navigation ─────────────────────────────────────────────────────────────
function navigateTo(section) {
  state.activeSection = section;
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === `section-${section}`));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  if (section === 'cart') renderCart();
  if (section === 'orders') renderOrders();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.section));
});

// ── Search & Theme ────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value;
  renderCatalog();
});

$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
});

// ── Init ───────────────────────────────────────────────────────────────────
loadProducts();