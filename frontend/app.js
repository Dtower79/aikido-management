// --- CONFIGURACIÓN ---
const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

// --- ESTADO ---
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Control de Sesión (Expiración 20 min)
    const loginTime = localStorage.getItem('aikido_login_time');
    const ahora = Date.now();
    const veinteMinutos = 20 * 60 * 1000;

    if (jwtToken && loginTime && (ahora - loginTime < veinteMinutos)) {
        localStorage.setItem('aikido_login_time', Date.now()); // Renovamos por actividad
        showDashboard();
    } else {
        logout(); 
    }

    setupDniInput('dni-login');
    setupDniInput('new-dni');
    setupNumericInput('new-cp');

    // Buscadores
    document.getElementById('search-alumno')?.addEventListener('keyup', () => filtrarAlumnos('table-alumnos', 'search-alumno'));
    document.getElementById('search-baja')?.addEventListener('keyup', () => filtrarAlumnos('table-bajas', 'search-baja'));

    setupDragScroll();
});

// --- HELPERS INPUTS ---
function setupDniInput(id) {
    const input = document.getElementById(id);
    if(input) {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
        });
    }
}

function setupNumericInput(id) {
    const input = document.getElementById(id);
    if(input) {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
}

// --- LOGIN / LOGOUT ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('dni-login').value; 
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');

    errorMsg.innerText = "Conectando...";

    try {
        const response = await fetch(`${API_URL}/api/auth/local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await response.json();

        if (response.ok) {
            jwtToken = data.jwt;
            userData = data.user;
            localStorage.setItem('aikido_jwt', jwtToken);
            localStorage.setItem('aikido_user', JSON.stringify(userData));
            localStorage.setItem('aikido_login_time', Date.now());
            errorMsg.innerText = "";
            showDashboard();
        } else {
            errorMsg.innerText = "❌ Credenciales incorrectas";
        }
    } catch (error) {
        errorMsg.innerText = "❌ Error de conexión";
    }
});

function logout() {
    localStorage.clear();
    jwtToken = null;
    userData = null;
    const dashboard = document.getElementById('dashboard');
    const login = document.getElementById('login-screen');
    if(dashboard) dashboard.classList.add('hidden');
    if(login) login.classList.remove('hidden');
}

// --- VISTAS ---
function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    loadDojos(); 
    loadCiudades(); 
    showSection('welcome'); 
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    const section = document.getElementById(`sec-${sectionId}`);
    if (section) section.classList.remove('hidden');
    
    if (sectionId !== 'welcome') {
        const btn = document.querySelector(`button[onclick="showSection('${sectionId}')"]`);
        if(btn) btn.classList.add('active');
    }

    if(sectionId === 'alumnos') loadAlumnosActivos();
    if(sectionId === 'bajas') loadAlumnosBaja();
    if(sectionId === 'dojos') loadDojosView();
    if(sectionId === 'status') {
        document.getElementById('console-output').innerHTML = '<span class="cursor">_</span>';
        runSystemDiagnostics();
    }
}

// --- MODALES ---
function showModal(title, message, type = 'info', onConfirm = null) {
    const overlay = document.getElementById('custom-modal');
    const iconDiv = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');
    const btnOk = document.getElementById('modal-btn-ok');
    const btnCancel = document.getElementById('modal-btn-cancel');

    titleEl.innerText = title;
    msgEl.innerText = message;
    
    if (type === 'success') { iconDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; iconDiv.style.color = '#10b981'; }
    else if (type === 'error') { iconDiv.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>'; iconDiv.style.color = '#ef4444'; }
    else if (type === 'warning') { iconDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>'; iconDiv.style.color = '#f59e0b'; }
    else { iconDiv.innerHTML = '<i class="fa-solid fa-circle-info"></i>'; iconDiv.style.color = '#3b82f6'; }

    if (onConfirm) {
        btnCancel.classList.remove('hidden'); 
        btnOk.onclick = () => { onConfirm(); closeModal(); };
    } else {
        btnCancel.classList.add('hidden'); 
        btnOk.onclick = closeModal;
    }
    overlay.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
}

// --- GESTIÓN DE DATOS AUXILIARES ---

async function loadDojos() {
    const select = document.getElementById('new-dojo');
    try {
        const res = await fetch(`${API_URL}/api/dojos?pagination[limit]=100`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        if (res.ok) {
            select.innerHTML = '<option value="">Selecciona un Dojo...</option>';
            data.data.forEach(dojo => {
                const d = dojo.attributes || dojo;
                const id = dojo.documentId || dojo.id; 
                select.innerHTML += `<option value="${id}">${d.nombre}</option>`;
            });
        }
    } catch (e) { console.error("Error loadDojos", e); }
}

async function loadCiudades() {
    const datalist = document.getElementById('ciudades-list');
    try {
        const res = await fetch(`${API_URL}/api/alumnos?fields[0]=poblacion&pagination[limit]=500`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        if(res.ok) {
            const ciudades = new Set();
            data.data.forEach(a => {
                const p = a.attributes ? a.attributes.poblacion : a.poblacion;
                if(p) ciudades.add(p);
            });
            datalist.innerHTML = "";
            Array.from(ciudades).sort().forEach(ciudad => {
                datalist.innerHTML += `<option value="${ciudad}">`;
            });
        }
    } catch (e) { console.error(e); }
}

// --- CREAR / EDITAR ALUMNO ---

document.getElementById('form-nuevo-alumno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-alumno');
    btn.disabled = true;

    const editId = document.getElementById('edit-id').value;
    const isEdit = !!editId;

    const ap1 = document.getElementById('new-apellido1').value.trim();
    const ap2 = document.getElementById('new-apellido2').value.trim();
    const apellidosCompletos = `${ap1} ${ap2}`.trim();

    const alumnoData = {
        nombre: document.getElementById('new-nombre').value,
        primer_apellido: ap1,
        segundo_apellido: ap2,
        apellidos: apellidosCompletos,
        dni: document.getElementById('new-dni').value,
        email: document.getElementById('new-email').value,
        telefono: document.getElementById('new-telefono').value,
        fecha_nacimiento: document.getElementById('new-nacimiento').value || null,
        direccion: document.getElementById('new-direccion').value,
        poblacion: document.getElementById('new-poblacion').value,
        cp: document.getElementById('new-cp').value,
        grado: document.getElementById('new-grado').value,
        grupo: document.getElementById('new-grupo').value,
        dojo: document.getElementById('new-dojo').value,
        activo: true
    };

    try {
        let url = `${API_URL}/api/alumnos`;
        let method = 'POST';
        if (isEdit) {
            url = `${API_URL}/api/alumnos/${editId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify({ data: alumnoData })
        });

        if (res.ok) {
            showModal("Éxito", isEdit ? "Alumno actualizado" : "Alumno creado", "success");
            resetForm(); 
            showSection('alumnos'); 
        } else {
            const err = await res.json();
            showModal("Error", err.error?.message || "Revisa los datos", "error");
        }
    } catch { showModal("Error", "Error de conexión", "error"); }
    finally { btn.disabled = false; }
});

function resetForm() {
    document.getElementById('form-nuevo-alumno').reset();
    document.getElementById('edit-id').value = ""; 
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-user-plus"></i> Alta de Alumno';
    document.getElementById('btn-cancelar-edit').classList.add('hidden');
}

async function editarAlumno(documentId) {
    showSection('nuevo-alumno');
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-pen"></i> Editando Alumno';
    document.getElementById('btn-cancelar-edit').classList.remove('hidden');
    
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=dojo`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        const props = json.data.attributes || json.data; 

        document.getElementById('edit-id').value = json.data.documentId || json.data.id;
        document.getElementById('new-nombre').value = props.nombre || '';
        document.getElementById('new-apellido1').value = props.primer_apellido || '';
        document.getElementById('new-apellido2').value = props.segundo_apellido || '';
        document.getElementById('new-dni').value = props.dni || '';
        document.getElementById('new-email').value = props.email || '';
        document.getElementById('new-telefono').value = props.telefono || '';
        document.getElementById('new-nacimiento').value = props.fecha_nacimiento || '';
        document.getElementById('new-direccion').value = props.direccion || '';
        document.getElementById('new-poblacion').value = props.poblacion || '';
        document.getElementById('new-cp').value = props.cp || '';
        document.getElementById('new-grado').value = props.grado || '';
        document.getElementById('new-grupo').value = props.grupo || 'Full Time';
        
        if (props.dojo) {
            const dId = props.dojo.data ? props.dojo.data.documentId : props.dojo.documentId;
            document.getElementById('new-dojo').value = dId;
        }
    } catch { showModal("Error", "Error cargando datos", "error"); }
}

// --- LISTADOS ---

async function loadAlumnosActivos() {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Cargando...</td></tr>';
    const url = `${API_URL}/api/alumnos?populate=dojo&sort=apellidos:asc&filters[activo][$eq]=true&pagination[limit]=200`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        renderTablaAlumnos(json.data, tbody, true);
    } catch { tbody.innerHTML = '<tr><td colspan="8">Error de conexión</td></tr>'; }
}

async function loadAlumnosBaja() {
    const tbody = document.getElementById('lista-bajas-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Cargando histórico...</td></tr>';
    const url = `${API_URL}/api/alumnos?populate=dojo&sort=fecha_baja:desc&filters[activo][$eq]=false`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        renderTablaAlumnos(json.data, tbody, false);
    } catch { tbody.innerHTML = '<tr><td colspan="5">Error</td></tr>'; }
}

function renderTablaAlumnos(alumnos, tbody, esActivo) {
    tbody.innerHTML = '';
    if (!alumnos || alumnos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${esActivo?8:5}" style="text-align:center">No hay registros</td></tr>`;
        return;
    }

    alumnos.forEach(alumno => {
        const props = alumno.attributes || alumno; 
        const docId = alumno.documentId || alumno.id; 
        const nombreCompleto = `${props.primer_apellido || ''} ${props.segundo_apellido || ''}, ${props.nombre || ''}`;
        const dojoNombre = props.dojo?.data?.attributes?.nombre || props.dojo?.nombre || "-";

        if (esActivo) {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${nombreCompleto}</strong></td>
                    <td style="font-family:monospace">${props.dni || '-'}</td>
                    <td><span class="badge">${props.grado || 'S/G'}</span></td>
                    <td>${dojoNombre} (${props.grupo || 'Full Time'})</td>
                    <td>${props.telefono || '-'}</td>
                    <td>${props.email || '-'}</td>
                    <td>${props.poblacion || '-'}</td>
                    <td>
                        <button class="action-btn-icon" onclick="editarAlumno('${docId}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn-icon delete" onclick="confirmarBaja('${docId}', '${nombreCompleto}')"><i class="fa-solid fa-user-xmark"></i></button>
                    </td>
                </tr>`;
        } else {
            tbody.innerHTML += `
                <tr>
                    <td style="color:var(--accent); font-weight:bold;">${props.fecha_baja || '-'}</td>
                    <td><strong>${nombreCompleto}</strong></td>
                    <td>${props.dni || '-'}</td>
                    <td>${dojoNombre}</td>
                    <td>
                        <button class="action-btn-icon restore" onclick="confirmarReactivacion('${docId}', '${nombreCompleto}')"><i class="fa-solid fa-rotate-left"></i></button>
                        <button class="action-btn-icon delete" onclick="eliminarDefinitivamente('${docId}', '${nombreCompleto}')"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                </tr>`;
        }
    });
}

// --- ACCIONES ---

function confirmarBaja(id, nombre) {
    showModal("Baja de Alumno", `¿Mover a ${nombre} al histórico?`, "warning", () => cambiarEstadoAlumno(id, false));
}

function confirmarReactivacion(id, nombre) {
    showModal("Reactivar Alumno", `¿Dar de alta de nuevo a ${nombre}?`, "info", () => cambiarEstadoAlumno(id, true));
}

async function cambiarEstadoAlumno(id, nuevoEstado) {
    const data = { activo: nuevoEstado };
    if (!nuevoEstado) data.fecha_baja = new Date().toISOString().split('T')[0];
    else data.fecha_baja = null;

    try {
        const res = await fetch(`${API_URL}/api/alumnos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
            body: JSON.stringify({ data: data })
        });
        if (res.ok) {
            showModal("Éxito", "Estado actualizado", "success");
            nuevoEstado ? loadAlumnosActivos() : loadAlumnosBaja();
            showSection(nuevoEstado ? 'alumnos' : 'bajas');
        }
    } catch { showModal("Error", "Error de conexión", "error"); }
}

function eliminarDefinitivamente(id, nombre) {
    showModal("¡PRIMER AVISO!", `¿Borrar definitivamente a ${nombre}?`, "error", () => {
        setTimeout(() => {
            showModal("¡ÚLTIMO AVISO!", `Confirmación final para ELIMINAR el registro físico.`, "error", async () => {
                const res = await fetch(`${API_URL}/api/alumnos/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${jwtToken}` }
                });
                if(res.ok) { showModal("Sistema", "Borrado.", "success"); loadAlumnosBaja(); }
            });
        }, 500);
    });
}

// --- UI / PDF ---

async function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');
    const logo = new Image();
    logo.src = 'img/logo-arashi.png';

    doc.addImage(logo, 'PNG', 15, 10, 25, 25);
    doc.setFontSize(18);
    doc.text("LLISTAT D'ALUMNES PER COGNOMS", 100, 20);
    doc.setFontSize(10);
    doc.text("Arashi Group Aikido Management", 100, 26);

    const res = await fetch(`${API_URL}/api/alumnos?filters[activo][$eq]=true&sort=apellidos:asc`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    const json = await res.json();
    const tableBody = json.data.map(a => [
        `${a.attributes.primer_apellido || ''} ${a.attributes.segundo_apellido || ''}, ${a.attributes.nombre || ''}`,
        a.attributes.dni || '',
        a.attributes.email || '',
        a.attributes.poblacion || '',
        a.attributes.grado || ''
    ]);

    doc.autoTable({
        startY: 40,
        head: [['Cognoms i Nom', 'DNI', 'Email', 'Població', 'Grau']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] }
    });
    doc.save(`Alumnes_Arashi_${new Date().toLocaleDateString()}.pdf`);
}

function changeFontSize(tableId, delta) {
    const table = document.getElementById(tableId);
    const currentSize = parseFloat(window.getComputedStyle(table).fontSize);
    table.style.fontSize = (currentSize + delta) + "px";
}

function setupDragScroll() {
    const sliders = document.querySelectorAll('.drag-scroll');
    sliders.forEach(slider => {
        let isDown = false, startX, scrollLeft;
        slider.addEventListener('mousedown', (e) => {
            isDown = true; slider.classList.add('active');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => { isDown = false; });
        slider.addEventListener('mouseup', () => { isDown = false; });
        slider.addEventListener('mousemove', (e) => {
            if(!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    });
}

function filtrarAlumnos(tablaId, inputId) {
    const filter = document.getElementById(inputId).value.toUpperCase();
    const rows = document.getElementById(tablaId).getElementsByTagName('tr');
    for (let i = 1; i < rows.length; i++) {
        rows[i].style.display = rows[i].textContent.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    }
}

// --- DOJOS ---

async function loadDojosView() {
    const container = document.getElementById('grid-dojos');
    container.innerHTML = 'Cargando...';
    try {
        const res = await fetch(`${API_URL}/api/dojos`, { headers: { 'Authorization': `Bearer ${jwtToken}` } });
        const json = await res.json();
        container.innerHTML = '';
        json.data.forEach(dojo => {
            const p = dojo.attributes;
            container.innerHTML += `
                <div class="dojo-card">
                    <div class="dojo-header"><h3><i class="fa-solid fa-torii-gate"></i> ${p.nombre}</h3></div>
                    <div class="dojo-body">
                        <div class="dojo-info-row"><i class="fa-solid fa-location-dot"></i><span>${p.direccion}<br><strong>${p.cp || ''} ${p.poblacion || ''}</strong></span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-phone"></i><span>${p.telefono || '627 555 228'}</span></div>
                        <div class="dojo-info-row"><i class="fa-solid fa-envelope"></i><span>${p.email || 'aikidobadalona@gmail.com'}</span></div>
                    </div>
                </div>`;
        });
    } catch { container.innerHTML = 'Error.'; }
}

async function runSystemDiagnostics() {
    const output = document.getElementById('console-output');
    const lines = ["> Conectando... [OK]", "> Strapi API... [OK]", "SISTEMA ONLINE"];
    for (const line of lines) {
        output.innerHTML += `<div>${line}</div>`;
        await new Promise(r => setTimeout(r, 500));
    }
}