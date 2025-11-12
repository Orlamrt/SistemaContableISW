const API_BASE = 'http://localhost:4000/api';

const ROUTE_ACCESS = {
    '/dashboard.html': ['ADMIN', 'AUDITOR', 'CLIENTE', 'SOPORTE'],
    '/auditorias.html': ['ADMIN', 'AUDITOR', 'CLIENTE'],
    '/notificaciones.html': ['ADMIN', 'AUDITOR', 'CLIENTE', 'SOPORTE'],
    '/coordinacion.html': ['ADMIN', 'AUDITOR', 'CLIENTE', 'SOPORTE'],
    '/cumplimiento.html': ['ADMIN', 'AUDITOR', 'CLIENTE'],
};

const NAV_ITEMS = {
    'dashboard.html': ['ADMIN', 'AUDITOR', 'CLIENTE', 'SOPORTE'],
    'auditorias.html': ['ADMIN', 'AUDITOR', 'CLIENTE'],
    'notificaciones.html': ['ADMIN', 'AUDITOR', 'CLIENTE', 'SOPORTE'],
    'coordinacion.html': ['ADMIN', 'AUDITOR', 'CLIENTE', 'SOPORTE'],
    'cumplimiento.html': ['ADMIN', 'AUDITOR', 'CLIENTE'],
};

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (err) {
        return null;
    }
}

function setStoredUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function isRouteAllowed(route, roles = []) {
    const pathname = route.toLowerCase();
    const key = Object.keys(ROUTE_ACCESS).find((r) => pathname.endsWith(r));
    if (!key) return true;
    const allowedRoles = ROUTE_ACCESS[key];
    return roles.some((role) => allowedRoles.includes(role));
}

function redirectToLogin() {
    window.location.href = 'index.html';
}

function renderForbiddenView() {
    const main = document.querySelector('main');
    if (!main) return;
    main.innerHTML = `
        <section class="forbidden">
            <h1>403 - Acceso restringido</h1>
            <p>No cuentas con permisos para acceder a este módulo. Regresa al dashboard.</p>
            <a class="btn btn-secondary-action" href="dashboard.html">Ir al dashboard</a>
        </section>
    `;
}

async function bootstrapSession() {
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return null;
    }
    let user = getStoredUser();
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                ...getAuthHeaders(),
            },
        });
        if (res.ok) {
            const data = await res.json();
            user = {
                id: data.id,
                email: data.email,
                roles: data.roles,
                permissions: data.permissions,
            };
            setStoredUser(user);
        } else if (res.status === 401) {
            redirectToLogin();
            return null;
        }
    } catch (err) {
        console.warn('No se pudo refrescar la sesión', err);
    }
    if (!user || !Array.isArray(user.roles) || user.roles.length === 0) {
        redirectToLogin();
        return null;
    }
    if (!isRouteAllowed(window.location.pathname, user.roles)) {
        renderForbiddenView();
    }
    return user;
}

function updateNavigationForRoles(user) {
    const links = document.querySelectorAll('.main-nav a');
    links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const allowedRoles = NAV_ITEMS[href] || NAV_ITEMS[href.toLowerCase()] || [];
        if (allowedRoles.length && !user.roles.some((role) => allowedRoles.includes(role))) {
            if (link.parentElement) { link.parentElement.classList.add('hidden'); }
        } else {
            if (link.parentElement) { link.parentElement.classList.remove('hidden'); }
        }
    });
}

function setupLogoutLinks() {
    document.querySelectorAll('.logout-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            redirectToLogin();
        });
    });
}

function setupModals() {
    const seguimientoModal = document.getElementById('seguimiento-modal');
    if (!seguimientoModal) return;
    document.querySelectorAll('[data-modal-target="seguimiento-modal"]').forEach(btn => {
        btn.addEventListener('click', () => {
            seguimientoModal.style.display = 'block';
        });
    });
    document.querySelectorAll('[data-modal-close="seguimiento-modal"]').forEach(btn => {
        btn.addEventListener('click', () => {
            seguimientoModal.style.display = 'none';
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target === seguimientoModal) {
            seguimientoModal.style.display = 'none';
        }
    });
}

function randomIdempotencyKey() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function setupAuditForm() {
    const newRequestForm = document.getElementById('new-request-form');
    if (!newRequestForm) return;
    newRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const auditType = document.getElementById('audit-type').value;
        const fileInput = document.getElementById('upload-file');
        if (!auditType) {
            alert('Selecciona el tipo de auditoría.');
            return;
        }
        if (!fileInput || !fileInput.files[0]) {
            alert('Debes adjuntar un archivo PDF o CSV.');
            return;
        }
        const file = fileInput.files[0];
        const allowedExt = ['pdf', 'csv'];
        const ext = file.name.split('.').pop().toLowerCase();
        if (!allowedExt.includes(ext)) {
            alert('Solo se permiten archivos PDF o CSV.');
            return;
        }
        const formData = new FormData();
        formData.append('audit_type', auditType);
        formData.append('file', file);
        try {
            const res = await fetch(`${API_BASE}/audits`, {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    'Idempotency-Key': randomIdempotencyKey(),
                },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.message || data.error || 'Error al enviar solicitud');
                return;
            }
            alert('Solicitud de auditoría enviada correctamente.');
            newRequestForm.reset();
            loadAudits();
        } catch (err) {
            console.error(err);
            alert('Error de conexión con el servidor');
        }
    });
    const uploadFile = document.getElementById('upload-file');
    if (uploadFile) {
        uploadFile.addEventListener('change', function () {
            const textInput = this.previousElementSibling;
            if (textInput) {
                textInput.value = this.files[0]
                    ? this.files[0].name
                    : 'Subir archivo';
            }
        });
    }
}

async function loadAudits() {
    const container = document.getElementById('audit-list');
    if (!container) return;
    try {
        const statusFilter = document.getElementById('audit-status-filter');
        const status = statusFilter ? statusFilter.value : '';
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        const res = await fetch(`${API_BASE}/audits${query}`, {
            headers: { ...getAuthHeaders() },
        });
        const data = await res.json();
        if (!res.ok) {
            container.innerHTML = '<p class="error">No fue posible cargar las solicitudes.</p>';
            return;
        }
        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = '<p>No hay solicitudes registradas.</p>';
            return;
        }
        const rows = data.map((audit) => `
            <tr>
                <td>${audit.id}</td>
                <td>${audit.audit_type}</td>
                <td>${audit.status}</td>
                <td>${new Date(audit.created_at).toLocaleString()}</td>
            </tr>
        `).join('');
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Creada</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="error">Error al obtener las solicitudes.</p>';
    }
}

async function loadNotifications() {
    const notificationsPanel = document.querySelector('.notifications-panel');
    if (!notificationsPanel) return;
    try {
        const res = await fetch(`${API_BASE}/notifications`, {
            headers: { ...getAuthHeaders() },
        });
        const data = await res.json();
        if (!res.ok) {
            notificationsPanel.innerHTML = '<p class="error">No fue posible cargar las notificaciones.</p>';
            return;
        }
        notificationsPanel.innerHTML = '';
        data.forEach((n) => {
            const icon =
                n.type === 'warning' ? 'fa-exclamation-circle' :
                n.type === 'success' ? 'fa-check-circle' :
                'fa-info-circle';
            const div = document.createElement('div');
            div.className = `notification-item ${n.is_read ? 'read' : 'unread'}`;
            div.innerHTML = `<i class="fas ${icon}"></i><p>${n.title} - ${n.message}</p>`;
            notificationsPanel.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}

async function loadComplianceSummary() {
    const complianceInfo = document.querySelector('.compliance-info');
    if (!complianceInfo) return;
    try {
        const res = await fetch(`${API_BASE}/compliance/summary`, {
            headers: { ...getAuthHeaders() },
        });
        const data = await res.json();
        if (!res.ok) {
            complianceInfo.innerHTML = '<p class="error">Sin acceso a cumplimiento.</p>';
            return;
        }
        const lastText = data.last_check
            ? `Última revisión: ${new Date(data.last_check).toLocaleString()} (estado: ${data.last_status})`
            : 'Sin revisiones registradas';
        complianceInfo.innerHTML = `
            <h3>Monitoreo Activo</h3>
            <p>${lastText}</p>
            ${data.message ? `<small>${data.message}</small>` : ''}
        `;
    } catch (err) {
        console.error(err);
        complianceInfo.innerHTML = '<p class="error">Error al obtener la información de cumplimiento.</p>';
    }
}

async function loadDashboardSummary() {
    const dashboard = document.querySelector('.dashboard-grid-small');
    if (!dashboard) return;
    try {
        const res = await fetch(`${API_BASE}/dashboard/summary`, {
            headers: { ...getAuthHeaders() },
        });
        if (!res.ok) return;
        const data = await res.json();
        const kpiElements = document.querySelectorAll('.kpis-grid .kpi-item p');
        if (kpiElements.length >= 3) {
            const totalCompletadas = data.audits.filter((a) => a.status === 'completada').reduce((acc, cur) => acc + cur.total, 0);
            const enProceso = data.audits.filter((a) => a.status !== 'completada').reduce((acc, cur) => acc + cur.total, 0);
            kpiElements[0].textContent = totalCompletadas;
            kpiElements[1].textContent = `${enProceso} activas`;
            kpiElements[2].textContent = `${data.notifications.unread} sin leer`;
        }
    } catch (err) {
        console.error(err);
    }
}

function setupMeetingsCalendar() {
    const calendarDaysContainer = document.getElementById('calendar-days');
    const calendarMonthLabel = document.getElementById('calendar-month-label');
    const meetingsBox = document.getElementById('calendar-meetings');
    const addMeetingBtn = document.getElementById('btn-add-meeting');
    if (!calendarDaysContainer || !calendarMonthLabel || !meetingsBox || !addMeetingBtn) {
        return;
    }

    const today = new Date();
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth();
    let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let meetings = [];

    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatTime(dtStr) {
        const d = new Date(dtStr);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    function renderMeetingsForSelected() {
        const iso = formatDateISO(selectedDate);
        const dayMeetings = meetings.filter((m) => m.scheduled_at.startsWith(iso));
        meetingsBox.innerHTML = '';
        const readable = iso.split('-').reverse().join('-');
        const title = document.createElement('h3');
        title.textContent = `Reuniones para el ${readable}`;
        meetingsBox.appendChild(title);
        if (dayMeetings.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No hay reuniones agendadas para este día.';
            meetingsBox.appendChild(p);
            return;
        }
        const ul = document.createElement('ul');
        dayMeetings.forEach((m) => {
            const li = document.createElement('li');
            li.textContent = `${formatTime(m.scheduled_at)} - ${m.notes || 'Sin notas'}`;
            ul.appendChild(li);
        });
        meetingsBox.appendChild(ul);
    }

    function renderCalendar() {
        calendarDaysContainer.innerHTML = '';
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        calendarMonthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        let start = firstDay.getDay();
        if (start === 0) start = 7;
        for (let i = 1; i < start; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day empty';
            calendarDaysContainer.appendChild(empty);
        }
        const selectedISO = formatDateISO(selectedDate);
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(currentYear, currentMonth, day);
            const iso = formatDateISO(date);
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.dataset.date = iso;
            const hasMeetings = meetings.some((m) => m.scheduled_at.startsWith(iso));
            if (hasMeetings) {
                div.classList.add('has-meetings');
            }
            if (iso === selectedISO) {
                div.classList.add('selected');
            }
            div.innerHTML = `<span class="day-number">${day}</span>`;
            div.addEventListener('click', () => {
                selectedDate = date;
                renderCalendar();
                renderMeetingsForSelected();
            });
            calendarDaysContainer.appendChild(div);
        }
        renderMeetingsForSelected();
    }

    async function loadMeetings() {
        try {
            const res = await fetch(`${API_BASE}/meetings`, {
                headers: { ...getAuthHeaders() },
            });
            const data = await res.json();
            if (!res.ok) {
                console.error(data);
                return;
            }
            meetings = data;
            renderCalendar();
        } catch (err) {
            console.error(err);
        }
    }

    addMeetingBtn.addEventListener('click', async () => {
        const timeInput = document.getElementById('meeting-time');
        const notesInput = document.getElementById('meeting-notes');
        if (!timeInput.value) {
            alert('Selecciona una hora.');
            return;
        }
        const [hh, mm] = timeInput.value.split(':');
        const isoDate = formatDateISO(selectedDate);
        const scheduled_at = `${isoDate} ${hh}:${mm}:00`;
        const notes = notesInput.value || '';
        try {
            const res = await fetch(`${API_BASE}/meetings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders(),
                },
                body: JSON.stringify({ scheduled_at, notes }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.message || data.error || 'Error al agendar la reunión');
                return;
            }
            notesInput.value = '';
            await loadMeetings();
            alert('Reunión agendada correctamente.');
        } catch (err) {
            console.error(err);
            alert('Error de conexión con el servidor');
        }
    });

    loadMeetings();
}

async function main() {
    const user = await bootstrapSession();
    if (!user) return;
    setupLogoutLinks();
    updateNavigationForRoles(user);
    setupModals();
    setupAuditForm();
    loadAudits();
    loadNotifications();
    loadComplianceSummary();
    loadDashboardSummary();
    setupMeetingsCalendar();
    window.loadAudits = loadAudits;
}

document.addEventListener('DOMContentLoaded', main);
