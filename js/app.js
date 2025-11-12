const API_BASE = 'http://localhost:4000/api';

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function requireAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Proteger páginas internas
    requireAuth();

    // =========================
    // Logout
    // =========================
    document.querySelectorAll('.logout-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    });

    // =========================
    // Modal seguimiento (Dashboard)
    // =========================
    const seguimientoModal = document.getElementById('seguimiento-modal');
    if (seguimientoModal) {
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

    // =========================
    // Auditorías: enviar solicitud con archivo obligatorio PDF/CSV
    // =========================
    const newRequestForm = document.getElementById('new-request-form');
    if (newRequestForm) {
        newRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const auditType = document.getElementById('audit-type').value;
            const fileInput = document.getElementById('upload-file');

            if (!auditType) {
                alert('Selecciona el tipo de auditoría.');
                return;
            }

            // Debe existir archivo
            if (!fileInput || !fileInput.files[0]) {
                alert('Debes adjuntar un archivo en formato PDF o CSV.');
                return;
            }

            const file = fileInput.files[0];

            // Validar extensión
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
                        ...getAuthHeaders()
                        // No seteamos Content-Type, FormData lo hace
                    },
                    body: formData
                });

                const data = await res.json();

                if (!res.ok) {
                    alert(data.message || 'Error al enviar solicitud');
                    return;
                }

                alert('Solicitud de auditoría enviada correctamente.');
                newRequestForm.reset();
            } catch (err) {
                console.error(err);
                alert('Error de conexión con el servidor');
            }
        });

        // Mostrar nombre de archivo en input de texto
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

    // =========================
    // Notificaciones
    // =========================
    const notificationsPanel = document.querySelector('.notifications-panel');
    if (notificationsPanel) {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/notifications`, {
                    headers: { ...getAuthHeaders() }
                });
                const data = await res.json();
                if (!res.ok) {
                    console.error(data);
                    return;
                }

                notificationsPanel.innerHTML = '';
                data.forEach(n => {
                    const icon =
                        n.type === 'warning' ? 'fa-exclamation-circle' :
                        n.type === 'success' ? 'fa-check-circle' :
                        'fa-info-circle';

                    const div = document.createElement('div');
                    div.className = 'notification-item';
                    div.innerHTML = `<i class="fas ${icon}"></i><p>${n.title} - ${n.message}</p>`;
                    notificationsPanel.appendChild(div);
                });
            } catch (err) {
                console.error(err);
            }
        })();
    }

    // =========================
    // Cumplimiento
    // =========================
    const complianceInfo = document.querySelector('.compliance-info');
    if (complianceInfo) {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/compliance/summary`, {
                    headers: { ...getAuthHeaders() }
                });
                const data = await res.json();
                if (!res.ok) return;

                const lastText = data.last_check
                    ? `Última revisión: ${data.last_check} (estado: ${data.last_status})`
                    : 'Sin registros aún';

                complianceInfo.innerHTML = `
                    <h3>Monitoreo Activo</h3>
                    <p>${lastText}</p>
                `;
            } catch (err) {
                console.error(err);
            }
        })();
    }

    // =========================
    // Coordinación: calendario funcional
    // =========================
const calendarDaysContainer = document.getElementById('calendar-days');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const meetingsBox = document.getElementById('calendar-meetings');
const addMeetingBtn = document.getElementById('btn-add-meeting');

if (calendarDaysContainer && calendarMonthLabel && meetingsBox && addMeetingBtn) {

        // Fecha base: mes actual
        const today = new Date();
        let currentYear = today.getFullYear();
        let currentMonth = today.getMonth(); // 0-11
        let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Cargar reuniones existentes desde el backend
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

        function renderCalendar() {
            calendarDaysContainer.innerHTML = '';

            const firstDay = new Date(currentYear, currentMonth, 1);
            const lastDay = new Date(currentYear, currentMonth + 1, 0);

            const monthNames = [
                'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
            ];

            calendarMonthLabel.textContent =
                `${monthNames[currentMonth]} ${currentYear}`;

            // Día de la semana (1-7) empezando en lunes
            let start = firstDay.getDay(); // 0=Dom,1=Lun...
            if (start === 0) start = 7;

            // Huecos antes del 1
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

                // Revisar si hay reuniones para este día
                const hasMeetings = meetings.some(m => m.scheduled_at.startsWith(iso));
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

        function renderMeetingsForSelected() {
            const iso = formatDateISO(selectedDate);
            const dayMeetings = meetings.filter(m => m.scheduled_at.startsWith(iso));

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
            dayMeetings.forEach(m => {
                const li = document.createElement('li');
                li.textContent = `${formatTime(m.scheduled_at)} - ${m.notes || 'Sin notas'}`;
                ul.appendChild(li);
            });
            meetingsBox.appendChild(ul);
        }

        async function loadMeetings() {
            try {
                const res = await fetch(`${API_BASE}/meetings`, {
                    headers: {
                        ...getAuthHeaders()
                    }
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

        // Agendar nueva reunión
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
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({ scheduled_at, notes })
                });

                const data = await res.json();
                if (!res.ok) {
                    alert(data.message || 'Error al agendar reunión');
                    return;
                }

                // Volver a cargar reuniones y limpiar notas
                notesInput.value = '';
                await loadMeetings();
                alert('Reunión agendada correctamente.');
            } catch (err) {
                console.error(err);
                alert('Error de conexión con el servidor');
            }
        });

        // Cargar todo al inicio
        loadMeetings();
    }
})