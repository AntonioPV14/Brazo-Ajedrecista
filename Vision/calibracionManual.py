import cv2
import numpy as np
import json
import argparse
import sys

# --- Configuración de Argumentos (Rotación del tablero) ---
parser = argparse.ArgumentParser()
parser.add_argument("--rotate", type=int, default=0,
                    choices=[0, 90, 180, 270],
                    help="Rotación de la orientación del tablero con respecto a la cámara (CW). "
                         "Ej: cámara desde la derecha = 90, desde atrás = 180, desde la izquierda = 270.")
args = parser.parse_args()
CAM_ROT = args.rotate

# Global list to store the 4 corner points (mouse click)
points = []

# --- Logic Functions ---

def mouse_click(event, x, y, flags, param):
    """Handles the mouse click event to capture the 4 vertices."""
    global points
    if event == cv2.EVENT_LBUTTONDOWN:
        if len(points) < 4:
            points.append((x, y))
            print(f"[INFO] Point {len(points)}: {x}, {y}")
        else:
            print("[INFO] Already 4 points. Press 'r' to reset or 's' to save.")

def remap_index(r_disp, c_disp, cam_rot):
    """
    Remaps the index (row, column) from the camera view
    to standard board notation (A1-H8), according to the rotation.
    """
    if cam_rot == 0:
        r_std, c_std = r_disp, c_disp
    elif cam_rot == 90:
        # 90 degrees CW: column becomes row, row becomes 7 - column
        r_std, c_std = c_disp, 7 - r_disp
    elif cam_rot == 180:
        r_std, c_std = 7 - r_disp, 7 - c_disp
    elif cam_rot == 270:
        # 270 degrees CW: column becomes 7 - row, row becomes column
        r_std, c_std = 7 - c_disp, r_disp
    else:
        r_std, c_std = r_disp, c_disp
    return r_std, c_std

# --- Robust Camera Opening ---

cap = None
# Camera switching support: start at index 0 and allow cycling with 'n'
cam_index = 0
MAX_CAMERA_TRIES = 5  # how many indices to consider when cycling

def open_camera(index):
    """Try to open camera at given index. Try default then CAP_DSHOW on Windows."""
    c = cv2.VideoCapture(index)
    if c is not None and c.isOpened():
        return c
    # try DSHOW backend (Windows) as fallback
    try:
        c2 = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if c2 is not None and c2.isOpened():
            return c2
        if c2 is not None:
            c2.release()
    except Exception:
        # backend not available or error — ignore
        pass
    if c is not None:
        c.release()
    return None

# Try to open initial camera by scanning a small range
found = False
for i in range(MAX_CAMERA_TRIES):
    cap = open_camera(i)
    if cap is not None:
        cam_index = i
        print(f"[INFO] Camera opened with index: {cam_index}")
        found = True
        break

if not found:
    print(f"❌ ERROR: No camera could be opened (tried 0..{MAX_CAMERA_TRIES-1}).")
    sys.exit(1)

# --- Bucle Principal de Calibración ---

cv2.namedWindow("Calibracion Papan") # Renombrado a español
cv2.setMouseCallback("Calibracion Papan", mouse_click)

print("\n📸 Instrucciones:")
print(" 1️⃣ Apunta la cámara a la posición final.")
print(" 2️⃣ **CLICKEA 4 VÉRTICES:** Arriba-Izquierda, Arriba-Derecha, Abajo-Derecha, Abajo-Izquierda.")
print(" 3️⃣ Pulsa 'r' para reiniciar, 's' para guardar sqdict.json, 'q' para salir.")
print(f"[INFO] Rotación del tablero relativa a la cámara: {CAM_ROT}° (CW)\n")

while True:
    ret, frame = cap.read()
    if not ret:
        continue

    vis = frame.copy()

    # Dibujar los puntos de clic
    for idx, p in enumerate(points):
        cv2.circle(vis, p, 6, (0, 0, 255), -1)
        cv2.putText(vis, str(idx+1), (p[0]+8, p[1]-8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

    if len(points) == 4:
        # Dibujar el recuadro y la cuadrícula
        pts = np.array(points, dtype=np.int32)
        cv2.polylines(vis, [pts], True, (255,255,255), 2)

        # Definir los 4 puntos objetivo para la transformación de perspectiva.
        # En una cuadrícula de 8x8, los puntos son (0,0), (8,0), (8,8), (0,8)
        src = np.array([[0,0],[8,0],[8,8],[0,8]], dtype=np.float32)
        dst = np.array(points, dtype=np.float32)
        H = cv2.getPerspectiveTransform(src, dst)

        # Generar las coordenadas de la cuadrícula de 9x9 para dibujar
        src_grid = np.array([[[x,y] for x in range(9)] for y in range(9)], dtype=np.float32)
        dst_grid = cv2.perspectiveTransform(src_grid.reshape(-1,1,2), H).reshape(9,9,2)

        # Dibujar la cuadrícula proyectada
        for r in range(9):
            cv2.polylines(vis, [dst_grid[r,:,:].astype(int)], False, (180,180,180), 1)
        for c in range(9):
            cv2.polylines(vis, [dst_grid[:,c,:].astype(int)], False, (180,180,180), 1)

        # Trazar la notación estándar del tablero (A1-H8)
        files = 'abcdefgh'
        ranks = '87654321'
        font = cv2.FONT_HERSHEY_SIMPLEX

        for r in range(8):
            for c in range(8):
                # Aplicar la rotación para obtener la notación correcta
                r_std, c_std = remap_index(r, c, CAM_ROT)
                file_letter = files[c_std]
                rank_char = ranks[r_std]
                label = f"{file_letter}{rank_char}"

                # Calcular el centro de la casilla para colocar la etiqueta
                center = dst_grid[r, c] + (dst_grid[r+1, c+1] - dst_grid[r, c]) / 2
                cx, cy = int(center[0]), int(center[1])
                cv2.putText(vis, label, (cx-12, cy+5), font, 0.5, (0,255,255), 1, cv2.LINE_AA)

    cv2.imshow("Calibracion Papan", vis)
    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        print("Saliendo sin guardar.")
        break
    elif key == ord('r'):
        points = []
        print("[INFO] Reiniciar puntos.")
    elif key == ord('s'):
        # --- Lógica de Guardado ---
        if len(points) != 4:
            print("[WARN] Debes hacer clic en 4 puntos antes de guardar.")
            continue

        # Recalcular H y dst_grid (transformación)
        src = np.array([[0,0],[8,0],[8,8],[0,8]], dtype=np.float32)
        dst = np.array(points, dtype=np.float32)
        H = cv2.getPerspectiveTransform(src, dst)

        src_grid = np.array([[[x,y] for x in range(9)] for y in range(9)], dtype=np.float32)
        dst_grid = cv2.perspectiveTransform(src_grid.reshape(-1,1,2), H).reshape(9,9,2)
        
        # Mapear las 64 casillas a sus polígonos de píxeles
        displayed_squares = {}
        for r in range(8):
            for c in range(8):
                # 4 vértices del polígono de la casilla (r, c)
                tl = dst_grid[r, c].tolist()
                tr = dst_grid[r, c+1].tolist()
                br = dst_grid[r+1, c+1].tolist()
                bl = dst_grid[r+1, c].tolist()
                displayed_squares[(r,c)] = [tl,tr,br,bl]

        # Reasignar el polígono de píxeles a la notación de ajedrez estándar
        files = 'abcdefgh'
        ranks = '87654321'
        squares_std = {}
        for (r_disp, c_disp), poly in displayed_squares.items():
            r_std, c_std = remap_index(r_disp, c_disp, CAM_ROT)
            file_letter = files[c_std]
            rank_char = ranks[r_std]
            squares_std[f"{file_letter}{rank_char}"] = poly

        with open('sqdict.json', 'w') as f:
            json.dump(squares_std, f, indent=2)
        print(f"[✅] sqdict.json guardado con rotación {CAM_ROT}° (notación ajustada).")
        break
    elif key == ord('n'):
        # Cycle to next camera index
        print("[INFO] Cambiar cámara: intentando siguiente índice...")
        # release current
        try:
            cap.release()
        except Exception:
            pass
        switched = False
        # try up to MAX_CAMERA_TRIES different indices starting from next
        for offset in range(1, MAX_CAMERA_TRIES+1):
            next_index = (cam_index + offset) % MAX_CAMERA_TRIES
            newcap = open_camera(next_index)
            if newcap is not None:
                cap = newcap
                cam_index = next_index
                points = []
                print(f"[INFO] Cámara cambiada a índice: {cam_index}. Puntos reiniciados.")
                switched = True
                break
        if not switched:
            # try to reopen previous camera as fallback
            print("[WARN] No se encontró otra cámara. Reabriendo cámara anterior...")
            cap = open_camera(cam_index)

# Liberar recursos
cap.release()
cv2.destroyAllWindows()