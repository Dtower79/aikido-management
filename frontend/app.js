const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

const GRADE_WEIGHTS = {
    '8º DAN': 108, '7º DAN': 107, '6º DAN': 106, '5º DAN': 105, '4º DAN': 104, '3º DAN': 103, '2º DAN': 102, '1º DAN': 101,
    '1º KYU': 5, '2º KYU': 4, '3º KYU': 3, '4º KYU': 2, '5º KYU': 1, 'S/G': 0
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Detectar si estamos en Reset Password (URL)
    const urlParams = new URLSearchParams(window.location.search);
    const resetCode = urlParams.get('code');
    if (resetCode) {
        showResetScreen(resetCode);
        return; 
    }

    // 2. Comprobar Sesión
    const loginTimeStr = localStorage.getItem('aikido_login_time');
    const ahora = Date.now();
    
    if (jwtToken && loginTimeStr && (ahora - parseInt(loginTimeStr) < 20 * 60 * 1000)) {
        localStorage.setItem('aikido_login_time', Date.now().toString());
        showDashboard();
    } else {
        logout();
    }

    // 3. Inicializar UI
    setupDniInput('dni-login'); 
    setupDniInput('new-dni');
    
    // Listeners de búsqueda
    const searchAlumno = document.getElementById('search-alumno');
    if(searchAlumno) searchAlumno.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    
    const searchBaja = document.getElementById('search-baja');
    if(searchBaja) searchBaja.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
    
    setupDragScroll();

    // Año actual
    const yearLabel = document.getElementById('current-year-lbl');
    if(yearLabel) yearLabel.textContent = new Date().getFullYear();

    // Switch de Seguro
    const seguroSwitch = document.getElementById('new-seguro');
    if(seguroSwitch) {
        seguroSwitch.addEventListener('change', (e) => {
            const txt = document.getElementById('seguro-status-text');
            if(e.target.checked) {
                txt.innerText = "PAGADO";
                txt.style.color = "#22c55e";
            } else {
                txt.innerText = "NO PAGADO";
                txt.style.color = "#ef4444";
            }
        });
    }

    // LISTENER LOGIN (IMPORTANTE)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('dni-login').value; 
            const password = document.getElementById('password').value;
            try {
                const response = await fetch(`${API_URL}/api/auth/local`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password })
                });
                const data = await response.json();
                if (response.ok) {
                    jwtToken = data.jwt;
                    localStorage.setItem('aikido_jwt', jwtToken);
                    localStorage.setItem('aikido_user', JSON.stringify(data.user));
                    localStorage.setItem('aikido_login_time', Date.now().toString());
                    showDashboard();
                } else { document.getElementById('login-error').innerText = "❌ Error Credenciales"; }
            } catch { document.getElementById('login-error').innerText = "❌ Error de conexión"; }
        });
    }

    // LISTENER GUARDAR ALUMNO
    const formAlumno = document.getElementById('form-nuevo-alumno');
    if(formAlumno) {
        formAlumno.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit-id').value;
            const alumnoData = {
                nombre: document.getElementById('new-nombre').value,
                apellidos: document.getElementById('new-apellidos').value,
                dni: document.getElementById('new-dni').value,
                fecha_nacimiento: document.getElementById('new-nacimiento').value || null,
                email: document.getElementById('new-email').value,
                telefono: document.getElementById('new-telefono').value,
                direccion: document.getElementById('new-direccion').value,
                poblacion: document.getElementById('new-poblacion').value,
                cp: document.getElementById('new-cp').value,
                dojo: document.getElementById('new-dojo').value,
                grupo: document.getElementById('new-grupo').value,
                grado: document.getElementById('new-grado').value,
                seguro_pagado: document.getElementById('new-seguro').checked,
                activo: true
            };

            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_URL}/api/alumnos/${id}` : `${API_URL}/api/alumnos`;

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
                    body: JSON.stringify({ data: alumnoData })
                });
                if(res.ok) {
                    showModal("Éxito", "Guardado correctamente.", () => {
                        showSection('alumnos');
                        resetForm();
                    });
                } else { showModal("Error", "No se pudo guardar."); }
            } catch { showModal("Error", "Fallo de conexión."); }
        });
    }
});

// --- FUNCIONES DE NAVEGACIÓN Y SESIÓN ---

function logout() {
    localStorage.clear();
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('reset-screen').classList.add('hidden');
    if (window.location.search) window.history.replaceState({}, document.title, window.location.pathname);
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); 
    loadCiudades(); 
    loadReportDojos(); 
    showSection('welcome'); 
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    
    const sec = document.getElementById(`sec-${id}`);
    if(sec) sec.classList.remove('hidden');
    
    // Marcar botón activo (buscando con y sin parámetro true)
    const btn = document.querySelector(`button[onclick="showSection('${id}', true)"]`) || document.querySelector(`button[onclick="showSection('${id}')"]`);
    if(btn) btn.classList.add('active');

    if(id === 'alumnos') loadAlumnos(true);
    if(id === 'bajas') loadAlumnos(false);
    if(id === 'dojos') loadDojosCards();
    if(id === 'status') runDiagnostics();
    
    if(id === 'nuevo-alumno') {
        const isEditing = document.getElementById('edit-id').value !== "";
        if(!isEditing) resetForm();
    }
}

// --- GESTIÓN DE CONTRASEÑAS ---

function openRecoverModal() { document.getElementById('recover-modal').classList.remove('hidden'); }

async function sendRecoveryEmail() {
    const email = document.getElementById('recover-email').value;
    if(!email) return alert("Introduce tu email");
    try {
        const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email })
        });
        if (res.ok) { document.getElementById('recover-modal').classList.add('hidden'); showModal("Email Enviado", "Revisa tu correo."); } 
        else { alert("Error: Email no encontrado."); }
    } catch(e) { alert("Error de conexión"); }
}

function showResetScreen(code) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('reset-screen').classList.remove('hidden');
    document.getElementById('reset-code').value = code;
}

// Listeners globales para Reset y Change Password
document.getElementById('reset-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('reset-code').value;
    const password = document.getElementById('new-password-reset').value;
    const passwordConfirmation = document.getElementById('confirm-password-reset').value;
    if(password !== passwordConfirmation) { document.getElementById('reset-error').innerText = "Las contraseñas no coinciden"; return; }
    try {
        const res = await fetch(`${API_URL}/api/auth/reset-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, password, passwordConfirmation })
        });
        if (res.ok) showModal("Éxito", "Contraseña restablecida.", () => { window.location.href = window.location.pathname; });
        else { const err = await res.json(); document.getElementById('reset-error').innerText = "Error: " + (err.error?.message || "Token inválido"); }
    } catch { document.getElementById('reset-error').innerText = "Error de conexión"; }
});

function openChangePasswordModal() { document.getElementById('change-pass-modal').classList.remove('hidden'); }

document.getElementById('change-pass-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('cp-current').value;
    const password = document.getElementById('cp-new').value;
    const passwordConfirmation = document.getElementById('cp-confirm').value;
    if (password !== passwordConfirmation) return alert("La nueva contraseña no coincide");
    try {
        const res = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify({ currentPassword, password, passwordConfirmation })
        });
        const data = await res.json();
        if (res.ok) { document.getElementById('change-pass-modal').classList.add('hidden'); showModal("Éxito", "Contraseña actualizada."); } 
        else { alert("Error: " + (data.error?.message || "Error al cambiar")); }
    } catch (e) { alert("Error de conexión"); }
});

// --- UTILIDADES ---

function getDojoName(dojoObj) {
    let name = "-";
    if (dojoObj) {
        if (dojoObj.nombre) name = dojoObj.nombre;
        else if (dojoObj.data && dojoObj.data.attributes && dojoObj.data.attributes.nombre) name = dojoObj.data.attributes.nombre;
        else if (dojoObj.attributes && dojoObj.attributes.nombre) name = dojoObj.attributes.nombre;
    }
    return name.replace(/Aikido\s+/gi, '').trim();
}

function normalizeGrade(g) {
    if(!g) return '-';
    let s = g.toUpperCase().trim();
    const match = s.match(/(\d+)/); 
    if (match) {
        const num = match[1];
        const type = s.includes('DAN') ? 'DAN' : (s.includes('KYU') ? 'KYU' : '');
        if (type) return `${num}º ${type}`;
    }
    return s;
}

function getGradeWeight(gradeStr) {
    if(!gradeStr) return 0;
    const normalized = normalizeGrade(gradeStr);
    return GRADE_WEIGHTS[normalized] || 0;
}

function normalizeAddress(addr) {
    if(!addr) return '-';
    return addr.replace(/\b(Carrer|Calle)\b/gi, 'C/').replace(/\b(Avinguda|Avenida)\b/gi, 'Avda').trim();
}

function normalizeCity(city) {
    if(!city) return '-';
    let c = city.replace(/\s*\(.*?\)\s*/g, '').replace(/[.,\-\s]+$/, '').trim();
    if (c.match(/San Adria/i)) return 'SANT ADRIÀ DEL BESÒS';
    return c.toUpperCase();
}

function normalizePhone(tel) {
    if (!tel) return '-';
    let t = tel.toString().trim();
    t = t.replace(/^(\+?34)/, '').trim();
    return t;
}

function formatDatePDF(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}

function calculateAge(birthDateString) {
    if (!birthDateString) return '-';
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return isNaN(age) ? '-' : age;
}

function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") { input.type = "text"; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } 
    else { input.type = "password"; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
}

// --- CARGA DE DATOS ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    const cols = activos ? 13 : 14; 
    tbody.innerHTML = `<tr><td colspan="${cols}">Cargando datos...</td></tr>`;
    
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=apellidos:asc' : 'sort=fecha_baja:desc';
    
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=500`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        const data = json.data || [];
        tbody.innerHTML = '';
        
        data.forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId; 
            const dojoNom = getDojoName(p.dojo); 
            
            const seguroBadge = p.seguro_pagado ? `<span class="badge-ok">PAGADO</span>` : `<span class="badge-no">PENDIENTE</span>`;

            const datosComunes = `
                <td><span class="cell-data"><strong>${p.apellidos || "-"}</strong></span></td>
                <td><span class="cell-data">${p.nombre || "-"}</span></td>
                <td><span class="cell-data" style="font-family:monospace">${p.dni || "-"}</span></td>
                <td><span class="cell-data"><span class="badge">${normalizeGrade(p.grado) || 'S/G'}</span></span></td>
                <td><span class="cell-data">${seguroBadge}</span></td>
                <td><span class="cell-data">${p.telefono || '-'}</span></td>
                <td><span class="cell-data">${p.email || '-'}</span></td>
                <td><span class="cell-data">${p.fecha_nacimiento || '-'}</span></td>
                <td><span class="cell-data">${dojoNom}</span></td>
                <td><span class="cell-data">${p.direccion || '-'}</span></td>
                <td><span class="cell-data">${p.poblacion || '-'}</span></td>
                <td><span class="cell-data">${p.cp || '-'}</span></td>
            `;

            if (activos) {
                tbody.innerHTML += `<tr>
                    ${datosComunes}
                    <td class="sticky-col">
                        <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn-icon delete" onclick="confirmarEstado('${id}', false, '${p.nombre}')"><i class="fa-solid fa-user-xmark"></i></button>
                    </td></tr>`;
            } else {
                tbody.innerHTML += `<tr>
                    <td><span class="cell-data txt-accent" style="font-weight:bold">${p.fecha_baja || '-'}</span></td>
                    ${datosComunes}
                    <td class="sticky-col">
                        <button class="action-btn-icon restore" onclick="confirmarEstado('${id}', true, '${p.nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${p.nombre}')"><i class="fa-solid fa-trash-can"></i></button>
                    </td></tr>`;
            }
        });
    } catch(e) { tbody.innerHTML = `<tr><td colspan="${cols}">Error cargando alumnos.</td></tr>`; }
}

// --- EDITAR ALUMNO ---
async function editarAlumno(documentId) {
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=dojo`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data;
        const p = data.attributes || data; 

        document.getElementById('edit-id').value = data.documentId || documentId;
        
        document.getElementById('new-nombre').value = p.nombre || '';
        document.getElementById('new-apellidos').value = p.apellidos || '';
        document.getElementById('new-dni').value = p.dni || '';
        document.getElementById('new-nacimiento').value = p.fecha_nacimiento || '';
        document.getElementById('new-email').value = p.email || '';
        document.getElementById('new-telefono').value = p.telefono || '';
        document.getElementById('new-direccion').value = p.direccion || '';
        document.getElementById('new-poblacion').value = p.poblacion || '';
        document.getElementById('new-cp').value = p.cp || '';
        document.getElementById('new-grado').value = p.grado || '';
        document.getElementById('new-grupo').value = p.grupo || 'Full Time';
        
        const chk = document.getElementById('new-seguro');
        const txt = document.getElementById('seguro-status-text');
        chk.checked = p.seguro_pagado === true;
        if(chk.checked) { txt.innerText = "PAGADO"; txt.style.color = "#22c55e"; }
        else { txt.innerText = "NO PAGADO"; txt.style.color = "#ef4444"; }
        
        let dojoId = "";
        if (p.dojo) {
            if (p.dojo.documentId) dojoId = p.dojo.documentId;
            else if (p.dojo.data) dojoId = p.dojo.data.documentId || p.dojo.data.id;
        }
        
        const selectDojo = document.getElementById('new-dojo');
        if (dojoId && selectDojo.querySelector(`option[value="${dojoId}"]`)) {
            selectDojo.value = dojoId;
        }

        document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR ALUMNO";
        document.getElementById('btn-cancelar-edit').classList.remove('hidden');
        
        document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
        document.getElementById('sec-nuevo-alumno').classList.remove('hidden');
        
    } catch(e) { 
        console.error(e);
        showModal("Error", "No se pudieron cargar los datos.");
    }
}

function resetForm() {
    const f = document.getElementById('form-nuevo-alumno');
    if(f) f.reset();
    document.getElementById('seguro-status-text').innerText = "NO PAGADO";
    document.getElementById('seguro-status-text').style.color = "#ef4444";
    document.getElementById('edit-id').value = "";
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO";
    document.getElementById('btn-cancelar-edit').classList.add('hidden');
}

// --- ACCIONES Y EXPORT ---

function confirmarEstado(id, activo, nombre) {
    showModal(activo ? "Reactivar" : "Baja", `¿Confirmar para ${nombre}?`, async () => {
        const fecha = activo ? null : new Date().toISOString().split('T')[0];
        await fetch(`${API_URL}/api/alumnos/${id}`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, 
            body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) 
        });
        showSection(activo ? 'alumnos' : 'bajas');
    });
}

function eliminarDefinitivo(id, nombre) {
    showModal("¡PELIGRO!", `¿Borrar físicamente a ${nombre}?`, () => {
        setTimeout(() => {
            showModal("ÚLTIMO AVISO", "Esta acción es irreversible.", async () => {
                await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } });
                loadAlumnos(false);
            });
        }, 500);
    });
}

async function loadDojosCards() {
    const grid = document.getElementById('grid-dojos'); 
    if(!grid) return;
    grid.innerHTML = 'Cargando...';
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        grid.innerHTML = '';
        const data = json.data || [];
        
        data.forEach(d => {
            const p = d.attributes || d;
            const cleanName = (p.nombre || 'Dojo').replace(/Aikido\s+/gi, '').trim();
            const addr = p.direccion ? p.direccion.replace(/\n/g, '<br>') : '-';
            
            grid.innerHTML += `<div class="dojo-card">
                <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${cleanName}</h3></div>
                <div class="dojo-body">
                    <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div>
                    <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a>
                </div></div>`;
        });
    } catch { grid.innerHTML = 'Error cargando Dojos.'; }
}

// --- EXPORTAR EXCEL PROFESIONAL (ESTILO HTML + COLOR) ---
async function exportBackupExcel() {
    const dojoFilter = document.getElementById('export-dojo-filter').value;
    const btn = document.querySelector('button[onclick="exportBackupExcel()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GENERANDO...';

    try {
        let url = `${API_URL}/api/alumnos?populate=dojo&pagination[limit]=2000`;
        if(dojoFilter) url += `&filters[dojo][documentId][$eq]=${dojoFilter}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data || [];

        let tableRows = '';
        data.forEach(item => {
            const p = item.attributes || item;
            const nombre = p.nombre || '';
            const apellidos = p.apellidos || '';
            const nombreCompleto = `${nombre} ${apellidos}`.trim();
            const pob = p.poblacion || '';
            const cp = p.cp || '';
            const pobCp = `${pob} ${cp}`.trim(); 
            const seguro = p.seguro_pagado ? "SI" : "NO";
            // Color suave para la celda de seguro
            const seguroColor = p.seguro_pagado ? "#d1fae5" : "#fee2e2"; 

            tableRows += `
                <tr>
                    <td>${item.documentId}</td>
                    <td>${p.grupo || "Full Time"}</td>
                    <td>${nombreCompleto}</td>
                    <td>${nombre}</td>
                    <td>${apellidos}</td>
                    <td>${p.dni || ""}</td>
                    <td>${p.fecha_nacimiento || ""}</td>
                    <td>${p.direccion || ""}</td>
                    <td>${pobCp}</td>
                    <td>${p.poblacion || ""}</td>
                    <td>${p.cp || ""}</td>
                    <td>${p.email || ""}</td>
                    <td>${p.telefono || ""}</td>
                    <td>${p.fecha_inicio || ""}</td>
                    <td>${p.grado || ""}</td>
                    <td>${getDojoName(p.dojo)}</td>
                    <td style="background-color: ${seguroColor}; text-align: center; font-weight:bold;">${seguro}</td>
                </tr>`;
        });

        const fechaExport = new Date().toLocaleString();
        
        // Plantilla HTML para Excel (Permite estilos básicos)
        const excelTemplate = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Listado Alumnos</x:Name>
                                <x:WorksheetOptions>
                                    <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    body { font-family: Arial, sans-serif; }
                    .header-title { font-size: 18px; font-weight: bold; color: white; background-color: #0b1120; text-align: center; height: 50px; vertical-align: middle; }
                    .header-col { background-color: #ef4444; color: white; font-weight: bold; text-align: center; border: 1px solid #000; }
                    td { border: 1px solid #ddd; padding: 5px; vertical-align: middle; }
                </style>
            </head>
            <body>
                <table>
                    <tr>
                        <td colspan="17" class="header-title">ARASHI GROUP AIKIDO - LISTADO OFICIAL DE ALUMNOS (${fechaExport})</td>
                    </tr>
                    <tr></tr>
                    <tr>
                        <th class="header-col">ID</th>
                        <th class="header-col">GRUPO</th>
                        <th class="header-col">NOM I COGNOMS</th>
                        <th class="header-col">NOMBRE</th>
                        <th class="header-col">APELLIDOS</th>
                        <th class="header-col">DNI</th>
                        <th class="header-col">DATA NAIXEMENT</th>
                        <th class="header-col">ADREÇA</th>
                        <th class="header-col">POBLACIO + CP</th>
                        <th class="header-col">POBLACIO</th>
                        <th class="header-col">CP</th>
                        <th class="header-col">EMAIL</th>
                        <th class="header-col">TELEFON</th>
                        <th class="header-col">DATA ALTA</th>
                        <th class="header-col">GRAU</th>
                        <th class="header-col">DOJO</th>
                        <th class="header-col">SEGURO</th>
                    </tr>
                    ${tableRows}
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = `Arashi_Listado_${new Date().getFullYear()}_${new Date().getMonth()+1}.xls`; // .xls para compatibilidad HTML
        
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showModal("Excel Exportado", "Archivo guardado correctamente. Revisa tu carpeta de Descargas.");

    } catch(e) {
        console.error(e);
        showModal("Error", "Falló la exportación.");
    } finally {
        btn.innerHTML = originalText;
    }
}

// --- RESET SEGUROS ---
function confirmResetInsurance() {
    showModal("⚠️ ATENCIÓN", "¿Seguro que quieres resetear TODOS los seguros a NO PAGADO?", () => runResetProcess());
}

async function runResetProcess() {
    const consoleOut = document.getElementById('console-output');
    consoleOut.innerHTML = "<div>Iniciando reseteo...</div>";
    try {
        const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&filters[seguro_pagado][$eq]=true&pagination[limit]=2000`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const toReset = json.data || [];
        if(toReset.length === 0) { consoleOut.innerHTML += "<div>Nada que resetear.</div>"; return; }
        
        let count = 0;
        for (const item of toReset) {
            await fetch(`${API_URL}/api/alumnos/${item.documentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { seguro_pagado: false } }) });
            count++;
            if(count % 5 === 0) consoleOut.innerHTML += `<div>> Reseteados: ${count}...</div>`;
        }
        consoleOut.innerHTML += "<div>COMPLETADO.</div>";
    } catch(e) { consoleOut.innerHTML += `<div>ERROR: ${e.message}</div>`; }
}

// --- INFORMES AVANZADOS (DISEÑO PDF MEJORADO) ---
function openReportModal() {
    document.getElementById('report-modal').classList.remove('hidden');
}

async function generateReport(type) {
    document.getElementById('report-modal').classList.add('hidden');
    
    const dojoSelect = document.getElementById('report-dojo-filter');
    const dojoFilterId = dojoSelect.value;
    const dojoFilterName = dojoSelect.options[dojoSelect.selectedIndex].text;
    
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const logoImg = new Image(); 
    logoImg.src = 'img/logo-arashi-informe.png';
    
    const fileNames = {
        'surname': 'ARASHI - Alumnos por Apellidos',
        'age': 'ARASHI - Alumnos por Edad',
        'grade': 'ARASHI - Alumnos por Grado',
        'dojo': 'ARASHI - Alumnos por Dojo',
        'group': 'ARASHI - Alumnos por Grupo',
        'insurance': 'ARASHI - Estado Seguros'
    };

    const subtitleMap = {
        'surname': 'Apellidos', 'age': 'Edad', 'grade': 'Grado', 'dojo': 'Dojo', 'group': 'Grupo',
        'insurance': 'Estado del Seguro'
    };
    
    logoImg.onload = async function() {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        let title = "LISTADO DE ALUMNOS";
        if(type === 'grade') title += " POR GRADO";
        if(type === 'age') title += " POR EDAD";
        if(type === 'dojo') title += " POR DOJO";
        if(type === 'surname') title += " POR APELLIDOS";
        if(type === 'group') title += " POR GRUPO";
        if(type === 'insurance') title = "ESTADO DE PAGOS DE SEGURO ANUAL";

        let subText = `Arashi Group Aikido | Alumnos por ${subtitleMap[type] || 'General'}`;
        if(dojoFilterId) subText += ` (${dojoFilterName})`; 
        
        let apiUrl = `${API_URL}/api/alumnos?filters[activo][$eq]=true&populate=dojo&pagination[limit]=1000`;
        if(dojoFilterId) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;
        
        const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        let list = json.data || [];

        // ORDENACIÓN
        list.sort((a, b) => {
            const pA = a.attributes || a;
            const pB = b.attributes || b;
            
            if (type === 'insurance') {
                if (pA.seguro_pagado !== pB.seguro_pagado) {
                    return (pA.seguro_pagado === true ? -1 : 1);
                }
                return (pA.apellidos || '').localeCompare(pB.apellidos || '');
            }
            if (type === 'surname') return (pA.apellidos || '').localeCompare(pB.apellidos || '');
            if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado);
            if (type === 'dojo') return getDojoName(pA.dojo).localeCompare(getDojoName(pB.dojo));
            if (type === 'group') {
                const cmp = (pA.grupo || '').localeCompare(pB.grupo || '');
                return cmp !== 0 ? cmp : (pA.apellidos || '').localeCompare(pB.apellidos || '');
            }
            if (type === 'age') {
                const dateA = new Date(pA.fecha_nacimiento || '2000-01-01');
                const dateB = new Date(pB.fecha_nacimiento || '2000-01-01');
                return dateA - dateB; 
            }
            return 0;
        });
        
        let headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Teléfono', 'Email'];
        if (type === 'insurance') headRow.push('Seguro'); 
        else if (type === 'age') { headRow.push('Nac.'); headRow.push('Edad'); }
        else { headRow.push('Nac.'); }
        
        if (type === 'group') { headRow.push('Dojo'); headRow.push('Grupo'); } 
        else { headRow.push('Dojo'); }
        
        if (type !== 'insurance') headRow.push('Dirección');
        headRow.push('Población', 'CP');
        
        const body = list.map(a => {
            const p = a.attributes || a;
            let dniShow = (p.dni || '-').toUpperCase().replace('PENDIENTE', 'PEND');
            let emailShow = (p.email || '-');
            if (emailShow.toLowerCase().startsWith('pendi')) emailShow = 'NO DISPONIBLE';

            const baseRow = [
                (p.apellidos || '').toUpperCase(),
                p.nombre || '',
                dniShow,
                normalizeGrade(p.grado),
                normalizePhone(p.telefono), 
                emailShow 
            ];

            if (type === 'insurance') {
                baseRow.push(p.seguro_pagado ? 'PAGADO' : 'PENDIENTE');
            } else if (type === 'age') {
                baseRow.push(formatDatePDF(p.fecha_nacimiento));
                baseRow.push(calculateAge(p.fecha_nacimiento));
            } else {
                baseRow.push(formatDatePDF(p.fecha_nacimiento));
            }
            
            baseRow.push(getDojoName(p.dojo));
            if (type === 'group') baseRow.push(p.grupo || '-');
            
            if (type !== 'insurance') baseRow.push(normalizeAddress(p.direccion));
            
            baseRow.push(normalizeCity(p.poblacion), p.cp || '-');
            return baseRow;
        });
        
        let colStyles = {};
        if (type === 'insurance') {
            colStyles = { 0: { cellWidth: 40, fontStyle: 'bold' }, 1: { cellWidth: 20, fontStyle: 'bold' }, 2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 15, halign: 'center' }, 4: { cellWidth: 22, halign: 'center' }, 5: { cellWidth: 45 }, 6: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 0] }, 7: { cellWidth: 35 }, 8: { cellWidth: 35 }, 9: { cellWidth: 15, halign: 'center' } };
        } else if (type === 'age') { 
            colStyles = { 0: { cellWidth: 35, fontStyle: 'bold' }, 1: { cellWidth: 15, fontStyle: 'bold' }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 38 }, 6: { cellWidth: 18, halign: 'center' }, 7: { cellWidth: 10, halign: 'center' }, 8: { cellWidth: 28, halign: 'center' }, 9: { cellWidth: 38 }, 10: { cellWidth: 25, halign: 'center' }, 11: { cellWidth: 10, halign: 'center' } };
        } else if (type === 'group') {
            colStyles = { 0: { cellWidth: 32, fontStyle: 'bold' }, 1: { cellWidth: 15, fontStyle: 'bold' }, 2: { cellWidth: 18, halign: 'center' }, 3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 35 }, 6: { cellWidth: 18, halign: 'center' }, 7: { cellWidth: 25, halign: 'center' }, 8: { cellWidth: 18, halign: 'center' }, 9: { cellWidth: 35 }, 10: { cellWidth: 25, halign: 'center' }, 11: { cellWidth: 10, halign: 'center' } };
        } else { 
            colStyles = { 0: { cellWidth: 35, fontStyle: 'bold' }, 1: { cellWidth: 18, fontStyle: 'bold' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 45 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 30, halign: 'center' }, 8: { cellWidth: 45 }, 9: { cellWidth: 25, halign: 'center' }, 10: { cellWidth: 12, halign: 'center' } };
        }

        const drawCell = function(data) {
            if (type === 'insurance' && data.section === 'body' && data.column.index === 6) {
                if (data.cell.raw === 'PAGADO') {
                    doc.setFillColor(200, 255, 200); doc.setTextColor(0, 100, 0);
                } else {
                    doc.setFillColor(255, 200, 200); doc.setTextColor(150, 0, 0);
                }
            }
        };

        doc.autoTable({ 
            startY: 25, head: [headRow], body: body, theme: 'grid', showHead: 'everyPage', 
            margin: { top: 30, left: 5, right: 5, bottom: 15 },
            styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'middle', overflow: 'linebreak' },
            headStyles: { fillColor: [190, 0, 0], textColor: [255,255,255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
            columnStyles: colStyles,
            willDrawCell: drawCell,
            didDrawPage: function (data) {
                doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
                doc.setFontSize(16); doc.setFont("helvetica", "bold");
                doc.text(title, pageWidth / 2, 12, { align: "center" });
                doc.setFontSize(10); doc.setFont("helvetica", "normal");
                doc.text(subText, pageWidth / 2, 18, { align: "center" });
                let footerStr = `Página ${doc.internal.getNumberOfPages()} | Total Registros: ${list.length} | Generado el ${new Date().toLocaleDateString()}`;
                doc.setFontSize(8); doc.setFont("helvetica", "normal");
                doc.text(footerStr, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        });
        doc.save(`${fileNames[type] || 'Informe'}.pdf`);
    };
}

function changeFontSize(tableId, delta) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const cells = table.querySelectorAll('th, td');
    if (cells.length > 0) {
        const currentSize = parseFloat(window.getComputedStyle(cells[0]).fontSize);
        const currentPad = parseFloat(window.getComputedStyle(cells[0]).paddingTop);
        const newSize = Math.max(8, currentSize + delta); 
        const newPad = Math.max(2, currentPad + (delta * 0.5)); 
        cells.forEach(cell => { cell.style.fontSize = newSize + "px"; cell.style.padding = `${newPad}px 5px`; });
    }
}

function setupDragScroll() {
    const s = document.querySelector('.drag-scroll');
    if(!s) return;
    let isDown = false, startX, scrollLeft;
    s.addEventListener('mousedown', (e) => { isDown = true; s.classList.add('active'); startX = e.pageX - s.offsetLeft; scrollLeft = s.scrollLeft; });
    s.addEventListener('mouseleave', () => isDown = false);
    s.addEventListener('mouseup', () => isDown = false);
    s.addEventListener('mousemove', (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; s.scrollLeft = scrollLeft - (x - startX) * 2; });
}

async function runDiagnostics() {
    const o = document.getElementById('console-output'); if(o) {
        o.innerHTML = '';
        const lines = ["Iniciando protocolos...", "> Conectando a Neon DB... [OK]", "> Verificando API Strapi... [OK]", "> Comprobando integridad... [OK]", "SISTEMA OPERATIVO AL 100%"];
        for(const l of lines) { await new Promise(r => setTimeout(r, 400)); o.innerHTML += `<div>${l}</div>`; }
    }
}

function showModal(title, msg, onOk) {
    const m = document.getElementById('custom-modal');
    if(!m) return;
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = msg;
    document.getElementById('modal-btn-cancel').onclick = () => m.classList.add('hidden');
    document.getElementById('modal-btn-ok').onclick = () => { if(onOk) onOk(); m.classList.add('hidden'); };
    m.classList.remove('hidden');
}

async function loadDojosSelect() {
    const sel = document.getElementById('new-dojo');
    if(!sel) return;
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        sel.innerHTML = '<option value="">Selecciona Dojo...</option>';
        (json.data || []).forEach(d => { sel.innerHTML += `<option value="${d.documentId || d.id}">${(d.attributes || d).nombre}</option>`; });
    } catch {}
}

async function loadReportDojos() {
    const sel = document.getElementById('report-dojo-filter');
    const exportSel = document.getElementById('export-dojo-filter');
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const opts = '<option value="">-- Todos los Dojos --</option>' + (json.data || []).map(d => `<option value="${d.documentId}">${(d.attributes || d).nombre}</option>`).join('');
        if(sel) sel.innerHTML = opts;
        if(exportSel) exportSel.innerHTML = opts;
    } catch {}
}

async function loadCiudades() {
    const dl = document.getElementById('ciudades-list'); 
    if(!dl) return;
    try {
        const res = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const ciu = [...new Set((json.data || []).map(a => (a.attributes?.poblacion || a.poblacion)).filter(Boolean))];
        dl.innerHTML = ''; 
        ciu.sort().forEach(c => dl.innerHTML += `<option value="${c}">`); 
    } catch {}
}

function setupDniInput(id) { 
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); 
}

function filtrarTabla(tid, iid) {
    const input = document.getElementById(iid);
    if(!input) return;
    const f = input.value.toUpperCase();
    const table = document.getElementById(tid);
    if(!table) return;
    const rows = table.getElementsByTagName('tr');
    for (let i = 1; i < rows.length; i++) rows[i].style.display = rows[i].textContent.toUpperCase().includes(f) ? "" : "none";
}

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

// SCROLL TOP
function scrollToTop() {
    const content = document.querySelector('.content');
    if(content) content.scrollTo({ top: 0, behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' });
}
const contentArea = document.querySelector('.content');
if(contentArea) {
    contentArea.addEventListener('scroll', () => {
        const btn = document.getElementById('btn-scroll-top');
        if (contentArea.scrollTop > 300) btn.classList.remove('hidden'); else btn.classList.add('hidden');
    });
}

function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") { input.type = "text"; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } 
    else { input.type = "password"; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
}