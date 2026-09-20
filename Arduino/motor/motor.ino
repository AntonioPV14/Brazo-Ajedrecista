/*
  motor.ino
  Sketch de calibración para el motor paso a paso (Base)

  Uso: conectar el driver y el stepper igual que en el proyecto principal.
  En el monitor serie (115200) enviar comandos sencillos para mover
  el motor, leer la posición actual y guardar posiciones etiquetadas
  (HOME, A..H). Al enviar `PRINT` se muestra un arreglo listo para
  copiar en `BASE_POSITIONS_COLUMNAS` de `main2.ino`.

  Comandos (envíe la línea y ENTER):
  - HOME         : establece la posición actual como HOME (pos = 0)
  - ENABLE       : habilita el motor (ENABLE LOW)
  - DISABLE      : deshabilita el motor (ENABLE HIGH)
  - LEFT n       : mueve n pasos hacia la izquierda (negativos)
  - RIGHT n      : mueve n pasos hacia la derecha (positivos)
  - GOTO n       : mueve a la posición absoluta n
  - GO X         : mueve a la posición guardada X (0=HOME, A..H)
  - SET X        : guarda la posición actual en etiqueta X (0=HOME, A..H)
  - POS          : muestra la posición actual
  - PRINT        : imprime el arreglo completo en formato C++ listo para pegar
  - HELP         : mostrar ayuda

  Autor: Generado automáticamente (extracción de calibración)
*/

#include <AccelStepper.h>

// Pines (mismos que en main2.ino)
#define STEP_PIN    3
#define DIR_PIN     2
#define ENABLE_PIN  4
#define M0_PIN      7
#define M1_PIN      6
#define M2_PIN      5

// Configuración
const float stepsPerRevolution = 200;
const int microstepSetting = 32; // para convertir a pasos/seg si hace falta
const float defaultRPM = 40.0;  // RPM por defecto para calibración (lento)
const float accelerationStepsPerSec2 = 2000.0;

const int DELAY_PRENDER_MOTOR = 50; // ms: tiempo para energizar driver

float currentRPM = defaultRPM;

AccelStepper stepper(AccelStepper::DRIVER, STEP_PIN, DIR_PIN);

// Posiciones guardadas: [0]=HOME, [1..8]=A..H
long positions[9];

void printHelp() {
  Serial.println("--- Calibracion Motor Paso a Paso ---");
  Serial.println("Comandos:");
  Serial.println(" HOME        -> setea la posicion actual como HOME (pos=0)");
  Serial.println(" ENABLE      -> energiza el motor");
  Serial.println(" DISABLE     -> desactiva el motor");
  Serial.println(" LEFT n      -> mueve n pasos hacia la izquierda (negativos)");
  Serial.println(" RIGHT n     -> mueve n pasos hacia la derecha (positivos)");
  Serial.println(" GOTO n      -> mueve a posicion absoluta n");
  Serial.println(" GO X        -> mueve a posicion guardada X (0=HOME, A..H)");
  Serial.println(" SET X       -> guarda la posicion actual en X (0=HOME, A..H)");
  Serial.println(" POS         -> muestra posicion actual");
  Serial.println(" PRINT       -> imprime arreglo C++ para pegar en main2.ino");
  Serial.println(" HELP        -> esta ayuda");
  Serial.println("Ejemplos: LEFT 1000   ; SET A   ; GO A ; PRINT");
}

int labelToIndex(char c) {
  if (c == '0') return 0;
  if (c >= 'A' && c <= 'H') return (c - 'A') + 1;
  return -1;
}

void enableMotor(bool en) {
  if (en) {
    digitalWrite(ENABLE_PIN, LOW);
    Serial.println("Motor habilitado.");
    delay(DELAY_PRENDER_MOTOR);
  } else {
    digitalWrite(ENABLE_PIN, HIGH);
    Serial.println("Motor deshabilitado.");
  }
}

void configurarVelocidad(float rpm) {
  if (rpm < 1.0) rpm = 1.0;
  if (rpm > 300.0) rpm = 300.0;
  currentRPM = rpm;
  float newSpeed = (microstepSetting * stepsPerRevolution * currentRPM) / 60.0;
  stepper.setMaxSpeed(newSpeed);
  Serial.print("Velocidad ajustada a: "); Serial.print(currentRPM); Serial.println(" RPM");
}

void setup() {
    Serial.begin(115200);
    while (!Serial) ;

    pinMode(M0_PIN, OUTPUT); pinMode(M1_PIN, OUTPUT); pinMode(M2_PIN, OUTPUT);
    digitalWrite(M0_PIN, HIGH); digitalWrite(M1_PIN, HIGH); digitalWrite(M2_PIN, HIGH);
    pinMode(ENABLE_PIN, OUTPUT);

    // Configurar stepper
    stepper.setAcceleration(accelerationStepsPerSec2);
    // Establecer velocidad inicial (RPM por defecto)
    float initialSpeed = (microstepSetting * stepsPerRevolution * currentRPM) / 60.0;
    stepper.setMaxSpeed(initialSpeed);

    // Deshabilitado por defecto
    enableMotor(false);

    // Inicializar posiciones a 0 (o valores conocidos)
    // Cargar posiciones por defecto (valores de referencia proporcionados)
    positions[0] = 0L;         // HOME
    positions[1] = -152400L;   // A
    positions[2] = -265400L;   // B
    positions[3] = -380400L;   // C
    positions[4] = -495400L;   // D
    positions[5] = -605400L;   // E
    positions[6] = -715400L;   // F
    positions[7] = -825400L;   // G
    positions[8] = -935400L;   // H

    Serial.println("\n--- motor.ino: Calibracion interactiva ---");
    Serial.println("Velocidad por defecto lenta para ajuste fino: ");
    Serial.print(defaultRPM); Serial.println(" RPM");
    Serial.println("Escriba HELP para ver comandos.");
    }

    void loop() {
    // Ejecutar stepper si hay movimiento
    if (stepper.distanceToGo() != 0) stepper.run();

    if (Serial.available() > 0) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        line.toUpperCase();
        if (line.length() == 0) return;

        // Tokenizar
        int spaceIdx = line.indexOf(' ');
        String cmd = (spaceIdx == -1) ? line : line.substring(0, spaceIdx);
        String arg = (spaceIdx == -1) ? "" : line.substring(spaceIdx + 1);
        cmd.trim(); arg.trim();

        // Soporte rápido: comando 'V80' (sin espacio) ajusta RPM
        bool vHandled = false;
        if (cmd.length() > 1 && cmd.charAt(0) == 'V' && arg.length() == 0) {
        String num = cmd.substring(1);
        float r = num.toFloat();
        if (r > 0.0) {
            configurarVelocidad(r);
            vHandled = true;
        }
        }

        if (!vHandled) {
        if (cmd == "HELP") {
        printHelp();
        } else if (cmd == "ENABLE") {
        enableMotor(true);
        } else if (cmd == "DISABLE") {
        enableMotor(false);
        } else if (cmd == "HOME") {
        stepper.setCurrentPosition(0);
        positions[0] = 0L;
        Serial.println("HOME definido: 0 pasos (posición actual tomada como HOME)");
        } else if (cmd == "LEFT" || cmd == "RIGHT") {
        long val = arg.toInt();
        if (val == 0 && arg != "0") {
            Serial.println("ERROR: especifique un número de pasos, p.ej. LEFT 1000");
        } else {
            long move = (cmd == "LEFT") ? -val : val;
            enableMotor(true);
            stepper.move(move);
            Serial.print("Moviendo "); Serial.print(move); Serial.println(" pasos...");
            while (stepper.distanceToGo() != 0) stepper.run();
            Serial.print("Pos actual: "); Serial.println(stepper.currentPosition());
            enableMotor(false);
        }
        } else if (cmd == "GOTO") {
        long val = arg.toInt();
        enableMotor(true);
        stepper.moveTo(val);
        Serial.print("Moviendo a "); Serial.print(val); Serial.println(" ...");
        while (stepper.distanceToGo() != 0) stepper.run();
        Serial.print("Pos actual: "); Serial.println(stepper.currentPosition());
        enableMotor(false);
        } else if (cmd == "POS") {
        Serial.print("Pos actual: "); Serial.println(stepper.currentPosition());
        } else if (cmd == "SET") {
        if (arg.length() == 0) { Serial.println("SET requiere un argumento: 0 o A..H (ej. SET A)"); }
        else {
            char c = arg.charAt(0);
            int idx = labelToIndex(c);
            if (idx == -1) { Serial.println("Etiqueta inválida. Use 0 o A..H."); }
            else {
            positions[idx] = stepper.currentPosition();
            Serial.print("Guardado "); Serial.print(c); Serial.print(" = "); Serial.println(positions[idx]);
            }
        }
        } else if (cmd == "GO") {
        if (arg.length() == 0) { Serial.println("GO requiere un argumento: 0 o A..H (ej. GO A o GO A+500)"); }
        else {
            String a = arg;
            a.trim();
            a.toUpperCase();
            char c = a.charAt(0);
            int idx = labelToIndex(c);
            if (idx == -1) {
            Serial.println("Etiqueta inválida. Use 0 o A..H.");
            } else {
            // Permitir offset opcional: formato A+123 o A-456
            long offset = 0;
            if (a.length() > 1) {
                char sign = a.charAt(1);
                if (sign == '+' || sign == '-') {
                String num = a.substring(2);
                num.trim();
                long v = num.toInt();
                if (sign == '-') v = -v;
                offset = v;
                }
            }

            long target = positions[idx] + offset;
            Serial.print("Yendo a "); Serial.print(c);
            if (offset != 0) {
                Serial.print((offset>0)?" +":" "); Serial.print(offset);
            }
            Serial.print(" -> "); Serial.println(target);
            enableMotor(true);
            stepper.moveTo(target);
            while (stepper.distanceToGo() != 0) stepper.run();
            Serial.print("Pos actual: "); Serial.println(stepper.currentPosition());
            enableMotor(false);
            }
        }
        } else if (cmd == "PRINT") {
        Serial.println("\n// Copie y pegue en main2.ino dentro de BASE_POSITIONS_COLUMNAS");
        Serial.print("const long BASE_POSITIONS_COLUMNAS[] = {\n");
        Serial.print("    ");
        // Imprimir HOME
        Serial.print(positions[0]); Serial.print(",   // [0] = HOME\n");
        for (int i = 1; i <= 8; i++) {
            Serial.print("    ");
            Serial.print(positions[i]);
            Serial.print((i==8)?"L":"L");
            Serial.print((i==8)?",   // [8] = Columna 'H'\n":",   // [" );
            if (i < 8) {
            // print index comment A..H
            char c = 'A' + (i - 1);
            Serial.print("[" ); Serial.print(i); Serial.print("] = Columna '"); Serial.print(c); Serial.print("'\n");
            }
        }
        Serial.println("};");
        Serial.println("\n// Alternativamente imprima como lista simple:");
        for (int i = 0; i < 9; i++) {
            Serial.print(i==0?"HOME":"");
            Serial.print(i==0?": ":"");
            if (i>0) { Serial.print((char)('A'+i-1)); Serial.print(": "); }
            Serial.println(positions[i]);
        }
        Serial.println("\nNOTA: Revisa signos (positivo/negativo) según orientación del motor.");
        } else {
        Serial.print("Comando desconocido: "); Serial.println(cmd);
        Serial.println("Escriba HELP para ver la lista de comandos.");
        }
    }
    }
}