"""
Lanzador de Escritorio Nativo para Nicobici.
Inicia el backend local y abre una ventana nativa de Windows (sin barras de navegador)
con la interfaz completa, rica y detallada de Nicobici.
"""
import sys
import os
import time
import socket
import subprocess
import threading
import webview


def check_port(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0


def start_backend():
    # Iniciar servidor Node.js local si no está corriendo
    if not check_port(3000):
        print("[*] Iniciando motor local de Nicobici...")
        node_cmd = ["node", "src/server.js"]
        p = subprocess.Popen(
            node_cmd,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        # Esperar hasta que el puerto 3000 responda
        for _ in range(30):
            time.sleep(0.3)
            if check_port(3000):
                break
        return p
    return None


def main():
    proc = start_backend()

    print("[*] Abriendo ventana de aplicacion de escritorio...")
    window = webview.create_window(
        title="Nicobici — Sistema de Gestión Comercial & Rodados",
        url="http://localhost:3000",
        width=1360,
        height=860,
        min_size=(1120, 680),
        background_color="#090d16"
    )

    webview.start()

    # Al cerrar la ventana, terminar el proceso backend si fue iniciado por el script
    if proc:
        proc.terminate()


if __name__ == "__main__":
    main()
