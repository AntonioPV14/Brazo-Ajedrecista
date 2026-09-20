/*
  control.ino
  Combina control del motor paso a paso (base) y los servos (brazo)
  Añade sub-posiciones por columna: se usan cuando la casilla destino
  está en filas 6..8 (mayor que 5). El comando principal es:
    MOVER PIEZA A2 A7
  que recogerá en A2 y colocará en A7 usando la sub-posicion de A

  Basado en los sketches existentes `motor.ino` y `servo.ino`.
*/

#include <AccelStepper.h>
#include <Servo.h>
#include <EEPROM.h>

// ======================== PINES y CONSTANTES ========================
// Pines stepper (igual que en los sketches originales)
#define STEP_PIN    3
#define DIR_PIN     2
#define ENABLE_PIN  4
#define M0_PIN      7
#define M1_PIN      6
#define M2_PIN      5

// Pines servos
#define PIN_HOMBRO 12
#define PIN_CODO 13
#define PIN_GARRA 11

// Motor config
const float stepsPerRevolution = 200;
const int microstepSetting = 32;
const float accelerationStepsPerSec2 = 2000.0;
const int DELAY_PRENDER_MOTOR = 50; // ms
float currentRPM = 40.0;

AccelStepper stepper(AccelStepper::DRIVER, STEP_PIN, DIR_PIN);

// ======================== POSICIONES BASE (normal + sub) ========================
// Índice 0 = HOME. [1..8] = A..H
const long BASE_NORMAL[] = {
  0L,        // [0] HOME
  -130900L,  // [1] = A (casillas 1..5)
  -245900L,  // [2] = B
  -360900L,  // [3] = C
  -463900L,  // [4] = D
  -583900L,  // [5] = E
  -687900L,  // [6] = F
  -797900L,  // [7] = G
  -950000L   // [8] = H (no requiere sub)
};

// Sub-posiciones para filas 6..8. Si no se necesita sub para una columna,
// se puede poner el mismo valor que BASE_NORMAL.
const long BASE_SUB[] = {
  0L,         // [0] HOME
  -170900L,   // [1] = A.1
  -300900L,   // [2] = B.1
  -403900L,   // [3] = C.1
  -523900L,   // [4] = D.1
  -613900L,   // [5] = E.1
  -727900L,   // [6] = F.1
  -846900L,   // [7] = G.1
  -950000L    // [8] = H -> usar mismo que normal
};

// ======================== Presets Servos (filas) ========================
const int HOME_HOMBRO = 120;
const int HOME_CODO = 140;
const int GARRA_ABRIR = 30;
const int GARRA_CERRAR = 70;

struct ArmPosition { int hombro; int codo; };
ArmPosition ARM_PRESETS[] = {
  {HOME_HOMBRO, HOME_CODO}, // [0] HOME
  {105, 100},  // [1]
  {98, 110},   // [2]
  {90, 120},   // [3]
  {88, 130},   // [4]
  {85, 138},   // [5]
  {80, 145},   // [6]
  {75, 152},   // [7]
  {70, 160}    // [8]
};

// Secuencias PRE/POST por preset (puede quedar vacío)
struct PresetSeq {
  int preH; int preC; unsigned long preDelayMs;
  int postH; int postC; unsigned long postDelayMs;
  bool hasPre; bool hasPost;
};
PresetSeq PRESET_SEQS[9];

// ======================== Objetos y variables ========================
Servo servoHombro;
Servo servoCodo;
Servo servoGarra;

int posHombroActual = HOME_HOMBRO;
int posCodoActual = HOME_CODO;
int posGarraActual = GARRA_ABRIR;

bool baseIsMoving = false;

bool isHomed = false; // indica si se definió HOME como referencia

long positions_saved[9]; // copia auxiliar si se necesita
// Home guardado (posicion absoluta del stepper)
long savedHomePosition = 0;
bool homeSaved = false;

// EEPROM layout:
// [0..3]   -> uint32_t magic (0xA5A5A5A5)
// [4..11]  -> long savedHomePosition
// [12]     -> uint8_t homeSaved (0 or 1)
const uint32_t EEPROM_MAGIC = 0xA5A5A5A5UL;
const int EEPROM_ADDR_MAGIC = 0;
const int EEPROM_ADDR_HOME = EEPROM_ADDR_MAGIC + sizeof(uint32_t);
const int EEPROM_ADDR_HOMESAVED = EEPROM_ADDR_HOME + sizeof(long);
const int EEPROM_ADDR_RPM = EEPROM_ADDR_HOMESAVED + sizeof(uint8_t);
const int EEPROM_ADDR_LASTPOS = EEPROM_ADDR_RPM + sizeof(float);

// Última posición conocida y última posición guardada en EEPROM
long lastKnownPosition = 0;
long lastSavedPosition = 0;

void saveStateToEEPROM() {
  uint32_t m = EEPROM_MAGIC;
  EEPROM.put(EEPROM_ADDR_MAGIC, m);
  EEPROM.put(EEPROM_ADDR_HOME, savedHomePosition);
  uint8_t hs = homeSaved ? 1 : 0;
  EEPROM.put(EEPROM_ADDR_HOMESAVED, hs);
  EEPROM.put(EEPROM_ADDR_RPM, currentRPM);
  EEPROM.put(EEPROM_ADDR_LASTPOS, lastSavedPosition);
}

void persistPositionIfNeeded() {
  long cur = stepper.currentPosition();
  lastKnownPosition = cur;
  if (cur != lastSavedPosition) {
    lastSavedPosition = cur;
    // Guardar solo la posición para reducir escritura de las otras zonas
    EEPROM.put(EEPROM_ADDR_LASTPOS, lastSavedPosition);
    // Asegurar la firma si aún no está
    uint32_t m = 0;
    EEPROM.get(EEPROM_ADDR_MAGIC, m);
    if (m != EEPROM_MAGIC) EEPROM.put(EEPROM_ADDR_MAGIC, EEPROM_MAGIC);
    Serial.print("EEPROM: Posición guardada: "); Serial.println(lastSavedPosition);
  }
}

void loadHomeFromEEPROM() {
  uint32_t m = 0;
  EEPROM.get(EEPROM_ADDR_MAGIC, m);
  if (m == EEPROM_MAGIC) {
    EEPROM.get(EEPROM_ADDR_HOME, savedHomePosition);
    uint8_t hs = 0;
    EEPROM.get(EEPROM_ADDR_HOMESAVED, hs);
    homeSaved = (hs != 0);
    if (homeSaved) {
      isHomed = true;
      Serial.print("EEPROM: HOME cargado: "); Serial.println(savedHomePosition);
    }
    // Cargar RPM si existe en EEPROM
    float rpmStored = 0.0;
    EEPROM.get(EEPROM_ADDR_RPM, rpmStored);
    if (rpmStored > 0.0) {
      currentRPM = rpmStored;
      configurarVelocidad(currentRPM);
      Serial.print("EEPROM: RPM cargada: "); Serial.println(currentRPM);
    }
    // Cargar última posición conocida
    long pos = 0;
    EEPROM.get(EEPROM_ADDR_LASTPOS, pos);
    lastSavedPosition = pos;
    lastKnownPosition = pos;
    if (pos != 0) {
      stepper.setCurrentPosition(pos);
      Serial.print("EEPROM: Posición restaurada: "); Serial.println(pos);
    }
  } else {
    // No válido aún
    homeSaved = false;
  }
}

void saveHomeToEEPROM() {
  // Guardar estado completo (HOME, RPM, última posición conocida)
  // lastSavedPosition debe contener la posición actual o la última conocida
  saveStateToEEPROM();
  Serial.println("EEPROM: HOME y RPM guardados.");
}

// ======================== Funciones Stepper ========================
void enableMotor(bool en) {
  if (en) {
    digitalWrite(ENABLE_PIN, LOW);
    baseIsMoving = true;
    delay(DELAY_PRENDER_MOTOR);
  } else {
    digitalWrite(ENABLE_PIN, HIGH);
    baseIsMoving = false;
  }
}

void configurarVelocidad(float rpm) {
  if (rpm < 1.0) rpm = 1.0;
  if (rpm > 300.0) rpm = 300.0;
  currentRPM = rpm;
  float newSpeed = (microstepSetting * stepsPerRevolution * currentRPM) / 60.0;
  stepper.setMaxSpeed(newSpeed);
}

void moveBaseTo(long targetPosition) {
  enableMotor(true);
  stepper.moveTo(targetPosition);
}

void waitForBaseToStop() {
  while (stepper.distanceToGo() != 0) {
    stepper.run();
  }
  enableMotor(false);
  // Actualizar y persistir posición final tras movimiento
  persistPositionIfNeeded();
}

// ======================== Funciones Servos (reutilizadas) ========================
void moverServoSuave(Servo &s, int &posActual, int target, int delayMs = 12) {
  if (posActual == target) return;
  int steps = abs(target - posActual);
  int dir = (target > posActual) ? 1 : -1;
  for (int i = 0; i < steps; ++i) {
    posActual += dir;
    s.write(posActual);
    delay(delayMs);
  }
  posActual = target;
}

void moverBrazo(int hombroTarget, int codoTarget) {
  moverServoSuave(servoCodo, posCodoActual, codoTarget);
  delay(30);
  moverServoSuave(servoHombro, posHombroActual, hombroTarget);
}

void abrirGarra() { moverServoSuave(servoGarra, posGarraActual, GARRA_ABRIR); }
void cerrarGarra() { moverServoSuave(servoGarra, posGarraActual, GARRA_CERRAR); }

void moverAPreset(int idx) {
  if (idx < 0 || idx > 8) return;
  if (PRESET_SEQS[idx].hasPre) {
    moverServoSuave(servoCodo, posCodoActual, PRESET_SEQS[idx].preC);
    delay(50);
    moverServoSuave(servoHombro, posHombroActual, PRESET_SEQS[idx].preH);
    delay(PRESET_SEQS[idx].preDelayMs);
  }
  moverBrazo(ARM_PRESETS[idx].hombro, ARM_PRESETS[idx].codo);
  if (PRESET_SEQS[idx].hasPost) {
    moverServoSuave(servoCodo, posCodoActual, PRESET_SEQS[idx].postC);
    delay(30);
    moverServoSuave(servoHombro, posHombroActual, PRESET_SEQS[idx].postH);
    delay(PRESET_SEQS[idx].postDelayMs);
  }
}

// Secuencias específicas (tomar, elevar, soltar) - copiadas del sketch de servos
void takeSequence(int row) {
  switch(row) {
    case 8:
      moverServoSuave(servoCodo, posCodoActual, 163); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 65); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    case 7:
      moverServoSuave(servoCodo, posCodoActual, 200); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 150); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 72); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    case 6:
      moverServoSuave(servoCodo, posCodoActual, 200); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 140); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 79); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    case 5:
      moverServoSuave(servoCodo, posCodoActual, 200); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 133); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 82); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    case 4:
      moverServoSuave(servoCodo, posCodoActual, 200); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 125); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 87); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    case 3:
      moverServoSuave(servoCodo, posCodoActual, 120); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 93); delay(800);
      moverServoSuave(servoCodo, posCodoActual, 120); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    case 2:
      moverServoSuave(servoCodo, posCodoActual, 200); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 93); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 110); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    case 1:
      moverServoSuave(servoCodo, posCodoActual, 200); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 105); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 110); delay(1000);
      cerrarGarra(); delay(1000);
      break;
    default:
      break;
  }
}

void liftSequence(int row) {
  switch(row) {
    case 8:
      moverServoSuave(servoHombro, posHombroActual, 120); delay(2000);
      moverServoSuave(servoCodo, posCodoActual, 163); // mantener
      break;
    case 7:
      moverServoSuave(servoHombro, posHombroActual, 120); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 160);
      break;
    case 6:
      moverServoSuave(servoHombro, posHombroActual, 90); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 120); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 180);
      break;
    case 5:
      moverServoSuave(servoHombro, posHombroActual, 90); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 120); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 150);
      break;
    case 4:
      moverServoSuave(servoCodo, posCodoActual, 140); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 120); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 150);
      break;
    case 3:
      moverServoSuave(servoCodo, posCodoActual, 140); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 120);
      break;
    case 2:
      moverServoSuave(servoCodo, posCodoActual, 140); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 120);
      break;
    case 1:
      moverServoSuave(servoCodo, posCodoActual, 120); delay(1000);
      moverServoSuave(servoHombro, posHombroActual, 110); delay(1000);
      moverServoSuave(servoCodo, posCodoActual, 140);
      moverServoSuave(servoHombro, posHombroActual, 120);
      break;
    default:
      break;
  }
}

void dropSequence(int row) {
  moverBrazo(ARM_PRESETS[row].hombro, ARM_PRESETS[row].codo);
  delay(1000);
  abrirGarra();
  delay(1000);
  moverAPreset(0);
}

// ======================== Utilidades y parsing ========================
int getColumnIndex(char columnChar) {
  int index = columnChar - 'A' + 1;
  if (index >= 1 && index <= 8) return index;
  return -1;
}

int getRowIndex(char rowChar) {
  int index = rowChar - '0';
  if (index >= 1 && index <= 8) return index;
  return -1;
}

// Mover pieza con sub-posiciones: inserta la sub-posicion cuando la fila destino >5
void moverPieza(String desde, String hasta) {
  if (desde.length() != 2 || hasta.length() != 2) {
    Serial.println("Formato MOVER PIEZA incorrecto. Use: MOVER PIEZA A2 B3");
    return;
  }

  char colFrom = desde.charAt(0);
  char rowFrom = desde.charAt(1);
  char colTo = hasta.charAt(0);
  char rowTo = hasta.charAt(1);

  int colIndexFrom = getColumnIndex(colFrom);
  int rowIndexFrom = getRowIndex(rowFrom);
  int colIndexTo = getColumnIndex(colTo);
  int rowIndexTo = getRowIndex(rowTo);

  if (colIndexFrom == -1 || rowIndexFrom == -1 || colIndexTo == -1 || rowIndexTo == -1) {
    Serial.println("Error: Casilla fuera de rango (A1..H8). Revisa coordenadas.");
    return;
  }

  Serial.print("\n--- MOVER PIEZA: "); Serial.print(desde); Serial.print(" -> "); Serial.print(hasta); Serial.println(" ---");

  // 1) Mover a la casilla de origen (base y servos) y tomar la pieza
  long baseFrom = (rowIndexFrom > 5) ? BASE_SUB[colIndexFrom] : BASE_NORMAL[colIndexFrom];
  moveBaseTo(baseFrom);
  waitForBaseToStop();

  moverAPreset(rowIndexFrom); // bajar servos al preset de la fila origen
  delay(300);
  takeSequence(rowIndexFrom);

  // 2) Elevar / preparar transporte
  liftSequence(rowIndexFrom);

  // 3) Mover base a la columna destino, usando sub si rowTo > 5
  long baseTo = (rowIndexTo > 5) ? BASE_SUB[colIndexTo] : BASE_NORMAL[colIndexTo];
  moveBaseTo(baseTo);
  waitForBaseToStop();

  // 4) Bajar brazo a la fila destino y soltar
  moverAPreset(rowIndexTo);
  delay(300);
  dropSequence(rowIndexTo);

  Serial.println("--- MOVER PIEZA: COMPLETADO ---\n");
}

// ======================== Setup y Loop ========================
void setup() {
  Serial.begin(115200);

  // Stepper pins
  pinMode(M0_PIN, OUTPUT); pinMode(M1_PIN, OUTPUT); pinMode(M2_PIN, OUTPUT);
  digitalWrite(M0_PIN, HIGH); digitalWrite(M1_PIN, HIGH); digitalWrite(M2_PIN, HIGH);
  pinMode(ENABLE_PIN, OUTPUT);
  // Asegurar pines STEP/DIR como salidas para pruebas manuales
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  // Configurar aceleración y velocidad inicial
  stepper.setAcceleration(accelerationStepsPerSec2);
  configurarVelocidad(currentRPM);

  // Servos
  servoHombro.attach(PIN_HOMBRO);
  servoCodo.attach(PIN_CODO);
  servoGarra.attach(PIN_GARRA);

  // Posicion inicial servos
  servoHombro.write(posHombroActual);
  servoCodo.write(posCodoActual);
  servoGarra.write(posGarraActual);

  enableMotor(false);

  // Intentar cargar HOME desde EEPROM (si la placa/core lo soporta)
  loadHomeFromEEPROM();

  Serial.println("--- control.ino listo ---");
  Serial.println("Comandos: HOME (ir o guardar), SAVE HOME/SET HOME/GUARDAR HOME (guardar), MOVER PIEZA A2 B3, ABRIR, CERRAR, V60 (RPM)");
  Serial.println("Comandos manuales: LEFT <n> or LEFT<n>, RIGHT <n> or RIGHT<n>, GOTO <pos>, GO HOME/GOTO HOME/IR A HOME, POS, GO A, PULSE count us");
}

void loop() {
  // Mantener stepper en marcha si hay movimiento pendiente
  if (stepper.distanceToGo() != 0) stepper.run();

  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    line.toUpperCase();
    if (line.length() == 0) return;

    if (line == "HOME") {
      // Comportamiento dual:
      // - Si ya hay un HOME guardado, ir a esa posición.
      // - Si no hay HOME guardado, guardar la posición actual como HOME.
      if (homeSaved) {
        Serial.print("Yendo a HOME guardado: "); Serial.println(savedHomePosition);
        moverAPreset(0); // mover servos a HOME al llegar
        enableMotor(true);
        stepper.moveTo(savedHomePosition);
        waitForBaseToStop();
      } else {
        // Guardar la posición actual como HOME (no reindexar la posición absoluta)
        savedHomePosition = stepper.currentPosition();
        homeSaved = true;
        isHomed = true;
        Serial.print("HOME guardado en posición: "); Serial.println(savedHomePosition);
        // Persistir en EEPROM
        saveHomeToEEPROM();
      }
    } else if (line == "SAVE HOME" || line == "SET HOME" || line == "GUARDAR HOME") {
      // Forzar guardar HOME independientemente
      savedHomePosition = stepper.currentPosition();
      homeSaved = true;
      isHomed = true;
      Serial.print("HOME guardado en posición: "); Serial.println(savedHomePosition);
      // Persistir en EEPROM
      saveHomeToEEPROM();
    } else if (line == "GO HOME" || line == "GOTO HOME" || line == "IR HOME" || line == "IR A HOME") {
      if (!homeSaved) {
        Serial.println("No hay HOME guardado. Use 'SAVE HOME' para guardar la posición actual como HOME.");
      } else {
        Serial.print("Yendo a HOME guardado: "); Serial.println(savedHomePosition);
        moverAPreset(0);
        enableMotor(true);
        stepper.moveTo(savedHomePosition);
        waitForBaseToStop();
      }
    } else if (line.startsWith("LEFT")) {
      // Acepta LEFT 1000 o LEFT1000
      String a = line.substring(4);
      a.trim();
      if (a.length() == 0) {
        Serial.println("Uso: LEFT <steps>  (ej. LEFT 1000 o LEFT1000)");
      } else {
        long steps = a.toInt();
        enableMotor(true);
        stepper.move(-steps);
        waitForBaseToStop();
      }
    } else if (line.startsWith("RIGHT")) {
      // Acepta RIGHT 1000 o RIGHT1000
      String a = line.substring(5);
      a.trim();
      if (a.length() == 0) {
        Serial.println("Uso: RIGHT <steps>  (ej. RIGHT 1000 or RIGHT1000)");
      } else {
        long steps = a.toInt();
        enableMotor(true);
        stepper.move(steps);
        waitForBaseToStop();
      }
    } else if (line.startsWith("GOTO ")) {
      String a = line.substring(5);
      long pos = a.toInt();
      enableMotor(true);
      stepper.moveTo(pos);
      waitForBaseToStop();
    } else if (line.startsWith("PULSE ")) {
      // PULSE <count> <microseconds>  -> genera pulsos manuales en STEP (útil para diagnosticar)
      // Ejemplo: PULSE 200 800  -> 200 pulsos con 800us de intervalo
      int sp1 = line.indexOf(' ');
      int sp2 = line.indexOf(' ', sp1 + 1);
      if (sp2 > 0) {
        String scount = line.substring(sp1 + 1, sp2);
        String sus = line.substring(sp2 + 1);
        long count = scount.toInt();
        long us = sus.toInt();
        if (count <= 0) count = 200;
        if (us <= 0) us = 800;
        Serial.print("Generando "); Serial.print(count); Serial.print(" pulsos con "); Serial.print(us); Serial.println(" us\n");
        // dejar enabled
        enableMotor(true);
        for (long i = 0; i < count; i++) {
          digitalWrite(STEP_PIN, HIGH);
          delayMicroseconds(us/2);
          digitalWrite(STEP_PIN, LOW);
          delayMicroseconds(us/2);
        }
        enableMotor(false);
        Serial.println("Pulsos completados.");
      } else {
        Serial.println("Uso: PULSE <count> <microseconds>");
      }
    } else if (line == "POS") {
      Serial.print("Pos actual: "); Serial.println(stepper.currentPosition());
    } else if (line.startsWith("GO ")) {
      // GO A or GO A+100
      String arg = line.substring(3);
      arg.trim(); arg.toUpperCase();
      if (arg.length() >= 1) {
        char c = arg.charAt(0);
        int idx = getColumnIndex(c);
        if (idx == -1) {
          Serial.println("Etiqueta inválida. Use A..H.");
        } else {
          long offset = 0;
          if (arg.length() > 1) {
            char sign = arg.charAt(1);
            if (sign == '+' || sign == '-') {
              String num = arg.substring(2);
              offset = num.toInt();
              if (sign == '-') offset = -offset;
            }
          }
          long target = (/*use normal by default*/ BASE_NORMAL[idx]) + offset;
          Serial.print("Yendo a "); Serial.print(c); Serial.print(" -> "); Serial.println(target);
          enableMotor(true);
          stepper.moveTo(target);
          waitForBaseToStop();
        }
      }
    } else if (line.startsWith("MOVER PIEZA ")) {
      String rest = line.substring(12);
      rest.trim();
      int sep = rest.indexOf(' ');
      if (sep > 0) {
        String desde = rest.substring(0, sep);
        String hasta = rest.substring(sep + 1);
        desde.trim(); hasta.trim();
        moverPieza(desde, hasta);
      } else {
        Serial.println("Formato MOVER PIEZA incorrecto. Use: MOVER PIEZA A2 B3");
      }
    } else if (line == "ABRIR") {
      abrirGarra();
    } else if (line == "CERRAR") {
      cerrarGarra();
    } else if (line.startsWith("V") ) {
      // V60 -> RPM 60
      String num = line.substring(1);
      float r = num.toFloat();
      if (r > 0.0) {
        configurarVelocidad(r);
        Serial.print("RPM ajustadas a: "); Serial.println(r);
        // Persistir RPM inmediatamente
        // Guardamos ajustes actuales (incluye RPM y HOME)
        {
          uint32_t m = EEPROM_MAGIC;
          EEPROM.put(EEPROM_ADDR_MAGIC, m);
          EEPROM.put(EEPROM_ADDR_HOME, savedHomePosition);
          uint8_t hs = homeSaved ? 1 : 0;
          EEPROM.put(EEPROM_ADDR_HOMESAVED, hs);
          EEPROM.put(EEPROM_ADDR_RPM, currentRPM);
          Serial.println("EEPROM: RPM guardada.");
        }
      }
    } else if (line == "ENABLE") {
      enableMotor(true);
    } else if (line == "DISABLE") {
      enableMotor(false);
    } else {
      Serial.println("Comando no reconocido. Use HOME, MOVER PIEZA, ABRIR, CERRAR, Vxx, ENABLE, DISABLE.");
    }

    while (Serial.available() > 0) Serial.read();
  }
}
