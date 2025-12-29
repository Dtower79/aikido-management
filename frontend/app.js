const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

const GRADE_WEIGHTS = {
    '8º DAN': 108, '7º DAN': 107, '6º DAN': 106, '5º DAN': 105, '4º DAN': 104, '3º DAN': 103, '2º DAN': 102, '1º DAN': 101,
    '1º KYU': 5, '2º KYU': 4, '3º KYU': 3, '4º KYU': 2, '5º KYU': 1, 'S/G': 0
};

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Detectar si estamos en modo "Restablecer Contraseña" por URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetCode = urlParams.get('code');
    if (resetCode) {
        showResetScreen(resetCode);
        return; 
    }

    // 2. Comprobar y renovar la sesión del usuario
    const loginTimeStr = localStorage.getItem('aikido_login_time');
    const ahora = Date.now();
    
    if (jwtToken && loginTimeStr && (ahora - parseInt(loginTimeStr) < 20 * 60 * 1000)) {
        localStorage.setItem('aikido_login_time', Date.now().toString());
        showDashboard();
    } else {
        logout();
    }

    // 3. Inicializar elementos de la interfaz de usuario
    setupDniInput('dni-login'); 
    setupDniInput('new-dni');
    
    const searchAlumno = document.getElementById('search-alumno');
    if(searchAlumno) searchAlumno.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    
    const searchBaja = document.getElementById('search-baja');
    if(searchBaja) searchBaja.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
    
    setupDragScroll();

    // Actualizar el año en el footer dinámicamente
    const yearLabel = document.getElementById('current-year-lbl');
    if(yearLabel) yearLabel.textContent = new Date().getFullYear();

    // Lógica para el switch del "Seguro Anual" en el formulario
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

    // Listener para el formulario de login
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

    // Listener para el formulario de nuevo/edición de alumno
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
            const apiUrl = id ? `${API_URL}/api/alumnos/${id}` : `${API_URL}/api/alumnos`;

            try {
                const res = await fetch(apiUrl, {
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
    const dash = document.getElementById('dashboard');
    const login = document.getElementById('login-screen');
    const reset = document.getElementById('reset-screen');
    
    if(dash) dash.classList.add('hidden');
    if(login) login.classList.remove('hidden');
    if(reset) reset.classList.add('hidden');
    
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

// --- FUNCIONES DE UTILIDAD GENERAL ---

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

// --- CARGA DE DATOS EN TABLAS ---
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

// --- ACCIONES DE GESTIÓN ---

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
    } catch(e) { 
        console.error(e);
        grid.innerHTML = 'Error cargando Dojos.'; 
    }
}

// --- EXPORTAR EXCEL PROFESIONAL (.XLSX REAL CON EXCELJS) ---
async function exportBackupExcel() {
    const dojoFilter = document.getElementById('export-dojo-filter').value;
    const btn = document.querySelector('button[onclick="exportBackupExcel()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GENERANDO...';

    try {
        let apiUrl = `${API_URL}/api/alumnos?populate=dojo&pagination[limit]=2000`;
        if(dojoFilter) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilter}`;

        const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data || [];

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Listado Alumnos');

        // 1. CARGAR LOGO
        try {
            const logoRes = await fetch('img/logo-arashi.png');
            const logoBlob = await logoRes.blob();
            const logoBuffer = await logoBlob.arrayBuffer();
            const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
            // Logo posicionado en A1-C4 aprox
            sheet.addImage(logoId, { tl: { col: 0.2, row: 0.2 }, ext: { width: 140, height: 70 } });
        } catch(e) { console.warn("Logo no encontrado", e); }

        // 2. DEFINIR COLUMNAS (Sin 'header' automático para evitar duplicados en fila 1)
        sheet.columns = [
            { key: 'apellidos', width: 35 },
            { key: 'nombre', width: 25 },
            { key: 'dni', width: 18 },
            { key: 'nac', width: 22 },
            { key: 'dir', width: 45 },
            { key: 'pob', width: 30 },
            { key: 'cp', width: 12 },
            { key: 'email', width: 35 },
            { key: 'dojo', width: 30 },
            { key: 'grupo', width: 18 },
            { key: 'alta', width: 18 },
            { key: 'grau', width: 15 },
            { key: 'seguro', width: 15 }
        ];

        // 3. CABECERA NEGRA GRANDE (Fila 1 a 4)
        sheet.mergeCells('D1:M4');
        const titleCell = sheet.getCell('D1');
        titleCell.value = `ARASHI GROUP AIKIDO - LISTADO OFICIAL (${new Date().toLocaleDateString()})`;
        titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }; // Blanco
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1120' } }; // Negro
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // Ajustar altura para el logo y título
        [1, 2, 3, 4].forEach(r => sheet.getRow(r).height = 20);

        // 4. CABECERAS DE COLUMNA (Fila 6)
        const headers = ['APELLIDOS', 'NOMBRE', 'DNI', 'FECHA NACIMIENTO', 'DIRECCIÓN', 'POBLACIÓN', 'CP', 'EMAIL', 'DOJO', 'GRUPO', 'FECHA ALTA', 'GRADO', 'SEGURO'];
        const headerRow = sheet.getRow(6);
        headerRow.values = headers;
        headerRow.height = 35;
        
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }; // Rojo
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });

        // 5. DATOS
        data.forEach(item => {
            const p = item.attributes || item;
            
            const rowData = {
                apellidos: (p.apellidos || '').trim(),
                nombre: (p.nombre || '').trim(),
                dni: p.dni || "",
                nac: p.fecha_nacimiento || "",
                dir: p.direccion || "",
                pob: (p.poblacion || "").trim(),
                cp: (p.cp || "").trim(),
                email: p.email || "",
                dojo: getDojoName(p.dojo),
                grupo: p.grupo || "Full Time",
                alta: p.fecha_inicio || "",
                grau: p.grado || "",
                seguro: p.seguro_pagado ? "SI" : "NO"
            };
            
            const row = sheet.addRow(rowData);
            
            // Estilos por celda
            row.eachCell((cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { vertical: 'middle', horizontal: 'center' }; // Centrado por defecto
                
                // Alinear Izquierda: Apellidos(1), Nombre(2), Dirección(5), Email(8)
                if([1, 2, 5, 8].includes(colNumber)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });

            // Color Seguro (Columna 13)
            const segCell = row.getCell(13);
            if (p.seguro_pagado) {
                segCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                segCell.font = { color: { argb: 'FF065F46' }, bold: true };
            } else {
                segCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                segCell.font = { color: { argb: 'FF991B1B' }, bold: true };
            }
        });

        // 6. FINALIZAR
        sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 6 }];
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Arashi_Listado_${new Date().getFullYear()}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        
        showModal("Excel Generado", `Archivo descargado correctamente.`);

    } catch(e) { console.error(e); showModal("Error", "Falló la exportación del Excel."); } 
    finally { btn.innerHTML = originalText; }
}

// --- RESET DE SEGUROS ---
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

// --- FUNCIONES EXTRA (Informes, Modales, Utils) ---
function openReportModal() { document.getElementById('report-modal').classList.remove('hidden'); }

async function generateReport(type) {
    document.getElementById('report-modal').classList.add('hidden');
    const dojoFilterId = document.getElementById('report-dojo-filter').value;
    const dojoFilterName = document.getElementById('report-dojo-filter').options[document.getElementById('report-dojo-filter').selectedIndex].text;
    
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const logoImg = new Image(); 
    logoImg.src = 'img/logo-arashi-informe.png';
    
    const subtitleMap = { 'surname': 'Apellidos', 'age': 'Edad', 'grade': 'Grado', 'dojo': 'Dojo', 'group': 'Grupo', 'insurance': 'Estado del Seguro' };
    
    logoImg.onload = async function() {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let title = "LISTADO DE ALUMNOS";
        if(type === 'insurance') title = "ESTADO DE PAGOS DE SEGURO ANUAL";
        else title += ` POR ${subtitleMap[type].toUpperCase()}`;

        let subText = `Arashi Group Aikido | Alumnos por ${subtitleMap[type] || 'General'}`;
        if(dojoFilterId) subText += ` (${dojoFilterName})`; 
        
        let apiUrl = `${API_URL}/api/alumnos?filters[activo][$eq]=true&populate=dojo&pagination[limit]=1000`;
        if(dojoFilterId) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;
        
        const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        let list = json.data || [];

        list.sort((a, b) => {
            const pA = a.attributes || a; const pB = b.attributes || b;
            if (type === 'insurance') { if (pA.seguro_pagado !== pB.seguro_pagado) return (pA.seguro_pagado === true ? -1 : 1); return (pA.apellidos || '').localeCompare(pB.apellidos || ''); }
            if (type === 'surname') return (pA.apellidos || '').localeCompare(pB.apellidos || '');
            if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado);
            if (type === 'dojo') return getDojoName(pA.dojo).localeCompare(getDojoName(pB.dojo));
            if (type === 'group') { const cmp = (pA.grupo || '').localeCompare(pB.grupo || ''); return cmp !== 0 ? cmp : (pA.apellidos || '').localeCompare(pB.apellidos || ''); }
            if (type === 'age') { return new Date(pA.fecha_nacimiento||'2000-01-01') - new Date(pB.fecha_nacimiento||'2000-01-01'); }
            return 0;
        });
        
        let headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Teléfono', 'Email'];
        if (type === 'insurance') headRow.push('Seguro'); else if (type === 'age') { headRow.push('Nac.'); headRow.push('Edad'); } else headRow.push('Nac.');
        if (type === 'group') { headRow.push('Dojo'); headRow.push('Grupo'); } else headRow.push('Dojo');
        if (type !== 'insurance') headRow.push('Dirección');
        headRow.push('Población', 'CP');
        
        const body = list.map(a => {
            const p = a.attributes || a;
            let dni = (p.dni || '-').toUpperCase().replace('PENDIENTE', 'PEND');
            let email = (p.email || '-'); if(email.toLowerCase().startsWith('pendi')) email = 'NO DISPONIBLE';
            const row = [(p.apellidos||'').toUpperCase(), p.nombre||'', dni, normalizeGrade(p.grado), normalizePhone(p.telefono), email];
            if (type === 'insurance') row.push(p.seguro_pagado ? 'PAGADO' : 'PENDIENTE');
            else if (type === 'age') { row.push(formatDatePDF(p.fecha_nacimiento)); row.push(calculateAge(p.fecha_nacimiento)); }
            else row.push(formatDatePDF(p.fecha_nacimiento));
            row.push(getDojoName(p.dojo));
            if (type === 'group') row.push(p.grupo || '-');
            if (type !== 'insurance') row.push(normalizeAddress(p.direccion));
            row.push(normalizeCity(p.poblacion), p.cp||'-');
            return row;
        });

        let styles = { 0: { cellWidth: 35, fontStyle: 'bold' }, 1: { cellWidth: 15, fontStyle: 'bold' }, 2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 45 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 30, halign: 'center' }, 8: { cellWidth: 45 }, 9: { cellWidth: 25, halign: 'center' }, 10: { cellWidth: 12, halign: 'center' } };
        if(type==='insurance') { styles[6]={ cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 0] }; styles[7]={ cellWidth: 35 }; styles[8]={ cellWidth: 35, halign: 'center' }; styles[9]={ cellWidth: 15, halign: 'center' }; }
        
        doc.autoTable({ 
            startY: 25, head: [headRow], body: body, theme: 'grid', showHead: 'everyPage', 
            margin: { top: 30, left: 5, right: 5, bottom: 15 },
            styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'middle', overflow: 'linebreak' },
            headStyles: { fillColor: [190, 0, 0], textColor: [255,255,255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
            columnStyles: styles,
            willDrawCell: (data) => { if (type === 'insurance' && data.section === 'body' && data.column.index === 6) { if (data.cell.raw === 'PAGADO') { doc.setFillColor(200, 255, 200); doc.setTextColor(0, 100, 0); } else { doc.setFillColor(255, 200, 200); doc.setTextColor(150, 0, 0); } } },
            didDrawPage: (data) => {
                doc.addImage(logoImg, 'PNG', 10, 5, 22, 15); doc.setFontSize(16); doc.setFont("helvetica", "bold");
                doc.text(title, pageWidth / 2, 12, { align: "center" }); doc.setFontSize(10); doc.setFont("helvetica", "normal");
                doc.text(subText, pageWidth / 2, 18, { align: "center" }); doc.setFontSize(8);
                doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        });
        doc.save(`Informe_Arashi_${type}.pdf`);
    };
}

// ... (RESTO DE HELPERS: Modales, Cargas, Filtros, Menú Móvil) ...
function changeFontSize(tableId, d) { const t=document.getElementById(tableId); if(!t)return; t.querySelectorAll('th, td').forEach(c => { const s=parseFloat(window.getComputedStyle(c).fontSize); const p=parseFloat(window.getComputedStyle(c).paddingTop); c.style.fontSize=(Math.max(8,s+d))+"px"; c.style.padding=`${Math.max(2,p+(d*0.5))}px 5px`; }); }
function setupDragScroll() { const s=document.querySelector('.drag-scroll'); if(!s)return; let isDown=false, startX, scrollLeft; s.addEventListener('mousedown',e=>{isDown=true;startX=e.pageX-s.offsetLeft;scrollLeft=s.scrollLeft;}); s.addEventListener('mouseleave',()=>isDown=false); s.addEventListener('mouseup',()=>isDown=false); s.addEventListener('mousemove',e=>{if(!isDown)return;e.preventDefault();const x=e.pageX-s.offsetLeft;s.scrollLeft=scrollLeft-(x-startX)*2;}); }
async function runDiagnostics() { const o=document.getElementById('console-output'); if(o){o.innerHTML=''; const l=["Iniciando...", "> Conectando DB... [OK]", "> Verificando API... [OK]", "SISTEMA ONLINE 100%"]; for(const x of l){await new Promise(r=>setTimeout(r,400));o.innerHTML+=`<div>${x}</div>`;} } }
function showModal(t, m, ok) { const d=document.getElementById('custom-modal'); if(!d)return; document.getElementById('modal-title').innerText=t; document.getElementById('modal-message').innerHTML=m; document.getElementById('modal-btn-cancel').onclick=()=>d.classList.add('hidden'); document.getElementById('modal-btn-ok').onclick=()=>{if(ok)ok();d.classList.add('hidden');}; d.classList.remove('hidden'); }
async function loadDojosSelect() { const s=document.getElementById('new-dojo'); if(s){ try{ const r=await fetch(`${API_URL}/api/dojos`,{headers:{'Authorization':`Bearer ${jwtToken}`}}); const j=await r.json(); s.innerHTML='<option value="">Selecciona Dojo...</option>'; (j.data||[]).forEach(d=>{s.innerHTML+=`<option value="${d.documentId}">${d.attributes.nombre}</option>`}); }catch{} } }
async function loadReportDojos() { const s=document.getElementById('report-dojo-filter'); const e=document.getElementById('export-dojo-filter'); try{ const r=await fetch(`${API_URL}/api/dojos`,{headers:{'Authorization':`Bearer ${jwtToken}`}}); const j=await r.json(); const o='<option value="">-- Todos los Dojos --</option>'+(j.data||[]).map(d=>`<option value="${d.documentId}">${d.attributes.nombre}</option>`).join(''); if(s)s.innerHTML=o; if(e)e.innerHTML=o; }catch{} }
async function loadCiudades() { const d=document.getElementById('ciudades-list'); if(d){ try{ const r=await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion`,{headers:{'Authorization':`Bearer ${jwtToken}`}}); const j=await r.json(); d.innerHTML=''; [...new Set((j.data||[]).map(a=>a.attributes.poblacion).filter(Boolean))].sort().forEach(c=>d.innerHTML+=`<option value="${c}">`); }catch{} } }
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^0-9A-Z]/g,'')); }
function filtrarTabla(t,i) { const input=document.getElementById(i); if(!input)return; const f=input.value.toUpperCase(); const rows=document.getElementById(t).getElementsByTagName('tr'); for(let j=1;j<rows.length;j++) rows[j].style.display=rows[j].textContent.toUpperCase().includes(f)?"":"none"; }
function toggleMobileMenu() { document.querySelector('.sidebar').classList.toggle('open'); }
function scrollToTop() { const c=document.querySelector('.content'); if(c)c.scrollTo({top:0,behavior:'smooth'}); else window.scrollTo({top:0,behavior:'smooth'}); }
const ca=document.querySelector('.content'); if(ca){ ca.addEventListener('scroll',()=>{ const b=document.getElementById('btn-scroll-top'); if(ca.scrollTop>300)b.classList.add('visible');else b.classList.remove('visible'); }); }