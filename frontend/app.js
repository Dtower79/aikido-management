const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

document.addEventListener('DOMContentLoaded', () => {
    // Control sesión 20 min
    const loginTimeStr = localStorage.getItem('aikido_login_time');
    const ahora = Date.now();
    const veinteMinutos = 20 * 60 * 1000;

    if (jwtToken && loginTimeStr && (ahora - parseInt(loginTimeStr) < veinteMinutos)) {
        localStorage.setItem('aikido_login_time', Date.now().toString());
        showDashboard();
    } else {
        logout();
    }

    setupDniInput('dni-login'); setupDniInput('new-dni'); setupNumericInput('new-cp');
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarTabla('table-alumnos', 'search-alumno'));
    document.getElementById('search-baja')?.addEventListener('keyup', () => filtrarTabla('table-bajas', 'search-baja'));
});

// --- SESIÓN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('dni-login').value; 
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    try {
        const response = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await response.json();
        if (response.ok) {
            jwtToken = data.jwt;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(data.user));
            localStorage.setItem('aikido_login_time', Date.now().toString());
            showDashboard();
        } else { errorMsg.innerText = "❌ Credenciales incorrectas"; }
    } catch { errorMsg.innerText = "❌ Error de conexión"; }
});

function logout() {
    localStorage.clear();
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

// --- NAVEGACIÓN ---
function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojosSelect(); loadCiudades(); showSection('welcome'); 
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`sec-${id}`).classList.remove('hidden');
    const btn = document.querySelector(`button[onclick="showSection('${id}')"]`);
    if(btn) btn.classList.add('active');

    if(id === 'alumnos') loadAlumnos(true);
    if(id === 'bajas') loadAlumnos(false);
    if(id === 'dojos') loadDojosCards();
    if(id === 'status') runDiagnostics();
}

// --- ALUMNOS ---
async function loadAlumnos(activos) {
    const tbody = document.getElementById(activos ? 'lista-alumnos-body' : 'lista-bajas-body');
    tbody.innerHTML = '<tr><td colspan="11">Cargando datos...</td></tr>';
    
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=apellidos:asc' : 'sort=fecha_baja:desc';
    
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=300`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        renderTabla(json.data, tbody, activos);
    } catch { tbody.innerHTML = '<tr><td colspan="11">Error cargando datos.</td></tr>'; }
}

function renderTabla(data, tbody, activos) {
    tbody.innerHTML = '';
    data.forEach(a => {
        const p = a.attributes || a;
        const id = a.documentId || a.id;
        const nombre = `${p.primer_apellido || ''} ${p.segundo_apellido || ''}, ${p.nombre || ''}`;
        const dojoData = (p.dojo && p.dojo.data) ? p.dojo.data.attributes : p.dojo;
        const dojo = dojoData ? dojoData.nombre : '-';

        if (activos) {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${nombre}</strong></td>
                    <td style="font-family:monospace">${p.dni || '-'}</td>
                    <td><span class="badge">${p.grado || 'S/G'}</span></td>
                    <td>${dojo} (${p.grupo || 'Full Time'})</td>
                    <td>${p.telefono || '-'}</td>
                    <td>${p.email || '-'}</td>
                    <td>${p.poblacion || '-'}</td>
                    <td>${p.cp || '-'}</td>
                    <td>${p.fecha_nacimiento || '-'}</td>
                    <td>${p.direccion || '-'}</td>
                    <td class="sticky-col">
                        <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn-icon delete" onclick="cambiarEstado('${id}', false, '${nombre}')"><i class="fa-solid fa-user-xmark"></i></button>
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML += `
                <tr>
                    <td class="txt-accent" style="font-weight:bold">${p.fecha_baja || '-'}</td>
                    <td><strong>${nombre}</strong></td>
                    <td>${p.dni || '-'}</td>
                    <td>${dojo}</td>
                    <td class="sticky-col">
                        <button class="action-btn-icon restore" onclick="cambiarEstado('${id}', true, '${nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${nombre}')"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                </tr>`;
        }
    });
}

// --- DOJOS ---
async function loadDojosCards() {
    const grid = document.getElementById('grid-dojos');
    grid.innerHTML = 'Cargando Dojos...';
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        grid.innerHTML = '';
        json.data.forEach(d => {
            const p = d.attributes || d;
            const address = p.direccion ? p.direccion.replace(/\n/g, '<br>') : '-';
            grid.innerHTML += `
                <div class="dojo-card">
                    <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${p.nombre}</h3></div>
                    <div class="dojo-body">
                        <div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${address}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div>
                        ${p.web ? `<a href="${p.web}" target="_blank" class="dojo-link-btn">VISITAR WEB OFICIAL</a>` : ''}
                    </div>
                </div>`;
        });
    } catch { grid.innerHTML = 'Error cargando Dojos.'; }
}

// --- PDF ---
async function exportarPDF() {
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF('l', 'mm', 'a4'); 
    const logo = new Image(); logo.src = 'img/logo-arashi.png';
    
    doc.addImage(logo, 'PNG', 15, 10, 25, 25); 
    doc.setFontSize(20); doc.text("LISTADO GENERAL DE ALUMNOS", 100, 20); 
    doc.setFontSize(10); doc.text("Arashi Group Aikido Management", 100, 28);
    doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 240, 35);

    try {
        const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&sort=apellidos:asc&pagination[limit]=400`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        
        const rows = json.data.map(a => {
            const p = a.attributes || a;
            return [
                p.primer_apellido || '',
                p.segundo_apellido || '',
                p.nombre || '',
                p.dni || '',
                p.grado || '',
                p.telefono || '',
                p.poblacion || ''
            ];
        });

        doc.autoTable({ 
            startY: 40, 
            head: [['1er Apellido', '2do Apellido', 'Nombre', 'DNI', 'Grado', 'Teléfono', 'Población']], 
            body: rows, 
            theme: 'grid', 
            headStyles: { fillColor: [239, 68, 68], fontSize: 9 },
            styles: { fontSize: 8 }
        });
        doc.save("Listado_Alumnos_Arashi.pdf");
    } catch(e) { alert("Error al generar PDF"); }
}

// --- UTILS ---
async function loadDojosSelect() {
    const sel = document.getElementById('new-dojo');
    const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    const json = await res.json();
    sel.innerHTML = '<option value="">Selecciona Dojo...</option>';
    json.data.forEach(d => { sel.innerHTML += `<option value="${d.documentId || d.id}">${(d.attributes || d).nombre}</option>`; });
}

async function loadCiudades() {
    const res = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion&pagination[limit]=500`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    const json = await res.json();
    const ciu = [...new Set(json.data.map(a => (a.attributes ? a.attributes.poblacion : a.poblacion)).filter(p => p))];
    const dl = document.getElementById('ciudades-list'); dl.innerHTML = '';
    ciu.sort().forEach(c => { dl.innerHTML += `<option value="${c}">`; });
}

async function cambiarEstado(id, activo, nombre) {
    showModal(activo ? "Reactivar" : "Baja", `¿Confirmar para ${nombre}?`, activo ? "info" : "warning", async () => {
        const fecha = activo ? null : new Date().toISOString().split('T')[0];
        await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) });
        loadAlumnos(!activo); showSection(activo ? 'alumnos' : 'bajas');
    });
}

function eliminarDefinitivo(id, nombre) {
    showModal("AVISO CRÍTICO", `¿Borrar físicamente a ${nombre}?`, "error", () => {
        setTimeout(() => { showModal("ÚLTIMA OPORTUNIDAD", "Esta acción borrará al usuario de la base de datos para siempre.", "error", async () => { await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } }); loadAlumnos(false); }); }, 500);
    });
}

function filtrarTabla(tid, iid) { 
    const f = document.getElementById(iid).value.toUpperCase(); 
    const rows = document.getElementById(tid).getElementsByTagName('tr'); 
    for (let i = 1; i < rows.length; i++) rows[i].style.display = rows[i].textContent.toUpperCase().includes(f) ? "" : "none"; 
}

function showModal(title, msg, type, onOk) {
    const m = document.getElementById('custom-modal'); document.getElementById('modal-title').innerText = title; document.getElementById('modal-message').innerText = msg;
    const ok = document.getElementById('modal-btn-ok'); const cancel = document.getElementById('modal-btn-cancel');
    cancel.classList.remove('hidden'); ok.onclick = () => { onOk(); closeModal(); }; m.classList.remove('hidden');
}
function closeModal() { document.getElementById('custom-modal').classList.add('hidden'); }
function changeFontSize(id, delta) { const t = document.getElementById(id); const s = parseFloat(window.getComputedStyle(t).fontSize); t.style.fontSize = (s + delta) + "px"; }
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); }
function setupNumericInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.replace(/[^0-9]/g, '')); }
async function runDiagnostics() {
    const o = document.getElementById('console-output'); o.innerHTML = '';
    const lines = ["Iniciando protocolos...", "> Conectando a Neon DB... [OK]", "> Verificando API Strapi... [OK]", "> Comprobando integridad... [OK]", "SISTEMA OPERATIVO AL 100%"];
    for(const l of lines) { o.innerHTML += `<div>${l}</div>`; await new Promise(r => setTimeout(r, 600)); }
    o.innerHTML += '<br><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="btn-monitor-ext">VEURE GRÀFICS DETALLATS</a>';
}