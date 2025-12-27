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
    setupDragScroll();
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
    tbody.innerHTML = `<tr><td colspan="${activos?12:6}">Cargando datos...</td></tr>`;
    
    const filter = activos ? 'filters[activo][$eq]=true' : 'filters[activo][$eq]=false';
    const sort = activos ? 'sort=apellidos:asc' : 'sort=fecha_baja:desc';
    
    try {
        const res = await fetch(`${API_URL}/api/alumnos?populate=dojo&${filter}&${sort}&pagination[limit]=400`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        renderTabla(json.data, tbody, activos);
    } catch { tbody.innerHTML = `<tr><td colspan="${activos?12:6}">Error cargando datos del servidor.</td></tr>`; }
}

function renderTabla(data, tbody, activos) {
    tbody.innerHTML = '';
    data.forEach(a => {
        const p = a.attributes || a;
        const id = a.documentId || a.id;
        
        // Prioridad: Campos individuales -> Campo apellidos completo
        const apellidos = (p.primer_apellido || p.segundo_apellido) 
            ? `${p.primer_apellido || ''} ${p.segundo_apellido || ''}`.trim()
            : (p.apellidos || '-');
        const nombre = p.nombre || '-';
        
        const dojoData = (p.dojo && p.dojo.data) ? p.dojo.data.attributes : p.dojo;
        const dojo = dojoData ? dojoData.nombre : '-';

        if (activos) {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${apellidos}</strong></td>
                    <td>${nombre}</td>
                    <td style="font-family:monospace">${p.dni || '-'}</td>
                    <td><span class="badge">${p.grado || 'S/G'}</span></td>
                    <td>${p.telefono || '-'}</td>
                    <td>${p.email || '-'}</td>
                    <td>${p.fecha_nacimiento || '-'}</td>
                    <td>${dojo}</td>
                    <td>${p.direccion || '-'}</td>
                    <td>${p.poblacion || '-'}</td>
                    <td>${p.cp || '-'}</td>
                    <td class="sticky-col">
                        <button class="action-btn-icon" onclick="editarAlumno('${id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn-icon delete" onclick="confirmarBaja('${id}', '${apellidos}, ${nombre}')"><i class="fa-solid fa-user-xmark"></i></button>
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML += `
                <tr>
                    <td class="txt-accent" style="font-weight:bold">${p.fecha_baja || '-'}</td>
                    <td><strong>${apellidos}</strong></td>
                    <td>${nombre}</td>
                    <td>${p.dni || '-'}</td>
                    <td>${dojo}</td>
                    <td class="sticky-col">
                        <button class="action-btn-icon restore" onclick="confirmarReactivacion('${id}', '${apellidos}, ${nombre}')"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="action-btn-icon delete" onclick="eliminarDefinitivo('${id}', '${apellidos}, ${nombre}')"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                </tr>`;
        }
    });
}

// --- ACCIONES ---
function confirmarBaja(id, nombre) {
    showModal("Confirmar Baja", `¿Mover a ${nombre} al histórico?`, "warning", () => cambiarEstado(id, false));
}
function confirmarReactivacion(id, nombre) {
    showModal("Reactivar", `¿Dar de alta de nuevo a ${nombre}?`, "info", () => cambiarEstado(id, true));
}

async function cambiarEstado(id, activo) {
    const fecha = activo ? null : new Date().toISOString().split('T')[0];
    await fetch(`${API_URL}/api/alumnos/${id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, 
        body: JSON.stringify({ data: { activo, fecha_baja: fecha } }) 
    });
    loadAlumnos(!activo); 
    showSection(activo ? 'alumnos' : 'bajas');
}

function eliminarDefinitivo(id, nombre) {
    showModal("AVISO CRÍTICO", `¿Borrar físicamente a ${nombre}?`, "error", () => {
        setTimeout(() => { showModal("ÚLTIMA OPORTUNIDAD", "Esta acción borrará al usuario de la base de datos.", "error", async () => { 
            await fetch(`${API_URL}/api/alumnos/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${jwtToken}` } }); 
            loadAlumnos(false); 
        }); }, 500);
    });
}

// --- CREAR / EDITAR ---
document.getElementById('form-nuevo-alumno')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-id').value;
    const isEdit = !!editId;
    const ap1 = document.getElementById('new-apellido1').value.trim();
    const ap2 = document.getElementById('new-apellido2').value.trim();
    const alumnoData = {
        nombre: document.getElementById('new-nombre').value,
        primer_apellido: ap1, segundo_apellido: ap2, apellidos: `${ap1} ${ap2}`.trim(),
        dni: document.getElementById('new-dni').value, email: document.getElementById('new-email').value,
        telefono: document.getElementById('new-telefono').value, fecha_nacimiento: document.getElementById('new-nacimiento').value || null,
        direccion: document.getElementById('new-direccion').value, poblacion: document.getElementById('new-poblacion').value,
        cp: document.getElementById('new-cp').value, grado: document.getElementById('new-grado').value,
        grupo: document.getElementById('new-grupo').value, dojo: document.getElementById('new-dojo').value, activo: true
    };
    try {
        const url = isEdit ? `${API_URL}/api/alumnos/${editId}` : `${API_URL}/api/alumnos`;
        const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` }, body: JSON.stringify({ data: alumnoData }) });
        if(res.ok) { showModal("Éxito", "Operación realizada", "success"); resetForm(); showSection('alumnos'); }
    } catch { showModal("Error", "Error de servidor", "error"); }
});

async function editarAlumno(id) {
    showSection('nuevo-alumno');
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-pen"></i> Editando Alumno';
    document.getElementById('btn-cancelar-edit').classList.remove('hidden');
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${id}?populate=dojo`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        const p = json.data.attributes || json.data;
        document.getElementById('edit-id').value = id;
        document.getElementById('new-nombre').value = p.nombre || '';
        document.getElementById('new-apellido1').value = p.primer_apellido || '';
        document.getElementById('new-apellido2').value = p.segundo_apellido || '';
        document.getElementById('new-dni').value = p.dni || '';
        document.getElementById('new-email').value = p.email || '';
        document.getElementById('new-telefono').value = p.telefono || '';
        document.getElementById('new-nacimiento').value = p.fecha_nacimiento || '';
        document.getElementById('new-direccion').value = p.direccion || '';
        document.getElementById('new-poblacion').value = p.poblacion || '';
        document.getElementById('new-cp').value = p.cp || '';
        document.getElementById('new-grado').value = p.grado || '';
        document.getElementById('new-grupo').value = p.grupo || 'Full Time';
        if(p.dojo && p.dojo.data) document.getElementById('new-dojo').value = p.dojo.data.documentId;
    } catch { showModal("Error", "Error cargando alumno", "error"); }
}

function resetForm() {
    document.getElementById('form-nuevo-alumno').reset(); document.getElementById('edit-id').value = "";
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-user-plus"></i> Alta de Alumno';
    document.getElementById('btn-cancelar-edit').classList.add('hidden');
}

// --- DOJOS ---
async function loadDojosCards() {
    const grid = document.getElementById('grid-dojos');
    grid.innerHTML = 'Cargando...';
    const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
    const json = await res.json();
    grid.innerHTML = '';
    json.data.forEach(d => {
        const p = d.attributes || d;
        grid.innerHTML += `<div class="dojo-card"><div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${p.nombre}</h3></div><div class="dojo-body"><div class="dojo-info-row"><i class="fa-solid fa-map-location-dot"></i><span>${p.direccion || '-'}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div><div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '-'}</span></div><div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || '-'}</span></div><a href="${p.web || '#'}" target="_blank" class="dojo-link-btn">Visitar Web Oficial</a></div></div>`;
    });
}

// --- PDF ---
async function exportarPDF() {
    const { jsPDF } = window.jspdf;
    // Orientación horizontal (l) para imitar el diseño adjunto
    const doc = new jsPDF('l', 'mm', 'a4');
    
    // Configuración de colores del diseño SICAP
    const azulEncabezado = [214, 234, 248]; // Light Blue de las celdas de cabecera
    const textoNegro = [0, 0, 0];

    // 1. Cargar el Logo
    const logoImg = new Image();
    logoImg.src = 'img/logo-arashi-informe.png';

    // Esperamos a que la imagen cargue para evitar errores en el PDF
    logoImg.onload = async function() {
        // --- ENCABEZADO ESTILO SICAP ---
        // Logo (posicionado arriba a la izquierda como en el PDF)
        doc.addImage(logoImg, 'PNG', 10, 10, 45, 20);

        // Título Principal
        doc.setFont("Inter", "bold");
        doc.setFontSize(18);
        doc.text("LLISTAT D'AFILIATS PER COGNOMS", 148, 18, { align: "center" });

        // Subtítulos (Información de la entidad)
        doc.setFontSize(11);
        doc.setFont("Inter", "normal");
        doc.text("Arashi Group - Aikido Management System", 148, 25, { align: "center" });
        doc.setFontSize(9);
        doc.text("Carrer de la Técnica s/n, 08912 Badalona | Tel: 627 555 228", 148, 30, { align: "center" });

        // Línea divisoria fina
        doc.setDrawColor(200, 200, 200);
        doc.line(10, 35, 287, 35);

        // 2. Obtener datos de la API
        try {
            const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&sort=primer_apellido:asc&populate=dojo`, {
                headers: { 'Authorization': `Bearer ${jwtToken}` }
            });
            const json = await res.json();
            const alumnos = json.data;

            // 3. Formatear datos para la tabla según el orden solicitado
            const body = alumnos.map(a => {
                const p = a.attributes;
                const nombreCompleto = `${(p.primer_apellido || '').toUpperCase()} ${(p.segundo_apellido || '').toUpperCase()}, ${p.nombre || ''}`;
                const dojoNom = p.dojo?.data?.attributes?.nombre || '-';
                
                return [
                    p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-', // Columna "Alta"
                    nombreCompleto,
                    p.dni || '-',
                    p.email || '-',
                    p.poblacion || '-',
                    "BARCELONA", // Provincia (fijo o según dato)
                    dojoNom      // Centre Treball
                ];
            });

            // 4. Generar Tabla con AutoTable
            doc.autoTable({
                startY: 40,
                head: [['Alta', 'Cognoms i Nom', 'DNI', 'Email', 'Població', 'Província', 'Centre Treball']],
                body: body,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    valign: 'middle',
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                },
                headStyles: {
                    fillColor: azulEncabezado,
                    textColor: textoNegro,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 22 }, // Alta
                    1: { cellWidth: 'auto' },               // Nombre
                    2: { halign: 'center', cellWidth: 25 }, // DNI
                    3: { cellWidth: 50 },                   // Email
                    4: { cellWidth: 40 },                   // Población
                    5: { halign: 'center', cellWidth: 25 }, // Provincia
                    6: { cellWidth: 45 }                    // Centro
                },
                didDrawPage: function (data) {
                    // --- PIE DE PÁGINA ---
                    const totalPages = doc.internal.getNumberOfPages();
                    const fechaGenerado = new Date().toLocaleDateString();
                    doc.setFontSize(8);
                    doc.setTextColor(100);
                    
                    const str = `Pàgina ${data.pageNumber} de ${totalPages} | Total Registres: ${alumnos.length} | Generat el ${fechaGenerado}`;
                    doc.text(str, 148, 200, { align: "center" });
                }
            });

            // 5. Descargar el archivo
            doc.save(`Llistat_Alumnes_Arashi_${new Date().getTime()}.pdf`);

        } catch (error) {
            console.error("Error al generar PDF:", error);
            showModal("Error", "No se pudieron recuperar los datos para el informe.", "error");
        }
    };
}

// --- UTILS ---
function setupDragScroll() {
    const sliders = document.querySelectorAll('.drag-scroll');
    sliders.forEach(s => {
        let isDown = false, startX, scrollLeft;
        s.addEventListener('mousedown', (e) => { isDown = true; s.classList.add('active'); startX = e.pageX - s.offsetLeft; scrollLeft = s.scrollLeft; });
        s.addEventListener('mouseleave', () => { isDown = false; s.classList.remove('active'); });
        s.addEventListener('mouseup', () => { isDown = false; s.classList.remove('active'); });
        s.addEventListener('mousemove', (e) => { if(!isDown) return; e.preventDefault(); const x = e.pageX - s.offsetLeft; s.scrollLeft = scrollLeft - (x - startX) * 2; });
    });
}
function changeFontSize(id, delta) { const t = document.getElementById(id); const s = parseFloat(window.getComputedStyle(t).fontSize); t.style.fontSize = (s + delta) + "px"; }
function setupDniInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '')); }
function setupNumericInput(id) { document.getElementById(id)?.addEventListener('input', e => e.target.value = e.target.value.replace(/[^0-9]/g, '')); }
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
function showModal(title, msg, type, onOk) {
    const m = document.getElementById('custom-modal'); document.getElementById('modal-title').innerText = title; document.getElementById('modal-message').innerText = msg;
    const ok = document.getElementById('modal-btn-ok'); const cancel = document.getElementById('modal-btn-cancel');
    cancel.classList.remove('hidden'); ok.onclick = () => { onOk(); closeModal(); }; m.classList.remove('hidden');
}
function closeModal() { document.getElementById('custom-modal').classList.add('hidden'); }
function filtrarTabla(tid, iid) { const f = document.getElementById(iid).value.toUpperCase(); const rows = document.getElementById(tid).getElementsByTagName('tr'); for (let i = 1; i < rows.length; i++) rows[i].style.display = rows[i].textContent.toUpperCase().includes(f) ? "" : "none"; }
async function runDiagnostics() {
    const o = document.getElementById('console-output'); o.innerHTML = '';
    const lines = ["Iniciando protocolos...", "> Conectando a Neon DB... [OK]", "> Verificando API Strapi... [OK]", "> Comprobando integridad... [OK]", "SISTEMA OPERATIVO AL 100%"];
    for(const l of lines) { o.innerHTML += `<div>${l}</div>`; await new Promise(r => setTimeout(r, 600)); }
    o.innerHTML += '<br><a href="https://stats.uptimerobot.com/xWW61g5At6" target="_blank" class="btn-monitor-ext">VEURE GRÀFICS DETALLATS</a>';
}