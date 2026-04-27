'use strict';

// ── State ─────────────────────────────
const state = {
  products: [],
  stock: {},
  cart: {},
  activeSection: 'catalog',
  searchQuery: '',
  activeCategory: 'all',
};

// ── DOM ───────────────────────────────
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

// ── Utils ─────────────────────────────
const fmt = n => '$' + Number(n).toFixed(2);

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastContainer.appendChild(el);

  setTimeout(() => {
    el.remove();
  }, 3000);
}

// ── PRODUCTS LOAD ─────────────────────
async function loadProducts() {
  try {
    const res = await fetch('./data/products.json');
    state.products = await res.json();

    state.products.forEach(p => {
      state.stock[p.id] = p.stock;
    });

    renderStats();
    renderFilters();
    renderCatalog();

  } catch (err) {
    console.error(err);
    toast("Products yüklenemedi", "error");
  }
}

// ── STATS ─────────────────────────────
function renderStats() {
  const total = state.products.length;
  const inStock = state.products.filter(p => state.stock[p.id] > 0).length;

  $('stat-total').textContent = total;
  $('stat-instock').textContent = inStock;
  $('stat-outstock').textContent = total - inStock;
}

// ── FILTERS ───────────────────────────
function renderFilters() {
  const cats = ['all', ...new Set(state.products.map(p => p.category))];

  filterBar.innerHTML = cats.map(c => `
    <button class="filter-btn ${c === state.activeCategory ? 'active' : ''}" data-cat="${c}">
      ${c}
    </button>
  `).join('');
}

filterBar.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;

  state.activeCategory = btn.dataset.cat;
  renderCatalog();
  renderFilters();
});

// ── CATALOG ───────────────────────────
function getFiltered() {
  return state.products.filter(p => {
    const q = state.searchQuery.toLowerCase();

    return (
      (state.activeCategory === 'all' || p.category === state.activeCategory) &&
      (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  });
}

function renderCatalog() {
  const list = getFiltered();

  if (!list.length) {
    productGrid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  productGrid.innerHTML = list.map(p => {
    const qty = state.stock[p.id];
    const img = (p.images && p.images[0]) ? p.images[0] : p.image;

    return `
      <div class="product-card">
        <img src="${img}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <strong>${fmt(p.price)}</strong>
        <span>Stock: ${qty}</span>
      </div>
    `;
  }).join('');
}

// ── SEARCH ────────────────────────────
searchInput.addEventListener('input', e => {
  state.searchQuery = e.target.value;
  renderCatalog();
});

// ── INIT ──────────────────────────────
loadProducts();