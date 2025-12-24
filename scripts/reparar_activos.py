import requests
import os
from dotenv import load_dotenv

# Cargar credenciales
load_dotenv()

API_URL = os.getenv("STRAPI_URL")
API_TOKEN = os.getenv("STRAPI_TOKEN")

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

def reparar():
    print(f"🚑 Conectando a: {API_URL}")
    print("⏳ Buscando alumnos sin estado definido...")
    
    # 1. Obtener alumnos
    try:
        r = requests.get(f"{API_URL}/api/alumnos?pagination[limit]=1000", headers=HEADERS)
        if r.status_code != 200:
            print(f"❌ Error de conexión: {r.status_code}")
            return
            
        alumnos = r.json().get('data', [])
        print(f"📋 Analizando {len(alumnos)} alumnos...")
        
        arreglados = 0
        for alum in alumnos:
            # Strapi v4 usa attributes, v5 es directo
            datos = alum.get('attributes', alum)
            id_alum = alum.get('documentId') or alum.get('id')
            
            # Si no tiene el campo activo o es null, lo ponemos a True
            if datos.get('activo') is None:
                print(f"🔧 Activando a: {datos.get('nombre')} {datos.get('apellidos')}...")
                
                # Actualizar
                url_put = f"{API_URL}/api/alumnos/{id_alum}"
                payload = {"data": {"activo": True}}
                res_put = requests.put(url_put, json=payload, headers=HEADERS)
                
                if res_put.status_code == 200:
                    arreglados += 1
                else:
                    print(f"❌ Fallo al guardar: {res_put.text}")
        
        print(f"\n✅ FIN. Se han reactivado {arreglados} alumnos.")
        print("Ahora ya deberían salir en la web.")

    except Exception as e:
        print(f"❌ Error crítico: {e}")

if __name__ == "__main__":
    reparar()