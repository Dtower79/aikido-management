/**
 * AIKIDO MANAGEMENT SYSTEM - OFICINA CENTRAL
 * Lead Developer: Arashi Group Team
 * Version: 2.0 (Strapi v5 Optimized)
 */

const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com";
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

const GRADE_WEIGHTS = {
    '8º DAN': 108, '7º DAN': 107, '6º DAN': 106, '5º DAN': 105, '4º DAN': 104, '3º DAN': 103, '2º DAN': 102, '1º DAN': 101,
    '1º KYU': 5, '2º KYU': 4, '3º KYU': 3, '4º KYU': 2, '5º KYU': 1, 'S/G': 0
};

// --- 1. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    if (jwtToken) showDashboard();
    
    // Configuración de inputs
    setupDniInput('dni-login'); 
    setupDniInput('new-dni');
    
    // Listeners de búsqueda
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    
    // Etiquetas dinámicas
    const yearLabel = document.getElementById('current-year-lbl');
    if (yearLabel) yearLabel.textContent = new Date().getFullYear();

    // Listener visual para el switch de seguro
    const seguroSwitch = document.getElementById('new-seguro');
    if (seguroSwitch) {
        seguroSwitch.addEventListener('change', (e) => {
            const txt = document.getElementById('seguro-status-text');
            txt.innerText = e.target.checked ? "PAGADO" : "NO PAGADO";
            txt.style.color = e.target.checked ? "#22c55e" : "#ef4444";
        });
    }

    // Formulario de Alumno (Crear/Editar)
    document.getElementById('form-nuevo-alumno')?.addEventListener('submit', guardarAlumno);
});

// --- 2. SESIÓN Y NAVEGACIÓN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('dni-login').value;
    const password = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (res.ok) {
            jwtToken = data.jwt;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            showDashboard();
        } else { 
            document.getElementById('login-error').innerText = "❌ Credenciales incorrectas"; 
        }
    } catch { 
        document.getElementById('login-error').innerText = "❌ Error de conexión con el servidor"; 
    }
});

function logout() { 
    localStorage.clear(); 
    location.reload(); 
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); 
    loadReportDojos(); 
    showSection('welcome');
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${id}`).classList.remove('hidden');
    
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-nav-${id === 'nuevo-alumno' ? 'nuevo' : id}`);
    if(activeBtn) activeBtn.classList.add('active');

    if (id === 'alumnos') loadAlumnos(true);
    if (id === 'bajas') loadAlumnos(false);
    if (id === 'dojos') loadDojosCards();
}

// --- 3. GESTIÓN DE ALUMNOS (CRUD) ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10">Cargando tatami...</td></tr>`;
    
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&sort=apellidos:asc&pagination[limit]=1000`, { 
            headers: { 'Authorization': `Bearer ${jwtToken}` } 
        });
        const json = await res.json();
        tbody.innerHTML = '';
        
        (json.data || []).forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId || a.id;
            const horas = parseFloat(p.horas_acumuladas || 0).toFixed(1);
            
            tbody.innerHTML += `
                <tr>
                    ${!activos ? `<td>${formatDateDisplay(p.fecha_baja)}</td>` : ''}
                    <td><strong>${(p.apellidos || '').toUpperCase()}</strong></td>
                    <td>${p.nombre || ''}</td>
                    <td>${p.dni || ''}</td>
                    <td><span class="badge">${normalizeGrade(p.grado)}</span></td>
                    <td><span class="${p.seguro_pagado ? 'badge-ok' : 'badge-no'}">${p.seguro_pagado ? 'SÍ' : 'NO'}</span></td>
                    <td>${normalizePhone(p.telefono)}</td>
                    <td>${getDojoName(p.dojo)}</td>
                    <td>${formatDateDisplay(p.fecha_inicio)}</td>
                    <td style="font-weight:bold; color:var(--primary)">${horas}h</td>
                    <td class="sticky-col">
                        ${activos ? `<button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>` : ''}
                        <button class="action-btn-icon" onclick="confirmarEstado('${id}', ${!activos}, '${p.nombre}')">
                            <i class="fa-solid ${activos ? 'fa-user-xmark' : 'fa-rotate-left'}"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch { tbody.innerHTML = '<tr><td colspan="10">Error al cargar datos</td></tr>'; }
}

async function guardarAlumno(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/api/alumnos/${id}` : `${API_URL}/api/alumnos`;

    const payload = {
        data: {
            nombre: document.getElementById('new-nombre').value,
            apellidos: document.getElementById('new-apellidos').value,
            dni: document.getElementById('new-dni').value.toUpperCase(),
            email: document.getElementById('new-email').value,
            telefono: document.getElementById('new-telefono').value,
            fecha_nacimiento: document.getElementById('new-nacimiento').value || null,
            fecha_inicio: document.getElementById('new-alta').value || null,
            direccion: document.getElementById('new-direccion').value,
            poblacion: document.getElementById('new-poblacion').value,
            cp: document.getElementById('new-cp').value,
            grado: document.getElementById('new-grado').value,
            grupo: document.getElementById('new-grupo').value,
            seguro_pagado: document.getElementById('new-seguro').checked,
            dojo: document.getElementById('new-dojo').value,
            activo: true
        }
    };

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showModal("¡Éxito!", "Alumno guardado correctamente en la base de datos.");
            resetForm();
            showSection('alumnos');
        } else {
            const err = await res.json();
            alert("Error: " + (err.error?.message || "No se pudo guardar"));
        }
    } catch { alert("Error de red"); }
}

async function editarAlumno(id) {
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${id}?populate=dojo`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        const p = json.data.attributes || json.data;

        document.getElementById('edit-id').value = id;
        document.getElementById('new-nombre').value = p.nombre || '';
        document.getElementById('new-apellidos').value = p.apellidos || '';
        document.getElementById('new-dni').value = p.dni || '';
        document.getElementById('new-email').value = p.email || '';
        document.getElementById('new-telefono').value = p.telefono || '';
        document.getElementById('new-nacimiento').value = p.fecha_nacimiento || '';
        document.getElementById('new-alta').value = p.fecha_inicio || '';
        document.getElementById('new-direccion').value = p.direccion || '';
        document.getElementById('new-poblacion').value = p.poblacion || '';
        document.getElementById('new-cp').value = p.cp || '';
        document.getElementById('new-grado').value = p.grado || '';
        document.getElementById('new-grupo').value = p.grupo || 'Full Time';
        document.getElementById('new-dojo').value = p.dojo?.documentId || p.dojo?.id || '';
        
        const checkSeguro = document.getElementById('new-seguro');
        checkSeguro.checked = p.seguro_pagado;
        checkSeguro.dispatchEvent(new Event('change'));

        document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR DATOS";
        document.getElementById('btn-cancelar-edit').classList.remove('hidden');
        showSection('nuevo-alumno');
    } catch { alert("Error al obtener datos del alumno"); }
}

function confirmarEstado(id, activar, nombre) {
    const accion = activar ? "REACTIVAR" : "DAR DE BAJA";
    showModal(`¿${accion} ALUMNO?`, `Vas a cambiar el estado de ${nombre}.`, async () => {
        const payload = { 
            data: { 
                activo: activar, 
                fecha_baja: activar ? null : new Date().toISOString().split('T')[0] 
            } 
        };
        const res = await fetch(`${API_URL}/api/alumnos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify(payload)
        });
        if (res.ok) loadAlumnos(!activar);
    });
}

function resetForm() {
    document.getElementById('form-nuevo-alumno').reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO";
    document.getElementById('btn-cancelar-edit').classList.add('hidden');
    const checkSeguro = document.getElementById('new-seguro');
    checkSeguro.checked = false;
    checkSeguro.dispatchEvent(new Event('change'));
}

// --- 4. DOJOS ---
async function loadDojosCards() {
    const grid = document.getElementById('grid-dojos');
    if (!grid) return;
    grid.innerHTML = '<p>Cargando sedes...</p>';
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        grid.innerHTML = '';
        (json.data || []).forEach(d => {
            const p = d.attributes || d;
            const cleanName = (p.nombre || 'Dojo').replace(/Aikido\s+/gi, '').trim();
            grid.innerHTML += `
                <div class="dojo-card">
                    <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${cleanName}</h3></div>
                    <div class="dojo-body">
                        <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${p.direccion || 'No disp.'}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || 'No disp.'}</span></div>
                        <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a>
                    </div>
                </div>`;
        });
    } catch { grid.innerHTML = '<p>Error al cargar dojos.</p>'; }
}

async function loadDojosSelect() {
    const selects = [document.getElementById('new-dojo'), document.getElementById('report-dojo-filter'), document.getElementById('export-dojo-filter')];
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        const options = j.data.map(d => `<option value="${d.documentId}">${(d.attributes || d).nombre}</option>`).join('');
        selects.forEach(s => {
            if (s) {
                const defaultText = s.id === 'new-dojo' ? 'Selecciona sede...' : 'Todos los Dojos';
                s.innerHTML = `<option value="">${defaultText}</option>` + options;
            }
        });
    } catch {}
}

// --- 5. INFORMES Y BACKUP ---
function openReportModal() { document.getElementById('report-modal').classList.remove('hidden'); }

async function generateReport(type) {
    const dojoId = document.getElementById('report-dojo-filter').value;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    
    // Configuración de tabla según tipo
    let title = "INFORME ARASHI GROUP";
    let url = `${API_URL}/api/alumnos?populate=dojo&pagination[limit]=1000`;
    
    if (type.startsWith('bajas')) {
        url += `&filters[activo][$eq]=false`;
        title = "HISTÓRICO DE BAJAS";
    } else {
        url += `&filters[activo][$eq]=true`;
        title = "LISTADO DE ALUMNOS ACTIVOS";
    }

    if (dojoId) url += `&filters[dojo][documentId][$eq]=${dojoId}`;

    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        let list = json.data || [];

        // Ordenación
        if (type === 'grade') list.sort((a,b) => getGradeWeight((b.attributes||b).grado) - getGradeWeight((a.attributes||a).grado));
        else list.sort((a,b) => ((a.attributes||a).apellidos || "").localeCompare((b.attributes||b).apellidos || ""));

        const body = list.map(item => {
            const p = item.attributes || item;
            return [
                (p.apellidos || '').toUpperCase(),
                p.nombre || '',
                p.dni || '',
                normalizeGrade(p.grado),
                p.seguro_pagado ? 'SÍ' : 'PENDIENTE',
                getDojoName(p.dojo),
                parseFloat(p.horas_acumuladas || 0).toFixed(1) + 'h',
                formatDateDisplay(p.fecha_inicio)
            ];
        });

        doc.setFontSize(16);
        doc.text(title, 14, 15);
        doc.autoTable({
            startY: 22,
            head: [['Apellidos', 'Nombre', 'DNI', 'Grado', 'Seguro', 'Dojo', 'Horas', 'Alta']],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [190, 0, 0] },
            styles: { fontSize: 8 }
        });
        doc.save(`Arashi_Informe_${type}.pdf`);
    } catch { alert("Error generando PDF"); }
}

async function exportBackupExcel() {
    const dojoId = document.getElementById('export-dojo-filter').value;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Alumnos');
    
    sheet.columns = [
        { header: 'APELLIDOS', key: 'ape', width: 25 },
        { header: 'NOMBRE', key: 'nom', width: 20 },
        { header: 'DNI', key: 'dni', width: 15 },
        { header: 'EMAIL', key: 'mail', width: 25 },
        { header: 'TELÉFONO', key: 'tel', width: 15 },
        { header: 'GRADO', key: 'gra', width: 12 },
        { header: 'HORAS', key: 'hrs', width: 10 },
        { header: 'DOJO', key: 'dojo', width: 20 }
    ];

    let url = `${API_URL}/api/alumnos?populate=dojo&filters[activo][$eq]=true&pagination[limit]=1000`;
    if (dojoId) url += `&filters[dojo][documentId][$eq]=${dojoId}`;

    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    const json = await res.json();

    json.data.forEach(item => {
        const p = item.attributes || item;
        sheet.addRow({
            ape: p.apellidos, nom: p.nombre, dni: p.dni, mail: p.email,
            tel: p.telefono, gra: p.grado, hrs: p.horas_acumuladas,
            dojo: getDojoName(p.dojo)
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Arashi_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
}

// --- 6. UTILS ---
function parseRelation(obj) { if(!obj || !obj.data) return obj; return obj.data.attributes || obj.data; }

function getDojoName(dojoObj) {
    const d = parseRelation(dojoObj);
    return d && d.nombre ? d.nombre.replace(/Aikido\s+/gi, '').trim() : "N/A";
}

function normalizeGrade(g) {
    if (!g) return 'S/G';
    let s = g.toUpperCase().trim();
    if (s.includes('DAN') || s.includes('KYU')) {
        const match = s.match(/(\d+)/);
        if (match) return `${match[1]}º ${s.includes('DAN') ? 'DAN' : 'KYU'}`;
    }
    return s;
}

function getGradeWeight(g) { return GRADE_WEIGHTS[normalizeGrade(g)] || 0; }

function formatDateDisplay(d) { 
    if (!d) return '-'; 
    const p = d.split('T')[0].split('-'); 
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; 
}

function normalizePhone(t) { 
    if (!t) return '-'; 
    return t.toString().replace(/^(\+?34)/, '').trim(); 
}

function setupDniInput(id) { 
    document.getElementById(id)?.addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    }); 
}

function filtrarTabla(t, i) { 
    const f = document.getElementById(i).value.toUpperCase(); 
    const rows = document.getElementById(t).getElementsByTagName('tr'); 
    for (let j = 1; j < rows.length; j++) {
        rows[j].style.display = rows[j].textContent.toUpperCase().includes(f) ? "" : "none";
    }
}

function showModal(t, m, okAction) { 
    const d = document.getElementById('custom-modal'); 
    document.getElementById('modal-title').innerText = t; 
    document.getElementById('modal-message').innerText = m; 
    document.getElementById('modal-btn-cancel').onclick = () => d.classList.add('hidden'); 
    document.getElementById('modal-btn-ok').onclick = () => { 
        if (okAction) okAction(); 
        d.classList.add('hidden'); 
    }; 
    d.classList.remove('hidden'); 
}

function toggleMobileMenu() { document.querySelector('.sidebar').classList.toggle('open'); }

async function confirmResetInsurance() {
    showModal("¡ATENCIÓN!", "Vas a resetear los seguros de TODOS los alumnos. ¿Estás seguro?", async () => {
        const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&pagination[limit]=1000`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        let total = json.data.length;
        let count = 0;
        
        for(let alu of json.data) {
            const id = alu.documentId || alu.id;
            await fetch(`${API_URL}/api/alumnos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
                body: JSON.stringify({ data: { seguro_pagado: false } })
            });
            count++;
            document.getElementById('console-output').innerText = `Procesando: ${count}/${total}...`;
        }
        showModal("Completado", "Todos los seguros han sido reseteados.");
        loadAlumnos(true);
    });
}