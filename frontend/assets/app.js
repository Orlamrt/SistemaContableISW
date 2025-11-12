const API_BASE = '/api';

const ROUTE_GUARDS = {
  '/dashboard': ['ADMIN', 'AUDITOR', 'CLIENTE', 'SOPORTE'],
  '/roles/admin': ['ADMIN'],
  '/roles/auditor': ['ADMIN', 'AUDITOR'],
  '/roles/cliente': ['CLIENTE'],
  '/roles/soporte': ['ADMIN', 'SOPORTE'],
};

const PAGE_LOADERS = {
  dashboard: loadDashboardPage,
  admin: loadAdminPage,
  auditor: loadAuditorPage,
  cliente: loadClientePage,
  soporte: loadSoportePage,
};

function currentPath() {
  return window.location.pathname.replace(/\/index\.html$/, '/');
}

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

function readCachedUser() {
  try {
    return JSON.parse(localStorage.getItem('session.user') || 'null');
  } catch (err) {
    return null;
  }
}

function writeCachedUser(user) {
  localStorage.setItem('session.user', JSON.stringify(user));
}

function redirectToLogin() {
  setToken(null);
  writeCachedUser(null);
  window.location.href = '/';
}

function hasAnyRole(user, roles) {
  return Array.isArray(user?.roles) && user.roles.some((role) => roles.includes(role));
}

function getGuardForPath(path) {
  const entry = Object.entries(ROUTE_GUARDS).find(([route]) => path === route);
  return entry ? entry[1] : [];
}

function renderForbidden() {
  const main = document.querySelector('main.page');
  if (!main) {
    alert('No tienes permisos para acceder a esta vista.');
    return;
  }
  main.innerHTML = `
    <section class="panel">
      <h2>403 - Acceso restringido</h2>
      <p>Tu rol actual no tiene permisos para abrir este módulo. Utiliza el menú para volver a una vista permitida.</p>
      <a class="btn btn-secondary" href="/dashboard">Ir al dashboard</a>
    </section>
  `;
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (response.status === 401) {
    redirectToLogin();
    return response;
  }
  return response;
}

async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options);
  if (response.status === 401) {
    throw Object.assign(new Error('UNAUTHENTICATED'), { status: 401 });
  }
  let data = null;
  try {
    data = response.status === 204 ? null : await response.json();
  } catch (err) {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.message || response.statusText || 'Error en la solicitud');
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
}

async function ensureSession(requiredRoles = []) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return null;
  }
  const cached = readCachedUser();
  let session = cached || null;
  try {
    const data = await apiJson('/auth/me');
    session = {
      id: data.id,
      email: data.email,
      roles: data.roles,
      permissions: data.permissions,
    };
    writeCachedUser(session);
  } catch (err) {
    if (err.status === 401) {
      return null;
    }
    // mantener sesión cacheada si existe
  }
  if (!session) {
    redirectToLogin();
    return null;
  }
  const guard = requiredRoles.length ? requiredRoles : getGuardForPath(currentPath());
  if (guard.length && !hasAnyRole(session, guard)) {
    renderForbidden();
  }
  window.__SESSION__ = session;
  if (typeof window.renderNavbarMenu === 'function') {
    window.renderNavbarMenu(session);
  }
  return session;
}

async function loadComponents() {
  const placeholders = Array.from(document.querySelectorAll('[data-component]'));
  for (const placeholder of placeholders) {
    const src = placeholder.dataset.src;
    if (!src) continue;
    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${src}`);
      }
      const html = await response.text();
      const template = document.createElement('template');
      template.innerHTML = html.trim();
      const fragment = template.content.cloneNode(true);
      const scripts = Array.from(fragment.querySelectorAll('script'));
      scripts.forEach((script) => script.parentNode.removeChild(script));
      placeholder.replaceChildren(fragment);
      scripts.forEach((script) => {
        const newScript = document.createElement('script');
        Array.from(script.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
        newScript.textContent = script.textContent;
        document.body.appendChild(newScript);
        document.body.removeChild(newScript);
      });
    } catch (err) {
      placeholder.innerHTML = `<div class="alert">${err.message}</div>`;
    }
  }
}

function applyRoleVisibility(session) {
  document.querySelectorAll('[data-roles]').forEach((element) => {
    const roles = element.dataset.roles?.split(',').map((role) => role.trim());
    if (!roles || !roles.length) return;
    if (!hasAnyRole(session, roles)) {
      element.classList.add('hidden');
    } else {
      element.classList.remove('hidden');
    }
  });
}

function setupLogout() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      redirectToLogin();
    });
  }
}

function updateKpis(summary = {}, session) {
  const pendingCount = (summary.audits || [])
    .filter((item) => ['en_revision', 'en_proceso'].includes(item.status))
    .reduce((acc, item) => acc + Number(item.total || 0), 0);
  const completedCount = (summary.audits || [])
    .filter((item) => item.status === 'completada')
    .reduce((acc, item) => acc + Number(item.total || 0), 0);
  const unread = Number(summary.notifications?.unread || 0);
  const mapping = {
    pending: pendingCount,
    completed: completedCount,
    unread,
  };
  Object.entries(mapping).forEach(([key, value]) => {
    const node = document.querySelector(`[data-kpi="${key}"]`);
    if (node) {
      node.textContent = value;
    }
  });
  if (typeof window.renderNavbarMenu === 'function') {
    window.renderNavbarMenu(session);
  }
}

function renderList(containerId, items, renderItem) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('div');
    li.className = 'list-item';
    li.innerHTML = renderItem(item);
    container.appendChild(li);
  });
}

function toggleEmptyState(emptyId, items) {
  const empty = document.getElementById(emptyId);
  if (!empty) return;
  if (!items || !items.length) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
  }
}

async function loadDashboardPage(session) {
  try {
    const summary = await apiJson('/dashboard/summary');
    updateKpis(summary, session);
    const canViewAll = hasAnyRole(session, ['ADMIN', 'AUDITOR']);
    const audits = await apiJson(canViewAll ? '/audits' : '/audits/mine');
    renderList('activity-list', audits.slice(0, 5), (audit) => `
      <strong>Solicitud #${audit.id}</strong>
      <span class="badge badge-info">${audit.status}</span>
      <span class="card-footnote">${new Date(audit.updated_at).toLocaleString()}</span>
    `);
    toggleEmptyState('activity-empty', audits);
    const meetings = await apiJson('/meetings');
    populateMeetingsTable('meetings-table', 'meetings-empty', meetings);
  } catch (err) {
    if (err.status === 403) {
      renderForbidden();
      return;
    }
    console.error(err);
  }
  const refresh = document.getElementById('refresh-dashboard');
  if (refresh && !refresh.dataset.bound) {
    refresh.dataset.bound = 'true';
    refresh.addEventListener('click', () => loadDashboardPage(session));
  }
}

async function loadAdminPage(session) {
  await loadDashboardPage(session);
  try {
    const users = await apiJson('/admin/users');
    const table = document.querySelector('#users-table tbody');
    if (table) {
      table.innerHTML = '';
      users.forEach((user) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${user.email}</td>
          <td>${user.roles.join(', ')}</td>
          <td>${user.status}</td>
          <td>${new Date(user.updated_at).toLocaleString()}</td>
        `;
        table.appendChild(tr);
      });
    }
    toggleEmptyState('users-empty', users);
    renderList('system-params', [
      { key: 'JWT expiración', value: '8h' },
      { key: 'Motor DB', value: 'MySQL / MariaDB' },
      { key: 'Idempotency', value: 'Habilitado' },
    ], (item) => `<strong>${item.key}</strong><span>${item.value}</span>`);
    renderList('monitoring', [
      { text: 'Último job de auditoría ejecutado hace 4 minutos.' },
      { text: 'Sin errores críticos en la última hora.' },
    ], (item) => item.text);
    setupUserModal();
  } catch (err) {
    if (err.status === 403) {
      renderForbidden();
    }
  }
}

async function loadAuditorPage(session) {
  await loadDashboardPage(session);
  const statusFilter = document.getElementById('status-filter');
  async function loadAudits() {
    try {
      const status = statusFilter?.value;
      const url = status ? `/audits?status=${encodeURIComponent(status)}` : '/audits';
      const audits = await apiJson(url);
      const tbody = document.querySelector('#audits-table tbody');
      if (tbody) {
        tbody.innerHTML = '';
        audits.forEach((audit) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${audit.id}</td>
            <td>${audit.audit_type}</td>
            <td>${audit.user_id}</td>
            <td><span class="badge badge-info">${audit.status}</span></td>
            <td>${new Date(audit.updated_at).toLocaleString()}</td>
          `;
          tbody.appendChild(tr);
        });
      }
      toggleEmptyState('audits-empty', audits);
      renderList('files-list', audits.slice(0, 3), (audit) => `
        <strong>Solicitud #${audit.id}</strong>
        <span>${audit.file_path}</span>
      `);
      renderList('history-list', audits.slice(0, 5), (audit) => `
        <strong>${audit.audit_type}</strong>
        <span class="card-footnote">${audit.status} - ${new Date(audit.updated_at).toLocaleString()}</span>
      `);
      renderList('normativa-list', [
        { title: 'ISO 27001', description: 'Controles de seguridad de la información' },
        { title: 'SOC 2', description: 'Confidencialidad y disponibilidad' },
      ], (item) => `
        <strong>${item.title}</strong>
        <span class="card-footnote">${item.description}</span>
      `);
    } catch (err) {
      if (err.status === 403) {
        renderForbidden();
      }
    }
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', loadAudits);
  }
  await loadAudits();
}

async function loadClientePage(session) {
  await loadDashboardPage(session);
  const openModalBtn = document.getElementById('open-request-modal');
  const modal = document.getElementById('request-modal');
  const closeModalBtn = document.getElementById('close-request-modal');
  const form = document.getElementById('request-form');

  function toggleModal(show) {
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
  }

  if (openModalBtn && !openModalBtn.dataset.bound) {
    openModalBtn.dataset.bound = 'true';
    openModalBtn.addEventListener('click', () => toggleModal(true));
  }
  if (closeModalBtn && !closeModalBtn.dataset.bound) {
    closeModalBtn.dataset.bound = 'true';
    closeModalBtn.addEventListener('click', () => toggleModal(false));
  }

  async function refreshClientData() {
    try {
      const audits = await apiJson('/audits/mine');
      const tbody = document.querySelector('#my-audits-table tbody');
      if (tbody) {
        tbody.innerHTML = '';
        audits.forEach((audit) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${audit.id}</td>
            <td>${audit.audit_type}</td>
            <td><span class="badge badge-info">${audit.status}</span></td>
            <td>${new Date(audit.created_at).toLocaleString()}</td>
          `;
          tbody.appendChild(tr);
        });
      }
      toggleEmptyState('my-audits-empty', audits);
      const notifications = await apiJson('/notifications');
      renderList('my-notifications', notifications.slice(0, 5), (item) => `
        <strong>${item.title}</strong>
        <span>${item.message}</span>
        <span class="card-footnote">${new Date(item.created_at).toLocaleString()}</span>
      `);
      toggleEmptyState('notifications-empty', notifications);
      const meetings = await apiJson('/meetings');
      populateMeetingsTable('client-meetings', 'client-meetings-empty', meetings);
    } catch (err) {
      if (err.status === 403) {
        renderForbidden();
      }
    }
  }

  if (form && !form.dataset.bound) {
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const type = document.getElementById('request-type').value;
      const file = document.getElementById('request-file').files[0];
      if (!type || !file) {
        alert('Selecciona tipo y adjunta un archivo.');
        return;
      }
      const allowed = ['pdf', 'csv'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowed.includes(ext)) {
        alert('Solo se permiten archivos PDF o CSV.');
        return;
      }
      const formData = new FormData();
      formData.append('audit_type', type);
      formData.append('file', file);
      try {
        const response = await apiFetch('/audits', {
          method: 'POST',
          body: formData,
          headers: {
            'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}`,
          },
        });
        const payload = await response.json();
        if (!response.ok) {
          throw Object.assign(new Error(payload.message || 'Error al crear solicitud'), { status: response.status });
        }
        alert('Solicitud creada correctamente.');
        toggleModal(false);
        form.reset();
        await refreshClientData();
      } catch (err) {
        alert(err.message || 'No se pudo crear la solicitud');
      }
    });
  }

  await refreshClientData();
}

async function loadSoportePage(session) {
  await loadDashboardPage(session);
  const refreshButton = document.getElementById('refresh-support');

  async function refreshSupportData() {
    try {
      const notifications = await apiJson('/notifications');
      const actionable = notifications.filter((n) => n.type !== 'info');
      renderList('tickets-list', actionable, (item) => `
        <strong>${item.title}</strong>
        <span>${item.message}</span>
        <button class="btn btn-secondary" data-ticket-id="${item.id}">Ver detalle</button>
      `);
      toggleEmptyState('tickets-empty', actionable);
      const detail = document.getElementById('ticket-detail');
      document.querySelectorAll('[data-ticket-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const ticket = notifications.find((n) => n.id === Number(btn.dataset.ticketId));
          if (!ticket || !detail) return;
          detail.innerHTML = `
            <strong>${ticket.title}</strong>
            <p>${ticket.message}</p>
            <span class="card-footnote">${new Date(ticket.created_at).toLocaleString()}</span>
          `;
        });
      });
      const meetings = await apiJson('/meetings');
      populateMeetingsTable('support-meetings', 'support-meetings-empty', meetings);
    } catch (err) {
      if (err.status === 403) {
        renderForbidden();
      }
    }
  }

  if (refreshButton && !refreshButton.dataset.bound) {
    refreshButton.dataset.bound = 'true';
    refreshButton.addEventListener('click', async () => {
      await loadDashboardPage(session);
      await refreshSupportData();
    });
  }

  await refreshSupportData();
}

function populateMeetingsTable(tableId, emptyId, meetings = []) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = '';
  meetings.forEach((meeting) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(meeting.scheduled_at).toLocaleString()}</td>
      <td>${meeting.notes || 'Sin notas'}</td>
    `;
    tbody.appendChild(tr);
  });
  toggleEmptyState(emptyId, meetings);
}

function setupUserModal() {
  const modal = document.getElementById('user-modal');
  const openBtn = document.getElementById('open-user-modal');
  const closeBtn = document.getElementById('close-user-modal');
  const form = document.getElementById('user-form');
  function toggle(show) {
    modal?.classList.toggle('hidden', !show);
  }
  openBtn?.addEventListener('click', () => toggle(true));
  closeBtn?.addEventListener('click', () => toggle(false));
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    alert('La creación de usuarios adicionales se gestiona mediante la API de administración.');
    toggle(false);
  });
}

async function bootstrap() {
  const page = document.body.dataset.page;
  if (page === 'login') {
    setupLogin();
    return;
  }
  const requiredRoles = (document.body.dataset.requiredRoles || '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
  await loadComponents();
  const session = await ensureSession(requiredRoles);
  if (!session) {
    return;
  }
  setupLogout();
  applyRoleVisibility(session);
  const loader = PAGE_LOADERS[page];
  if (typeof loader === 'function') {
    await loader(session);
  }
}

function setupLogin() {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      email: formData.get('email'),
      password: formData.get('password'),
    };
    try {
      const response = await apiJson('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setToken(response.token);
      writeCachedUser(response.user);
      window.location.href = '/dashboard';
    } catch (err) {
      errorBox?.classList.remove('hidden');
      errorBox.textContent = err.body?.message || err.message || 'No se pudo iniciar sesión';
    }
  });
}

document.addEventListener('DOMContentLoaded', bootstrap);
