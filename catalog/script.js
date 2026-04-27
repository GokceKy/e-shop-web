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

// ── Base path resolver (survives any GitHub Pages subfolder) ──────────────
// window.location.pathname for https://user.github.io/repo/catalog/ → "/repo/catalog/"
const BASE_PATH = (() => {
  let p = window.location.pathname;
  if (!p.endsWith('/')) p = p.replace(/\/[^/]*$/, '/');
  return p; // always ends with "/"
})();

function assetUrl(rel) {
  if (!rel || rel.startsWith('http') || rel.startsWith('data:')) return rel;
  // Strip any accidental leading "./"
  return BASE_PATH + rel.replace(/^\.\//, '');
}

// ── Inline product data (fallback — always works on GitHub Pages) ──────────
const INLINE_PRODUCTS = [
  { id: "P001", name: "Wireless Noise-Cancel Headphones", price: 249.99, stock: 14, image: "images/headphones.svg", category: "Audio", description: "Studio-grade sound, 30hr battery" },
  { id: "P002", name: "Mechanical Keyboard TKL", price: 139.00, stock: 7, image: "images/keyboard.svg", category: "Peripherals", description: "Cherry MX switches, RGB backlit" },
  { id: "P003", name: "4K Webcam Pro", price: 199.00, stock: 0, image: "images/webcam.svg", category: "Video", description: "Auto-focus, built-in ring light" },
  { id: "P004", name: "USB-C Hub 12-in-1", price: 79.99, stock: 23, image: "images/hub.svg", category: "Accessories", description: "4K HDMI, 100W PD, SD card" },
  { id: "P005", name: "Ergonomic Mouse", price: 89.00, stock: 3, image: "images/mouse.svg", category: "Peripherals", description: "Vertical grip, silent clicks" },
  { id: "P006", name: '27" 165Hz Monitor', price: 449.00, stock: 5, image: "images/monitor.svg", category: "Displays", description: "QHD IPS, 1ms response time" },
  { id: "P007", name: "Smart LED Desk Lamp", price: 59.99, stock: 18, image: "images/lamp.svg", category: "Accessories", description: "Tunable color temp, USB-A port" },
  { id: "P008", name: "Portable SSD 1TB", price: 109.00, stock: 0, image: "images/ssd.svg", category: "Storage", description: "1050MB/s read, shock-resistant" },
];

// ── Fetch products ─────────────────────────────────────────────────────────
// Builds the correct URL regardless of GitHub Pages subfolder depth.
// e.g. https://user.github.io/repo/catalog/ → fetches /repo/catalog/data/products.json
function getJsonUrl() {
  const base = document.currentScript
    ? new URL(document.currentScript.src)          // script tag src as anchor
    : new URL(window.location.href);               // fallback: page URL
  // Strip filename if present (script.js → keep directory)
  const dir = base.pathname.endsWith('.js')
    ? base.pathname.replace(/\/[^/]+$/, '/')
    : base.pathname.replace(/\/?$/, '/');
  return `${base.origin}${dir}data/products.json`;
}

async function loadProducts() {
  // Try fetching the JSON file first
  try {
    const url = getJsonUrl();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`);
    state.products = await res.json();
    console.log('✅ Loaded products from JSON file');
  } catch (err) {
    // Fall back to inline data — works 100% of the time on GitHub Pages
    console.warn('⚠️ JSON fetch failed, using inline data:', err.message);
    state.products = INLINE_PRODUCTS;
  }

  // Seed live stock from loaded data
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

  $('stat-total').textContent = total;
  $('stat-instock').textContent = inStock;
  $('stat-outstock').textContent = outStock;
  $('stat-cartval').textContent = fmt(cartVal);
}

// ── Filters ────────────────────────────────────────────────────────────────
function renderFilters() {
  const cats = ['all', ...new Set(state.products.map(p => p.category))];
  filterBar.innerHTML = cats.map(c => `
    <button class="filter-btn${c === state.activeCategory ? ' active' : ''}" data-cat="${c}">
      ${c === 'all' ? 'All' : c}
    </button>
  `).join('');
}

filterBar.addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  state.activeCategory = btn.dataset.cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCatalog();
});

// ── Catalog ────────────────────────────────────────────────────────────────
function getFilteredProducts() {
  const q = state.searchQuery.trim().toLowerCase();
  return state.products.filter(p => {
    const matchCat = state.activeCategory === 'all' || p.category === state.activeCategory;
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    return matchCat && matchQ;
  });
}

function stockBadge(qty) {
  if (qty === 0) return `<span class="stock-badge out">Out of stock</span>`;
  if (qty <= 5) return `<span class="stock-badge low">${qty} left</span>`;
  return `<span class="stock-badge ok">${qty} in stock</span>`;
}

function renderCatalog() {
  const list = getFilteredProducts();

  emptyState.classList.toggle('hidden', list.length > 0);
  if (!list.length) {
    emptyQuery.textContent = state.searchQuery || state.activeCategory;
    productGrid.innerHTML = '';
    return;
  }

  productGrid.innerHTML = list.map((p, i) => {
    const qty = state.stock[p.id];
    const oos = qty === 0;
    const inCart = state.cart[p.id] || 0;
    const maxReached = inCart >= qty;
    return `
      <article class="product-card${oos ? ' out-of-stock' : ''}" data-id="${p.id}" style="animation-delay:${i * 30}ms">
        <div class="card-img-wrap">
          <img src="${assetUrl(p.images ? p.images[0] : p.image)}" alt="${p.name}"" alt="${p.name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22><rect width=%22120%22 height=%22120%22 fill=%22%231e2637%22/><text x=%2260%22 y=%2265%22 text-anchor=%22middle%22 fill=%22%2364748b%22 font-size=%2224%22>📦</text></svg>'" />
        </div>
        <div class="card-body">
          <span class="card-category">${p.category || ''}</span>
          <h3 class="card-name">${p.name}</h3>
          ${p.description ? `<p class="card-desc">${p.description}</p>` : ''}
          <div class="card-meta">
            <span class="card-price">${fmt(p.price)}</span>
            ${stockBadge(qty)}
          </div>
        </div>
        <div class="card-footer">
          <button class="btn-add" data-id="${p.id}" ${oos || maxReached ? 'disabled' : ''}>
            ${oos ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Out of Stock'
        : maxReached ? '✓ Max in Cart'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add to Cart'}
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

  const currentQty = state.cart[id] || 0;
  const available = state.stock[id];

  if (currentQty >= available) {
    toast(`Only ${available} in stock!`, 'warning');
    return;
  }

  state.cart[id] = currentQty + 1;
  toast(`${p.name} added to cart`, 'success');

  updateCartBadge();
  renderCatalog();
  renderStats();
});

// ── Cart ───────────────────────────────────────────────────────────────────
function cartTotal() {
  return Object.entries(state.cart).reduce((sum, [id, qty]) => {
    const p = state.products.find(x => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
}

function updateCartBadge() {
  const count = Object.values(state.cart).reduce((a, b) => a + b, 0);
  cartBadge.textContent = count;
  cartBadge.hidden = count === 0;
}

function renderCart() {
  const entries = Object.entries(state.cart).filter(([, qty]) => qty > 0);

  if (!entries.length) {
    cartList.innerHTML = `
      <div class="empty-cart">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <p>Your cart is empty</p>
      </div>`;
    $('summary-subtotal').textContent = '$0.00';
    $('summary-total').textContent = '$0.00';
    return;
  }

  cartList.innerHTML = entries.map(([id, qty]) => {
    const p = state.products.find(x => x.id === id);
    if (!p) return '';
    return `
      <div class="cart-item" data-id="${id}">
        <img class="cart-item-img" src="${p.image}" alt="${p.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect width=%2240%22 height=%2240%22 fill=%22%231e2637%22/></svg>'" />
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">${fmt(p.price)} × ${qty} = ${fmt(p.price * qty)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" data-id="${id}">−</button>
          <span class="qty-value">${qty}</span>
          <button class="qty-btn" data-action="inc" data-id="${id}" ${qty >= state.stock[id] ? 'disabled style="opacity:0.4"' : ''}>+</button>
          <button class="remove-btn" data-action="remove" data-id="${id}" aria-label="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  const total = cartTotal();
  $('summary-subtotal').textContent = fmt(total);
  $('summary-total').textContent = fmt(total);
}

cartList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  const p = state.products.find(x => x.id === id);

  if (action === 'inc') {
    if ((state.cart[id] || 0) < state.stock[id]) state.cart[id]++;
    else toast(`Only ${state.stock[id]} in stock!`, 'warning');
  } else if (action === 'dec') {
    if ((state.cart[id] || 0) > 1) state.cart[id]--;
    else { delete state.cart[id]; toast(`${p?.name} removed`, 'info'); }
  } else if (action === 'remove') {
    delete state.cart[id];
    toast(`${p?.name} removed`, 'info');
  }

  updateCartBadge();
  renderCart();
  renderCatalog();
  renderStats();
});

$('clear-cart-btn').addEventListener('click', () => {
  if (!Object.keys(state.cart).length) return;
  state.cart = {};
  updateCartBadge();
  renderCart();
  renderCatalog();
  renderStats();
  toast('Cart cleared', 'info');
});

// ── Sale ───────────────────────────────────────────────────────────────────
$('complete-sale-btn').addEventListener('click', () => {
  const name = $('customer-name').value.trim();

  if (!name) {
    toast('Please enter a customer name', 'error');
    $('customer-name').focus();
    return;
  }

  const items = Object.entries(state.cart).filter(([, qty]) => qty > 0);
  if (!items.length) {
    toast('Cart is empty', 'error');
    return;
  }

  // Build order record
  const order = {
    id: Date.now(),
    customer: name,
    date: new Date().toISOString(),
    items: items.map(([id, qty]) => {
      const p = state.products.find(x => x.id === id);
      return { id, name: p?.name, price: p?.price, qty };
    }),
    total: cartTotal(),
  };

  // Reduce live stock
  items.forEach(([id, qty]) => { state.stock[id] = Math.max(0, (state.stock[id] || 0) - qty); });

  // Persist order
  const orders = JSON.parse(localStorage.getItem('nexus_orders') || '[]');
  orders.unshift(order);
  localStorage.setItem('nexus_orders', JSON.stringify(orders));

  // Reset cart
  state.cart = {};
  $('customer-name').value = '';

  updateCartBadge();
  renderCart();
  renderCatalog();
  renderStats();
  renderOrders();

  toast(`Sale completed for ${name} 🎉`, 'success');

  // Switch to orders
  setTimeout(() => navigateTo('orders'), 800);
});

// ── Orders ─────────────────────────────────────────────────────────────────
function renderOrders() {
  const orders = JSON.parse(localStorage.getItem('nexus_orders') || '[]');

  if (!orders.length) {
    ordersList.innerHTML = `<div class="empty-orders">No orders yet. Complete a sale to see history.</div>`;
    return;
  }

  ordersList.innerHTML = orders.map((o, i) => {
    const d = new Date(o.date);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="order-card" style="animation-delay:${i * 40}ms">
        <div class="order-header">
          <span class="order-customer">${o.customer}</span>
          <div class="order-meta">
            <span class="order-date">${dateStr} · ${timeStr}</span>
            <span class="order-total-badge">${fmt(o.total)}</span>
          </div>
        </div>
        <div class="order-items">
          ${o.items.map(it => `
            <div class="order-item-line">
              <span>${it.qty}× ${it.name}</span>
              <span>${fmt((it.price || 0) * it.qty)}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

$('clear-orders-btn').addEventListener('click', () => {
  if (!localStorage.getItem('nexus_orders')) return;
  localStorage.removeItem('nexus_orders');
  renderOrders();
  toast('Order history cleared', 'info');
});

// ── Navigation ─────────────────────────────────────────────────────────────
const sectionMeta = {
  catalog: { title: 'Product Catalog', subtitle: 'Browse and manage inventory' },
  cart: { title: 'Cart', subtitle: 'Review and complete your sale' },
  orders: { title: 'Order History', subtitle: 'Past completed transactions' },
};

function navigateTo(section) {
  state.activeSection = section;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Show correct section
  document.querySelectorAll('.section').forEach(el => {
    el.classList.toggle('active', el.id === `section-${section}`);
  });

  // Update topbar
  const meta = sectionMeta[section] || {};
  $('page-title').textContent = meta.title || '';
  $('page-subtitle').textContent = meta.subtitle || '';

  // Show/hide search
  const searchWrap = $('search-wrap');
  if (searchWrap) searchWrap.style.display = section === 'catalog' ? '' : 'none';

  // Render section content
  if (section === 'cart') renderCart();
  if (section === 'orders') renderOrders();

  // Close mobile sidebar
  closeMobileSidebar();
}

document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigateTo(el.dataset.section);
  });
});

// ── Search ─────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value;
  renderCatalog();
});

// ── Theme ──────────────────────────────────────────────────────────────────
const themeToggle = $('theme-toggle');
const savedTheme = localStorage.getItem('nexus_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('nexus_theme', next);
});

// ── Mobile sidebar ─────────────────────────────────────────────────────────
const sidebar = document.querySelector('.sidebar');
const mobileMenuBtn = $('mobile-menu-btn');

// Create overlay
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

function openMobileSidebar() { sidebar.classList.add('open'); overlay.classList.add('visible'); }
function closeMobileSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('visible'); }

mobileMenuBtn.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeMobileSidebar() : openMobileSidebar();
});

overlay.addEventListener('click', closeMobileSidebar);

// ── Init ───────────────────────────────────────────────────────────────────
loadProducts();