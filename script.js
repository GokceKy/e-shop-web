'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  products: [],
  stock: {},
  cart: {},
  orders: [],
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

function assetUrl(rel) {
  if (!rel || rel.startsWith('http') || rel.startsWith('data:')) return rel;
  return rel.replace(/^\.\//, '');
}

// ── Inline Fallback Data ───────────────────────────────────────────────────
const INLINE_PRODUCTS = [
  { id: 'P001', name: 'Wireless Noise-Cancel Headphones', price: 249.99, stock: 14, image: 'images/headphones.jfif', category: 'Audio', description: 'Studio-grade sound, 30hr battery' },
  { id: 'P002', name: 'Gaming Headset Max', price: 139.00, stock: 7, image: 'images/headphones2.jfif', category: 'Audio', description: 'RGB lighting, 7.1 Surround' },
  { id: 'P003', name: 'Pro Studio Headphones', price: 199.00, stock: 5, image: 'images/headphones3.jfif', category: 'Audio', description: 'Flat response for mixing' },
];

// ── Load Products ──────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    const res = await fetch('./data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.products = await res.json();
  } catch (err) {
    console.warn('⚠️ Using inline data:', err.message);
    state.products = INLINE_PRODUCTS;
  }
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

filterBar && filterBar.addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  state.activeCategory = btn.dataset.cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCatalog();
});

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
          <img src="${imgSrc}" alt="${p.name}" loading="lazy"
               onerror="this.src='https://via.placeholder.com/200?text=Box'">
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

  const currentQty = state.cart[id] || 0;
  if (currentQty >= state.stock[id]) return;

  state.cart[id] = currentQty + 1;

  toast(`${p.name} added to cart`, 'success');
  updateCartBadge();
  renderCatalog();
  renderStats();
});

// ── Cart Badge ─────────────────────────────────────────────────────────────
function updateCartBadge() {
  const count = Object.values(state.cart).reduce((a, b) => a + b, 0);
  cartBadge.textContent = count;
  cartBadge.hidden = count === 0;
}

// ── Cart Render ────────────────────────────────────────────────────────────
function renderCart() {
  if (!cartList) return;

  const entries = Object.entries(state.cart).filter(([, qty]) => qty > 0);

  if (!entries.length) {
    cartList.innerHTML = `
      <div class="empty-cart">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        <p>Your cart is empty</p>
      </div>`;
    updateSummary(0);
    return;
  }

  cartList.innerHTML = entries.map(([id, qty]) => {
    const p = state.products.find(x => x.id === id);
    if (!p) return '';
    const img = assetUrl(p.image || (p.images ? p.images[0] : ''));
    return `
      <div class="cart-item">
        <img class="cart-item-img" src="${img}" alt="${p.name}"
             onerror="this.src='https://via.placeholder.com/60?text=Box'">
        <div class="cart-item-info">
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-price">${fmt(p.price)} × ${qty} = <strong>${fmt(p.price * qty)}</strong></div>
        </div>
        <div class="cart-item-controls">
          <button data-action="dec" data-id="${id}">−</button>
          <span>${qty}</span>
          <button data-action="inc" data-id="${id}" ${qty >= state.stock[id] ? 'disabled' : ''}>+</button>
        </div>
        <button class="btn-remove" data-action="remove" data-id="${id}" title="Remove">✕</button>
      </div>`;
  }).join('');

  const total = entries.reduce((sum, [id, qty]) => {
    const p = state.products.find(x => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  updateSummary(total);
}

function updateSummary(total) {
  if ($('summary-subtotal')) $('summary-subtotal').textContent = fmt(total);
  if ($('summary-total')) $('summary-total').textContent = fmt(total);
}

// Cart controls (inc / dec / remove)
cartList && cartList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;

  if (action === 'inc') {
    if ((state.cart[id] || 0) < state.stock[id]) state.cart[id]++;
  } else if (action === 'dec') {
    state.cart[id]--;
    if (state.cart[id] <= 0) delete state.cart[id];
  } else if (action === 'remove') {
    const p = state.products.find(x => x.id === id);
    delete state.cart[id];
    toast(`${p ? p.name : 'Item'} removed`, 'info');
  }

  updateCartBadge();
  renderCart();
  renderCatalog();
  renderStats();
});

// Clear cart
$('clear-cart-btn') && $('clear-cart-btn').addEventListener('click', () => {
  if (!Object.keys(state.cart).length) return;
  state.cart = {};
  updateCartBadge();
  renderCart();
  renderCatalog();
  renderStats();
  toast('Cart cleared', 'info');
});

// ── Complete Sale (id="complete-sale-btn") ─────────────────────────────────
$('complete-sale-btn').addEventListener('click', () => {
  const entries = Object.entries(state.cart).filter(([, qty]) => qty > 0);

  if (!entries.length) {
    toast('Your cart is empty!', 'error');
    return;
  }

  // Stok kontrolü
  for (const [id, qty] of entries) {
    if (qty > state.stock[id]) {
      const p = state.products.find(x => x.id === id);
      toast(`Not enough stock for ${p ? p.name : id}`, 'error');
      return;
    }
  }

  const customerName = ($('customer-name') && $('customer-name').value.trim()) || 'Guest';

  // Sipariş oluştur
  const order = {
    id: 'ORD-' + Date.now(),
    date: new Date().toLocaleString('tr-TR'),
    customer: customerName,
    items: entries.map(([id, qty]) => {
      const p = state.products.find(x => x.id === id);
      return { id, name: p ? p.name : id, price: p ? p.price : 0, qty };
    }),
    total: entries.reduce((sum, [id, qty]) => {
      const p = state.products.find(x => x.id === id);
      return sum + (p ? p.price * qty : 0);
    }, 0),
  };

  // Stok düşür
  entries.forEach(([id, qty]) => { state.stock[id] -= qty; });

  // Kaydet, sepeti temizle
  state.orders.unshift(order);
  state.cart = {};
  if ($('customer-name')) $('customer-name').value = '';

  updateCartBadge();
  renderCart();
  renderCatalog();
  renderStats();

  toast(`✓ Order ${order.id} saved for ${customerName}`, 'success');
  navigateTo('orders');
});

// ── Orders Render ──────────────────────────────────────────────────────────
function renderOrders() {
  if (!ordersList) return;

  if (!state.orders.length) {
    ordersList.innerHTML = `
      <div class="empty-cart">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>No orders yet</p>
      </div>`;
    return;
  }

  ordersList.innerHTML = state.orders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">${order.id}</span>
        <span class="order-customer">${order.customer}</span>
        <span class="order-date">${order.date}</span>
        <span class="order-total">${fmt(order.total)}</span>
      </div>
      <ul class="order-items">
        ${order.items.map(item => `
          <li>
            <span>${item.name}</span>
            <span>× ${item.qty}</span>
            <span>${fmt(item.price * item.qty)}</span>
          </li>`).join('')}
      </ul>
    </div>
  `).join('');
}

// Clear orders
$('clear-orders-btn') && $('clear-orders-btn').addEventListener('click', () => {
  if (!state.orders.length) return;
  state.orders = [];
  renderOrders();
  toast('Order history cleared', 'info');
});

// ── Navigation ─────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  catalog: ['Product Catalog', 'Browse and manage inventory'],
  cart: ['Shopping Cart', 'Review items before checkout'],
  orders: ['Order History', 'All completed transactions'],
};

function navigateTo(section) {
  state.activeSection = section;

  document.querySelectorAll('.section').forEach(el =>
    el.classList.toggle('active', el.id === `section-${section}`)
  );
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.section === section)
  );

  // Başlık güncelle
  const [title, subtitle] = PAGE_TITLES[section] || ['', ''];
  if ($('page-title')) $('page-title').textContent = title;
  if ($('page-subtitle')) $('page-subtitle').textContent = subtitle;

  // Arama kutusunu sadece catalog'da göster
  const sw = $('search-wrap');
  if (sw) sw.style.display = section === 'catalog' ? '' : 'none';

  if (section === 'cart') renderCart();
  if (section === 'orders') renderOrders();
}

document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', () => navigateTo(el.dataset.section))
);

// Mobile menu (opsiyonel — sidebar toggle)
$('mobile-menu-btn') && $('mobile-menu-btn').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
});

// ── Search & Theme ─────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  state.searchQuery = searchInput.value;
  renderCatalog();
});

$('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
});
function downloadFile(filename, content, type = 'text/plain') {
  const element = document.createElement('a');
  element.setAttribute('href', `data:${type};charset=utf-8,` + encodeURIComponent(content));
  element.setAttribute('download', filename);

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

function generateOrderText() {
  if (!state.orders.length) return 'No orders yet';

  return state.orders.map(order => {
    let items = order.items.map(i => `${i.name} x${i.qty}`).join('\n');

    return `
Order ID: ${order.id}
Customer: ${order.customer}
Date: ${order.date}

Items:
${items}

Total: $${order.total}
-----------------------------
`;
  }).join('\n');
}

// TXT butonu
document.getElementById('download-txt-btn').addEventListener('click', () => {
  const text = generateOrderText();
  downloadFile('orders.txt', text);
});
document.getElementById('download-pdf-btn').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 10;

  if (!state.orders.length) {
    doc.text("No orders yet", 10, y);
  } else {
    state.orders.forEach(order => {
      doc.text(`Order: ${order.id}`, 10, y); y += 6;
      doc.text(`Customer: ${order.customer}`, 10, y); y += 6;
      doc.text(`Date: ${order.date}`, 10, y); y += 6;

      doc.text("Items:", 10, y); y += 6;

      order.items.forEach(i => {
        doc.text(`- ${i.name} x${i.qty}`, 12, y);
        y += 6;
      });

      doc.text(`Total: $${order.total}`, 10, y);
      y += 10;

      // sayfa taşarsa yeni sayfa
      if (y > 270) {
        doc.addPage();
        y = 10;
      }
    });
  }

  doc.save("orders.pdf");
});
// ── Init ───────────────────────────────────────────────────────────────────
loadProducts();