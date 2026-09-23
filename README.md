♟️ Brazo Ajedrecista Inteligente | Intelligent Robotic Chess Arm

🇪🇸 Español | 🇺🇸 English

🇪🇸 Español
📌 Descripción

El Brazo Ajedrecista Inteligente es un sistema robótico diseñado para interactuar con un tablero físico de ajedrez, permitiendo el movimiento automatizado de piezas mediante un brazo robótico.

El proyecto integra robótica, visión por computadora, sistemas embebidos y desarrollo web para ofrecer una experiencia interactiva que combina tecnología, automatización y aprendizaje del ajedrez.

✨ Características
Brazo robótico de 3 grados de libertad.
Movimiento automatizado de piezas de ajedrez.
Sistema de control basado en Arduino.
Visión por computadora mediante Python y OpenCV.
Interfaz web para la interacción con el sistema.
Modelos 3D disponibles en formato STL.
🛠️ Tecnologías
Categoría	Tecnologías
Programación	C++, Python, JavaScript, HTML, CSS
Backend	Node.js, Express.js
Visión por computadora	OpenCV, python-chess
Hardware	Arduino, servomotores, motor paso a paso
Diseño CAD	Fusion 360
🤖 Sistema Robótico

El sistema utiliza un brazo robótico diseñado para manipular piezas de ajedrez sobre un tablero físico.

Su estructura mecánica combina servomotores y un motor paso a paso, controlados mediante electrónica basada en Arduino.

🧩 Modelos 3D

Los modelos tridimensionales del proyecto están disponibles en formato STL, organizados en las siguientes carpetas:

Directorio	Contenido
STL/Arm/	Modelos 3D correspondientes al brazo robótico.
STL/Claw/	Modelos 3D correspondientes a la pinza o mecanismo de sujeción.

Los archivos pueden utilizarse para visualización, referencia del diseño mecánico e impresión 3D.

🚀 Instalación y Configuración
Requisitos
Node.js y npm.
Python 3.
Arduino IDE.
GTK3 Runtime: gtk3-runtime-3.24.31-2022-01-04-ts-win64.
Hardware compatible con Arduino.
1. Clonar el repositorio
git clone https://github.com/AntonioPV14/Brazo-Ajedrecista.git
cd Brazo-Ajedrecista
2. Instalar las dependencias
npm install

Instala también las bibliotecas de Python requeridas por el módulo de visión por computadora.

3. Instalar GTK3 Runtime

Para utilizar el sistema en Windows, es necesario instalar el siguiente entorno de ejecución:

gtk3-runtime-3.24.31-2022-01-04-ts-win64

Instala y configura GTK3 Runtime antes de ejecutar los componentes que dependen de esta biblioteca.

4. Configurar el hardware

Abre el código fuente de Arduino en Arduino IDE, selecciona la placa correspondiente y verifica las conexiones antes de cargar el firmware.

5. Ejecutar la aplicación

El servidor principal se encuentra en server.js.

Consulta package.json para identificar el comando de inicio configurado para la aplicación.

🇺🇸 English
📌 Description

The Intelligent Robotic Chess Arm is a robotic system designed to interact with a physical chessboard, enabling automated chess piece movement through a robotic arm.

The project integrates robotics, computer vision, embedded systems, and web development to provide an interactive experience combining technology, automation, and chess learning.

✨ Features
3-degree-of-freedom robotic arm.
Automated chess piece movement.
Arduino-based control system.
Computer vision using Python and OpenCV.
Web interface for system interaction.
3D models available in STL format.
🛠️ Technologies
Category	Technologies
Programming	C++, Python, JavaScript, HTML, CSS
Backend	Node.js, Express.js
Computer Vision	OpenCV, python-chess
Hardware	Arduino, servo motors, stepper motor
CAD Design	Fusion 360
🤖 Robotic System

The system uses a robotic arm designed to manipulate chess pieces on a physical chessboard.

Its mechanical structure combines servo motors and a stepper motor, controlled through Arduino-based electronics.

🧩 3D Models

The project's 3D models are available in STL format and organized into the following directories:

Directory	Contents
STL/Arm/	3D models of the robotic arm.
STL/Claw/	3D models of the claw or gripping mechanism.

These files can be used for visualization, mechanical design reference, and 3D printing.

🚀 Installation and Setup
Requirements
Node.js and npm.
Python 3.
Arduino IDE.
GTK3 Runtime: gtk3-runtime-3.24.31-2022-01-04-ts-win64.
Arduino-compatible hardware.
1. Clone the Repository
git clone https://github.com/AntonioPV14/Brazo-Ajedrecista.git
cd Brazo-Ajedrecista
2. Install Dependencies
npm install

Also install the Python libraries required by the computer vision module.

3. Install GTK3 Runtime

To use the system on Windows, the following runtime environment must be installed:

gtk3-runtime-3.24.31-2022-01-04-ts-win64

Install and configure GTK3 Runtime before running components that depend on this library.

4. Configure the Hardware

Open the Arduino source code in the Arduino IDE, select the appropriate board, and verify the hardware connections before uploading the firmware.

5. Run the Application

The main server entry point is server.js.

Refer to package.json to identify the application's configured startup command.

👨‍💻 Author

Antonio José Perozo Valbuena

Systems Engineering | Software Development | Robotics

GitHub: @AntonioPV14

📄 Licencia | License

🇪🇸 Este proyecto está distribuido bajo la Licencia MIT, que permite usar, copiar, modificar, distribuir y utilizar comercialmente el software, siempre que se incluya el aviso de copyright y los términos de la licencia.

🇺🇸 This project is licensed under the MIT License, which permits the use, copying, modification, distribution, and commercial use of the software, provided that the copyright notice and license terms are included.
