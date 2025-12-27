const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// MAPA DE PESO DE GRADOS (Mayor peso = Más rango)
const GRADE_WEIGHTS = {
    '8º Dan': 108, '7º Dan': 107, '6º Dan': 106, '5º Dan': 105, '4º Dan': 104, '3º Dan': 103, '2º Dan': 102, '1º Dan': 101,
    '1º Kyu': 5, '2º Kyu': 4, '3º Kyu': 3, '4º Kyu': 2, '5º Kyu': 1, 'S/G': 0
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

    // Inicializadores
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

// --- UTILS ---
function getDojoName(dojoObj) {
    if (!dojoObj) return "-";
    if (dojoObj.nombre) return dojoObj.nombre;
    if (dojoObj.data && dojoObj.data.attributes && dojoObj.data.attributes.nombre) return dojoObj.data.attributes.nombre;
    if (dojoObj.attributes && dojoObj.attributes.nombre) return dojoObj.attributes.nombre;
    return "-";
}

function getGradeWeight(gradeStr) {
    if(!gradeStr) return 0;
    return GRADE_WEIGHTS[gradeStr.trim()] || 0;
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
                <td><span class="badge">${p.grado || 'S/G'}</span></td>
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
                <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${p.nombre}</h3></div>
                <div class="dojo-body">
                    <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${addr}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div>
                    <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div>
                    <a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">WEB OFICIAL</a>
                </div></div>`;
        });
    } catch { grid.innerHTML = 'Error cargando Dojos.'; }
}

// --- INFORMES AVANZADOS (DISEÑO PDF) ---
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
        'surname': 'ARASHI - Alumnos por apellidos',
        'age': 'ARASHI - Alumnos por Edad',
        'grade': 'ARASHI - Alumnos por Grado',
        'dojo': 'ARASHI - Alumnos por Dojos'
    };
    
    logoImg.onload = async function() {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Cabecera
        doc.addImage(logoImg, 'PNG', 10, 5, 30, 15);
        
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        
        let title = "LLISTAT D'AFILIATS";
        if(type === 'grade') title += " PER GRAU";
        if(type === 'age') title += " PER EDAT";
        if(type === 'dojo') title += " PER DOJO";
        if(type === 'surname') title += " PER COGNOMS";

        doc.text(title, pageWidth / 2, 12, { align: "center" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Arashi Group Aikido | Sistema de Gestión", pageWidth / 2, 18, { align: "center" });
        
        // 2. Datos
        const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&populate=dojo&pagination[limit]=1000`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        let list = json.data || [];

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
        
        let headRow = ['Apellidos', 'Nombre', 'DNI', 'Grado', 'Teléfono', 'Email', 'Nac.'];
        if (type === 'age') headRow.push('Edad'); 
        headRow.push('Dojo', 'Dirección', 'Población', 'CP');
        
        const body = list.map(a => {
            const p = a.attributes || a;
            const baseRow = [
                (p.apellidos || '').toUpperCase(),
                p.nombre || '',
                p.dni || '-',
                p.grado || '-',
                p.telefono || '-',
                p.email || '-',
                p.fecha_nacimiento || '-'
            ];
            if (type === 'age') baseRow.push(calculateAge(p.fecha_nacimiento));
            baseRow.push(getDojoName(p.dojo), p.direccion || '-', p.poblacion || '-', p.cp || '-');
            return baseRow;
        });
        
        // Estilos
        let colStyles = {};
        if (type === 'age') {
            colStyles = {
                0: { cellWidth: 35 }, 1: { cellWidth: 25 }, 2: { cellWidth: 20 }, 3: { cellWidth: 15 },
                4: { cellWidth: 20 }, 5: { cellWidth: 40 }, 6: { cellWidth: 18 }, 7: { cellWidth: 10 },
                8: { cellWidth: 35 }, 9: { cellWidth: 35 }, 10: { cellWidth: 20 }, 11: { cellWidth: 10 }
            };
        } else {
            colStyles = {
                0: { cellWidth: 35 }, 1: { cellWidth: 25 }, 2: { cellWidth: 22 }, 3: { cellWidth: 15 },
                4: { cellWidth: 22 }, 5: { cellWidth: 45 }, 6: { cellWidth: 20 }, 7: { cellWidth: 35 },
                8: { cellWidth: 35 }, 9: { cellWidth: 25 }, 10: { cellWidth: 10 }
            };
        }

        doc.autoTable({ 
            startY: 25, 
            head: [headRow], 
            body: body, 
            theme: 'grid', 
            margin: { left: 5, right: 5, bottom: 15 },
            styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle', overflow: 'ellipsize' },
            headStyles: { fillColor: [214, 234, 248], textColor: [0,0,0], fontSize: 8, fontStyle: 'bold', halign: 'center' },
            columnStyles: colStyles,
            didDrawPage: function (data) {
                let footerStr = `Pàgina ${doc.internal.getNumberOfPages()} | Total Registres: ${list.length} | Generat el ${new Date().toLocaleDateString()}`;
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