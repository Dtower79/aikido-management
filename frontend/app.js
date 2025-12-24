// --- CONFIGURACIÓN ---
const API_URL = "https://elegant-acoustics-3b7e60f840.strapiapp.com"; 

// --- ESTADO ---
let jwtToken = localStorage.getItem('aikido_jwt');
let userData = JSON.parse(localStorage.getItem('aikido_user'));

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Validadores de DNI en tiempo real (Login y Nuevo Alumno)
    setupDniInput('dni-login');
    setupDniInput('new-dni');

    if (jwtToken) {
        showDashboard();
    } else {
        showLogin();
    }
});

function setupDniInput(id) {
    const input = document.getElementById(id);
    if(input) {
        input.addEventListener('input', function (e) {
            e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
        });
    }
}

// --- VISTAS ---
function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    // Cargar datos iniciales necesarios
    loadDojos();
    // Por defecto mostramos la sección activa (Nuevo Alumno)
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`sec-${sectionId}`).classList.remove('hidden');
    
    const btn = document.querySelector(`button[onclick="showSection('${sectionId}')"]`);
    if(btn) btn.classList.add('active');

    // --- LÓGICA DE CARGA SEGÚN SECCIÓN ---
    if(sectionId === 'alumnos') loadAlumnos();
    if(sectionId === 'dojos') loadDojosView(); // <--- AÑADE ESTA LÍNEA
    if(sectionId === 'nuevo-alumno') loadDojos(); // Para rellenar el select
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
    localStorage.removeItem('aikido_jwt');
    localStorage.removeItem('aikido_user');
    location.reload(); // Recarga limpia
}

// --- GESTIÓN DE ALUMNOS ---

// 1. Cargar Dojos para el Select
async function loadDojos() {
    const select = document.getElementById('new-dojo');
    try {
        const res = await fetch(`${API_URL}/api/dojos?pagination[limit]=100`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        
        // Guardamos la selección actual si estamos editando
        const currentVal = select.value;

        select.innerHTML = '<option value="">Selecciona un Dojo...</option>';
        data.data.forEach(dojo => {
            const d = dojo.attributes || dojo;
            const id = dojo.documentId || dojo.id; 
            select.innerHTML += `<option value="${id}">${d.nombre}</option>`;
        });

        if(currentVal) select.value = currentVal;

    } catch (e) { console.error("Error cargando dojos", e); }
}

// 2. Crear O Editar Alumno (Lógica Mixta)
document.getElementById('form-nuevo-alumno').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-alumno');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Procesando...";

    // Miramos si hay un ID oculto (Modo Edición)
    const editId = document.getElementById('edit-id').value;
    const isEdit = !!editId;

    // Recoger datos
    const alumnoData = {
        nombre: document.getElementById('new-nombre').value,
        apellidos: document.getElementById('new-apellidos').value,
        dni: document.getElementById('new-dni').value,
        email: document.getElementById('new-email').value,
        telefono: document.getElementById('new-telefono').value,
        fecha_nacimiento: document.getElementById('new-nacimiento').value || null, // null si está vacío para que no falle date
        direccion: document.getElementById('new-direccion').value,
        poblacion: document.getElementById('new-poblacion').value,
        cp: document.getElementById('new-cp').value,
        grado: document.getElementById('new-grado').value,
        grupo: document.getElementById('new-grupo').value,
        dojo: document.getElementById('new-dojo').value 
    };

    try {
        let url = `${API_URL}/api/alumnos`;
        let method = 'POST';

        // Si es edición, cambiamos URL y método
        if (isEdit) {
            url = `${API_URL}/api/alumnos/${editId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ data: alumnoData })
        });

        if (res.ok) {
            showModal("Éxito", isEdit ? "Alumno actualizado correctamente" : "Alumno creado correctamente", "success");
            resetForm(); // Limpiar y volver a modo creación
            showSection('alumnos'); // Volver a la tabla
            loadAlumnos(); // Recargar lista para ver cambios
        } else {
            const err = await res.json();
            // CAMBIO AQUÍ
            showModal("Error", err.error?.message || "Revisa los datos introducidos", "error");
        }
    } catch (error) {
        console.error(error);
        // CAMBIO AQUÍ
        showModal("Error de Conexión", "No se pudo contactar con el servidor", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
});

// Función para limpiar el formulario y salir del modo edición
function resetForm() {
    document.getElementById('form-nuevo-alumno').reset();
    document.getElementById('edit-id').value = ""; // Borrar ID
    
    // Restaurar textos y botones
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-user-plus"></i> Alta de Alumno';
    document.getElementById('btn-submit-alumno').innerText = "GUARDAR ALUMNO";
    document.getElementById('btn-cancelar-edit').classList.add('hidden');
}

// 3. Preparar Edición (Se llama al hacer clic en el lápiz)
async function editarAlumno(documentId) {
    // 1. Ir a la vista de formulario
    showSection('nuevo-alumno');
    
    // 2. Cambiar títulos visuales
    document.querySelector('#sec-nuevo-alumno h2').innerHTML = '<i class="fa-solid fa-pen"></i> Editant Alumne';
    document.getElementById('btn-submit-alumno').innerText = "ACTUALIZAR DATOS";
    document.getElementById('btn-cancelar-edit').classList.remove('hidden');
    
    // 3. Cargar datos del alumno desde la API (para tener todos los campos, no solo los de la tabla)
    // Usamos el documentId que es el estándar de Strapi v5
    try {
        const res = await fetch(`${API_URL}/api/alumnos/${documentId}?populate=dojo`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const json = await res.json();
        const data = json.data; // En v5 data es el objeto directo, en v4 data.attributes
        const props = data.attributes || data; // Compatibilidad

        // 4. Rellenar campos
        document.getElementById('edit-id').value = data.documentId || data.id;
        document.getElementById('new-nombre').value = props.nombre || '';
        document.getElementById('new-apellidos').value = props.apellidos || '';
        document.getElementById('new-dni').value = props.dni || '';
        document.getElementById('new-email').value = props.email || '';
        document.getElementById('new-telefono').value = props.telefono || '';
        document.getElementById('new-nacimiento').value = props.fecha_nacimiento || '';
        document.getElementById('new-direccion').value = props.direccion || '';
        document.getElementById('new-poblacion').value = props.poblacion || '';
        document.getElementById('new-cp').value = props.cp || '';
        document.getElementById('new-grado').value = props.grado || '';
        document.getElementById('new-grupo').value = props.grupo || 'General';
        
        // El select de Dojo puede tardar en cargar, así que esperamos un poco o seteamos valor
        if (props.dojo) {
            // Strapi v5 devuelve el objeto relacionado directo o en data
            const dojoId = props.dojo.documentId || (props.dojo.data ? props.dojo.data.documentId : null) || props.dojo.id;
            if(dojoId) document.getElementById('new-dojo').value = dojoId;
        }

    } catch (e) {
        console.error("Error cargando alumno", e);
        alert("No se pudieron cargar los datos del alumno.");
        showSection('alumnos');
    }
}

// 4. Listar Alumnos (Tabla)
async function loadAlumnos() {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '<tr><td colspan="5" class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/api/alumnos?populate=*&sort=apellidos:asc&pagination[limit]=100`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await response.json();
        
        if (response.ok) renderTablaAlumnos(data.data);
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5">Error de conexión</td></tr>';
    }
}

function renderTablaAlumnos(alumnos) {
    const tbody = document.getElementById('lista-alumnos-body');
    tbody.innerHTML = '';

    if (!alumnos || alumnos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No hay alumnos.</td></tr>';
        return;
    }

    alumnos.forEach(alumno => {
        const props = alumno.attributes || alumno; 
        const docId = alumno.documentId || alumno.id; // Clave para editar

        let dojoNombre = "-";
        if (props.dojo) {
             const d = props.dojo.data ? props.dojo.data.attributes : props.dojo;
             // Ajuste para Strapi v5 que a veces devuelve el objeto directo
             if(d && d.nombre) dojoNombre = d.nombre;
             else if (props.dojo.nombre) dojoNombre = props.dojo.nombre;
        }
        
        const grupo = props.grupo ? ` (${props.grupo})` : "";

        const row = `
            <tr>
                <td><strong>${props.apellidos || ''}</strong>, ${props.nombre || ''}</td>
                <td style="font-family: monospace;">${props.dni || '-'}</td>
                <td><span class="badge">${props.grado || 'S/G'}</span></td>
                <td>${dojoNombre}${grupo}</td>
                <td>
                    <!-- AQUÍ LLAMAMOS A LA FUNCIÓN DE EDITAR -->
                    <button class="action-btn-icon" onclick="editarAlumno('${docId}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function filtrarAlumnos() {
    const filter = document.getElementById('search-alumno').value.toUpperCase();
    const tr = document.getElementById('tabla-alumnos').getElementsByTagName('tr');

    for (let i = 1; i < tr.length; i++) { 
        const tdNombre = tr[i].getElementsByTagName('td')[0];
        const tdDNI = tr[i].getElementsByTagName('td')[1];
        if (tdNombre || tdDNI) {
            const txt = (tdNombre.textContent + tdDNI.textContent).toUpperCase();
            tr[i].style.display = txt.indexOf(filter) > -1 ? "" : "none";
        }
    }
}

// --- GESTIÓN DE DOJOS ---

async function loadDojosView() {
    const container = document.getElementById('grid-dojos');
    container.innerHTML = '<p class="loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando dojos...</p>';

    try {
        const response = await fetch(`${API_URL}/api/dojos?pagination[limit]=100`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await response.json();
        
        if (response.ok) {
            renderDojosCards(data.data);
        } else {
            container.innerHTML = '<p>Error cargando datos.</p>';
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p>Error de conexión.</p>';
    }
}

function renderDojosCards(dojos) {
    const container = document.getElementById('grid-dojos');
    container.innerHTML = '';

    if (!dojos || dojos.length === 0) {
        container.innerHTML = '<p>No hay dojos registrados.</p>';
        return;
    }

    dojos.forEach(dojo => {
        // Compatibilidad v4/v5
        const props = dojo.attributes || dojo;
        
        // Datos seguros (por si están vacíos en la BD)
        const nombre = props.nombre || "Dojo Sin Nombre";
        const direccion = props.direccion || "Dirección no disponible";
        const poblacion = props.poblacion || "";
        const web = props.web || "#";
        const webText = props.web ? "Visitar Web" : "";

        const card = `
            <div class="dojo-card">
                <div class="dojo-header">
                    <h3><i class="fa-solid fa-torii-gate"></i> ${nombre}</h3>
                    <!-- <span class="student-count"><i class="fa-solid fa-users"></i> ?</span> -->
                </div>
                <div class="dojo-body">
                    <div class="dojo-info-row">
                        <i class="fa-solid fa-map-location-dot"></i>
                        <span>${direccion}<br><strong>${poblacion}</strong></span>
                    </div>
                    
                    ${webText ? `
                    <div class="dojo-info-row">
                        <i class="fa-solid fa-globe"></i>
                        <a href="${web}" target="_blank" class="dojo-link">${webText}</a>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        container.innerHTML += card;
    });
}

// --- SISTEMA DE MODALES ---
function showModal(title, message, type = 'info') {
    const overlay = document.getElementById('custom-modal');
    const iconDiv = document.getElementById('modal-icon');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-message');

    // Configurar contenido
    titleEl.innerText = title;
    msgEl.innerText = message;
    
    // Iconos y colores según tipo
    if (type === 'success') {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        iconDiv.style.color = '#10b981'; // Verde
    } else if (type === 'error') {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
        iconDiv.style.color = '#ef4444'; // Rojo
    } else {
        iconDiv.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
        iconDiv.style.color = '#3b82f6'; // Azul
    }

    // Mostrar
    overlay.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('custom-modal').classList.add('hidden');
}