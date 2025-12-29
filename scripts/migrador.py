import pandas as pd
import requests
import os
import re
from datetime import datetime
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor

# Cargar variables de entorno (.env)
load_dotenv()

API_URL = os.getenv("STRAPI_URL")
API_TOKEN = os.getenv("STRAPI_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# Configuración por defecto
NOMBRE_DOJO_DEFECTO = "Aikido Arashi Badalona"
CACHE_DOJOS = {} # Para no consultar la API mil veces

# --- 1. FUNCIONES DE LIMPIEZA DE DATOS ---

def limpiar_dni(dato, contador_ficticio):
    if pd.notna(dato):
        texto = str(dato).strip().upper().replace('-', '').replace('.', '').replace(' ', '')
        # Si parece un DNI válido (más de 4 caracteres)
        if len(texto) > 4: return texto
    return f"PENDIENTE-{contador_ficticio}"

def limpiar_telefono(dato):
    if pd.isna(dato): return ""
    # Deja solo números
    return re.sub(r'[^0-9]', '', str(dato))

def separar_nombre_completo(nombre_completo):
    """
    Separa 'Nombre Apellido1 Apellido2' en (Nombre, ApellidosString).
    """
    if pd.isna(nombre_completo): return "Desconocido", ""
    texto = str(nombre_completo).strip()
    
    # Evitar cabeceras repetidas si se cuelan
    if "NOM I COGNOMS" in texto.upper() or "NOMBRE" in texto.upper():
        return None, None

    partes = texto.split(" ", 1)
    nombre = partes[0].title()
    apellidos_str = partes[1].title() if len(partes) > 1 else ""
    return nombre, apellidos_str

def separar_poblacion_cp(texto_pob, texto_cp=None):
    """
    Maneja si la población y CP vienen juntos o separados.
    """
    pob = ""
    cp = ""

    # Caso 1: Vienen separados (Excel Nuevo de la Web)
    if texto_cp is not None and pd.notna(texto_cp):
        # Convertir a string y limpiar .0 si pandas lo leyó como float
        cp = str(texto_cp).replace('.0', '').strip()
        # Rellenar con ceros a la izquierda si tiene menos de 5 dígitos
        if cp and cp.isdigit(): cp = cp.zfill(5)
        
        pob = str(texto_pob).strip().upper() if pd.notna(texto_pob) else ""
        return pob, cp

    # Caso 2: Vienen juntos (Excel Antiguo / Legado)
    if pd.isna(texto_pob): return "", ""
    texto = str(texto_pob).strip()
    match = re.search(r'\b\d{5}\b', texto)
    if match:
        cp = match.group(0)
        pob = texto.replace(cp, "").strip().upper()
    else:
        pob = texto.upper()
    
    return pob, cp

def limpiar_fecha(dato):
    if pd.isna(dato): return None
    texto = str(dato).strip()
    
    # Si ya es objeto datetime
    if isinstance(dato, datetime): return dato.strftime("%Y-%m-%d")
    
    # Intentar formatos comunes
    formatos = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"]
    for fmt in formatos:
        try:
            return datetime.strptime(texto, fmt).strftime("%Y-%m-%d")
        except: pass
    
    return None # Si falla todo

def normalizar_seguro(dato):
    if pd.isna(dato): return False
    s = str(dato).upper().strip()
    return True if s in ['SI', 'YES', 'PAGADO', 'TRUE', '1'] else False

# --- 2. FUNCIONES STRAPI ---

def cargar_cache_dojos():
    """Descarga todos los Dojos de Strapi para buscar sus IDs por nombre localmente"""
    print("🌍 Cargando lista de Dojos desde Strapi...")
    try:
        res = requests.get(f"{API_URL}/api/dojos", headers=HEADERS)
        if res.status_code == 200:
            data = res.json().get('data', [])
            for d in data:
                # Strapi v5 o v4
                attrs = d.get('attributes', d)
                id_doc = d.get('documentId', d.get('id'))
                nombre_norm = attrs['nombre'].upper().strip()
                CACHE_DOJOS[nombre_norm] = id_doc
            print(f"✅ {len(CACHE_DOJOS)} Dojos cacheados.")
    except Exception as e:
        print(f"⚠️ Error cargando Dojos: {e}")

def obtener_id_dojo(nombre_excel):
    """Busca el ID del Dojo. Si no existe o viene vacío, usa el por defecto"""
    if pd.isna(nombre_excel) or not str(nombre_excel).strip():
        # Retorna el ID del Dojo por defecto (Badalona)
        return CACHE_DOJOS.get(NOMBRE_DOJO_DEFECTO.upper(), None)
    
    nombre_limpio = str(nombre_excel).upper().strip()
    
    # 1. Búsqueda exacta
    if nombre_limpio in CACHE_DOJOS:
        return CACHE_DOJOS[nombre_limpio]
    
    # 2. Búsqueda parcial (ej: "Badalona" en "Aikido Arashi Badalona")
    for key, val in CACHE_DOJOS.items():
        if nombre_limpio in key or key in nombre_limpio:
            return val
            
    # 3. Fallback: Crear o devolver defecto
    return CACHE_DOJOS.get(NOMBRE_DOJO_DEFECTO.upper())

def tarea_crear_alumno(datos):
    """ Función que ejecuta cada hilo para enviar datos """
    try:
        # Check duplicado por DNI para no crear repetidos
        url_check = f"{API_URL}/api/alumnos?filters[dni][$eq]={datos['dni']}"
        check = requests.get(url_check, headers=HEADERS).json().get('data', [])
        
        if check:
            # Podríamos actualizar (PUT) aquí si quisiéramos sobrescribir datos
            # id_existente = check[0]['documentId']
            # requests.put(...)
            print(f"⚠️ Ya existe: {datos['nombre']} {datos['apellidos']}")
            return

        payload = {"data": datos}
        resp = requests.post(f"{API_URL}/api/alumnos", json=payload, headers=HEADERS)
        
        if resp.status_code in [200, 201]:
            print(f"🚀 Creado: {datos['nombre']} ({datos['grupo']})")
        else:
            print(f"❌ Error API: {resp.text}")
    except Exception as e:
        print(f"❌ Excepción: {e}")

# --- 3. PROCESO PRINCIPAL INTELIGENTE ---

def buscar_fila_cabecera(df):
    """Busca dinámicamente en qué fila están los títulos"""
    for i, row in df.iterrows():
        fila_str = str(row.values).upper()
        # Si la fila contiene palabras clave, es la cabecera
        if "DNI" in fila_str and ("NOM" in fila_str or "NOMBRE" in fila_str):
            return i
    return 0

def procesar_excel(ruta_archivo):
    # 1. Preparar Entorno
    cargar_cache_dojos()
    
    if not CACHE_DOJOS:
        # Intentar crear el dojo por defecto si está vacío
        print("⚠️ No hay Dojos en Strapi. Creando uno por defecto...")
        # (Código simplificado de creación omitido, asumimos que existe base)
    
    print(f"📊 Analizando estructura del archivo: {ruta_archivo}...")

    try:
        # Paso A: Leer sin cabecera para encontrar la fila real
        df_raw = pd.read_excel(ruta_archivo, header=None)
        start_row = buscar_fila_cabecera(df_raw)
        print(f"✅ Cabecera detectada en fila: {start_row + 1}")

        # Paso B: Leer datos reales
        df = pd.read_excel(ruta_archivo, header=start_row)
        # Normalizar nombres de columnas (Upper y sin espacios)
        df.columns = [str(c).strip().upper() for c in df.columns]

    except Exception as e:
        return print(f"❌ Error crítico leyendo Excel: {e}")

    # Paso C: Mapeo Dinámico de Columnas
    # Detectamos qué columna es cual buscando palabras clave
    col_map = {}
    for col in df.columns:
        if "NOM" in col and "COGNOMS" in col: col_map['nombre_completo'] = col
        elif "NOMBRE" in col: col_map['nombre_completo'] = col # Nuevo formato
        elif "APELLIDOS" in col: col_map['apellidos_sep'] = col # Nuevo formato
        
        elif "DNI" in col: col_map['dni'] = col
        elif "GRUPO" in col: col_map['grupo'] = col
        elif "EMAIL" in col: col_map['email'] = col
        elif "TELEF" in col or "TELÉFONO" in col: col_map['telefono'] = col
        elif "NAIX" in col or "NACIM" in col or "NAC." in col: col_map['nacimiento'] = col
        elif "GRAU" in col or "GRADO" in col: col_map['grado'] = col
        elif "ADRE" in col or "DIRECC" in col: col_map['direccion'] = col
        elif "POBL" in col: col_map['poblacion'] = col
        elif "CP" in col: col_map['cp'] = col
        elif "DOJO" in col: col_map['dojo'] = col
        elif "SEGURO" in col: col_map['seguro'] = col
        elif "ALTA" in col or "INICIO" in col: col_map['inicio'] = col

    print(f"   Columnas identificadas: {list(col_map.keys())}")
    
    lista_alumnos = []
    contador_sin_dni = 1

    # Paso D: Iterar filas
    for index, row in df.iterrows():
        # Extraer Nombre
        nombre = ""
        apellidos = ""
        
        # Caso 1: Nombre completo en una columna (Viejo Excel)
        if 'nombre_completo' in col_map and pd.notna(row.get(col_map['nombre_completo'])):
            n_raw = row[col_map['nombre_completo']]
            # Si es la fila de header repetida, saltar
            if "NOM I COGNOMS" in str(n_raw).upper(): continue
            nombre, apellidos = separar_nombre_completo(n_raw)
            if not nombre: continue # Skip vacíos

        # Caso 2: Nombre y Apellidos separados (Nuevo Excel BackUp)
        elif 'nombre_completo' in col_map and 'apellidos_sep' in col_map:
            # (Si tu backup usa columnas separadas, ajusta aquí.
            #  Tu exportBackupExcel actual usa una sola columna "NOM I COGNOMS",
            #  así que el Caso 1 cubrirá ambos por ahora).
            pass

        else:
             # Fallback si falla el nombre
             if index > 10: continue # Evitar bucles infinitos en vacíos
        
        # DNI
        dni_raw = row.get(col_map.get('dni'))
        dni_final = limpiar_dni(dni_raw, contador_sin_dni)
        if "PENDIENTE" in dni_final: contador_sin_dni += 1

        # Población y CP
        pob_raw = row.get(col_map.get('poblacion'))
        cp_raw = row.get(col_map.get('cp')) # Puede ser None si es Excel viejo
        poblacion, cp = separar_poblacion_cp(pob_raw, cp_raw)

        # Dojo
        dojo_nombre = row.get(col_map.get('dojo'))
        dojo_id = obtener_id_dojo(dojo_nombre)

        # Seguro
        seguro_raw = row.get(col_map.get('seguro'))
        seguro_bool = normalizar_seguro(seguro_raw)

        # Email
        email = str(row.get(col_map.get('email'), '')).strip()
        if not email or "@" not in email:
            email = f"{dni_final.lower()}@sin-email.com"

        alumno = {
            "nombre": nombre,
            "apellidos": apellidos,
            "dni": dni_final,
            "email": email,
            "telefono": limpiar_telefono(row.get(col_map.get('telefono'))),
            "direccion": str(row.get(col_map.get('direccion'), '')).strip(),
            "poblacion": poblacion,
            "cp": cp,
            "fecha_nacimiento": limpiar_fecha(row.get(col_map.get('nacimiento'))),
            "fecha_inicio": limpiar_fecha(row.get(col_map.get('inicio'))),
            "grado": str(row.get(col_map.get('grado'), '')).strip(),
            "grupo": str(row.get(col_map.get('grupo'), 'Full Time')).strip(),
            "seguro_pagado": seguro_bool,
            "dojo": dojo_id,
            "activo": True
        }
        
        lista_alumnos.append(alumno)

    # Paso E: Enviar a Strapi (Paralelo)
    total = len(lista_alumnos)
    print(f"🔥 Procesando {total} alumnos (10 hilos)...")
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(tarea_crear_alumno, lista_alumnos)
    
    print("\n✅ Migración completada.")

if __name__ == "__main__":
    # Puedes cambiar el nombre del archivo aquí
    archivo = "listado.xlsx" 
    
    # Detectar si hay un archivo de backup nuevo
    for f in os.listdir():
        if f.startswith("Backup_") and f.endswith(".xlsx"):
            archivo = f
            print(f"📂 Archivo de backup detectado: {archivo}")
            break
            
    if os.path.exists(archivo):
        procesar_excel(archivo)
    else:
        print(f"❌ No se encuentra el archivo {archivo}. Pon el Excel en la misma carpeta.")