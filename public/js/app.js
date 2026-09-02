// Nicobici v5 — Core Application Helpers & Utilities

// Global Fetch Interceptor: detect 401 Unauthorized and redirect to login
const _originalFetch = window.fetch;
window.fetch = async function(...args) {
  const res = await _originalFetch.apply(this, args);
  if (res.status === 401) {
    const isPublic = location.pathname.endsWith('login.html') || location.pathname.endsWith('register.html');
    if (!isPublic) {
      location.replace('/login.html');
    }
  }
  return res;
};

// Handle browser back button cache
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    refreshNav();
  }
});

// Toast notifications
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warn' ? '⚠' : 'ℹ';
  toast.innerHTML = `
    <div style="font-weight:900;font-size:15px;line-height:1">${icon}</div>
    <div style="font-size:13px;font-weight:600;color:var(--text);flex:1">${esc(message)}</div>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Global Auth & Navbar Manager
async function refreshNav() {
  const isPublicPage = location.pathname.endsWith('login.html') || location.pathname.endsWith('register.html');

  try {
    const r = await _originalFetch('/api/auth/me').then(x => x.json()).catch(() => ({ ok: false, user: null }));
    const user = r?.user;

    // Strict security guard: redirect immediately if not authenticated
    if (!user && !isPublicPage) {
      location.replace('/login.html');
      return;
    }

    // Display user labels
    document.querySelectorAll('.nav-user, #nav-user, #topbar-user').forEach(el => {
      if (user) {
        el.style.display = 'inline-flex';
        el.textContent = '👤 ' + user.nombre;
      } else {
        if (el.id === 'nav-user') {
          el.style.display = 'block';
          el.innerHTML = '<a href="/login.html" style="color:#93c5fd;font-weight:600;font-size:12px;text-decoration:none">🔑 Iniciar Sesión</a>';
        } else {
          el.style.display = 'none';
        }
      }
    });

    // Display & bind logout buttons
    document.querySelectorAll('.btn-logout, #btn-logout, #btn-logout-topbar, #btn-logout-mobile').forEach(btn => {
      if (btn.tagName === 'A' && btn.closest('.mobile-nav')) {
        // Mobile bottom navigation item
        if (user) {
          btn.style.display = 'flex';
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span style="color:var(--danger)">Salir</span>`;
        } else {
          btn.style.display = 'flex';
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg><span style="color:var(--primary)">Ingresar</span>`;
          btn.onclick = (e) => { e.preventDefault(); location.href = '/login.html'; };
          return;
        }
      } else {
        btn.style.display = user ? 'inline-flex' : 'none';
      }

      if (!btn._bound) {
        btn._bound = true;
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (confirm('¿Cerrar sesión de Nicobici?')) {
            await fetch('/api/auth/logout', { method: 'POST' });
            showToast('Sesión cerrada correctamente', 'info');
            setTimeout(() => {
              location.replace('/login.html');
            }, 250);
          }
        });
      }
    });

    document.querySelectorAll('.link-login, #link-login').forEach(el => el.style.display = user ? 'none' : 'inline-flex');
    document.querySelectorAll('.link-reg, #link-reg').forEach(el => el.style.display = user ? 'none' : 'inline-flex');

  } catch (e) {}

  // Highlight active link in sidebar and mobile nav based on pathname
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.side-link, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '/' && href === '/') || (path !== '/' && href && href !== '/' && path.endsWith(href))) {
      a.classList.add('active');
    }
  });
}

// String escaping
function esc(s) {
  return (s || '').toString().replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

// Number & Currency formatting
function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function money(n) {
  return '$ ' + fmt(n);
}

// Date formatting
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return isNaN(d) ? iso.slice(0, 10) : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch (e) { return iso; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return iso; }
}

// Stock badge renderer
function badgeStock(prod) {
  const stock = Number(prod.stock) || 0, min = Number(prod.stockMin) || 2;
  if (stock === 0) return '<span class="badge badge-red"><span class="dot red"></span>Sin stock</span>';
  if (stock <= min) return `<span class="badge badge-amber"><span class="dot amber"></span>Bajo (${stock}/${min})</span>`;
  return `<span class="badge badge-green"><span class="dot green"></span>Stock ${stock}</span>`;
}

// Payment status badge renderer
function badgeEstado(estado) {
  if (estado === 'pagada') return '<span class="badge badge-green"><span class="dot green"></span>Pagada</span>';
  if (estado === 'parcial') return '<span class="badge badge-amber"><span class="dot amber"></span>Parcial</span>';
  return '<span class="badge badge-red"><span class="dot red"></span>Pendiente</span>';
}

// WhatsApp direct contact helper
function openWhatsApp(telefono, mensaje = '') {
  if (!telefono) {
    showToast('Cliente sin teléfono registrado', 'warn');
    return;
  }
  let cleanPhone = telefono.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = '549' + cleanPhone; // Argentina standard
  else if (cleanPhone.startsWith('15')) cleanPhone = '54911' + cleanPhone.slice(2);
  else if (!cleanPhone.startsWith('54')) cleanPhone = '54' + cleanPhone;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

// Copy text to clipboard
async function copyToClipboard(text, successMsg = 'Copiado al portapapeles') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(successMsg, 'success');
  }
}
