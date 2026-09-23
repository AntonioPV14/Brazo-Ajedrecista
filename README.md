# ♟️ Brazo Ajedrecista Inteligente | Intelligent Robotic Chess Arm

![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)
![Arduino](https://img.shields.io/badge/Arduino-00979D?style=for-the-badge&logo=arduino&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

---

🌐 **Language / Idioma:** [🇪🇸 Español](#-español) | [🇺🇸 English](#-english)

---

## 🇪🇸 Español

### 📌 Descripción

El **Brazo Ajedrecista Inteligente** es un sistema robótico diseñado para interactuar de forma física con un tablero de ajedrez, permitiendo el **movimiento automatizado de piezas** mediante un brazo robótico de precisión.

El proyecto integra **robótica**, **visión por computadora**, **sistemas embebidos** y **desarrollo web** para ofrecer una experiencia interactiva completa que combina automatización, control e inteligencia.

<p align="center">
  <img src="img/sis.png" alt="Esquema General del Sistema" width="750"/>
</p>

---

### ✨ Características Principales

* 🦾 **Brazo robótico de 3 grados de libertad (3 DoF)**.
* ♟️ **Movimiento automatizado de piezas** sobre tablero físico.
* ⚡ **Sistema de control en tiempo real** basado en **Arduino**.
* 👁️ **Visión por computadora** desarrollada con **Python**, **OpenCV** y **python-chess**.
* 🌐 **Interfaz web interactiva** para monitoreo y control del sistema.
* 📐 **Modelos 3D completos** disponibles en formato **STL** para impresión 3D.

---

### 🛠️ Tecnologías Utilizadas

| Categoría | Tecnologías / Herramientas |
| :--- | :--- |
| **Lenguajes de Programación** | `C++`, `Python`, `JavaScript`, `HTML5`, `CSS3` |
| **Backend & Servidor** | `Node.js`, `Express.js` |
| **Visión & Lógica de Ajedrez** | `OpenCV`, `python-chess` |
| **Hardware & Control** | `Arduino`, Servomotores, Motor Paso a Paso |
| **Diseño CAD & 3D** | `Fusion 360` |

---

### 🤖 Sistema Robótico

El sistema utiliza un brazo articulado proyectado para tomar y mover piezas de ajedrez con precisión. Su estructura mecánica combina **servomotores** para el control articular y **motores paso a paso** para el desplazamiento general, gestionados mediante un microcontrolador **Arduino**.

<p align="center">
  <img src="img/arm.jpg" alt="Estructura del Brazo Robótico" width="600"/>
</p>

---

### 🧩 Modelos 3D

Los modelos tridimensionales del diseño mecánico están disponibles en la carpeta `STL/`, organizados de la siguiente forma:

| Directorio | Descripción del Contenido |
| :--- | :--- |
| `STL/Arm/` | Archivos **3D (STL)** correspondientes a los eslabones y estructura del brazo robótico. |
| `STL/Claw/` | Archivos **3D (STL)** de la pinza (efector final) y mecanismo de sujeción. |

> 💡 *Puedes utilizar estos archivos para visualización en software CAD, ensamblaje o impresión 3D.*

---

### 🚀 Instalación y Configuración

#### 📋 Requisitos Previos
* **Node.js** (v14+ recomendado) y **npm**.
* **Python 3.x** instalado en el sistema.
* **Arduino IDE** configurado.
* **GTK3 Runtime**: `gtk3-runtime-3.24.31-2022-01-04-ts-win64` (Requerido para Windows).
* Hardware compatible con **Arduino**.

#### 1. Clonar el repositorio
```bash
git clone [https://github.com/AntonioPV14/Brazo-Ajedrecista.git](https://github.com/AntonioPV14/Brazo-Ajedrecista.git)
cd Brazo-Ajedrecista
