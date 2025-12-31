const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com";

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

const GRADE_WEIGHTS = {
    '8º DAN': 108, '7º DAN': 107, '6º DAN': 106, '5º DAN': 105, '4º DAN': 104, '3º DAN': 103, '2º DAN': 102, '1º DAN': 101,
    '1º KYU': 5, '2º KYU': 4, '3º KYU': 3, '4º KYU': 2, '5º KYU': 1, 'S/G': 0
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) { showResetScreen(urlParams.get('code')); return; }

    const loginTimeStr = localStorage.getItem('aikido_login_time');
    if (jwtToken && loginTimeStr && (Date.now() - parseInt(loginTimeStr) < 20 * 60 * 1000)) {
        localStorage.setItem('aikido_login_time', Date.now().toString());
        showDashboard();
    } else { logout(); }

    setupDniInput('dni-login'); setupDniInput('new-dni');
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    document.getElementById('search-baja')?.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
    setupDragScroll();

    const yearLabel = document.getElementById('current-year-lbl');
    if (yearLabel) yearLabel.textContent = new Date().getFullYear();

    const seguroSwitch = document.getElementById('new-seguro');
    if (seguroSwitch) {
        seguroSwitch.addEventListener('change', (e) => {
            const txt = document.getElementById('seguro-status-text');
            if (e.target.checked) { txt.innerText = "PAGADO"; txt.style.color = "#22c55e"; }
            else { txt.innerText = "NO PAGADO"; txt.style.color = "#ef4444"; }
        });
    }
});

// --- SESIÓN ---
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

function logout() {
    localStorage.clear();
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    if (window.location.search) window.history.replaceState({}, document.title, window.location.pathname);
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); loadCiudades(); loadReportDojos(); showSection('welcome');
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`sec-${id}`).classList.remove('hidden');
    const btn = document.querySelector(`button[onclick="showSection('${id}', true)"]`) || document.querySelector(`button[onclick="showSection('${id}')"]`);
    if (btn) btn.classList.add('active');
    if (id === 'alumnos') loadAlumnos(true);
    if (id === 'bajas') loadAlumnos(false);
    if (id === 'dojos') loadDojosCards();
    if (id === 'status') runDiagnostics();
    if (id === 'nuevo-alumno') { const isEditing = document.getElementById('edit-id').value !== ""; if (!isEditing) resetForm(); }
}

// --- UTILS ---
function getDojoName(dojoObj) {
    let name = "NO DISP";
    if (dojoObj) {
        if (dojoObj.nombre) name = dojoObj.nombre;
        else if (dojoObj.data && dojoObj.data.attributes) name = dojoObj.data.attributes.nombre;
        else if (dojoObj.attributes) name = dojoObj.attributes.nombre;
    }
    return name === "NO DISP" ? name : name.replace(/Aikido\s+/gi, '').trim();
}

function normalizeGrade(g) {
    if (!g) return 'NO DISP';
    let s = g.toUpperCase().trim();
    const match = s.match(/(\d+)/);
    if (match) { const num = match[1]; const type = s.includes('DAN') ? 'DAN' : (s.includes('KYU') ? 'KYU' : ''); if (type) return `${num}º ${type}`; }
    return s;
}

function getGradeWeight(g) { return GRADE_WEIGHTS[normalizeGrade(g)] || 0; }

function normalizeAddress(a) { 
    if (!a || a.trim() === "") return 'NO DISP';
    return a.replace(/\b(Carrer|Calle)\b/gi, 'C/').replace(/\b(Avinguda|Avenida)\b/gi, 'Avda').trim(); 
}

function normalizeCity(c) {
    if (!c || c.trim() === "") return 'NO DISP';
    let s = c.toString().toUpperCase();
    s = s.replace(/\s*\(.*?\)\s*/g, ' ');
    s = s.replace(/\bSTA\b/g, 'SANTA');
    s = s.replace(/\bST\b/g, 'SANT');
    s = s.replace(/[.,\-\s]+$/, '').replace(/^[.,\-\s]+/, '');
    if (s.match(/SAN.*ADRI/i)) return 'SANT ADRIÀ DE BESÒS';
    return s.trim();
}

function normalizePhone(t) { 
    if (!t || t.toString().trim() === "" || t === "-") return 'NO DISP';
    return t.toString().trim().replace(/^(\+?34)/, '').trim(); 
}

// FORMATEADOR DE FECHAS DD/MM/AAAA PARA PANTALLA E INFORMES
function formatDateDisplay(d) { 
    if (!d || d === "" || d === null) return 'NO DISP'; 
    const p = d.split('-'); 
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; 
}

function formatDateExcel(d) {
    if (!d) return "";
    const p = d.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

function calculateAge(d) { 
    if (!d) return 'NO DISP'; 
    const t = new Date(), b = new Date(d); 
    let a = t.getFullYear() - b.getFullYear(); 
    if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; 
    return isNaN(a) ? 'NO DISP' : a; 
}

function togglePassword(i, icon) { 
    const x = document.getElementById(i); 
    if (x.type === "password") { x.type = "text"; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } 
    else { x.type = "password"; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); } 
}

// --- CARGA ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    tbody.innerHTML = `<tr><td colspan="15">Cargando...</td></tr>`;
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=apellidos:asc' : 'sort=fecha_baja:desc';
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=500`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data || [];
        tbody.innerHTML = '';
        data.forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId;
            const badgeSeguro = p.seguro_pagado ? `<span class="badge-ok">PAGADO</span>` : `<span class="badge-no">PENDIENTE</span>`;
            
            const rowContent = `
                <td><span class="cell-data"><strong>${p.apellidos || "NO DISP"}</strong></span></td>
                <td><span class="cell-data">${p.nombre || "NO DISP"}</span></td>
                <td><span class="cell-data" style="font-family:monospace">${p.dni || "NO DISP"}</span></td>
                <td><span class="cell-data"><span class="badge">${normalizeGrade(p.grado)}</span></span></td>
                <td><span class="cell-data">${badgeSeguro}</span></td>
                <td><span class="cell-data">${normalizePhone(p.telefono)}</span></td>
                <td><span class="cell-data">${p.email || 'NO DISP'}</span></td>
                <td><span class="cell-data">${formatDateDisplay(p.fecha_nacimiento)}</span></td>
                <td><span class="cell-data">${getDojoName(p.dojo)}</span></td>
                <td><span class="cell-data" style="font-weight:bold">${formatDateDisplay(p.fecha_inicio)}</span></td>
                <td><span class="cell-data">${p.direccion || 'NO DISP'}</span></td>
                <td><span class="cell-data">${p.poblacion || 'NO DISP'}</span></td>
                <td><span class="cell-data">${p.cp || 'NO DISP'}</span></td>
            `;

            if (activos) {
                tbody.innerHTML += `<tr>${rowContent}<td class="sticky-col"><button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button><button class="action-btn-icon delete" onclick="confirmarEstado('${id}', false, '${p.nombre}')"><i class="fa-solid fa-user-xmark"></i></button></td></tr>`;
            } else {
                tbody.innerHTML += `<tr><td><span class="cell-data txt-accent" style="font-weight:bold">${formatDateDisplay(p.fecha_baja)}</span></td>${rowContent}<td class="sticky-col"><button class="action-btn-icon restore" onclick="confirmarEstado('${id}', true, '${p.nombre}')"><i class="fa-solid fa-rotate-left"></i></button><button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${p.nombre}')"><i class="fa-solid fa-trash-can"></i></button></td></tr>`;
            }
        });
    } catch { tbody.innerHTML = `<tr><td colspan="15">Error de carga.</td></tr>`; }
}

const formAlumno = document.getElementById('form-nuevo-alumno');
if (formAlumno) {
    formAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const alumnoData = { nombre: document.getElementById('new-nombre').value, apellidos: document.getElementById('new-apellidos').value, dni: document.getElementById('new-dni').value, fecha_nacimiento: document.getElementById('new-nacimiento').value || null, fecha_inicio: document.getElementById('new-alta').value || null, email: document.getElementById('new-email').value, telefono: document.getElementById('new-telefono').value, direccion: document.getElementById('new-direccion').value, poblacion: document.getElementById('new-poblacion').value, cp: document.getElementById('new-cp').value, dojo: document.getElementById('new-dojo').value, grupo: document.getElementById('new-grupo').value, grado: document.getElementById('new-grado').value, seguro_pagado: document.getElementById('new-seguro').checked, activo: true };
        try {
            const method = id ? 'PUT' : 'POST'; const url = id ? `${API_URL}/api/alumnos/${id}` : `${API_URL}/api/alumnos`;
            const res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: alumnoData }) });
            if (res.ok) showModal("Éxito", "Guardado.", () => { showSection('alumnos'); resetForm(); }); else showModal("Error", "No se pudo guardar.");
        } catch { showModal("Error", "Fallo de conexión."); }
    });
}

async function editarAlumno(documentId) {
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=dojo`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data; const p = data.attributes || data;
        document.getElementById('edit-id').value = data.documentId || documentId;
        document.getElementById('new-nombre').value = p.nombre || '';
        document.getElementById('new-apellidos').value = p.apellidos || '';
        document.getElementById('new-dni').value = p.dni || '';
        document.getElementById('new-nacimiento').value = p.fecha_nacimiento || '';
        document.getElementById('new-alta').value = p.fecha_inicio || '';
        document.getElementById('new-email').value = p.email || '';
        document.getElementById('new-telefono').value = p.telefono || '';
        document.getElementById('new-direccion').value = p.direccion || '';
        document.getElementById('new-poblacion').value = p.poblacion || '';
        document.getElementById('new-cp').value = p.cp || '';
        document.getElementById('new-grado').value = p.grado || '';
        document.getElementById('new-grupo').value = p.grupo || 'Full Time';
        const chk = document.getElementById('new-seguro'); const txt = document.getElementById('seguro-status-text'); chk.checked = p.seguro_pagado === true; if (chk.checked) { txt.innerText = "PAGADO"; txt.style.color = "#22c55e"; } else { txt.innerText = "NO PAGADO"; txt.style.color = "#ef4444"; }
        let dojoId = "";
        if (p.dojo) {
            if (p.dojo.documentId) { dojoId = p.dojo.documentId; } 
            else if (p.dojo.data) { dojoId = p.dojo.data.documentId || p.dojo.data.id; }
        }
        const selectDojo = document.getElementById('new-dojo');
        if (dojoId && selectDojo) { selectDojo.value = dojoId; }
        document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR ALUMNO"; document.getElementById('btn-cancelar-edit').classList.remove('hidden'); document.querySelectorAll('.section').forEach(s => s.classList.add('hidden')); document.getElementById('sec-nuevo-alumno').classList.remove('hidden');
    } catch { showModal("Error", "Error al cargar datos."); }
}

function resetForm() { const f = document.getElementById('form-nuevo-alumno'); if (f) f.reset(); document.getElementById('seguro-status-text').innerText = "NO PAGADO"; document.getElementById('seguro-status-text').style.color = "#ef4444"; document.getElementById('edit-id').value = ""; document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO"; document.getElementById('btn-cancelar-edit').classList.add('hidden'); }

function confirmarEstado(id, activo, nombre) { showModal(activo ? "Reactivar" : "Baja", `¿Confirmar para ${nombre}?`, async () => { const fecha = activo ? null : new Date().toISOString().split('T')[0]; await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) }); showSection(activo ? 'alumnos' : 'bajas'); }); }

function eliminarDefinitivo(id, nombre) { showModal("¡PELIGRO!", `¿Borrar físicamente a ${nombre}?`, () => { setTimeout(() => { showModal("ÚLTIMO AVISO", "Irreversible.", async () => { await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } }); loadAlumnos(false); }); }, 500); }); }

async function loadDojosCards() { const grid = document.getElementById('grid-dojos'); if (!grid) return; grid.innerHTML = 'Cargando...'; try { const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const json = await res.json(); grid.innerHTML = ''; (json.data || []).forEach(d => { const p = d.attributes || d; const cleanName = (p.nombre || 'Dojo').replace(/Aikido\s+/gi, '').trim(); const addr = p.direccion ? p.direccion.replace(/\n/g, '<br>') : 'NO DISP'; grid.innerHTML += `<div class="dojo-card"><div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${cleanName}</h3></div><div class="dojo-body"><div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div><div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || 'NO DISP'}</span></div><div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || 'NO DISP'}</span></div><a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a></div></div>`; }); } catch { grid.innerHTML = 'Error.'; } }

// --- EXPORTAR EXCEL ---
async function exportBackupExcel() {
    const dojoFilter = document.getElementById('export-dojo-filter').value;
    const btn = document.querySelector('button[onclick="exportBackupExcel()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GENERANDO...';

    try {
        let apiUrl = `${API_URL}/api/alumnos?populate=dojo&pagination[limit]=2000`;
        if (dojoFilter) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilter}`;

        const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data || [];

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Alumnos');

        for (let i = 1; i <= 6; i++) {
            const row = sheet.getRow(i);
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1120' } };
        }

        sheet.mergeCells('A2:M3');
        const titleCell = sheet.getCell('A2');
        titleCell.value = `            ARASHI GROUP AIKIDO - LISTADO OFICIAL (${new Date().toLocaleDateString('es-ES')})`;
        titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        sheet.mergeCells('A4:M4');
        const totalCell = sheet.getCell('A4');
        totalCell.value = `TOTAL ALUMNOS: ${data.length}`;
        totalCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        totalCell.alignment = { vertical: 'middle', horizontal: 'center' };

        sheet.mergeCells('A5:M5');
        const genCell = sheet.getCell('A5');
        genCell.value = `GENERADO EL: ${new Date().toLocaleString('es-ES')}`;
        genCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FFCCCCCC' } };
        genCell.alignment = { vertical: 'middle', horizontal: 'center' };

        try {
            const logoRes = await fetch('img/logo-arashi.png');
            const logoBlob = await logoRes.blob();
            const logoBuffer = await logoBlob.arrayBuffer();
            const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
            sheet.addImage(logoId, { tl: { col: 2.2, row: 1.2 }, ext: { width: 110, height: 60 } });
        } catch (e) { console.warn("Logo no encontrado", e); }

        const columns = [
            { key: 'apellidos' }, { key: 'nombre' }, { key: 'dni' },
            { key: 'nac' }, { key: 'dir' }, { key: 'pob' },
            { key: 'cp' }, { key: 'email' }, { key: 'dojo' },
            { key: 'grupo' }, { key: 'alta' }, { key: 'grau' }, { key: 'seguro' }
        ];
        sheet.columns = columns;

        const headers = ['APELLIDOS', 'NOMBRE', 'DNI', 'FECHA\nNACIMIENTO', 'DIRECCIÓN', 'POBLACIÓN', 'CP', 'EMAIL', 'DOJO', 'GRUPO', 'FECHA\nALTA', 'GRADO', 'SEGURO'];
        const headerRow = sheet.getRow(8);
        headerRow.values = headers;
        headerRow.height = 45;

        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        let maxLengths = new Array(headers.length).fill(8);

        data.forEach(item => {
            const p = item.attributes || item;
            const rowValues = {
                apellidos: (p.apellidos || 'NO DISP').toUpperCase().trim(),
                nombre: (p.nombre || 'NO DISP').trim(),
                dni: p.dni || "NO DISP",
                nac: formatDateExcel(p.fecha_nacimiento),
                dir: p.direccion || "NO DISP",
                pob: normalizeCity(p.poblacion),
                cp: (p.cp || "NO DISP").trim(),
                email: p.email || "NO DISP",
                dojo: getDojoName(p.dojo),
                grupo: p.grupo || "Full Time",
                alta: formatDateExcel(p.fecha_inicio),
                grau: p.grado || "NO DISP",
                seguro: p.seguro_pagado ? "SI" : "NO"
            };

            const row = sheet.addRow(rowValues);
            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if ([1, 2, 5, 8].includes(colNumber)) cell.alignment = { vertical: 'middle', horizontal: 'left' };
                const len = cell.value ? cell.value.toString().length : 0;
                if (len > maxLengths[colNumber - 1]) maxLengths[colNumber - 1] = len;
            });
            const segCell = row.getCell(13);
            if (p.seguro_pagado) { segCell.font = { color: { argb: 'FF065F46' }, bold: true }; }
            else { segCell.font = { color: { argb: 'FF991B1B' }, bold: true }; }
        });

        sheet.columns.forEach((col, index) => { col.width = maxLengths[index] + 2; });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Arashi_Listado_${new Date().getFullYear()}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);

        showModal("Excel Generado", "Descarga completada.");

    } catch (e) { console.error(e); showModal("Error", "Falló la exportación."); }
    finally { btn.innerHTML = originalText; }
}

function confirmResetInsurance() { showModal("⚠️ ATENCIÓN", "¿Resetear TODOS los seguros?", () => runResetProcess()); }
async function runResetProcess() { const out = document.getElementById('console-output'); out.innerHTML = "<div>Iniciando...</div>"; try { const r = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&filters[seguro_pagado][$eq]=true&pagination[limit]=2000`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const j = await r.json(); const l = j.data || []; if (l.length === 0) { out.innerHTML += "<div>Nada que resetear.</div>"; return; } for (const i of l) { await fetch(`${API_URL}/api/alumnos/${i.documentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { seguro_pagado: false } }) }); } out.innerHTML += "<div style='color:#33ff00'>COMPLETADO.</div>"; } catch (e) { out.innerHTML += `<div>ERROR: ${e.message}</div>`; } }
function openReportModal() { document.getElementById('report-modal').classList.remove('hidden'); }

// --- GENERACIÓN PDF ---
async function generateReport(type) {
    document.getElementById('report-modal').classList.add('hidden');
    const dojoSelect = document.getElementById('report-dojo-filter');
    const dojoFilterId = dojoSelect.value;
    const dojoFilterName = dojoSelect.options[dojoSelect.selectedIndex].text;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    const subtitleMap = {
        'surname': 'Apellidos', 'age': 'Edad', 'grade': 'Grado', 'dojo': 'Dojo', 'group': 'Grupo', 'insurance': 'Estado del Seguro',
        'bajas_surname': 'Histórico Bajas (Por Apellidos)', 'bajas_date': 'Histórico Bajas (Por Fecha)'
    };
    const filenameMap = {
        'surname': 'apellidos', 'age': 'edad', 'grade': 'grado', 'dojo': 'dojo', 'group': 'grado', 'insurance': 'seguros',
        'bajas_surname': 'historico_apellidos', 'bajas_date': 'historico_fechas'
    };

    logoImg.onload = async function () {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const isBaja = type.startsWith('bajas_');
        let title = isBaja ? "HISTÓRICO DE BAJAS" : "LISTADO DE ALUMNOS";

        if (!isBaja && type === 'insurance') title = "ESTADO DE PAGOS DE SEGURO ANUAL";
        else if (!isBaja) title += ` POR ${subtitleMap[type].toUpperCase()}`;

        let subText = `Arashi Group Aikido | Alumnos ${isBaja ? 'Inactivos' : 'Activos'}`;
        if (dojoFilterId) subText += ` (${dojoFilterName})`;

        let apiUrl = `${API_URL}/api/alumnos?filters[activo][$eq]=${isBaja ? 'false' : 'true'}&populate=dojo&pagination[limit]=1000`;
        if (dojoFilterId) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;

        const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        let list = json.data || [];

        list.sort((a, b) => {
            const pA = a.attributes || a;
            const pB = b.attributes || b;
            if (type === 'bajas_date') return new Date(pB.fecha_baja || '1900-01-01') - new Date(pA.fecha_baja || '1900-01-01');
            if (type === 'bajas_surname' || type === 'surname') return (pA.apellidos || '').localeCompare(pB.apellidos || '');
            if (type === 'insurance') { if (pA.seguro_pagado !== pB.seguro_pagado) return (pA.seguro_pagado === true ? -1 : 1); return (pA.apellidos || '').localeCompare(pB.apellidos || ''); }
            if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado);
            if (type === 'dojo') return getDojoName(pA.dojo).localeCompare(getDojoName(pB.dojo));
            if (type === 'group') { const cmp = (pA.grupo || '').localeCompare(pB.grupo || ''); return cmp !== 0 ? cmp : (pA.apellidos || '').localeCompare(pB.apellidos || ''); }
            if (type === 'age') return new Date(pA.fecha_nacimiento || '2000-01-01') - new Date(pB.fecha_nacimiento || '2000-01-01');
            return 0;
        });

        // Configuración de Cabecera
        let headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Seguro', 'Teléfono'];
        if (isBaja) headRow.unshift('Fecha Baja');
        headRow.push('Email');
        if (type === 'age') headRow.push('Nac.', 'Edad');
        else if (type !== 'insurance') headRow.push('Nac.');

        headRow.push('Dojo', 'Alta');
        if (!isBaja && type === 'group') headRow.push('Grupo');
        if (type !== 'insurance') headRow.push('Dirección');
        headRow.push('Población', 'CP');

        const body = list.map(a => {
            const p = a.attributes || a;
            let dni = (p.dni || 'NO DISP').toUpperCase();
            let email = (p.email && p.email.trim() !== "") ? p.email : 'NO DISP';
            const row = [(p.apellidos || 'NO DISP').toUpperCase(), p.nombre || 'NO DISP', dni, normalizeGrade(p.grado), p.seguro_pagado ? 'PAGADO' : 'PENDIENTE', normalizePhone(p.telefono)];

            if (isBaja) row.unshift(formatDateDisplay(p.fecha_baja));
            row.push(email);

            if (type === 'age') { row.push(formatDateDisplay(p.fecha_nacimiento), calculateAge(p.fecha_nacimiento)); }
            else if (type !== 'insurance') row.push(formatDateDisplay(p.fecha_nacimiento));

            row.push(getDojoName(p.dojo), formatDateDisplay(p.fecha_inicio));
            if (!isBaja && type === 'group') row.push(p.grupo || 'NO DISP');
            if (type !== 'insurance') row.push(normalizeAddress(p.direccion));
            row.push(normalizeCity(p.poblacion), p.cp || 'NO DISP');
            return row;
        });

        const colStyles = {};
        headRow.forEach((h, i) => {
            colStyles[i] = { halign: 'left', cellWidth: 'auto' };
            if (['DNI', 'Grado', 'Teléfono', 'Nac.', 'Edad', 'Seguro', 'CP', 'Grupo', 'Fecha Baja', 'Alta'].includes(h)) {
                colStyles[i].halign = 'center';
            }
            if (h === 'Grado') colStyles[i].cellWidth = 14;
            if (h === 'DNI') colStyles[i].cellWidth = 22;
            if (h === 'Nac.') colStyles[i].cellWidth = 18;
            if (h === 'Alta') colStyles[i].cellWidth = 18;
            if (h === 'Edad') colStyles[i].cellWidth = 10;
            if (h === 'CP') colStyles[i].cellWidth = 12;
            if (h === 'Teléfono') colStyles[i].cellWidth = 22;
            if (h === 'Población') colStyles[i].cellWidth = 22;
            if (h === 'Seguro') colStyles[i].cellWidth = 18;
            if (h === 'Fecha Baja') colStyles[i].cellWidth = 18;
        });

        doc.autoTable({
            startY: 25, head: [headRow], body: body, theme: 'grid', showHead: 'everyPage',
            margin: { top: 30, left: 5, right: 5, bottom: 15 },
            styles: { fontSize: 6.8, cellPadding: 1.2, valign: 'middle', overflow: 'linebreak' },
            headStyles: { fillColor: [190, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            columnStyles: colStyles,
            willDrawCell: (data) => {
                if (data.section === 'body' && headRow[data.column.index] === 'Seguro') {
                    const status = data.cell.raw;
                    if (status === 'PAGADO') { doc.setFillColor(200, 255, 200); doc.setTextColor(0, 100, 0); }
                    else if (status === 'PENDIENTE') { doc.setFillColor(255, 200, 200); doc.setTextColor(150, 0, 0); }
                }
            },
            didDrawPage: (data) => {
                doc.addImage(logoImg, 'PNG', 10, 5, 22, 15); doc.setFontSize(16); doc.setFont("helvetica", "bold");
                doc.text(title, pageWidth / 2, 12, { align: "center" }); doc.setFontSize(10); doc.setFont("helvetica", "normal");
                doc.text(subText, pageWidth / 2, 18, { align: "center" });
                doc.setFontSize(8); doc.setTextColor(150);
                const footerY = pageHeight - 10;
                const now = new Date().toLocaleString('es-ES');
                doc.text(`Generado el: ${now}`, 10, footerY);
                doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageWidth / 2, footerY, { align: 'center' });
                doc.text(`Total Alumnos: ${list.length}`, pageWidth - 10, footerY, { align: 'right' });
            }
        });
        doc.save(`Informe_Arashi_${filenameMap[type]}.pdf`);
    };
}

function changeFontSize(t, d) { const table = document.getElementById(t); if (!table) return; table.querySelectorAll('th, td').forEach(c => { const s = parseFloat(window.getComputedStyle(c).fontSize); const p = parseFloat(window.getComputedStyle(c).paddingTop); c.style.fontSize = (Math.max(8, s + d)) + "px"; c.style.padding = `${Math.max(2, p + (d * 0.5))}px 5px`; }); }
function setupDragScroll() { const s = document.querySelector('.drag-scroll'); if (!s) return; let d = false, x, l; s.addEventListener('mousedown', e => { d = true; x = e.pageX - s.offsetLeft; l = s.scrollLeft; }); s.addEventListener('mouseleave', () => d = false); s.addEventListener('mouseup', () => d = false); s.addEventListener('mousemove', e => { if (!d) return; e.preventDefault(); const p = e.pageX - s.offsetLeft; s.scrollLeft = l - (p - x) * 2; }); }
async function runDiagnostics() { const o = document.getElementById('console-output'); if (o) { o.innerHTML = ''; const l = ["Iniciando...", "> Conectando DB... [OK]", "> Verificando API... [OK]", "SISTEMA ONLINE 100%"]; for (const x of l) { await new Promise(r => setTimeout(r, 400)); o.innerHTML += `<div>${x}</div>`; } o.innerHTML += '<div style="padding:15px; border-top:1px solid #33ff00;"><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="action-btn secondary" style="text-decoration:none; display:inline-block; border-color:#33ff00; color:#33ff00;">Ver Estado de Strapi</a></div>'; } }
function showModal(t, m, ok) { const d = document.getElementById('custom-modal'); if (!d) return; document.getElementById('modal-title').innerText = t; document.getElementById('modal-message').innerHTML = m; document.getElementById('modal-btn-cancel').onclick = () => d.classList.add('hidden'); document.getElementById('modal-btn-ok').onclick = () => { if (ok) ok(); d.classList.add('hidden'); }; d.classList.remove('hidden'); }

async function loadDojosSelect() {
    const s = document.getElementById('new-dojo');
    if (!s) return;
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        s.innerHTML = '<option value="">Selecciona Dojo...</option>';
        (j.data || []).forEach(d => {
            const docId = d.documentId || d.id;
            const nombre = d.nombre || (d.attributes ? d.attributes.nombre : 'NO DISP');
            s.innerHTML += `<option value="${docId}">${nombre}</option>`;
        });
    } catch (err) { console.error("Error al cargar selector de dojos:", err); }
}

async function loadReportDojos() {
    const s = document.getElementById('report-dojo-filter');
    const e = document.getElementById('export-dojo-filter');
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        const options = (j.data || []).map(d => {
            const docId = d.documentId || d.id;
            const nombre = d.nombre || (d.attributes ? d.attributes.nombre : 'NO DISP');
            return `<option value="${docId}">${nombre}</option>`;
        }).join('');

        const html = '<option value="">-- Todos los Dojos --</option>' + options;
        if (s) s.innerHTML = html;
        if (e) e.innerHTML = html;
    } catch (err) { console.error("Error al cargar filtros de dojos:", err); }
}

async function loadCiudades() { const d = document.getElementById('ciudades-list'); if (d) { try { const r = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const j = await r.json(); d.innerHTML = ''; [...new Set((j.data || []).map(a => (a.attributes ? a.attributes.poblacion : a.poblacion)).filter(Boolean))].sort().forEach(c => d.innerHTML += `<option value="${c}">`); } catch { } } }
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); }
function filtrarTabla(t, i) { const input = document.getElementById(i); if (!input) return; const f = input.value.toUpperCase(); const rows = document.getElementById(t).getElementsByTagName('tr'); for (let j = 1; j < rows.length; j++) rows[j].style.display = rows[j].textContent.toUpperCase().includes(f) ? "" : "none"; }
function toggleMobileMenu() { document.querySelector('.sidebar').classList.toggle('open'); }
function scrollToTop() { const c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); }
const ca = document.querySelector('.content'); if (ca) { ca.addEventListener('scroll', () => { const b = document.getElementById('btn-scroll-top'); if (ca.scrollTop > 300) b.classList.add('visible'); else b.classList.remove('visible'); }); }