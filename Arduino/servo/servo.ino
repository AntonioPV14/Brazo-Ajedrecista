#include <Servo.h>

// Sketch independiente para controlar solo los servos (Hombro, Codo, Garra)
// Pines coincidentes con el proyecto principal
#define PIN_HOMBRO 12
#define PIN_CODO 13
#define PIN_GARRA 11

// Posiciones HOME y valores de garra
const int HOME_HOMBRO = 120;
const int HOME_CODO = 140;
const int GARRA_ABRIR = 30;
const int GARRA_CERRAR = 70;

// Estructura y presets para calibración (P1..P8 + [0]=HOME)
struct ArmPosition { int hombro; int codo; };
// Inicializa con valores de ejemplo. Usa SAVE Pn para guardar los tuyos.
ArmPosition ARM_PRESETS[9] = {
  {HOME_HOMBRO, HOME_CODO}, // [0] HOME
  {105, 100}, // P1: Ejemplo
  {98, 110},  // P2: Ejemplo
  {90, 120},  // P3: Ejemplo
  {88, 130},  // P4: Ejemplo
  {85, 138},  // P5: Ejemplo
  {80, 145},  // P6: Ejemplo
  {75, 152},  // P7: Ejemplo
  {70, 160}   // P8: Ejemplo
};

// Secuencias por preset: (pre y post) - Se mantienen para compatibilidad, pero se ignoran en la calibración básica.
struct PresetSeq {
  int preH; int preC; unsigned long preDelayMs;
  int postH; int postC; unsigned long postDelayMs;
  bool hasPre; bool hasPost;
};
PresetSeq PRESET_SEQS[9];

// Objetos servo
Servo servoHombro;
Servo servoCodo;
Servo servoGarra;

// Posiciones actuales (iniciadas en HOME)
int posHombroActual = HOME_HOMBRO;
int posCodoActual = HOME_CODO;
int posGarraActual = GARRA_ABRIR;

// Movimiento suave de un servo hasta target (bloqueante, simple)
void moverServoSuave(Servo &s, int &posActual, int target, int delayMs = 12) {
  if (posActual == target) return;
  // Limita el target al rango de 0 a 180 para evitar fallos.
  if (target < 0) target = 0;
  if (target > 180) target = 180;
  
  int steps = abs(target - posActual);
  int dir = (target > posActual) ? 1 : -1;
  for (int i = 0; i < steps; ++i) {
    posActual += dir;
    s.write(posActual);
    delay(delayMs);
  }
  posActual = target;
}

// Mueve los dos servos del brazo suavemente (primero codo, luego hombro)
void moverBrazo(int hombroTarget, int codoTarget) {
  Serial.print("Moviendo brazo a H="); Serial.print(hombroTarget);
  Serial.print(" C="); Serial.println(codoTarget);
  // Movimiento del codo primero (típicamente más seguro)
  moverServoSuave(servoCodo, posCodoActual, codoTarget);
  delay(30);
  // Luego movimiento del hombro
  moverServoSuave(servoHombro, posHombroActual, hombroTarget);
}

// Mover a preset (P1..P8, 0=HOME)
void moverAPreset(int idx) {
  if (idx < 0 || idx > 8) return;
  Serial.print("Ir a preset P"); Serial.print(idx); Serial.print(" -> H="); Serial.print(ARM_PRESETS[idx].hombro);
  Serial.print(" C="); Serial.println(ARM_PRESETS[idx].codo);

  // NOTA: Se mantiene la lógica de PRESET_SEQS por si se desea usar
  // para movimientos finos, pero no es necesario para la calibración básica.
  
  // Ejecutar secuencia PRE si existe
  if (PRESET_SEQS[idx].hasPre) {
    Serial.print("Ejecutando SEQ PRE de P"); Serial.println(idx);
    moverServoSuave(servoCodo, posCodoActual, PRESET_SEQS[idx].preC);
    delay(50);
    moverServoSuave(servoHombro, posHombroActual, PRESET_SEQS[idx].preH);
    delay(PRESET_SEQS[idx].preDelayMs);
  }

  moverBrazo(ARM_PRESETS[idx].hombro, ARM_PRESETS[idx].codo);

  // Ejecutar secuencia POST si existe
  if (PRESET_SEQS[idx].hasPost) {
    Serial.print("Ejecutando SEQ POST de P"); Serial.println(idx);
    moverServoSuave(servoCodo, posCodoActual, PRESET_SEQS[idx].postC);
    delay(30);
    moverServoSuave(servoHombro, posHombroActual, PRESET_SEQS[idx].postH);
    delay(PRESET_SEQS[idx].postDelayMs);
  }  
}

// Funciones para abrir/cerrar garra
void abrirGarra() {
  moverServoSuave(servoGarra, posGarraActual, GARRA_ABRIR);
  Serial.println("Garra: ABIERTA");
}
void cerrarGarra() {
  moverServoSuave(servoGarra, posGarraActual, GARRA_CERRAR);
  Serial.println("Garra: CERRADA");
}

// Interpreta un token como por ejemplo "H90" o "C120" o "G30" y aplica
bool interpretarTokenYCambiar(String tok) {
  tok.trim();
  if (tok.length() < 2) return false;
  char id = tok.charAt(0);
  String num = tok.substring(1);
  int val = num.toInt();
  
  // No permitir movimiento si el valor es 0 o fuera de rango (1-180) para evitar problemas
  if (val < 1 || val > 180) {
      Serial.print("Error: Valor de angulo ("); Serial.print(val); Serial.println(") fuera de rango (1-180).");
      return false;
  }
  
  if (id == 'H') {
    moverBrazo(val, posCodoActual); // cambia hombro manteniendo codo
    return true;
  } else if (id == 'C') {
    moverBrazo(posHombroActual, val); // cambia codo manteniendo hombro
    return true;
  } else if (id == 'G') {
    moverServoSuave(servoGarra, posGarraActual, val);
    return true;
  }
  return false;
}

// --- Secuencias simplificadas para testear presets (NO USAR PARA CALIBRACIÓN) ---
// La complejidad de las secuencias originales ha sido removida para enfocarse en la calibración.
void takeSequence(int row) {
  Serial.print("Take Seq (Simplificada): Ir a P"); Serial.print(row); Serial.println(", CERRAR Garra.");
  moverBrazo(ARM_PRESETS[row].hombro, ARM_PRESETS[row].codo);
  delay(500);
  cerrarGarra();
  delay(500);
}

void liftSequence(int row) {
  Serial.print("Lift Seq (Simplificada): Retraer a HOME...");
  moverAPreset(0);
}

void dropSequence(int row) {
  Serial.print("Drop Seq (Simplificada): Ir a P"); Serial.print(row); Serial.println(", ABRIR Garra, Retraer a HOME.");
  // Bajar a la posicion objetivo y soltar
  moverBrazo(ARM_PRESETS[row].hombro, ARM_PRESETS[row].codo);
  delay(500);
  abrirGarra();
  delay(500);
  // Retraer a HOME
  moverAPreset(0);
}

void setup() {
  Serial.begin(115200);
  servoHombro.attach(PIN_HOMBRO);
  servoCodo.attach(PIN_CODO);
  servoGarra.attach(PIN_GARRA);

  // Posicionar en HOME al iniciar
  servoHombro.write(posHombroActual);
  servoCodo.write(posCodoActual);
  servoGarra.write(posGarraActual);

  Serial.println("--- servo.ino listo para CALIBRACION ---");
  Serial.println("--- Usa estos comandos para CALIBRAR individualmente: ---");
  Serial.println("H<deg> (e.g., H90) -> Mueve Hombro");
  Serial.println("C<deg> (e.g., C120) -> Mueve Codo");
  Serial.println("G<deg> (e.g., G30) -> Mueve Garra");
  Serial.println("SAVE Pn (e.g., SAVE P3) -> Guarda H y C actuales en el preset Pn (n=1..8)");
  Serial.println("---------------------------------------------------------");
  Serial.println("Otros comandos: HOME, P1..P8, ABRIR, CERRAR, TEST, SHOW Pn");
}

void loop() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    line.toUpperCase();

    if (line.length() == 0) return;

    if (line == "HOME") {
      Serial.println("Ir a HOME...");
      moverAPreset(0);
      abrirGarra();
    } else if (line.startsWith("MOVER PIEZA ")) {
      // Formato: MOVER PIEZA A3 A8 (Simplificado para testear presets)
      String rest = line.substring(12);
      rest.trim();
      int sep = rest.indexOf(' ');
      if (sep > 0) {
        String desde = rest.substring(0, sep);
        String hasta = rest.substring(sep + 1);
        desde.trim(); hasta.trim();
        if (desde.length() == 2 && hasta.length() == 2) {
          // Asumimos que la columna (letra) es irrelevante para este sketch
          int rowFrom = desde.charAt(1) - '0';
          int rowTo = hasta.charAt(1) - '0';
          if (rowFrom >=1 && rowFrom <=8 && rowTo >=1 && rowTo <=8) {
            Serial.print("TEST MOVER PIEZA: "); Serial.print(desde); Serial.print(" -> "); Serial.println(hasta);
            
            // 1. Ir a origen (preset)
            moverAPreset(rowFrom);
            delay(500);
            
            // 2. Ejecutar secuencia de toma (simplificada)
            takeSequence(rowFrom);
            
            // 3. Elevar según secuencia (simplificada: ir a HOME)
            liftSequence(rowFrom);
            
            // 4. Mover a destino (preset)
            moverAPreset(rowTo);
            delay(500);
            
            // 5. Soltar en destino (simplificada)
            dropSequence(rowTo);
            
            Serial.println("TEST MOVER PIEZA: completado (solo usa ARM_PRESETS)");
          } else {
            Serial.println("Filas invalidas (usar 1..8)");
          }
        } else {
          Serial.println("Formato MOVER PIEZA incorrecto. Use: MOVER PIEZA A2 B3");
        }
      } else {
        Serial.println("Formato MOVER PIEZA incorrecto. Use: MOVER PIEZA A2 B3");
      }
    } else if (line == "ABRIR") {
      abrirGarra();
    } else if (line == "CERRAR") {
      cerrarGarra();
    } else if (line.length() == 2 && line.charAt(0) == 'P' && line.charAt(1) >= '1' && line.charAt(1) <= '8') {
      int idx = line.charAt(1) - '0';
      moverAPreset(idx);
    } else if (line.startsWith("SAVE P") && line.length() >= 6) {
      // SAVE Pn -> guarda la posicion actual en el preset
      int idx = line.charAt(6) - '0';
      if (idx >=1 && idx <=8) {
        ARM_PRESETS[idx].hombro = posHombroActual;
        ARM_PRESETS[idx].codo = posCodoActual;
        Serial.print("Preset P"); Serial.print(idx); Serial.println(" guardado con la posicion actual.");
      } else {
        Serial.println("Uso: SAVE Pn   (n=1..8)");
      }
    } else if (line.startsWith("SHOW P") && line.length() >= 6) {
      int idx = line.charAt(6) - '0';
      if (idx >=0 && idx <=8) {
        Serial.print("P"); Serial.print(idx); Serial.print(": H="); Serial.print(ARM_PRESETS[idx].hombro);
        Serial.print(" C="); Serial.println(ARM_PRESETS[idx].codo);
      } else {
        Serial.println("Uso: SHOW Pn   (n=0..8, 0=HOME)");
      }
    } else if (line.startsWith("SET P") && line.length() > 5) {
      // SET Pn H90 C110  -> parse
      // Se mantiene este comando complejo para permitir el ajuste fino
      int sp1 = line.indexOf(' ');
      int sp2 = line.indexOf(' ', sp1+1);
      if (sp2 == -1) sp2 = line.length();
      String token1 = (sp1!=-1) ? line.substring(sp1+1, sp2) : ""; // Pn
      if (token1.length() >=2 && token1.charAt(0)=='P') {
        int idx = token1.charAt(1)-'0';
        if (idx < 1 || idx > 8) { Serial.println("Indice Pn invalido (1..8)"); }
        else {
          int pos = sp2+1;
          int newH = ARM_PRESETS[idx].hombro;
          int newC = ARM_PRESETS[idx].codo;
          while (pos < line.length()) {
            int sp = line.indexOf(' ', pos);
            String tok = (sp==-1) ? line.substring(pos) : line.substring(pos, sp);
            tok.trim();
            if (tok.length()>1) {
              if (tok.charAt(0)=='H') newH = tok.substring(1).toInt();
              if (tok.charAt(0)=='C') newC = tok.substring(1).toInt();
            }
            if (sp==-1) break; else pos = sp+1;
          }
          ARM_PRESETS[idx].hombro = newH;
          ARM_PRESETS[idx].codo = newC;
          Serial.print("Preset P"); Serial.print(idx); Serial.print(" seteado a H="); Serial.print(newH);
          Serial.print(" C="); Serial.println(newC);
        }
      }
      
    } else if (line.startsWith("SETSEQ") || line.startsWith("SHOWSEQ") || line.startsWith("CLEARSEQ")) {
      Serial.println("Comando de SECUENCIA ignorado. Enfocarse en la calibracion posicional (SAVE Pn).");
      // Se mantienen los bloques de código originales para las secuencias 
      // pero se omite su ejecución y se da un mensaje informativo.
      // (Mantener el código del parser es complejo, así que solo doy la advertencia)
    
    } else if (line == "TEST") {
      // Secuencia de demostración
      Serial.println("Secuencia TEST: HOME -> P3 -> CERRAR -> HOME");
      moverAPreset(0);
      delay(1000);
      moverAPreset(3); // Va al preset P3
      delay(1000);
      cerrarGarra();
      delay(1000);
      moverAPreset(0);
      abrirGarra();
    } else {
      // Puede ser una secuencia de tokens separada por espacios: "H90 C120 G30"
      int start = 0;
      bool matchedAny = false;
      while (start < line.length()) {
        int sp = line.indexOf(' ', start);
        String tok;
        if (sp == -1) {
          tok = line.substring(start);
          start = line.length();
        } else {
          tok = line.substring(start, sp);
          start = sp + 1;
        }
        tok.trim();
        if (tok.length() == 0) continue;
        if (interpretarTokenYCambiar(tok)) matchedAny = true;
      }
      if (!matchedAny) {
        Serial.println("Comando no reconocido. Use HOME, H<deg>, C<deg>, G<deg>, ABRIR, CERRAR, TEST, Pn, SAVE Pn");
      }
    }

    while (Serial.available() > 0) Serial.read();
  }
}
