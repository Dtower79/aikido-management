import pandas as pd
import requests
import os
import re
from datetime import datetime
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

API_URL = os.getenv("STRAPI_URL")
API_TOKEN = os.getenv("STRAPI_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

NOMBRE_DOJO_PRINCIPAL = "Aikido Arashi Badalona"

# --- FUNCIONES DE LIMPIEZA ---
def limpiar_dni(dato, contador_ficticio):
    if pd.notna(dato):
        texto = str(dato).strip().upper().replace('-', '').replace('.', '').replace(' ', '')
        if len(texto) > 4: return texto
    return f"PENDIENTE-{contador_ficticio}"

def limpiar_telefono(dato):
    if pd.isna(dato): return ""
    return re.sub(r'[^0-9]', '', str(dato))

def separar_nombre_completo(nombre_completo):
    """
    Separa 'Nombre Apellido1 Apellido2' en (Nombre, ApellidosString).
    """
    if pd.isna(nombre_completo): return "Desconocido", ""
    texto = str(nombre_completo).strip()
    partes = texto.split(" ", 1)
    nombre = partes[0].title()
    apellidos_str = partes[1].title() if len(partes) > 1 else ""
    return nombre, apellidos_str

def separar_apellidos(apellidos_str):
    """
    DIVISIÓN CRÍTICA PARA FRONTEND:
    Separa el string de apellidos en primer_apellido y segundo_apellido.
    Ej: "Garcia Lopez" -> "Garcia", "Lopez"
    """
    if not apellidos_str: return "", ""
    partes = apellidos_str.split(" ", 1)
    primer = partes[0].strip()
    segundo = partes[1].strip() if len(partes) > 1 else ""
    return primer, segundo

def separar_poblacion_cp(texto):
    if pd.isna(texto): return "", ""
    texto = str(texto).strip()
    match = re.search(r'\b\d{5}\b', texto)
    if match:
        cp = match.group(0)
        pob = texto.replace(cp, "").strip()
        return pob, cp
    return texto, ""

def limpiar_fecha(dato):
    if pd.isna(dato): return None
    texto = str(dato).strip()
    if isinstance(dato, datetime): return dato.strftime("%Y-%m-%d")
    
    meses = {"enero": "01", "febrero": "02", "marzo": "03", "abril": "04", "mayo": "05", "junio": "06", 
             "julio": "07", "agosto": "08", "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12"}
    
    for mes, num in meses.items():
        if mes in texto.lower():
            anio = re.search(r'\d{4}', texto)
            if anio: return f"{anio.group(0)}-{num}-01"

    try:
        dt = pd.to_datetime(texto, dayfirst=True)
        return dt.strftime("%Y-%m-%d")
    except: return None

# --- FUNCIONES STRAPI ---
def obtener_id_dojo_badalona():
    url = f"{API_URL}/api/dojos?filters[nombre][$eq]={NOMBRE_DOJO_PRINCIPAL}"
    try:
        resp = requests.get(url, headers=HEADERS)
        data = resp.json().get('data', [])
        if data: return data[0]['documentId']
        
        print(f"🏗️ Creando Dojo Principal...")
        payload = {"data": {"nombre": NOMBRE_DOJO_PRINCIPAL, "direccion": "Badalona"}}
        r = requests.post(f"{API_URL}/api/dojos", json=payload, headers=HEADERS)
        if r.status_code == 201: return r.json()['data']['documentId']
    except: pass
    return None

def tarea_crear_alumno(datos):
    """ Función aislada para ThreadPoolExecutor """
    try:
        # Check duplicado por DNI
        url_check = f"{API_URL}/api/alumnos?filters[dni][$eq]={datos['dni']}"
        check = requests.get(url_check, headers=HEADERS).json().get('data', [])
        
        if check:
            print(f"⚠️ Existe: {datos['nombre']} {datos['primer_apellido']}")
            return

        payload = {"data": datos}
        resp = requests.post(f"{API_URL}/api/alumnos", json=payload, headers=HEADERS)
        
        if resp.status_code == 201:
            print(f"🚀 OK: {datos['nombre']} {datos['primer_apellido']}")
        else:
            print(f"❌ Error {datos['nombre']}: {resp.text}")
    except Exception as e:
        print(f"❌ Excepción con {datos['nombre']}: {e}")

# --- PROCESO PRINCIPAL ---
def procesar_excel(ruta_archivo):
    print(f"📊 Leyendo Excel y preparando datos...")
    dojo_id = obtener_id_dojo_badalona()
    if not dojo_id: return print("❌ Error Dojo Principal")

    try: df = pd.read_excel(ruta_archivo, header=None)
    except Exception as e: return print(f"❌ Error Excel: {e}")

    grupo_actual = "General"
    contador_sin_dni = 1
    lista_para_enviar = []

    for index, row in df.iterrows():
        fila_texto = str(row.values).upper()
        if "FULL TIME" in fila_texto: grupo_actual = "Full Time"; continue
        elif "MAÑANAS" in fila_texto or "MANANAS" in fila_texto: grupo_actual = "Mañanas"; continue
        elif "KIDS" in fila_texto: grupo_actual = "Kids"; continue

        if index < 2: continue 

        c_nombre = row[2]; c_dni = row[3]; c_nacim = row[4]; c_direc = row[5]
        c_pob_cp = row[6]; c_email = row[7]; c_telf = row[8]; c_inicio = row[9]; c_grado = row[10]

        if pd.isna(c_nombre): continue
        nombre_str = str(c_nombre).strip()
        if "NOM I COGNOMS" in nombre_str.upper() or "BAJA" in nombre_str.upper(): continue

        dni_final = limpiar_dni(c_dni, contador_sin_dni)
        if "PENDIENTE" in dni_final: contador_sin_dni += 1

        # Separación Nombre vs Apellidos
        nombre, apellidos_full = separar_nombre_completo(nombre_str)
        # Separación Apellido1 vs Apellido2 (NECESARIO PARA FRONTEND SORT)
        ap1, ap2 = separar_apellidos(apellidos_full)
        
        poblacion, cp = separar_poblacion_cp(c_pob_cp)
        
        email_final = str(c_email).strip() if pd.notna(c_email) else ""
        if not email_final or "@" not in email_final:
            email_final = f"{dni_final.lower()}@sin-email.com"

        alumno = {
            "nombre": nombre, 
            "primer_apellido": ap1, # Campo crítico
            "segundo_apellido": ap2, # Campo crítico
            "apellidos": apellidos_full, # Legacy / Fallback
            "dni": dni_final,
            "email": email_final, 
            "telefono": limpiar_telefono(c_telf),
            "direccion": str(c_direc).strip() if pd.notna(c_direc) else "",
            "poblacion": poblacion, 
            "cp": cp,
            "fecha_nacimiento": limpiar_fecha(c_nacim),
            "fecha_inicio": limpiar_fecha(c_inicio),
            "grado": str(c_grado).strip() if pd.notna(c_grado) else "",
            "dojo": dojo_id,
            "grupo": grupo_actual,
            "activo": True
        }
        
        lista_para_enviar.append(alumno)

    total = len(lista_para_enviar)
    print(f"🔥 Iniciando carga masiva de {total} alumnos (10 hilos simultáneos)...")
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(tarea_crear_alumno, lista_para_enviar)
    
    print("\n✅ Migración finalizada.")

if __name__ == "__main__":
    procesar_excel("listado.xlsx")