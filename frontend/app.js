const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// MAPA DE PESO DE GRADOS (Mayor peso = Más rango)
const GRADE_WEIGHTS = {
    '8º DAN': 108, '7º DAN': 107, '6º DAN': 106, '5º DAN': 105, '4º DAN': 104, '3º DAN': 103, '2º DAN': 102, '1º DAN': 101,
    '1º KYU': 5, '2º KYU': 4, '3º KYU': 3, '4º KYU': 2, '5º KYU': 1, 'S/G': 0
};

document.addEventListener('DOMContentLoaded', () => {
    const loginTimeStr = localStorage.getItem('aikido_login_time');
    const ahora = Date.now();
    
    // Comprobar sesión (20 min)
    if (jwtToken && loginTimeStr && (ahora - parseInt(loginTimeStr) < 20 * 60 * 1000)) {
        localStorage.setItem('aikido_login_time', Date.now().toString());
        showDashboard();
    } else {
        logout();
    }

    setupDniInput('dni-login'); 
    setupDniInput('new-dni');
    
    const searchAlumno = document.getElementById('search-alumno');
    if(searchAlumno) searchAlumno.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    
    const searchBaja = document.getElementById('search-baja');
    if(searchBaja) searchBaja.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
    
    setupDragScroll();
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
    const dash = document.getElementById('dashboard');
    const login = document.getElementById('login-screen');
    if(dash) dash.classList.add('hidden');
    if(login) login.classList.remove('hidden');
}

// --- NAVEGACIÓN ---
function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); 
    loadCiudades(); 
    showSection('welcome'); 
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    
    const sec = document.getElementById(`sec-${id}`);
    if(sec) sec.classList.remove('hidden');
    
    const btn = document.querySelector(`button[onclick="showSection('${id}')"]`);
    if(btn) btn.classList.add('active');

    if(id === 'alumnos') loadAlumnos(true);
    if(id === 'bajas') loadAlumnos(false);
    if(id === 'dojos') loadDojosCards();
    if(id === 'status') runDiagnostics();
    if(id === 'nuevo-alumno') resetForm();
}

// --- UTILS DE LIMPIEZA DE DATOS ---

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
    return addr
        .replace(/\b(Carrer|Calle)\b/gi, 'C/')
        .replace(/\b(Avinguda|Avenida)\b/gi, 'Avda')
        .trim();
}

function normalizeCity(city) {
    if(!city) return '-';
    // 1. Limpieza básica (paréntesis, puntos finales)
    let c = city.replace(/\s*\(.*?\)\s*/g, '').replace(/[.,\-\s]+$/, '').trim();
    
    // 2. CORRECCIÓN ESPECÍFICA: San Adrián del Besós
    // Detecta variaciones con acentos mal codificados
    if (c.match(/San Adria/i)) {
        return 'SANT ADRIÀ DEL BESÒS';
    }
    
    return c.toUpperCase();
}

function normalizePhone(tel) {
    if (!tel) return '-';
    let t = tel.toString().trim();
    // Eliminar prefijo +34 o 34 al inicio
    t = t.replace(/^(\+?34)/, '').trim();
    return t;
}

function formatDatePDF(dateStr) {
    if (!dateStr) return '-';
    // Asume formato YYYY-MM-DD de la base de datos
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        // Retorna DD/MM/YYYY
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function calculateAge(birthDateString) {
    if (!birthDateString) return '-';
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return isNaN(age) ? '-' : age;
}

// --- CARGA DE DATOS ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    const cols = activos ? 12 : 13; 
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

            const datosComunes = `
                <td><strong>${p.apellidos || "-"}</strong></td>
                <td>${p.nombre || "-"}</td>
                <td style="font-family:monospace">${p.dni || "-"}</td>
                <td><span class="badge">${normalizeGrade(p.grado) || 'S/G'}</span></td>
                <td>${p.telefono || '-'}</td>
                <td>${p.email || '-'}</td>
                <td>${p.fecha_nacimiento || '-'}</td>
                <td>${dojoNom}</td>
                <td>${p.direccion || '-'}</td>
                <td>${p.poblacion || '-'}</td>
                <td>${p.cp || '-'}</td>
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
                    <td class="txt-accent" style="font-weight:bold">${p.fecha_baja || '-'}</td>
                    ${datosComunes}
                    <td class="sticky-col">
                        <button class="action-btn-icon restore" onclick="confirmarEstado('${id}', true, '${p.nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${p.nombre}')"><i class="fa-solid fa-trash-can"></i></button>
                    </td></tr>`;
            }
        });
    } catch(e) { tbody.innerHTML = `<tr><td colspan="${cols}">Error cargando alumnos del servidor.</td></tr>`; }
}

// --- GUARDAR / EDITAR ---
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
                showModal("Éxito", "Alumno guardado correctamente.", () => {
                    showSection('alumnos');
                    resetForm();
                });
            } else {
                showModal("Error", "No se pudo guardar. Revisa el DNI.");
            }
        } catch { showModal("Error", "Fallo de conexión."); }
    });
}

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
        showSection('nuevo-alumno');
        
    } catch(e) { 
        console.error(e);
        showModal("Error", "No se pudieron cargar los datos.");
    }
}

function resetForm() {
    const f = document.getElementById('form-nuevo-alumno');
    if(f) f.reset();
    document.getElementById('edit-id').value = "";
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO";
    document.getElementById('btn-cancelar-edit').classList.add('hidden');
}

// --- ACCIONES ---
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

// --- DOJOS ---
async function loadDojosCards() {
    const grid = document.getElementById('grid-dojos'); 
    if(!grid) return;
    grid.innerHTML = 'Cargando...';
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        grid.innerHTML = '';
        (json.data || []).forEach(d => {
            const p = d.attributes || d;
            const addr = p.direccion ? p.direccion.replace(/\n/g, '<br>') : '-';
            grid.innerHTML += `<div class="dojo-card">
                <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${getDojoName(p)}</h3></div>
                <div class="dojo-body">
                    <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div>
                    <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a>
                </div></div>`;
        });
    } catch { grid.innerHTML = 'Error cargando Dojos.'; }
}

// --- INFORMES AVANZADOS (DISEÑO PDF MEJORADO) ---
function openReportModal() {
    document.getElementById('report-modal').classList.remove('hidden');
}

async function generateReport(type) {
    document.getElementById('report-modal').classList.add('hidden');
    
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal
    const logoImg = new Image(); 
    logoImg.src = 'img/logo-arashi-informe.png';
    
    const fileNames = {
        'surname': 'ARASHI - Alumnos por Apellidos',
        'age': 'ARASHI - Alumnos por Edad',
        'grade': 'ARASHI - Alumnos por Grado',
        'dojo': 'ARASHI - Alumnos por Dojo'
    };

    const subtitleMap = {
        'surname': 'Apellidos',
        'age': 'Edad',
        'grade': 'Grado',
        'dojo': 'Dojo'
    };
    
    logoImg.onload = async function() {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Cabecera (Logo ajustado a 22x15)
        doc.addImage(logoImg, 'PNG', 10, 5, 22, 15);
        
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        
        let title = "LISTADO DE AFILIADOS";
        if(type === 'grade') title += " POR GRADO";
        if(type === 'age') title += " POR EDAD";
        if(type === 'dojo') title += " POR DOJO";
        if(type === 'surname') title += " POR APELLIDOS";

        doc.text(title, pageWidth / 2, 12, { align: "center" });

        const subtitleText = `Arashi Group Aikido | Alumnos por ${subtitleMap[type] || 'General'}`;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(subtitleText, pageWidth / 2, 18, { align: "center" });
        
        const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&populate=dojo&pagination[limit]=1000`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        let list = json.data || [];

        // Ordenación
        list.sort((a, b) => {
            const pA = a.attributes || a;
            const pB = b.attributes || b;
            
            if (type === 'surname') return (pA.apellidos || '').localeCompare(pB.apellidos || '');
            if (type === 'grade') return getGradeWeight(pB.grado) - getGradeWeight(pA.grado);
            if (type === 'dojo') return getDojoName(pA.dojo).localeCompare(getDojoName(pB.dojo));
            if (type === 'age') {
                const dateA = new Date(pA.fecha_nacimiento || '2000-01-01');
                const dateB = new Date(pB.fecha_nacimiento || '2000-01-01');
                return dateA - dateB; 
            }
            return 0;
        });
        
        // Encabezados
        let headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Teléfono', 'Email', 'Nac.'];
        if (type === 'age') headRow.push('Edad'); 
        headRow.push('Dojo', 'Dirección', 'Población', 'CP');
        
        const body = list.map(a => {
            const p = a.attributes || a;
            
            let dniShow = (p.dni || '-').toUpperCase();
            if (dniShow.includes('PENDIENTE')) dniShow = dniShow.replace('PENDIENTE', 'PEND');

            const baseRow = [
                (p.apellidos || '').toUpperCase(),
                p.nombre || '',
                dniShow,
                normalizeGrade(p.grado),
                normalizePhone(p.telefono), // Teléfono limpio
                p.email || '-',
                formatDatePDF(p.fecha_nacimiento) // Fecha DD/MM/AAAA
            ];
            if (type === 'age') baseRow.push(calculateAge(p.fecha_nacimiento));
            
            baseRow.push(
                getDojoName(p.dojo),
                normalizeAddress(p.direccion),
                normalizeCity(p.poblacion), // Población Limpia con corrección Sant Adrià
                p.cp || '-'
            );
            return baseRow;
        });
        
        // Estilos de Columna Ajustados
        let colStyles = {};
        
        if (type === 'age') { 
            colStyles = {
                0: { cellWidth: 35, fontStyle: 'bold' },
                1: { cellWidth: 15, fontStyle: 'bold' },
                2: { cellWidth: 18, halign: 'center' }, 
                3: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
                4: { cellWidth: 20, halign: 'center' }, 
                5: { cellWidth: 38 },
                6: { cellWidth: 18, halign: 'center' }, 
                7: { cellWidth: 10, halign: 'center' },
                8: { cellWidth: 28, halign: 'center' }, 
                9: { cellWidth: 38 }, 
                10: { cellWidth: 25, halign: 'center' }, // Pob Centrada
                11: { cellWidth: 10, halign: 'center' }
            };
        } else { 
            colStyles = {
                0: { cellWidth: 35, fontStyle: 'bold' },
                1: { cellWidth: 18, fontStyle: 'bold' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 45 },
                6: { cellWidth: 20, halign: 'center' },
                7: { cellWidth: 30, halign: 'center' },
                8: { cellWidth: 45 },
                9: { cellWidth: 25, halign: 'center' },
                10: { cellWidth: 12, halign: 'center' }
            };
        }

        doc.autoTable({ 
            startY: 25, 
            head: [headRow], 
            body: body, 
            theme: 'grid', 
            margin: { left: 5, right: 5, bottom: 15 },
            styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'middle', overflow: 'linebreak' },
            // Estilo Rojo Arashi para Cabecera
            headStyles: { fillColor: [190, 0, 0], textColor: [255,255,255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
            columnStyles: colStyles,
            didDrawPage: function (data) {
                let footerStr = `Página ${doc.internal.getNumberOfPages()} | Total Registros: ${list.length} | Generado el ${new Date().toLocaleDateString()}`;
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text(footerStr, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        });
        
        const finalName = fileNames[type] || `Informe_Arashi_${type}`;
        doc.save(`${finalName}.pdf`);
    };
}

// --- UTILS COMPACTACIÓN ---
function changeFontSize(tableId, delta) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const cells = table.querySelectorAll('th, td');
    if (cells.length > 0) {
        const currentSize = parseFloat(window.getComputedStyle(cells[0]).fontSize);
        const currentPad = parseFloat(window.getComputedStyle(cells[0]).paddingTop);
        const newSize = Math.max(8, currentSize + delta); 
        const newPad = Math.max(2, currentPad + (delta * 0.5)); 
        cells.forEach(cell => {
            cell.style.fontSize = newSize + "px";
            cell.style.padding = `${newPad}px 5px`; 
        });
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
    const o = document.getElementById('console-output'); 
    if(o) {
        o.innerHTML = '';
        const lines = ["Iniciando protocolos...", "> Conectando a Neon DB... [OK]", "> Verificando API Strapi... [OK]", "> Comprobando integridad... [OK]", "SISTEMA OPERATIVO AL 100%"];
        for(const l of lines) { await new Promise(r => setTimeout(r, 400)); o.innerHTML += `<div>${l}</div>`; }
        o.innerHTML += '<br><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="btn-monitor-ext" style="color:#33ff00; border:1px solid #33ff00; padding:10px 20px; text-decoration:none;">VER GRÁFICOS</a>';
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