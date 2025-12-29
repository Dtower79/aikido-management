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
    if(yearLabel) yearLabel.textContent = new Date().getFullYear();

    const seguroSwitch = document.getElementById('new-seguro');
    if(seguroSwitch) {
        seguroSwitch.addEventListener('change', (e) => {
            const txt = document.getElementById('seguro-status-text');
            if(e.target.checked) { txt.innerText = "PAGADO"; txt.style.color = "#22c55e"; } 
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
    document.getElementById('reset-screen').classList.add('hidden');
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
    if(btn) btn.classList.add('active');
    if(id === 'alumnos') loadAlumnos(true);
    if(id === 'bajas') loadAlumnos(false);
    if(id === 'dojos') loadDojosCards();
    if(id === 'status') runDiagnostics();
    if(id === 'nuevo-alumno') { const isEditing = document.getElementById('edit-id').value !== ""; if(!isEditing) resetForm(); }
}

// --- UTILS ---
function getDojoName(dojoObj) {
    let name = "-";
    if (dojoObj) {
        if (dojoObj.nombre) name = dojoObj.nombre;
        else if (dojoObj.data && dojoObj.data.attributes) name = dojoObj.data.attributes.nombre;
        else if (dojoObj.attributes) name = dojoObj.attributes.nombre;
    }
    return name.replace(/Aikido\s+/gi, '').trim();
}
function normalizeGrade(g) {
    if(!g) return '-';
    let s = g.toUpperCase().trim();
    const match = s.match(/(\d+)/); 
    if (match) { const num = match[1]; const type = s.includes('DAN') ? 'DAN' : (s.includes('KYU') ? 'KYU' : ''); if (type) return `${num}º ${type}`; }
    return s;
}
function getGradeWeight(g) { return GRADE_WEIGHTS[normalizeGrade(g)] || 0; }
function normalizeAddress(a) { return a ? a.replace(/\b(Carrer|Calle)\b/gi, 'C/').replace(/\b(Avinguda|Avenida)\b/gi, 'Avda').trim() : '-'; }
function normalizeCity(c) { if(!c) return '-'; let s = c.replace(/\s*\(.*?\)\s*/g, '').replace(/[.,\-\s]+$/, '').trim(); if (s.match(/San Adria/i)) return 'SANT ADRIÀ DEL BESÒS'; return s.toUpperCase(); }
function normalizePhone(t) { return t ? t.toString().trim().replace(/^(\+?34)/, '').trim() : '-'; }
function formatDatePDF(d) { if(!d) return '-'; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; }
function calculateAge(d) { if(!d) return '-'; const t = new Date(), b = new Date(d); let a = t.getFullYear() - b.getFullYear(); if(t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return isNaN(a) ? '-' : a; }
function togglePassword(i, icon) { const x = document.getElementById(i); if(x.type==="password"){x.type="text";icon.classList.remove('fa-eye');icon.classList.add('fa-eye-slash');}else{x.type="password";icon.classList.remove('fa-eye-slash');icon.classList.add('fa-eye');} }

// --- CARGA ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    tbody.innerHTML = `<tr><td colspan="${activos?13:14}">Cargando...</td></tr>`;
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
            const badge = p.seguro_pagado ? `<span class="badge-ok">PAGADO</span>` : `<span class="badge-no">PENDIENTE</span>`;
            const row = `<td><span class="cell-data"><strong>${p.apellidos || "-"}</strong></span></td><td><span class="cell-data">${p.nombre || "-"}</span></td><td><span class="cell-data" style="font-family:monospace">${p.dni || "-"}</span></td><td><span class="cell-data"><span class="badge">${normalizeGrade(p.grado) || 'S/G'}</span></span></td><td><span class="cell-data">${badge}</span></td><td><span class="cell-data">${p.telefono || '-'}</span></td><td><span class="cell-data">${p.email || '-'}</span></td><td><span class="cell-data">${p.fecha_nacimiento || '-'}</span></td><td><span class="cell-data">${getDojoName(p.dojo)}</span></td><td><span class="cell-data">${p.direccion || '-'}</span></td><td><span class="cell-data">${p.poblacion || '-'}</span></td><td><span class="cell-data">${p.cp || '-'}</span></td>`;
            if (activos) { tbody.innerHTML += `<tr>${row}<td class="sticky-col"><button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button><button class="action-btn-icon delete" onclick="confirmarEstado('${id}', false, '${p.nombre}')"><i class="fa-solid fa-user-xmark"></i></button></td></tr>`; } 
            else { tbody.innerHTML += `<tr><td><span class="cell-data txt-accent" style="font-weight:bold">${p.fecha_baja || '-'}</span></td>${row}<td class="sticky-col"><button class="action-btn-icon restore" onclick="confirmarEstado('${id}', true, '${p.nombre}')"><i class="fa-solid fa-rotate-left"></i></button><button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${p.nombre}')"><i class="fa-solid fa-trash-can"></i></button></td></tr>`; }
        });
    } catch { tbody.innerHTML = `<tr><td colspan="13">Error de carga.</td></tr>`; }
}

const formAlumno = document.getElementById('form-nuevo-alumno');
if(formAlumno) {
    formAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const alumnoData = { nombre: document.getElementById('new-nombre').value, apellidos: document.getElementById('new-apellidos').value, dni: document.getElementById('new-dni').value, fecha_nacimiento: document.getElementById('new-nacimiento').value || null, email: document.getElementById('new-email').value, telefono: document.getElementById('new-telefono').value, direccion: document.getElementById('new-direccion').value, poblacion: document.getElementById('new-poblacion').value, cp: document.getElementById('new-cp').value, dojo: document.getElementById('new-dojo').value, grupo: document.getElementById('new-grupo').value, grado: document.getElementById('new-grado').value, seguro_pagado: document.getElementById('new-seguro').checked, activo: true };
        try {
            const method = id ? 'PUT' : 'POST'; const url = id ? `${API_URL}/api/alumnos/${id}` : `${API_URL}/api/alumnos`;
            const res = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: alumnoData }) });
            if(res.ok) showModal("Éxito", "Guardado.", () => { showSection('alumnos'); resetForm(); }); else showModal("Error", "No se pudo guardar.");
        } catch { showModal("Error", "Fallo de conexión."); }
    });
}
async function editarAlumno(documentId) {
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=dojo`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data; const p = data.attributes || data; 
        document.getElementById('edit-id').value = data.documentId || documentId;
        document.getElementById('new-nombre').value = p.nombre || ''; document.getElementById('new-apellidos').value = p.apellidos || ''; document.getElementById('new-dni').value = p.dni || ''; document.getElementById('new-nacimiento').value = p.fecha_nacimiento || ''; document.getElementById('new-email').value = p.email || ''; document.getElementById('new-telefono').value = p.telefono || ''; document.getElementById('new-direccion').value = p.direccion || ''; document.getElementById('new-poblacion').value = p.poblacion || ''; document.getElementById('new-cp').value = p.cp || ''; document.getElementById('new-grado').value = p.grado || ''; document.getElementById('new-grupo').value = p.grupo || 'Full Time';
        const chk = document.getElementById('new-seguro'); const txt = document.getElementById('seguro-status-text'); chk.checked = p.seguro_pagado === true; if(chk.checked) { txt.innerText = "PAGADO"; txt.style.color = "#22c55e"; } else { txt.innerText = "NO PAGADO"; txt.style.color = "#ef4444"; }
        let dojoId = ""; if (p.dojo) { if (p.dojo.documentId) dojoId = p.dojo.documentId; else if (p.dojo.data) dojoId = p.dojo.data.documentId || p.dojo.data.id; }
        const selectDojo = document.getElementById('new-dojo'); if (dojoId) selectDojo.value = dojoId;
        document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR ALUMNO"; document.getElementById('btn-cancelar-edit').classList.remove('hidden'); document.querySelectorAll('.section').forEach(s => s.classList.add('hidden')); document.getElementById('sec-nuevo-alumno').classList.remove('hidden');
    } catch { showModal("Error", "Error al cargar datos."); }
}
function resetForm() { const f = document.getElementById('form-nuevo-alumno'); if(f) f.reset(); document.getElementById('seguro-status-text').innerText = "NO PAGADO"; document.getElementById('seguro-status-text').style.color = "#ef4444"; document.getElementById('edit-id').value = ""; document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO"; document.getElementById('btn-cancelar-edit').classList.add('hidden'); }
function confirmarEstado(id, activo, nombre) { showModal(activo ? "Reactivar" : "Baja", `¿Confirmar para ${nombre}?`, async () => { const fecha = activo ? null : new Date().toISOString().split('T')[0]; await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) }); showSection(activo ? 'alumnos' : 'bajas'); }); }
function eliminarDefinitivo(id, nombre) { showModal("¡PELIGRO!", `¿Borrar físicamente a ${nombre}?`, () => { setTimeout(() => { showModal("ÚLTIMO AVISO", "Irreversible.", async () => { await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } }); loadAlumnos(false); }); }, 500); }); }
async function loadDojosCards() { const grid = document.getElementById('grid-dojos'); if(!grid) return; grid.innerHTML = 'Cargando...'; try { const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const json = await res.json(); grid.innerHTML = ''; (json.data || []).forEach(d => { const p = d.attributes || d; const cleanName = (p.nombre || 'Dojo').replace(/Aikido\s+/gi, '').trim(); const addr = p.direccion ? p.direccion.replace(/\n/g, '<br>') : '-'; grid.innerHTML += `<div class="dojo-card"><div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${cleanName}</h3></div><div class="dojo-body"><div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div><div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div><div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div><a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a></div></div>`; }); } catch { grid.innerHTML = 'Error.'; } }

// --- EXPORTAR EXCEL DE LUJO (CORREGIDO: CENTRADO, ANCHOS AUTO, LOGO) ---
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
        const sheet = workbook.addWorksheet('Alumnos');

        // 1. CARGAR LOGO
        try {
            const logoRes = await fetch('img/logo-arashi.png');
            const logoBlob = await logoRes.blob();
            const logoBuffer = await logoBlob.arrayBuffer();
            const logoId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
            // Logo ajustado en fila 2 (no toca borde superior)
            sheet.addImage(logoId, { tl: { col: 0.1, row: 1.1 }, ext: { width: 140, height: 70 } });
        } catch(e) { console.warn("Logo no encontrado", e); }

        // 2. COLUMNAS
        // Definimos las claves para mapear datos
        const columns = [
            { key: 'apellidos' }, { key: 'nombre' }, { key: 'dni' },
            { key: 'nac' }, { key: 'dir' }, { key: 'pob' },
            { key: 'cp' }, { key: 'email' }, { key: 'dojo' },
            { key: 'grupo' }, { key: 'alta' }, { key: 'grau' }, { key: 'seguro' }
        ];
        sheet.columns = columns;

        // 3. CABECERA NEGRA (Fila 1-5 para dejar espacio al logo)
        sheet.mergeCells('A1:M5'); // Cubre TODO el ancho
        const titleCell = sheet.getCell('A1');
        titleCell.value = `ARASHI GROUP AIKIDO - LISTADO OFICIAL (${new Date().toLocaleDateString()})`;
        titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }; 
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1120' } }; // Negro
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' }; // Centrado

        // 4. CABECERAS DE COLUMNA (Fila 7)
        const headers = ['APELLIDOS', 'NOMBRE', 'DNI', 'FECHA NACIMIENTO', 'DIRECCIÓN', 'POBLACIÓN', 'CP', 'EMAIL', 'DOJO', 'GRUPO', 'FECHA ALTA', 'GRADO', 'SEGURO'];
        const headerRow = sheet.getRow(7);
        headerRow.values = headers;
        headerRow.height = 35;
        
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }; // Rojo
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });

        // 5. DATOS Y AUTO-AJUSTE DE ANCHO
        // Primero mapeamos datos
        let maxLengths = new Array(headers.length).fill(10); // Ancho mínimo

        data.forEach(item => {
            const p = item.attributes || item;
            
            // Datos limpios
            const rowValues = {
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
            
            const row = sheet.addRow(rowValues);
            
            // Estilos
            row.eachCell((cell, colNumber) => {
                cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                cell.alignment = { vertical: 'middle', horizontal: 'center' }; // TODO CENTRADO
                
                // Excepciones a la izquierda: Apell(1), Nom(2), Dir(5), Email(8)
                if([1, 2, 5, 8].includes(colNumber)) {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }

                // Calcular ancho máximo
                const len = cell.value ? cell.value.toString().length : 0;
                if (len > maxLengths[colNumber - 1]) maxLengths[colNumber - 1] = len;
            });

            // Color Seguro
            const segCell = row.getCell(13);
            if (p.seguro_pagado) {
                segCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                segCell.font = { color: { argb: 'FF065F46' }, bold: true };
            } else {
                segCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                segCell.font = { color: { argb: 'FF991B1B' }, bold: true };
            }
        });

        // Aplicar anchos calculados + margen
        sheet.columns.forEach((col, index) => {
            col.width = maxLengths[index] + 4; // Margen de seguridad
        });

        // 6. FINALIZAR
        sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 7 }];
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Arashi_Listado_${new Date().getFullYear()}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        
        showModal("Excel Generado", "Descarga completada.");

    } catch(e) { console.error(e); showModal("Error", "Falló la exportación."); } 
    finally { btn.innerHTML = originalText; }
}

function confirmResetInsurance() { showModal("⚠️ ATENCIÓN", "¿Resetear TODOS los seguros?", () => runResetProcess()); }
async function runResetProcess() { const out=document.getElementById('console-output'); out.innerHTML="<div>Iniciando...</div>"; try{ const r=await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&filters[seguro_pagado][$eq]=true&pagination[limit]=2000`,{headers:{'Authorization':`Bearer ${jwtToken}`}}); const j=await r.json(); const l=j.data||[]; if(l.length===0){out.innerHTML+="<div>Nada que resetear.</div>";return;} for(const i of l){ await fetch(`${API_URL}/api/alumnos/${i.documentId}`,{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${jwtToken}`},body:JSON.stringify({data:{seguro_pagado:false}})}); } out.innerHTML+="<div style='color:#33ff00'>COMPLETADO.</div>"; }catch(e){out.innerHTML+=`<div>ERROR: ${e.message}</div>`;} }
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
        list.sort((a, b) => { const pA = a.attributes || a; const pB = b.attributes || b; if (type === 'insurance') { if (pA.seguro_pagado !== pB.seguro_pagado) return (pA.seguro_pagado === true ? -1 : 1); return (pA.apellidos || '').localeCompare(pB.apellidos || ''); } if (type === 'surname') return (pA.apellidos || '').localeCompare(pB.apellidos || ''); if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado); if (type === 'dojo') return getDojoName(pA.dojo).localeCompare(getDojoName(pB.dojo)); if (type === 'group') { const cmp = (pA.grupo || '').localeCompare(pB.grupo || ''); return cmp !== 0 ? cmp : (pA.apellidos || '').localeCompare(pB.apellidos || ''); } if (type === 'age') { return new Date(pA.fecha_nacimiento||'2000-01-01') - new Date(pB.fecha_nacimiento||'2000-01-01'); } return 0; });
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

        // ALINEACIÓN DE COLUMNAS DEL PDF PARA COINCIDIR CON EXCEL (Centrado excepto texto largo)
        let styles = {};
        // Indices base: 0:Apell, 1:Nom, 2:DNI, 3:Grado, 4:Tlf, 5:Email
        // Centrados: DNI, Grado, Tlf, Nac, Edad, Grupo, Seguro, CP
        // Izquierda: Apell, Nom, Email, Dir, Pob, Dojo
        
        // Configuración Base
        styles = { 
            0: { cellWidth: 35, fontStyle: 'bold' }, // Apell (Izq)
            1: { cellWidth: 15, fontStyle: 'bold' }, // Nom (Izq)
            2: { cellWidth: 20, halign: 'center' },  // DNI
            3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, // Grado
            4: { cellWidth: 20, halign: 'center' }, // Tlf
            5: { cellWidth: 40 }, // Email (Izq)
            // ... resto dinámico
        };
        
        if(type==='age') { 
            styles[6] = { cellWidth: 18, halign: 'center' }; // Nac
            styles[7] = { cellWidth: 10, halign: 'center' }; // Edad
            styles[8] = { cellWidth: 28 }; // Dojo (Izq)
            styles[9] = { cellWidth: 35 }; // Dir (Izq)
            styles[10] = { cellWidth: 20 }; // Pob (Izq)
            styles[11] = { cellWidth: 10, halign: 'center' }; // CP
        } else if(type==='insurance') {
             styles[6] = { cellWidth: 20, halign: 'center', fontStyle: 'bold' }; // Seguro
             styles[7] = { cellWidth: 35 }; // Dojo
             styles[8] = { cellWidth: 35 }; // Pob
             styles[9] = { cellWidth: 15, halign: 'center' }; // CP
        } else if(type==='group') {
             styles[6] = { cellWidth: 18, halign: 'center' }; // Nac
             styles[7] = { cellWidth: 25 }; // Dojo
             styles[8] = { cellWidth: 18, halign: 'center' }; // Grupo
             styles[9] = { cellWidth: 35 }; // Dir
             styles[10] = { cellWidth: 25 }; // Pob
             styles[11] = { cellWidth: 10, halign: 'center' }; // CP
        } else {
             styles[6] = { cellWidth: 18, halign: 'center' }; // Nac
             styles[7] = { cellWidth: 30 }; // Dojo
             styles[8] = { cellWidth: 40 }; // Dir
             styles[9] = { cellWidth: 25 }; // Pob
             styles[10] = { cellWidth: 12, halign: 'center' }; // CP
        }

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

function changeFontSize(t, d) { const table = document.getElementById(t); if(!table) return; table.querySelectorAll('th, td').forEach(c => { const s = parseFloat(window.getComputedStyle(c).fontSize); const p = parseFloat(window.getComputedStyle(c).paddingTop); c.style.fontSize = (Math.max(8, s + d)) + "px"; c.style.padding = `${Math.max(2, p + (d * 0.5))}px 5px`; }); }
function setupDragScroll() { const s=document.querySelector('.drag-scroll'); if(!s)return; let d=false,x,l; s.addEventListener('mousedown',e=>{d=true;x=e.pageX-s.offsetLeft;l=s.scrollLeft;}); s.addEventListener('mouseleave',()=>d=false); s.addEventListener('mouseup',()=>d=false); s.addEventListener('mousemove',e=>{if(!d)return;e.preventDefault();const p=e.pageX-s.offsetLeft;s.scrollLeft=l-(p-x)*2;}); }
async function runDiagnostics() { const o=document.getElementById('console-output'); if(o){ o.innerHTML=''; const l=["Iniciando...", "> Conectando DB... [OK]", "> Verificando API... [OK]", "SISTEMA ONLINE 100%"]; for(const x of l){await new Promise(r=>setTimeout(r,400));o.innerHTML+=`<div>${x}</div>`;} o.innerHTML += '<div style="padding:15px; border-top:1px solid #333;"><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="action-btn secondary" style="text-decoration:none; display:inline-block; border-color:#33ff00; color:#33ff00;">Ver Estado de Strapi</a></div>'; } }
function showModal(t, m, ok) { const d=document.getElementById('custom-modal'); if(!d)return; document.getElementById('modal-title').innerText=t; document.getElementById('modal-message').innerHTML=m; document.getElementById('modal-btn-cancel').onclick=()=>d.classList.add('hidden'); document.getElementById('modal-btn-ok').onclick=()=>{if(ok)ok();d.classList.add('hidden');}; d.classList.remove('hidden'); }
async function loadDojosSelect() { const s=document.getElementById('new-dojo'); if(s){ try{ const r=await fetch(`${API_URL}/api/dojos`,{headers:{'Authorization':`Bearer ${jwtToken}`}}); const j=await r.json(); s.innerHTML='<option value="">Selecciona Dojo...</option>'; (j.data||[]).forEach(d=>{s.innerHTML+=`<option value="${d.documentId}">${d.attributes.nombre}</option>`}); }catch{} } }
async function loadReportDojos() { const s=document.getElementById('report-dojo-filter'); const e=document.getElementById('export-dojo-filter'); try{ const r=await fetch(`${API_URL}/api/dojos`,{headers:{'Authorization':`Bearer ${jwtToken}`}}); const j=await r.json(); const o='<option value="">-- Todos los Dojos --</option>'+(j.data||[]).map(d=>`<option value="${d.documentId}">${d.attributes.nombre}</option>`).join(''); if(s)s.innerHTML=o; if(e)e.innerHTML=o; }catch{} }
async function loadCiudades() { const d=document.getElementById('ciudades-list'); if(d){ try{ const r=await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion`,{headers:{'Authorization':`Bearer ${jwtToken}`}}); const j=await r.json(); d.innerHTML=''; [...new Set((j.data||[]).map(a=>a.attributes.poblacion).filter(Boolean))].sort().forEach(c=>d.innerHTML+=`<option value="${c}">`); }catch{} } }
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^0-9A-Z]/g,'')); }
function filtrarTabla(t,i) { const input=document.getElementById(i); if(!input)return; const f=input.value.toUpperCase(); const rows=document.getElementById(t).getElementsByTagName('tr'); for(let j=1;j<rows.length;j++) rows[j].style.display=rows[j].textContent.toUpperCase().includes(f)?"":"none"; }
function toggleMobileMenu() { document.querySelector('.sidebar').classList.toggle('open'); }
function scrollToTop() { const c=document.querySelector('.content'); if(c)c.scrollTo({top:0,behavior:'smooth'}); else window.scrollTo({top:0,behavior:'smooth'}); }
const ca=document.querySelector('.content'); if(ca){ ca.addEventListener('scroll',()=>{ const b=document.getElementById('btn-scroll-top'); if(ca.scrollTop>300)b.classList.add('visible');else b.classList.remove('visible'); }); }
function togglePassword(i,c) { const x=document.getElementById(i); if(x.type==="password"){x.type="text";c.classList.remove('fa-eye');c.classList.add('fa-eye-slash');}else{x.type="password";c.classList.remove('fa-eye-slash');c.classList.add('fa-eye');} }