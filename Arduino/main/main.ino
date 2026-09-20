#include <AccelStepper.h>
#include <Servo.h>

// ==========================================================
// 1. CONFIGURACIÓN DE PINES Y CONSTANTES
// ==========================================================

// --- PINES SERVO ---
#define PIN_HOMBRO 12   
#define PIN_CODO 13
#define PIN_GARRA 11

// --- PINES STEPPER (BASE) ---
#define STEP_PIN    3
#define DIR_PIN     2
#define ENABLE_PIN  4 // Pin para DESHABILITAR (HIGH = APAGADO, LOW = ENCENDIDO)
#define M0_PIN      7
#define M1_PIN      6
#define M2_PIN      5

// --- CONSTANTES GENERALES ---
const int PAUSA_MOVIMIENTO = 50; 
const int GARRA_ABRIR = 30;
const int GARRA_CERRAR = 70;
const int DELAY_PRENDER_MOTOR = 50; // ms: Tiempo para energizar el motor antes de mover

// --- POSICIÓN HOME (Inicial) ---
const int HOME_HOMBRO = 120;
const int HOME_CODO = 140;
const long HOME_BASE = 0L; 

// ==========================================================
// 2. ESTRUCTURAS DE POSICIÓN Y MAPEO COLUMNA/FILA
// ==========================================================

// Estructura para almacenar el PAR de ángulos del brazo (Alcance/Altura)
struct ArmPosition {
    int hombro;
    int codo;
};

// ** MAPEO DEL MOTOR PASO A PASO (COLUMNAS A-H) **
// Índice [0] es HOME. [1] a [8] mapean de 'A' a 'H'.
const long BASE_POSITIONS_COLUMNAS[] = {
    HOME_BASE,   // [0] = HOME (0 Pasos)
    -152400L,    // [1] = Columna 'A'
    -265400L,    // [2] = Columna 'B'
    -380400L,    // [3] = Columna 'C'
    -495400L,    // [4] = Columna 'D'
    -605400L,    // [5] = Columna 'E'
    -715400L,    // [6] = Columna 'F'
    -825400L,    // [7] = Columna 'G'
    -935400L     // [8] = Columna 'H'
};
const int TOTAL_COLUMNAS = 8;

// ** MAPEO DEL BRAZO (FILAS 1-8) **
// Índice [0] es HOME. [1] a [8] mapean de '1' a '8' (distinto alcance/altura).
const ArmPosition ARM_POSITIONS_FILAS[] = {
    {HOME_HOMBRO, HOME_CODO}, // [0] = HOME (Retraído)
    {105, 100},  // [1] = Fila '1' 
    {98, 110},   // [2] = Fila '2'
    {90, 120},   // [3] = Fila '3'
    {88, 130},   // [4] = Fila '4'
    {85, 138},   // [5] = Fila '5'
    {80, 145},   // [6] = Fila '6'
    {75, 152},   // [7] = Fila '7'
    {70, 160}    // [8] = Fila '8' 
};
const int TOTAL_FILAS = 8;


// ==========================================================
// 3. OBJETOS DE CONTROL Y VARIABLES GLOBALES
// ==========================================================

// --- Objetos Servo ---
Servo servoHombro;
Servo servoCodo;
Servo servoGarra; 

// --- Variables de Posición Actual de Servos ---
int posHombroActual = HOME_HOMBRO; 
int posCodoActual = HOME_CODO;   
int posGarraActual = GARRA_ABRIR;

// --- Objetos y Variables Stepper ---
const float stepsPerRevolution = 200;
const int microstepSetting = 32;
const float maxRPM = 300; 
const float accelerationStepsPerSec2 = 10000.0;
float currentRPM = 50.0;
float speedStepsPerSec = 0;

AccelStepper stepper(AccelStepper::DRIVER, STEP_PIN, DIR_PIN);

bool baseIsMoving = false; // Indica si la base está en movimiento o habilitada


// ==========================================================
// 4. DECLARACIONES DE FUNCIONES (Para que el IDE sepa qué buscar)
// ==========================================================
void configurarVelocidad(float rpm);
void enableBaseMotor(bool state);
void moveBaseTo(long targetPosition);
void stepperRunLoop();
void waitForBaseToStop();

void moverServoIndividualSuave(Servo& servo, int& posActual, int targetPos);
void moverBrazoSuave(int targetHombro, int targetCodo);
void moverGarra(bool cerrar);

int getColumnIndex(char columnChar);
int getRowIndex(char rowChar);
void goHome();
void moverA_Ajedrez(String casilla);
void moverDe_A_Ajedrez(String from, String to);


// ==========================================================
// 5. SETUP
// ==========================================================

void setup() {
    // Configuración Stepper
    Serial.begin(115200);
    pinMode(M0_PIN, OUTPUT); pinMode(M1_PIN, OUTPUT); pinMode(M2_PIN, OUTPUT);
    digitalWrite(M0_PIN, HIGH); digitalWrite(M1_PIN, HIGH); digitalWrite(M2_PIN, HIGH);
    pinMode(ENABLE_PIN, OUTPUT);
    configurarVelocidad(currentRPM);
    
    // Configuración Servos
    servoHombro.attach(PIN_HOMBRO);
    servoCodo.attach(PIN_CODO);
    servoGarra.attach(PIN_GARRA); 
    
    // Posición Inicial
    servoHombro.write(posHombroActual);
    servoCodo.write(posCodoActual);
    servoGarra.write(posGarraActual);
    
    enableBaseMotor(false); // Apagar motor al inicio para ahorro de energía

    Serial.println("-------------------------------------------------");
    Serial.println(" Control UNIFICADO Ajedrez 3DOF - LISTO.");
    Serial.println("-------------------------------------------------");
    Serial.println("Comandos: HOME, A1..H8, MOVER A1 B2, ABRIR, CERRAR, V<RPM>");
    Serial.println("-------------------------------------------------");
}

// ==========================================================
// 6. LOOP
// ==========================================================

void loop() {
    // Es CRUCIAL que stepperRunLoop() se ejecute constantemente
    stepperRunLoop();

    if (Serial.available() > 0) {
        String input = Serial.readStringUntil('\n');
        input.trim();
        input.toUpperCase();

        // 1. COMANDOS DE AJEDREZ
        if (input == "HOME") {
            goHome();
        } else if (input.length() == 2 && input.charAt(0) >= 'A' && input.charAt(0) <= 'H' && input.charAt(1) >= '1' && input.charAt(1) <= '8') {
            moverA_Ajedrez(input);
        
        // 2. COMANDOS DE MOVIMIENTO DE PIEZAS
        } else if (input.startsWith("MOVER ")) {
            String params = input.substring(6); // "E2 E4"
            int spaceIndex = params.indexOf(' ');
            if (spaceIndex > 0) {
                String from = params.substring(0, spaceIndex);
                String to = params.substring(spaceIndex + 1);
                moverDe_A_Ajedrez(from, to);
            } else {
                Serial.println("Comando MOVER no válido. Use 'MOVER A1 B2'.");
            }

        // 3. COMANDOS DE GARRA
        } else if (input == "ABRIR") {
            moverGarra(false);
        } else if (input == "CERRAR") {
            moverGarra(true);

        // 3. COMANDOS DE STEPPER (Velocidad)
        } else if (input.startsWith("V")) {
            String rpmString = input.substring(1);
            float newRPM = rpmString.toFloat();
            if (newRPM > 0.0) configurarVelocidad(newRPM);
        } else {
            Serial.println("Comando no reconocido. Use HOME, A1..H8, ABRIR, CERRAR, V<RPM>.");
        }
        
        while(Serial.available() > 0) Serial.read(); // Limpiar el buffer
    }
}


// ==========================================================
// 7. FUNCIONES DE MOVIMIENTO STEPPER (BASE)
// ==========================================================

void enableBaseMotor(bool state) {
    if (state) {
        digitalWrite(ENABLE_PIN, LOW); // LOW = ENCENDIDO/HABILITADO
        baseIsMoving = true;
        Serial.println("Base: Motor ENERGIZADO.");
        delay(DELAY_PRENDER_MOTOR); // Espera de calentamiento
    } else {
        digitalWrite(ENABLE_PIN, HIGH); // HIGH = APAGADO/DESHABILITADO
        baseIsMoving = false;
        Serial.println("Base: Motor DESHABILITADO (Ahorro de energía).");
    }
}

void configurarVelocidad(float rpm) {
    float maxSpeedStepsPerSec = (microstepSetting * stepsPerRevolution * maxRPM) / 60.0;
    if (rpm > maxRPM) rpm = maxRPM; else if (rpm < 1.0) rpm = 1.0;
    float newSpeedStepsPerSec = (microstepSetting * stepsPerRevolution * rpm) / 60.0;
    
    stepper.setMaxSpeed(newSpeedStepsPerSec); 
    stepper.setAcceleration(accelerationStepsPerSec2);
    speedStepsPerSec = newSpeedStepsPerSec;
    currentRPM = rpm;

    Serial.print("Base: Velocidad ajustada a: ");
    Serial.print(currentRPM);
    Serial.println(" RPM.");
}

void moveBaseTo(long targetPosition) {
    enableBaseMotor(true); // Enciende el motor
    
    stepper.moveTo(targetPosition);
    Serial.print("Base: Iniciando movimiento a ");
    Serial.print(targetPosition);
    Serial.println(" pasos.");
}

void stepperRunLoop() {
    // Si hay pasos pendientes, mueve el stepper
    if (stepper.distanceToGo() != 0) {
        stepper.run();
    } else if (baseIsMoving) {
        // Si termina el movimiento, apaga el motor (la función de espera lo hace primero)
        // Esto solo es un respaldo si no se usa waitForBaseToStop()
        // enableBaseMotor(false); 
    }
}

void waitForBaseToStop() {
    unsigned long startTime = millis();
    Serial.println("Esperando a que la Base termine...");

    while (stepper.distanceToGo() != 0) {
        stepper.run();
    }
    
    // Una vez detenido, apagamos el motor y reportamos
    enableBaseMotor(false); 
    
    unsigned long endTime = millis();
    unsigned long duration = endTime - startTime;
    Serial.print("Base detenida. Duración del movimiento: ");
    Serial.print(duration);
    Serial.println(" ms.");
}

// ==========================================================
// 8. FUNCIONES DE MOVIMIENTO SERVO (BRAZO/GARRA)
// ==========================================================

void moverServoIndividualSuave(Servo& servo, int& posActual, int targetPos) {
    int pasos = abs(targetPos - posActual);
    int direccion = targetPos > posActual ? 1 : -1;
    
    for (int i = 0; i < pasos; i++) {
        posActual += direccion;
        servo.write(posActual);
        delay(15);
    }
    posActual = targetPos; 
}

void moverBrazoSuave(int targetHombro, int targetCodo) {
    unsigned long startTime = millis();
    Serial.println("Moviendo Servos...");

    // 1. Mover Codo
    moverServoIndividualSuave(servoCodo, posCodoActual, targetCodo);
    delay(PAUSA_MOVIMIENTO);
    // 2. Mover Hombro
    moverServoIndividualSuave(servoHombro, posHombroActual, targetHombro);
    
    unsigned long endTime = millis();
    unsigned long duration = endTime - startTime;
    Serial.print("Servos: Movimiento completado. Duración: ");
    Serial.print(duration);
    Serial.println(" ms.");
}

void moverGarra(bool cerrar) {
    int targetGarra = cerrar ? GARRA_CERRAR : GARRA_ABRIR;
    
    if (posGarraActual == targetGarra) {
        Serial.print("La garra ya esta ");
        Serial.println(cerrar ? "CERRADA." : "ABIERTA.");
        return;
    }
    moverServoIndividualSuave(servoGarra, posGarraActual, targetGarra);
    Serial.print("Garra: ");
    Serial.println(cerrar ? "CERRADA." : "ABIERTA.");
}


// ==========================================================
// 9. FUNCIONES DE POSICIONAMIENTO DE AJEDREZ
// ==========================================================

int getColumnIndex(char columnChar) {
    int index = columnChar - 'A' + 1;
    if (index >= 1 && index <= TOTAL_COLUMNAS) {
        return index;
    }
    return -1;
}

int getRowIndex(char rowChar) {
    int index = rowChar - '0';
    if (index >= 1 && index <= TOTAL_FILAS) {
        return index;
    }
    return -1;
}

/**
 * @brief Mueve el brazo a una casilla de ajedrez (Ej. B3).
 * Secuencia: BASE (Columna) -> ESPERAR -> SERVOS (Fila).
 */
void moverA_Ajedrez(String casilla) {
    char colChar = casilla.charAt(0);
    char rowChar = casilla.charAt(1);

    int colIndex = getColumnIndex(colChar);
    int rowIndex = getRowIndex(rowChar);

    if (colIndex == -1 || rowIndex == -1) {
        Serial.println("Error: Casilla de ajedrez no válida.");
        return;
    }

    // OBTENER POSICIONES
    long targetBase = BASE_POSITIONS_COLUMNAS[colIndex]; 
    int targetHombro = ARM_POSITIONS_FILAS[rowIndex].hombro;
    int targetCodo = ARM_POSITIONS_FILAS[rowIndex].codo;

    Serial.print("\n--- INICIO MOVIMIENTO A: "); Serial.print(casilla); Serial.println(" ---");
    Serial.print("Mapeo: Columna "); Serial.print(colChar); 
    Serial.print(", Fila "); Serial.print(rowChar); Serial.println(".");
    
    // 1. Mover la Base (Stepper)
    moveBaseTo(targetBase);
    
    // 2. ESPERAR a que la Base termine y apague el motor
    waitForBaseToStop();

    // 3. Mover el Brazo (Servos)
    moverBrazoSuave(targetHombro, targetCodo);

    Serial.println("--- MOVIMIENTO COMPLETADO ---");
}

/**
 * @brief Mueve el brazo a la posición de inicio (HOME).
 */
void goHome() {
    Serial.println("\n--- INICIO MOVIMIENTO A: HOME ---");

    // 1. Mover el Brazo (Servos) al HOME (Retraer primero)
    moverBrazoSuave(ARM_POSITIONS_FILAS[0].hombro, ARM_POSITIONS_FILAS[0].codo);

    // 2. Mover la Base (Stepper) al HOME (0 pasos)
    moveBaseTo(BASE_POSITIONS_COLUMNAS[0]);
    waitForBaseToStop();

    Serial.println("--- POSICION HOME ALCANZADA ---");
}

/**
 * @brief Mueve una pieza de ajedrez de una casilla a otra.
 * Secuencia: Ir a 'from', cerrar garra, ir a 'to', abrir garra.
 */
void moverDe_A_Ajedrez(String from, String to) {
    Serial.print("\n--- INICIO MOVIMIENTO DE PIEZA: ");
    Serial.print(from);
    Serial.print(" -> ");
    Serial.print(to);
    Serial.println(" ---");

    // 1. Ir a la casilla de origen
    moverA_Ajedrez(from);

    // 2. Cerrar garra para agarrar la pieza
    moverGarra(true); // Cerrar

    // 3. Ir a la casilla de destino
    moverA_Ajedrez(to);

    // 4. Abrir garra para soltar la pieza
    moverGarra(false); // Abrir

    Serial.println("--- MOVIMIENTO DE PIEZA COMPLETADO ---");
}
