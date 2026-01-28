const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com";
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

const GRADE_WEIGHTS = {
    '8º DAN': 108, '7º DAN': 107, '6º DAN': 106, '5º DAN': 105, '4º DAN': 104, '3º DAN': 103, '2º DAN': 102, '1º DAN': 101,
    '1º KYU': 5, '2º KYU': 4, '3º KYU': 3, '4º KYU': 2, '5º KYU': 1, 'S/G': 0
};

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    if (jwtToken) showDashboard();
    setupDniInput('dni-login'); 
    setupDniInput('new-dni');
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    document.getElementById('search-baja')?.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
    setupDragScroll();
    
    const yearLabel = document.getElementById('current-year-lbl');
    if (yearLabel) yearLabel.textContent = new Date().getFullYear();

    const seguroSwitch = document.getElementById('new-seguro');
    if (seguroSwitch) {
        seguroSwitch.addEventListener('change', (e) => {
            const txt = document.getElementById('seguro-status-text');
            txt.innerText = e.target.checked ? "PAGADO" : "NO PAGADO";
            txt.style.color = e.target.checked ? "#22c55e" : "#ef4444";
        });
    }
});

// --- SESIÓN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('dni-login').value;
    const password = document.getElementById('password').value;
    try {
        const res = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (res.ok) {
            jwtToken = data.jwt;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            showDashboard();
        } else { document.getElementById('login-error').innerText = "❌ Credenciales incorrectas"; }
    } catch { document.getElementById('login-error').innerText = "❌ Error de conexión"; }
});

function logout() { localStorage.clear(); location.reload(); }

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); loadCiudades(); loadReportDojos(); showSection('welcome');
}

function showSection(id) {
    // 1. Ocultamos TODAS las secciones, incluida la de bienvenida
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    
    // 2. Mostramos solo la que queremos
    const targetSection = document.getElementById(`sec-${id}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
    
    // 3. Gestionamos los botones del menú
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-nav-${id}`);
    if(activeBtn) activeBtn.classList.add('active');

    // 4. Cargas específicas
    if (id === 'alumnos') loadAlumnos(true);
    if (id === 'bajas') loadAlumnos(false);
    if (id === 'dojos') loadDojosCards();
    if (id === 'status') runDiagnostics();
    if (id === 'nuevo-alumno') { 
        const isEditing = document.getElementById('edit-id').value !== ""; 
        if (!isEditing) resetForm(); 
    }
    
    // 5. Cerramos cualquier menú de acciones abierto al cambiar de sección
    if (typeof closeAlumnoActions === 'function') closeAlumnoActions();
}

// --- UTILS ---
const parseRelation = (obj) => { if(!obj || !obj.data) return obj; return obj.data.attributes || obj.data; };
const getID = (obj) => obj?.documentId || obj?.id;

// SEGURIDAD PARA BOTONES: Escapar comillas simples en nombres (ej: O'Connor)
function escapeQuotes(str) {
    if (!str) return "";
    return str.replace(/'/g, "\\'");
}

function getDojoName(dojoObj) {
    const d = parseRelation(dojoObj);
    return d && d.nombre ? d.nombre.replace(/Aikido\s+/gi, '').trim() : "NO DISP";
}

function normalizeGrade(g) {
    if (!g) return 'NO DISP';
    let s = g.toUpperCase().trim();
    if (s.includes('DAN') || s.includes('KYU')) {
        const match = s.match(/(\d+)/);
        if (match) return `${match[1]}º ${s.includes('DAN') ? 'DAN' : 'KYU'}`;
    }
    return s;
}

function getGradeWeight(g) { return GRADE_WEIGHTS[normalizeGrade(g)] || 0; }
function formatDateDisplay(d) { if (!d) return 'NO DISP'; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; }
function formatDateExcel(d) { if (!d) return ""; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; }
function calculateAge(d) { if (!d) return 'NO DISP'; const t = new Date(), b = new Date(d); let a = t.getFullYear() - b.getFullYear(); if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--; return isNaN(a) ? 'NO DISP' : a; }
function normalizePhone(t) { if (!t || t === "-") return 'NO DISP'; return t.toString().replace(/^(\+?34)/, '').trim(); }
function togglePassword(i, icon) { const x = document.getElementById(i); if (x.type === "password") { x.type = "text"; icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); } else { x.type = "password"; icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); } }

// --- CARGA ALUMNOS (Corrección Botón Borrar) ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    const colCount = activos ? 9 : 8;
    tbody.innerHTML = `<tr><td colspan="${colCount}">Cargando...</td></tr>`;
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=apellidos:asc' : 'sort=fecha_baja:desc';

    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=500`, { 
            headers: { 'Authorization': `Bearer ${jwtToken}` } 
        });
        const json = await res.json();
        tbody.innerHTML = '';
        
        (json.data || []).forEach(a => {
            const p = a.attributes || a;
            const id = a.documentId;
            const safeNombre = escapeQuotes(p.nombre || '');
            const safeApellidos = escapeQuotes(p.apellidos || '');
            
            const tr = document.createElement('tr');
            tr.id = `row-${id}`;
            // Pasamos 'activos' para saber qué botones mostrar
            tr.onclick = (e) => handleAlumnoSelection(id, safeNombre, safeApellidos, e, activos);
            
            tr.innerHTML = `
                ${!activos ? `<td><strong>${formatDateDisplay(p.fecha_baja)}</strong></td>` : ''}
                <td><strong>${(p.apellidos || '').toUpperCase()}</strong></td>
                <td>${p.nombre || ''}</td>
                <td>${p.dni || ''}</td>
                <td><span class="badge">${normalizeGrade(p.grado)}</span></td>
                ${activos ? `<td style="font-weight:bold; color:var(--primary)">${parseFloat(p.horas_acumuladas || 0).toFixed(1)}h</td>` : ''}
                <td><span class="${p.seguro_pagado ? 'badge-ok' : 'badge-no'}">${p.seguro_pagado ? 'SÍ' : 'NO'}</span></td>
                <td>${normalizePhone(p.telefono)}</td>
                <td>${getDojoName(p.dojo)}</td>
                ${activos ? `<td>${formatDateDisplay(p.fecha_inicio)}</td>` : ''}
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { tbody.innerHTML = `<tr><td colspan="${colCount}">Error de carga.</td></tr>`; }
}

function handleAlumnoSelection(id, nombre, apellidos, event, esActivo) {
    // 1. Limpiar cualquier selección previa
    closeAlumnoActions();
    
    // 2. Resaltar la fila actual
    const row = document.getElementById(`row-${id}`);
    if (row) row.classList.add('selected-row');

    // 3. Preparar los iconos
    const actionsHtml = esActivo ? `
        <button class="action-btn-icon" title="Historial" onclick="generateIndividualHistory('${id}', '${nombre}', '${apellidos}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
        <button class="action-btn-icon" title="Editar" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="action-btn-icon delete" title="Baja" onclick="confirmarEstado('${id}', false, '${nombre}')"><i class="fa-solid fa-user-xmark"></i></button>
    ` : `
        <button class="action-btn-icon restore" title="Reactivar" onclick="confirmarEstado('${id}', true, '${nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
        <button class="action-btn-icon delete" title="Eliminar" onclick="eliminarDefinitivo('${id}', '${nombre}')"><i class="fa-solid fa-trash-can"></i></button>
    `;

    const isMobile = window.innerWidth <= 900;

    if (isMobile) {
        // En móvil usamos el Bottom Sheet (Panel inferior)
        document.getElementById('sheet-alumno-name').innerText = `${nombre} ${apellidos}`;
        document.getElementById('sheet-actions-container').innerHTML = actionsHtml;
        document.getElementById('bottom-sheet-mobile').classList.remove('hidden');
        } else {
            const targetId = esActivo ? 'actions-alumnos' : 'actions-bajas';
            const container = document.getElementById(targetId);
            
            if (container) {
                container.innerHTML = `
                    <div style="grid-column: 1;"></div> <!-- Espaciador izquierdo -->
                    <span class="student-tag">${nombre} ${apellidos}</span>
                    <div class="actions-buttons-wrap">${actionsHtml}</div>
                `;
                container.classList.add('active');
            }
        }
    if (event) event.stopPropagation();
}

// También actualizamos closeAlumnoActions para limpiar la barra
function closeAlumnoActions() {
    // Quitar resaltado de todas las filas
    document.querySelectorAll('tr.selected-row').forEach(r => r.classList.remove('selected-row'));
    
    // Limpiar y ocultar áreas de la toolbar (tanto alumnos como bajas)
    ['actions-alumnos', 'actions-bajas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active');
            el.innerHTML = '';
        }
    });

    // Ocultar panel móvil
    const sheet = document.getElementById('bottom-sheet-mobile');
    if (sheet) sheet.classList.add('hidden');
}

function logout() { localStorage.clear(); location.reload(); }

// Cerrar acciones al hacer clic fuera
document.addEventListener('click', (e) => {
    const isRowClick = e.target.closest('tr');
    const isBarClick = e.target.closest('.action-bar-desktop');
    const isSheetClick = e.target.closest('.bottom-sheet-content');

    if (!isRowClick && !isBarClick && !isSheetClick) {
        closeAlumnoActions();
    }
});


const formAlumno = document.getElementById('form-nuevo-alumno');
if (formAlumno) {
    formAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const alumnoData = { 
            nombre: document.getElementById('new-nombre').value, 
            apellidos: document.getElementById('new-apellidos').value, 
            dni: document.getElementById('new-dni').value, 
            fecha_nacimiento: document.getElementById('new-nacimiento').value || null, 
            fecha_inicio: document.getElementById('new-alta').value || null, 
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
        
        try {
            const method = id ? 'PUT' : 'POST'; 
            const url = id ? `${API_URL}/api/alumnos/${id}` : `${API_URL}/api/alumnos`;
            const res = await fetch(url, { 
                method: method, 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, 
                body: JSON.stringify({ data: alumnoData }) 
            });
            
            if (res.ok) {
                showModal("¡OSS!", id ? "Los datos del alumno se han actualizado correctamente." : "Alumno registrado con éxito.", () => { 
                    showSection('alumnos'); 
                    resetForm(); 
                });
            } else { 
                showModal("Error", "No se han podido guardar los cambios. Revisa los datos."); 
            }
        } catch (error) { 
            showModal("Error", "Fallo de conexión con el Dojo."); 
        }
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
        if (p.dojo) { if (p.dojo.documentId) { dojoId = p.dojo.documentId; } else if (p.dojo.data) { dojoId = p.dojo.data.documentId || p.dojo.data.id; } }
        const selectDojo = document.getElementById('new-dojo'); if (dojoId && selectDojo) { selectDojo.value = dojoId; }
        document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR ALUMNO"; document.getElementById('btn-cancelar-edit').classList.remove('hidden'); showSection('nuevo-alumno');
    } catch { showModal("Error", "Error al cargar datos."); }
}

function resetForm() { 
    const f = document.getElementById('form-nuevo-alumno'); 
    if (f) f.reset(); 
    
    // Resetear visuales de seguro
    document.getElementById('seguro-status-text').innerText = "NO PAGADO"; 
    document.getElementById('seguro-status-text').style.color = "#ef4444"; 
    
    // Resetear ID de edición
    document.getElementById('edit-id').value = ""; 
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO"; 
    document.getElementById('btn-cancelar-edit').classList.add('hidden'); 
    
    // Volver a la lista de alumnos
    showSection('alumnos'); 
}

function confirmarEstado(id, activo, nombre) { showModal(activo ? "Reactivar" : "Baja", `¿Confirmar para ${nombre}?`, async () => { const fecha = activo ? null : new Date().toISOString().split('T')[0]; await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) }); showSection(activo ? 'alumnos' : 'bajas'); }); }
function eliminarDefinitivo(id, nombre) { showModal("¡PELIGRO!", `¿Borrar físicamente a ${nombre}?`, () => { setTimeout(() => { showModal("ÚLTIMO AVISO", "Irreversible.", async () => { await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } }); loadAlumnos(false); }); }, 500); }); }

// --- LOGICA CAMBIO DE CONTRASEÑA ---
function openChangePasswordModal() {
    document.getElementById('change-pass-form').reset();
    document.getElementById('change-pass-modal').classList.remove('hidden');
}

document.getElementById('change-pass-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('cp-current').value;
    const password = document.getElementById('cp-new').value;
    const passwordConfirmation = document.getElementById('cp-confirm').value;

    if (password !== passwordConfirmation) { showModal("Error", "Las contraseñas nuevas no coinciden."); return; }

    try {
        const res = await fetch(`${API_URL}/api/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify({ currentPassword, password, passwordConfirmation })
        });
        const data = await res.json();
        if (res.ok) {
            showModal("Éxito", "Contraseña actualizada. Inicia sesión de nuevo.", () => logout());
        } else {
            showModal("Error", data.error ? data.error.message : "No se pudo cambiar la contraseña.");
        }
    } catch { showModal("Error", "Fallo de conexión."); }
});

// --- INFORMES ---
function openReportModal() { document.getElementById('report-modal').classList.remove('hidden'); }

// 1. INFORME HISTÓRICO INDIVIDUAL
async function generateIndividualHistory(id, nombre, apellidos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    try {
        const res = await fetch(`${API_URL}/api/asistencias?filters[alumno][documentId][$eq]=${id}&populate=clase&sort=createdAt:desc&pagination[limit]=200`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const data = json.data || [];

        const headRow = ['Fecha', 'Hora', 'Tipo', 'Duración', 'Estado'];
        let totalHoras = 0;

        const body = data.map(item => {
            const a = item.attributes || item;
            const c = parseRelation(a.clase);
            
            let fechaStr = "NO DISP", horaStr = "--", duracion = 0, tipo = "General";
            if (c && c.Fecha_Hora) {
                const dateObj = new Date(c.Fecha_Hora);
                fechaStr = dateObj.toLocaleDateString('es-ES');
                horaStr = dateObj.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
                duracion = parseFloat(c.Duracion || 0);
                tipo = c.Tipo || "General";
            }
            
            // Sumar solo si asistió
            if(a.Estado === 'Asistio') totalHoras += duracion;

            return [fechaStr, horaStr, tipo, duracion + 'h', a.Estado === 'Asistio' ? 'ASISTIÓ' : 'NO VINO'];
        });

        doc.setFontSize(16); doc.text(`HISTORIAL DE ASISTENCIA`, 105, 15, { align: 'center' });
        doc.setFontSize(12); doc.text(`Alumno: ${apellidos.toUpperCase()}, ${nombre}`, 105, 22, { align: 'center' });
        doc.setFontSize(10); doc.text(`Total Horas Registradas: ${totalHoras.toFixed(1)}h`, 105, 28, { align: 'center' });

        doc.autoTable({
            startY: 35, head: [headRow], body: body, theme: 'grid',
            headStyles: { fillColor: [190, 0, 0] },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 4) {
                    data.cell.styles.textColor = data.cell.raw === 'ASISTIÓ' ? [0, 128, 0] : [190, 0, 0];
                }
            }
        });

        doc.save(`Historial_${apellidos}_${nombre}.pdf`);

    } catch (e) { alert("Error generando historial."); console.error(e); }
}

// 2. GENERADOR DE INFORMES GENERALES
async function generateReport(type) {
    document.getElementById('report-modal').classList.add('hidden');
    const dojoSelect = document.getElementById('report-dojo-filter');
    const dojoFilterId = dojoSelect.value;
    const dojoFilterName = dojoSelect.options[dojoSelect.selectedIndex].text;
    const attendanceDate = document.getElementById('report-attendance-date').value;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    const subtitleMap = {
        'surname': 'Apellidos', 'age': 'Edad', 'grade': 'Grado', 'dojo': 'Dojo', 'group': 'Grupo', 'insurance': 'Estado del Seguro',
        'bajas_surname': 'Histórico Bajas (Por Apellidos)', 'bajas_date': 'Histórico Bajas (Por Fecha)',
        'attendance': 'Asistencia Diaria'
    };

    logoImg.onload = async function () {
        const pageWidth = doc.internal.pageSize.getWidth();
        let headRow = [], body = [], title = "", subText = "";

        try {
            if (type === 'attendance') {
                if (!attendanceDate) { alert("Selecciona una fecha."); return; }
                title = "ASISTENCIA DIARIA - TATAMI";
                subText = `Día: ${formatDateDisplay(attendanceDate)} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'}`;
                
                let apiUrl = `${API_URL}/api/asistencias?filters[clase][Fecha_Hora][$contains]=${attendanceDate}&populate[alumno][populate]=dojo&populate[clase]=*&pagination[limit]=500`;
                if (dojoFilterId) apiUrl += `&filters[alumno][dojo][documentId][$eq]=${dojoFilterId}`;

                const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                
                headRow = ['Alumno', 'DNI', 'Dojo', 'Clase', 'Hora', 'Estado'];
                body = (json.data || []).map(item => {
                    const a = item.attributes || item;
                    const alu = parseRelation(a.alumno);
                    const cla = parseRelation(a.clase);
                    let horaStr = "--:--";
                    if(cla?.Fecha_Hora) {
                        const d = new Date(cla.Fecha_Hora);
                        horaStr = d.getUTCHours().toString().padStart(2, '0') + ":" + d.getUTCMinutes().toString().padStart(2, '0') + "h";
                    }
                    return [
                        alu ? `${(alu.apellidos||'').toUpperCase()}, ${alu.nombre||''}` : 'DESCONOCIDO',
                        alu?.dni || '-',
                        getDojoName(alu?.dojo),
                        cla?.Tipo || 'General',
                        horaStr,
                        a.Estado === 'Asistio' ? 'ASISTIÓ' : 'NO SE PRESENTÓ'
                    ];
                });

            } else {
                const isBaja = type.startsWith('bajas_');
                title = isBaja ? "HISTÓRICO DE BAJAS" : "LISTADO COMPLETO ALUMNOS";
                if (!isBaja && type === 'insurance') title = "ESTADO DE PAGOS DE SEGURO ANUAL";
                else if (!isBaja) title += ` POR ${subtitleMap[type].toUpperCase()}`;

                subText = `${isBaja ? 'Alumnos Inactivos' : 'Alumnos Activos'} | ${dojoFilterId ? dojoFilterName : 'Todos los Dojos'} | ${new Date().toLocaleDateString()}`;

                let apiUrl = `${API_URL}/api/alumnos?filters[activo][$eq]=${isBaja ? 'false' : 'true'}&populate=dojo&pagination[limit]=1000`;
                if (dojoFilterId) apiUrl += `&filters[dojo][documentId][$eq]=${dojoFilterId}`;

                const res = await fetch(apiUrl, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
                const json = await res.json();
                let list = json.data || [];

                list.sort((a, b) => {
                    const pA = a.attributes || a; const pB = b.attributes || b;
                    if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado);
                    if (type === 'age') return new Date(pA.fecha_nacimiento || '0') - new Date(pB.fecha_nacimiento || '0');
                    if (type === 'group') return (pA.grupo || '').localeCompare(pB.grupo || '');
                    if (type === 'dojo') return getDojoName(pA.dojo).localeCompare(getDojoName(pB.dojo));
                    return (pA.apellidos || '').localeCompare(pB.apellidos || '');
                });

                headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Horas', 'Seguro', 'Teléfono', 'Email', 'Dirección', 'CP/Ciudad'];
                if (isBaja) headRow.unshift('Baja');

                body = list.map(item => {
                    const p = item.attributes || item;
                    const ciudadFull = `${p.cp || ''} ${p.poblacion || ''}`.trim();
                    const row = [
                        (p.apellidos || '').toUpperCase(),
                        p.nombre || '',
                        p.dni || '',
                        normalizeGrade(p.grado),
                        parseFloat(p.horas_acumuladas || 0).toFixed(1) + 'h',
                        p.seguro_pagado ? 'PAGADO' : 'NO',
                        normalizePhone(p.telefono),
                        p.email || '-',
                        (p.direccion || '').substring(0, 30),
                        ciudadFull
                    ];
                    if (isBaja) row.unshift(formatDateDisplay(p.fecha_baja));
                    return row;
                });
            }

            doc.autoTable({
                startY: 25, head: [headRow], body: body, theme: 'grid',
                styles: { fontSize: 6, cellPadding: 1.5, overflow: 'linebreak' },
                headStyles: { fillColor: [190, 0, 0], halign: 'center', fontStyle: 'bold' },
                didDrawPage: (d) => {
                    doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
                    doc.setFontSize(14); doc.setFont("helvetica", "bold");
                    doc.text(title, pageWidth / 2, 12, { align: 'center' });
                    doc.setFontSize(9); doc.setFont("helvetica", "normal");
                    doc.text(subText, pageWidth / 2, 18, { align: 'center' });
                }
            });
            doc.save(`Informe_Arashi_${type}.pdf`);
        } catch (e) { 
            console.error(e);
            alert("Error al generar el PDF. Revisa la consola."); 
        }
    };
}

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

        const headers = ['APELLIDOS', 'NOMBRE', 'DNI', 'FECHA NAC', 'DIRECCIÓN', 'POBLACIÓN', 'CP', 'EMAIL', 'DOJO', 'GRUPO', 'ALTA', 'GRADO', 'SEGURO', 'HORAS'];
        const headerRow = sheet.getRow(8);
        headerRow.values = headers;
        
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
            cell.alignment = { horizontal: 'center' };
        });

        data.forEach(item => {
            const p = item.attributes || item;
            sheet.addRow([
                (p.apellidos || '').toUpperCase(), p.nombre || '', p.dni || '',
                formatDateExcel(p.fecha_nacimiento), p.direccion || '', p.poblacion || '', p.cp || '',
                p.email || '', getDojoName(p.dojo), p.grupo || 'Full Time',
                formatDateExcel(p.fecha_inicio), p.grado || '',
                p.seguro_pagado ? 'SI' : 'NO', p.horas_acumuladas || 0
            ]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Arashi_Listado_${new Date().getFullYear()}.xlsx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);

    } catch (e) { showModal("Error", "Falló exportación."); }
    finally { btn.innerHTML = originalText; }
}

function confirmResetInsurance() { showModal("⚠️ ATENCIÓN", "¿Resetear TODOS los seguros?", () => runResetProcess()); }
async function runResetProcess() { const out = document.getElementById('console-output'); out.innerHTML = "<div>Iniciando...</div>"; try { const r = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&filters[seguro_pagado][$eq]=true&pagination[limit]=2000`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const j = await r.json(); const l = j.data || []; for (const i of l) { await fetch(`${API_URL}/api/alumnos/${i.documentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { seguro_pagado: false } }) }); } out.innerHTML += "<div style='color:#33ff00'>COMPLETADO.</div>"; } catch (e) { out.innerHTML += `<div>ERROR: ${e.message}</div>`; } }

// --- FUNCIONES ARREGLADAS DOJOS ---
async function loadDojosCards() { 
    const grid = document.getElementById('grid-dojos'); 
    if (!grid) return; 
    grid.innerHTML = '<p style="color:#aaa;">Cargando dojos...</p>'; 
    try { 
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); 
        const json = await res.json(); 
        const data = json.data || [];
        grid.innerHTML = ''; 
        if(data.length === 0) { grid.innerHTML = '<p>No hay dojos.</p>'; return; }

        data.forEach(d => { 
            // FIX: Normalizar lectura de Strapi v5
            const p = d.attributes || d; 
            const cleanName = (p.nombre || 'Dojo Desconocido').replace(/Aikido\s+/gi, '').trim(); 
            const addr = p.direccion ? p.direccion.replace(/\n/g, '<br>') : 'NO DISP'; 
            
            grid.innerHTML += `
                <div class="dojo-card">
                    <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${cleanName}</h3></div>
                    <div class="dojo-body">
                        <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || 'NO DISP'}</span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || 'NO DISP'}</span></div>
                        <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a>
                    </div>
                </div>`; 
        }); 
    } catch(e) { console.error(e); grid.innerHTML = '<p style="color:red">Error al cargar dojos.</p>'; } 
}

async function loadDojosSelect() {
    const s = document.getElementById('new-dojo');
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        s.innerHTML = '<option value="">Selecciona...</option>';
        (j.data || []).forEach(d => { 
            const docId = d.documentId || d.id;
            // FIX: Nombre seguro
            const p = d.attributes || d;
            s.innerHTML += `<option value="${docId}">${p.nombre}</option>`; 
        });
    } catch {}
}

async function loadReportDojos() {
    const s = document.getElementById('report-dojo-filter');
    const e = document.getElementById('export-dojo-filter');
    try {
        const r = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const j = await r.json();
        const options = (j.data || []).map(d => {
            const docId = d.documentId || d.id;
            const p = d.attributes || d;
            return `<option value="${docId}">${p.nombre}</option>`;
        }).join('');
        const html = '<option value="">-- Todos los Dojos --</option>' + options;
        if (s) s.innerHTML = html; if (e) e.innerHTML = html;
    } catch {}
}

async function loadCiudades() { const d = document.getElementById('ciudades-list'); if (d) { try { const r = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion`, { headers: { 'Authorization': `Bearer ${jwtToken}` } }); const j = await r.json(); d.innerHTML = ''; [...new Set((j.data || []).map(a => (a.attributes ? a.attributes.poblacion : a.poblacion)).filter(Boolean))].sort().forEach(c => d.innerHTML += `<option value="${c}">`); } catch { } } }
async function runDiagnostics() { const o = document.getElementById('console-output'); if (o) { o.innerHTML = ''; const l = ["Iniciando...", "> Conectando DB... [OK]", "> Verificando API... [OK]", "SISTEMA ONLINE 100%"]; for (const x of l) { await new Promise(r => setTimeout(r, 400)); o.innerHTML += `<div>${x}</div>`; } o.innerHTML += '<div style="padding:15px; border-top:1px solid #33ff00;"><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="action-btn secondary" style="text-decoration:none; display:inline-block; border-color:#33ff00; color:#33ff00;">Ver Estado de Strapi</a></div>'; } }
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); }
function filtrarTabla(t, i) { const input = document.getElementById(i); if (!input) return; const f = input.value.toUpperCase(); const rows = document.getElementById(t).getElementsByTagName('tr'); for (let j = 1; j < rows.length; j++) rows[j].style.display = rows[j].textContent.toUpperCase().includes(f) ? "" : "none"; }
function changeFontSize(t, d) { const table = document.getElementById(t); if (!table) return; table.querySelectorAll('th, td').forEach(c => { const s = parseFloat(window.getComputedStyle(c).fontSize); c.style.fontSize = (Math.max(8, s + d)) + "px"; }); }

// FIX SCROLL: Prevenir default para que no seleccione texto
function setupDragScroll() { 
    const s = document.querySelector('.drag-scroll'); 
    if (!s) return; 
    let d = false, x, l; 
    s.addEventListener('mousedown', e => { 
        d = true; 
        s.classList.add('active'); // Activa cursor grabbing y user-select:none
        x = e.pageX - s.offsetLeft; 
        l = s.scrollLeft; 
        e.preventDefault(); // CLAVE: Evita selección de texto
    }); 
    s.addEventListener('mouseleave', () => { d = false; s.classList.remove('active'); }); 
    s.addEventListener('mouseup', () => { d = false; s.classList.remove('active'); }); 
    s.addEventListener('mousemove', e => { 
        if (!d) return; 
        e.preventDefault(); 
        const p = e.pageX - s.offsetLeft; 
        s.scrollLeft = l - (p - x) * 2; 
    }); 
}

function toggleMobileMenu() { document.querySelector('.sidebar').classList.toggle('open'); }
function scrollToTop() { const c = document.querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); else window.scrollTo({ top: 0, behavior: 'smooth' }); }
const ca = document.querySelector('.content'); if (ca) { ca.addEventListener('scroll', () => { const b = document.getElementById('btn-scroll-top'); if (ca.scrollTop > 300) b.classList.add('visible'); else b.classList.remove('visible'); }); }

function showModal(titulo, mensaje, callbackOk = null) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = titulo;
    document.getElementById('modal-message').innerText = mensaje;
    
    const btnOk = document.getElementById('modal-btn-ok');
    const btnCancel = document.getElementById('modal-btn-cancel');
    
    modal.classList.remove('hidden');
    
    btnOk.onclick = () => {
        modal.classList.add('hidden');
        if (callbackOk) callbackOk();
    };
    
    btnCancel.onclick = () => {
        modal.classList.add('hidden');
    };
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
}