from __future__ import annotations

from pathlib import Path
from datetime import date

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
SCREENSHOTS = ROOT / "screenshots"
ASSETS = ROOT / "assets"
OUTPUT = ROOT / "UDLAIoT_documentacion_tecnica_y_simulacion_vps.docx"

NAVY = "09263E"
BLUE = "1677FF"
LIGHT_BLUE = "EAF3FF"
GREEN = "18A566"
LIGHT_GREEN = "E8F7EF"
ORANGE = "F59E0B"
LIGHT_GRAY = "F4F7FB"
MID_GRAY = "607089"
RED = "E5484D"
WHITE = "FFFFFF"
BLACK = "111827"


def font(size: int, bold: bool = False):
    regular = Path("C:/Windows/Fonts/segoeui.ttf")
    semibold = Path("C:/Windows/Fonts/seguisb.ttf")
    source = semibold if bold and semibold.exists() else regular
    return ImageFont.truetype(str(source), size=size)


def draw_centered(draw, box, text, text_font, fill):
    x1, y1, x2, y2 = box
    bounds = draw.multiline_textbbox((0, 0), text, font=text_font, spacing=8, align="center")
    tw = bounds[2] - bounds[0]
    th = bounds[3] - bounds[1]
    draw.multiline_text(((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2), text, font=text_font, fill=fill, spacing=8, align="center")


def arrow(draw, start, end, color=BLUE, width=6):
    if not color.startswith("#"):
        color = f"#{color}"
    draw.line([start, end], fill=color, width=width)
    ex, ey = end
    sx, sy = start
    if abs(ex - sx) >= abs(ey - sy):
        direction = 1 if ex > sx else -1
        points = [(ex, ey), (ex - direction * 18, ey - 11), (ex - direction * 18, ey + 11)]
    else:
        direction = 1 if ey > sy else -1
        points = [(ex, ey), (ex - 11, ey - direction * 18), (ex + 11, ey - direction * 18)]
    draw.polygon(points, fill=color)


def create_architecture_diagram():
    path = ASSETS / "arquitectura_udlaiot.png"
    canvas = Image.new("RGB", (1600, 760), "#F7F9FC")
    draw = ImageDraw.Draw(canvas)
    draw.text((70, 45), "Arquitectura general de UDLAIoT", font=font(42, True), fill="#09263E")
    draw.text((70, 102), "Aplicación web, API, mensajería IoT y almacenamiento trabajando como un único sistema", font=font(24), fill="#607089")

    boxes = [
        ((80, 220, 350, 430), "USUARIO\nNavegador web", "#EAF3FF", "#1677FF"),
        ((460, 220, 730, 430), "FRONTEND\nReact + Vite", "#EAF3FF", "#1677FF"),
        ((840, 220, 1110, 430), "BACKEND\nFastAPI", "#E8F7EF", "#18A566"),
        ((1220, 150, 1510, 315), "POSTGRESQL\nDatos e históricos", "#FFF4DF", "#F59E0B"),
        ((1220, 375, 1510, 540), "MOSQUITTO\nBroker MQTT", "#F1ECFF", "#7C3AED"),
        ((840, 570, 1110, 720), "ESP32 / SIMULADOR\nSensores y actuadores", "#FFF0F1", "#E5484D"),
    ]
    for box, label, fill_color, border in boxes:
        draw.rounded_rectangle(box, radius=24, fill=fill_color, outline=border, width=4)
        draw_centered(draw, box, label, font(25, True), "#111827")

    arrow(draw, (350, 325), (460, 325))
    draw.text((365, 286), "HTTPS", font=font(18, True), fill="#607089")
    arrow(draw, (730, 285), (840, 285))
    draw.text((748, 245), "REST", font=font(18, True), fill="#607089")
    arrow(draw, (840, 365), (730, 365))
    draw.text((744, 383), "WebSocket", font=font(18, True), fill="#607089")
    arrow(draw, (1110, 255), (1220, 235))
    arrow(draw, (1220, 285), (1110, 310))
    draw.text((1120, 175), "SQL", font=font(18, True), fill="#607089")
    arrow(draw, (1110, 380), (1220, 440), color="#7C3AED")
    arrow(draw, (1220, 490), (1110, 450), color="#7C3AED")
    draw.text((1125, 475), "MQTT", font=font(18, True), fill="#607089")
    arrow(draw, (1365, 540), (1100, 625), color="#7C3AED")
    arrow(draw, (1000, 570), (1280, 515), color="#7C3AED")
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)
    return path


def create_flow_diagram():
    path = ASSETS / "flujo_telemetria_control.png"
    canvas = Image.new("RGB", (1600, 760), "#FFFFFF")
    draw = ImageDraw.Draw(canvas)
    draw.text((70, 45), "Flujo bidireccional: telemetría y control", font=font(42, True), fill="#09263E")
    draw.text((70, 102), "La lectura viaja hacia la web; el comando regresa al dispositivo y se confirma con un ACK", font=font(24), fill="#607089")

    top = [
        ((80, 200, 350, 345), "DHT22\nTemperatura / humedad", "#FFF0F1", "#E5484D"),
        ((445, 200, 715, 345), "ESP32\nPublica telemetría", "#EAF3FF", "#1677FF"),
        ((810, 200, 1080, 345), "MOSQUITTO\nTopic telemetry", "#F1ECFF", "#7C3AED"),
        ((1175, 200, 1520, 345), "FASTAPI + WEBSOCKET\nInterfaz actualizada", "#E8F7EF", "#18A566"),
    ]
    bottom = [
        ((80, 520, 350, 665), "LED VIRTUAL\nCambia de estado", "#FFF4DF", "#F59E0B"),
        ((445, 520, 715, 665), "ESP32\nEjecuta y confirma", "#EAF3FF", "#1677FF"),
        ((810, 520, 1080, 665), "MOSQUITTO\nCommands + ACK", "#F1ECFF", "#7C3AED"),
        ((1175, 520, 1520, 665), "UDLAIoT WEB\nUsuario pulsa Encender", "#E8F7EF", "#18A566"),
    ]
    for box, label, fill_color, border in top + bottom:
        draw.rounded_rectangle(box, radius=22, fill=fill_color, outline=border, width=4)
        draw_centered(draw, box, label, font(23, True), "#111827")
    for x in [(350, 445), (715, 810), (1080, 1175)]:
        arrow(draw, (x[0], 272), (x[1], 272), color="#1677FF")
    for x in [(1175, 1080), (810, 715), (445, 350)]:
        arrow(draw, (x[0], 592), (x[1], 592), color="#7C3AED")
    draw.text((80, 375), "FLUJO DE LECTURAS", font=font(20, True), fill="#1677FF")
    draw.text((80, 695), "FLUJO DE CONTROL Y CONFIRMACIÓN", font=font(20, True), fill="#7C3AED")
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, optimize=True)
    return path


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color="D8E0EC", size="5"):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:color"), color)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_field(paragraph, instruction):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.extend([begin, instr, separate, end])


def set_run(run, size=None, bold=None, color=None, name="Aptos"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def add_text(doc, text, style=None, bold_prefix=None, color=BLACK, size=10.5, after=5):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.12
    if bold_prefix and text.startswith(bold_prefix):
        r1 = p.add_run(bold_prefix)
        set_run(r1, size=size, bold=True, color=color)
        r2 = p.add_run(text[len(bold_prefix):])
        set_run(r2, size=size, color=color)
    else:
        r = p.add_run(text)
        set_run(r, size=size, color=color)
    return p


def add_bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.left_indent = Inches(0.25)
        p.paragraph_format.first_line_indent = Inches(-0.12)
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(item)
        set_run(r, 10.3, color=BLACK)


def add_numbered(doc, items):
    for index, item in enumerate(items, start=1):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Inches(0.3)
        p.paragraph_format.first_line_indent = Inches(-0.18)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(f"{index}. {item}")
        set_run(r, 10.3, color=BLACK)


def add_callout(doc, title, body, fill=LIGHT_BLUE, accent=BLUE):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    tr_pr = table.rows[0]._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    tr_pr.append(cant_split)
    cell = table.cell(0, 0)
    cell.width = Inches(6.7)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    shade(cell, fill)
    set_cell_border(cell, color=accent, size="10")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(title)
    set_run(r, 10.5, True, accent)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(0)
    r2 = p2.add_run(body)
    set_run(r2, 9.8, color=BLACK)


def add_screenshot_note(doc, body):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    row = table.rows[0]
    tr_pr = row._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:cantSplit"))
    cell = row.cells[0]
    cell.width = Inches(6.7)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    shade(cell, LIGHT_BLUE)
    set_cell_border(cell, color=BLUE, size="10")
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    label = p.add_run("Función: ")
    set_run(label, 9.8, True, BLUE)
    text_run = p.add_run(body)
    set_run(text_run, 9.8, color=BLACK)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    header = table.rows[0]
    set_repeat_table_header(header)
    for index, text in enumerate(headers):
        cell = header.cells[index]
        shade(cell, NAVY)
        set_cell_border(cell, color=NAVY)
        if widths:
            cell.width = Inches(widths[index])
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(text)
        set_run(r, 9, True, WHITE)
    for row_index, row_values in enumerate(rows):
        row = table.add_row()
        for index, text in enumerate(row_values):
            cell = row.cells[index]
            if row_index % 2 == 0:
                shade(cell, LIGHT_GRAY)
            set_cell_border(cell)
            if widths:
                cell.width = Inches(widths[index])
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(str(text))
            set_run(r, 8.8, color=BLACK)
    return table


def add_figure(doc, image_path, caption, description=None, width=6.7):
    image_path = Path(image_path)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run()
    run.add_picture(str(image_path), width=Inches(width))
    inline = run._r.xpath(".//wp:inline")[0]
    doc_pr = inline.xpath(".//wp:docPr")[0]
    doc_pr.set("descr", description or caption)
    doc_pr.set("title", caption)
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(5)
    r = cap.add_run(caption)
    set_run(r, 8.8, True, MID_GRAY)
    if description:
        d = doc.add_paragraph()
        d.alignment = WD_ALIGN_PARAGRAPH.CENTER
        d.paragraph_format.space_after = Pt(5)
        rr = d.add_run(description)
        set_run(rr, 8.8, color=MID_GRAY)


def add_section_title(doc, number, title, intro=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(f"{number}. {title}")
    set_run(r, 20, True, NAVY)
    if intro:
        add_text(doc, intro, color=MID_GRAY, size=10.5, after=8)


def add_subtitle(doc, title):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(title)
    set_run(r, 13, True, NAVY)


def screenshot_page(doc, number, title, intro, filename, caption, notes):
    add_section_title(doc, number, title, intro)
    add_figure(doc, SCREENSHOTS / filename, caption, width=6.55)
    add_screenshot_note(doc, notes)
    doc.add_page_break()


def configure_document(doc):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.65)
    section.bottom_margin = Inches(0.62)
    section.left_margin = Inches(0.72)
    section.right_margin = Inches(0.72)
    section.header_distance = Inches(0.3)
    section.footer_distance = Inches(0.3)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Aptos"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(BLACK)
    normal.paragraph_format.space_after = Pt(5)
    normal.paragraph_format.line_spacing = 1.12

    for style_name, size, color in [("Title", 30, NAVY), ("Heading 1", 20, NAVY), ("Heading 2", 13, NAVY)]:
        style = styles[style_name]
        style.font.name = "Aptos Display"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos Display")
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor.from_string(color)

    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("UDLAIoT  ·  Documento técnico y funcional")
    set_run(r, 8, True, MID_GRAY)

    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("UDLAIoT  |  ")
    set_run(r, 8, color=MID_GRAY)
    add_field(p, "PAGE")


def build_document():
    architecture = create_architecture_diagram()
    flow = create_flow_diagram()
    doc = Document()
    configure_document(doc)
    doc.core_properties.title = "UDLAIoT — Documentación técnica, funcional y de simulación"
    doc.core_properties.subject = "Descripción de la plataforma IoT universitaria"
    doc.core_properties.author = "Proyecto UDLAIoT"
    doc.core_properties.keywords = "IoT, ESP32, MQTT, Mosquitto, FastAPI, React, PostgreSQL, WebSocket"

    # Cover
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(24)
    r = p.add_run("UDLAIoT")
    set_run(r, 34, True, NAVY)
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_after = Pt(6)
    r2 = p2.add_run("Plataforma de gestión, monitoreo y control IoT")
    set_run(r2, 18, True, BLUE)
    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p3.paragraph_format.space_after = Pt(18)
    r3 = p3.add_run("Documentación funcional, técnica y de simulación ESP32")
    set_run(r3, 12, color=MID_GRAY)
    add_figure(
        doc,
        ASSETS / "mockup_esp32_mqtt_udlaiot.png",
        "Representación conceptual de una práctica IoT conectada a UDLAIoT",
        "Mockup ilustrativo: ESP32, sensor DHT22, LED, MQTT y panel web.",
        width=6.25,
    )
    p4 = doc.add_paragraph()
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p4.paragraph_format.space_before = Pt(10)
    r4 = p4.add_run("15 de octubre de 2026")
    set_run(r4, 10, True, MID_GRAY)
    doc.add_page_break()

    add_section_title(doc, "1", "Resumen del proyecto")
    add_text(doc, "UDLAIoT es una plataforma web para organizar proyectos de Internet de las Cosas, registrar dispositivos, recibir telemetría de sensores y controlar actuadores en tiempo real. El sistema está pensado para actividades académicas en las que estudiantes y docentes necesitan observar el comportamiento de prototipos sin separar la gestión del proyecto, la seguridad y la evidencia técnica.")
    add_callout(doc, "Objetivo principal", "Probar la cadena completa desde un dispositivo o simulador hasta la interfaz web: autenticación, proyecto, dispositivo, lectura del sensor, comando al actuador y confirmación del resultado.", fill=LIGHT_GREEN, accent=GREEN)
    add_subtitle(doc, "Alcance actual")
    add_bullets(doc, [
        "Inicio de sesión con access token de corta duración y refresh token revocable.",
        "Administración de usuarios y participación por proyecto mediante roles propietario, editor y visualizador.",
        "CRUD de proyectos, ubicaciones, dispositivos, sensores y actuadores.",
        "Credenciales MQTT separadas de la información general del dispositivo.",
        "Telemetría histórica con políticas de intervalo, cambio mínimo, retención y eliminación de duplicados.",
        "Control de actuadores mediante comandos MQTT, ACK y actualización por WebSocket.",
        "Eventos, alertas, documentación y archivos asociados al proyecto.",
        "Despliegue web en un VPS con simulador ESP32 y conexión de hardware físico por Wi-Fi o puente USB/Serial.",
    ])
    add_subtitle(doc, "Contenido")
    add_table(doc, ["Bloque", "Descripción"], [
        ("Interfaz", "Recorrido por todas las pantallas y operaciones principales."),
        ("Arquitectura", "Frontend, API, base de datos, MQTT y tiempo real."),
        ("Simulación", "ESP32 virtual con temperatura, humedad y LED."),
        ("Despliegue", "VPS, servicios web, MQTT, WebSocket y operación remota."),
        ("Seguridad", "Sesiones, roles, credenciales y recomendaciones."),
    ], widths=[1.35, 5.25])
    doc.add_page_break()

    screenshot_page(doc, "2", "Acceso al sistema", "El ingreso está cerrado al público. Un administrador semilla crea y administra las cuentas autorizadas.", "01_login.png", "Pantalla de inicio de sesión", "Solicita usuario y contraseña; al autenticar, la API entrega tokens de sesión. Los errores se muestran sin revelar detalles internos.")
    screenshot_page(doc, "3", "Panel de inicio", "El dashboard resume el estado operativo de los proyectos IoT y presenta accesos rápidos a las tareas más comunes.", "02_dashboard.png", "Dashboard principal con indicadores, proyectos, sensores y alertas", "Consultar cantidades de proyectos, dispositivos, sensores y actuadores; revisar lecturas destacadas, alertas recientes y accesos rápidos.")
    screenshot_page(doc, "4", "Gestión de proyectos", "Cada proyecto agrupa equipos, ubicaciones, personas, documentos y dispositivos bajo permisos específicos.", "03_projects.png", "Listado general de proyectos", "Crear, consultar, editar, archivar y abrir proyectos. El estado visible evita eliminar información histórica por accidente.")
    screenshot_page(doc, "5", "Dispositivos de un proyecto", "La vista interna concentra los recursos que pertenecen al proyecto seleccionado.", "04_project_detail.png", "Detalle del proyecto y dispositivo conectado", "Registrar un dispositivo físico o simulado, consultar su estado y entrar a su administración técnica.")
    screenshot_page(doc, "6", "Ubicaciones del proyecto", "Las ubicaciones ayudan a interpretar dónde se encuentra cada dispositivo o conjunto de sensores.", "05_project_locations.png", "Ubicaciones asociadas al proyecto", "Crear espacios como laboratorio, aula, invernadero o casa principal y relacionar allí los equipos.")
    screenshot_page(doc, "7", "Integrantes y roles", "Los usuarios existentes se agregan al proyecto por nombre de usuario y reciben un rol contextual.", "06_project_members.png", "Integrantes del proyecto", "Asignar propietario, editor o visualizador. Los permisos de la interfaz se ajustan al rol del integrante.")
    screenshot_page(doc, "8", "Documentación del proyecto", "La documentación registra decisiones, instrucciones y notas sin sacarlas del contexto del proyecto.", "07_project_documentation.png", "Notas de documentación del proyecto", "Crear, editar y ordenar contenido técnico para que el equipo conserve la memoria del proyecto.")
    screenshot_page(doc, "9", "Archivos y evidencias", "Los archivos complementan la documentación con diagramas, código, imágenes, PDF y videos.", "08_project_files.png", "Gestión de archivos", "Subir y descargar evidencias. El límite general es 25 MB y los videos pueden llegar a 100 MB. Una eliminación definitiva borra registro y archivo físico.")
    screenshot_page(doc, "10", "Inventario de dispositivos", "La vista global permite localizar rápidamente equipos de todos los proyectos disponibles para el usuario.", "09_devices.png", "Inventario de dispositivos", "Filtrar y consultar dispositivos, su proyecto, ubicación, tipo de placa, conexión y estado operativo.")
    screenshot_page(doc, "11", "Sensores del dispositivo", "Los canales de sensor reciben valores de telemetría y pueden conservar históricos según una política configurable.", "10_device_sensors.png", "Sensores del ESP32 virtual con lecturas en tiempo real", "Definir clave, tipo de dato, unidad, rango, visualización, GPIO y reglas de persistencia; consultar el último valor y el histórico.")
    screenshot_page(doc, "12", "Actuadores del dispositivo", "Los actuadores reciben órdenes desde la web y confirman su ejecución mediante mensajes ACK.", "11_device_actuators.png", "Actuador LED virtual", "Enviar comandos como encender o apagar. El estado visible se actualiza cuando el dispositivo confirma la orden.")
    screenshot_page(doc, "13", "Credenciales MQTT", "Cada dispositivo dispone de una identidad MQTT independiente y permisos limitados a sus propios topics.", "12_device_credentials.png", "Administración de la credencial MQTT", "Generar, rotar o revocar credenciales. La contraseña solo se muestra al crearla y nunca debe guardarse en el repositorio.")
    screenshot_page(doc, "14", "Inventario de sensores", "La pantalla transversal facilita revisar los canales de telemetría disponibles en la plataforma.", "13_sensors.png", "Sensores registrados", "Consultar sensores por proyecto o dispositivo, revisar estado y acceder a las operaciones permitidas.")
    screenshot_page(doc, "15", "Inventario de actuadores", "La administración global reúne los canales de control disponibles.", "14_actuators.png", "Actuadores registrados", "Consultar actuadores, identificar su dispositivo y operar controles de acuerdo con los permisos del usuario.")
    screenshot_page(doc, "16", "Eventos y alertas", "El sistema conserva señales relevantes para operación y diagnóstico.", "15_alerts.png", "Historial de eventos con filtros", "Registrar conexiones, desconexiones, datos inválidos y comandos fallidos; filtrar por proyecto, dispositivo, severidad y fecha.")
    screenshot_page(doc, "17", "Ubicaciones", "La vista general permite reutilizar y administrar la estructura física de los proyectos.", "16_locations.png", "Administración de ubicaciones", "Crear, editar, consultar y desactivar ubicaciones sin perder las relaciones históricas.")
    screenshot_page(doc, "18", "Usuarios", "El registro público no forma parte del MVP. El administrador mantiene el control de las cuentas.", "17_users.png", "Usuarios activos de UDLAIoT", "Crear usuarios, editar datos y desactivar cuentas. La captura muestra el administrador y tres cuentas de estudiantes para pruebas académicas.")
    screenshot_page(doc, "19", "Perfil propio", "Cada persona puede revisar y actualizar su información sin acceder a la administración global.", "18_profile.png", "Edición del perfil del usuario autenticado", "Modificar nombre y datos personales permitidos; la API valida y registra operaciones sensibles.")

    add_section_title(doc, "20", "Arquitectura técnica", "UDLAIoT separa la interfaz, la lógica de negocio, los datos y la mensajería para que cada componente tenga una responsabilidad clara.")
    add_figure(doc, architecture, "Arquitectura lógica de la solución", width=6.8)
    add_table(doc, ["Componente", "Tecnologías", "Responsabilidad"], [
        ("Frontend", "React, Vite, TypeScript, Tailwind", "Interfaz, formularios, permisos visuales, gráficas y consumo de API."),
        ("Backend", "FastAPI, SQLAlchemy, Pydantic, Alembic", "Autenticación, reglas de negocio, CRUD, auditoría y orquestación MQTT."),
        ("Base de datos", "PostgreSQL", "Usuarios, proyectos, canales, sesiones, históricos, eventos y auditoría."),
        ("Mensajería", "Eclipse Mosquitto / MQTT", "Intercambio desacoplado con dispositivos, telemetría, comandos y ACK."),
        ("Tiempo real", "WebSocket", "Entrega cambios del backend al navegador sin recargar la página."),
        ("Infraestructura", "Docker Compose", "Ejecución coordinada y reproducible de todos los servicios."),
    ], widths=[1.1, 2.0, 3.5])
    doc.add_page_break()

    add_section_title(doc, "21", "Cómo viaja la información")
    add_figure(doc, flow, "Flujos de telemetría y control", width=6.8)
    add_subtitle(doc, "Telemetría")
    add_numbered(doc, [
        "El ESP32 o simulador obtiene una lectura de temperatura o humedad.",
        "Publica el valor en un topic MQTT aislado para su identidad de dispositivo.",
        "FastAPI consume el mensaje, valida el canal y aplica la política de persistencia.",
        "PostgreSQL conserva la lectura cuando corresponde y el backend la emite por WebSocket.",
        "React actualiza tarjetas y gráficas sin recargar la pantalla.",
    ])
    add_subtitle(doc, "Control de actuadores")
    add_numbered(doc, [
        "El usuario pulsa Encender o Apagar sobre el LED virtual.",
        "La API valida permisos y registra un comando pendiente.",
        "Mosquitto entrega el comando al ESP32 por el topic commands.",
        "El dispositivo cambia el GPIO, publica un ACK y reporta el estado resultante.",
        "La web muestra la confirmación o registra un evento si ocurre un timeout.",
    ])
    doc.add_page_break()

    add_section_title(doc, "22", "Simulación de un ESP32", "El simulador se ejecuta como un servicio del VPS y expone el mismo comportamiento MQTT que tendría un ESP32 físico. La interfaz sigue siendo web y no depende de una ejecución local en el equipo del usuario.")
    add_figure(doc, ASSETS / "mockup_simulador_esp32_vps.png", "Pantalla web del simulador ESP32 alojado en el VPS", "El operador puede observar telemetría, controlar el LED y verificar el ACK desde el navegador.", width=6.65)
    add_figure(doc, ASSETS / "mockup_esp32_mqtt_udlaiot.png", "Mockup de la práctica: ESP32 + DHT22 + LED + MQTT + UDLAIoT", "La imagen es una representación conceptual; no reemplaza un diagrama eléctrico de conexión.", width=6.65)
    add_subtitle(doc, "Elementos simulados")
    add_table(doc, ["Elemento", "Comportamiento"], [
        ("ESP32 virtual", "Cliente MQTT que se identifica con las credenciales generadas por UDLAIoT."),
        ("DHT22", "Produce temperatura y humedad variables dentro de rangos realistas."),
        ("LED", "Actuador booleano que responde a Encender/Apagar y publica confirmación."),
        ("Mosquitto", "Transporta telemetría, estado, comandos y ACK."),
        ("Interfaz web", "Muestra lecturas, conexión y estado del LED en tiempo real."),
    ], widths=[1.5, 5.1])
    doc.add_page_break()

    add_section_title(doc, "23", "Configuración del simulador en el VPS")
    add_numbered(doc, [
        "Crear un dispositivo de tipo ESP32 con conexión MQTT directa.",
        "Crear canales de sensor con claves temperatura y humedad; crear el actuador booleano con clave led.",
        "Generar la credencial MQTT del dispositivo y copiarla una sola vez.",
        "Guardar servidor, Client ID, usuario, contraseña y topic base en un archivo de entorno privado del VPS. Ese archivo debe permanecer ignorado por Git.",
        "Instalar las dependencias del simulador en el VPS y ejecutarlo como servicio supervisado, por ejemplo con Docker Compose o systemd.",
        "Abrir el dispositivo en UDLAIoT, comprobar las lecturas y usar el botón del LED.",
    ])
    add_callout(doc, "Comando de ejecución en el VPS", "python simulator/esp32_virtual.py", fill=LIGHT_GRAY, accent=NAVY)
    add_subtitle(doc, "Variables esperadas en simulator/.env")
    add_table(doc, ["Variable", "Uso"], [
        ("MQTT_HOST / MQTT_PORT", "Dirección privada del broker del VPS; en producción se recomienda MQTT TLS por el puerto 8883."),
        ("MQTT_CLIENT_ID", "Identificador único del dispositivo."),
        ("MQTT_USERNAME / MQTT_PASSWORD", "Credencial generada por UDLAIoT. No documentar su valor real."),
        ("MQTT_BASE_TOPIC", "Prefijo nexiot/devices/{device_id}."),
        ("PUBLISH_INTERVAL", "Segundos entre publicaciones de telemetría."),
    ], widths=[2.2, 4.4])
    add_callout(doc, "Resultado esperado", "La consola informa Conectado y Escuchando commands/#. En la web aparecen temperatura y humedad; al accionar el LED, el simulador recibe la orden y envía el ACK.", fill=LIGHT_GREEN, accent=GREEN)
    doc.add_page_break()

    add_section_title(doc, "24", "Conexión de hardware físico", "La plataforma no obliga a que el dispositivo esté conectado al mismo equipo donde se abre el navegador. El camino recomendado es que un ESP32 con Wi-Fi se conecte directamente al broker MQTT seguro del VPS.")
    add_figure(doc, ASSETS / "mockup_conexion_hardware_vps.png", "Pantalla web para conectar ESP32 por Wi-Fi o USB/Serial", "La vista separa la conexión directa del dispositivo y el puente serial opcional para placas conectadas por cable.", width=6.65)
    add_subtitle(doc, "ESP32 por Wi-Fi")
    add_text(doc, "El ESP32 se conecta de forma saliente al VPS mediante MQTT sobre TLS. No es necesario abrir un puerto entrante hacia la red del usuario: el dispositivo inicia la conexión, se autentica con su credencial individual y publica en sus topics autorizados.")
    add_subtitle(doc, "ESP32 o Arduino por USB")
    add_text(doc, "Cuando la placa solo está disponible por USB, un puente serial local abre el puerto COM, lee los mensajes de la placa y los publica al MQTT del VPS usando TLS. El puente es el único componente local y no contiene la aplicación principal ni la base de datos.")
    add_subtitle(doc, "Web Serial")
    add_text(doc, "El navegador puede solicitar permiso para acceder a un puerto serial mediante Web Serial en navegadores compatibles. Esta opción es útil para una sesión interactiva, pero depende del navegador, de los permisos del usuario y de que la pestaña permanezca abierta. Para operación continua se recomienda el puente serial como agente independiente.")
    add_table(doc, ["Opción", "Cuándo usarla", "Dependencia local"], [
        ("ESP32 por Wi-Fi", "Dispositivos desplegados o laboratorio con red disponible.", "Ninguna; solo el firmware del ESP32."),
        ("Puente USB/Serial", "Arduino o ESP32 conectado físicamente por cable.", "Agente serial pequeño en el PC."),
        ("Web Serial", "Pruebas interactivas desde el navegador.", "Permiso del navegador y pestaña abierta."),
    ], widths=[1.45, 3.2, 1.95])
    doc.add_page_break()

    add_section_title(doc, "25", "Topics MQTT utilizados")
    add_table(doc, ["Topic", "Dirección", "Contenido"], [
        ("nexiot/devices/{id}/telemetry/#", "Dispositivo → plataforma", "Lecturas de sensores."),
        ("nexiot/devices/{id}/state/#", "Dispositivo → plataforma", "Estado confirmado de actuadores."),
        ("nexiot/devices/{id}/ack/#", "Dispositivo → plataforma", "Confirmación de comandos."),
        ("nexiot/devices/{id}/status", "Dispositivo → plataforma", "Conectado, desconectado y presencia."),
        ("nexiot/devices/{id}/commands/#", "Plataforma → dispositivo", "Órdenes dirigidas a los actuadores."),
    ], widths=[3.05, 1.65, 1.9])
    add_subtitle(doc, "Por qué se usa MQTT")
    add_text(doc, "MQTT es ligero, tolera conexiones intermitentes y desacopla al dispositivo de la aplicación web. El ESP32 no necesita conocer la base de datos ni la interfaz: únicamente publica y se suscribe a topics autorizados. Mosquitto actúa como intermediario y FastAPI aplica las reglas del sistema.")
    add_subtitle(doc, "Por qué se usa WebSocket")
    add_text(doc, "El navegador no se conecta directamente con las credenciales del dispositivo. FastAPI recibe los cambios de MQTT y los reenvía por WebSocket al usuario autenticado. Así se actualiza la interfaz en tiempo real sin sondeos frecuentes ni exposición de secretos.")
    add_callout(doc, "Separación importante", "MQTT conecta dispositivos con el backend; WebSocket conecta el backend con el navegador. Son protocolos diferentes y cumplen funciones complementarias.", fill=LIGHT_BLUE, accent=BLUE)
    doc.add_page_break()

    add_section_title(doc, "26", "Despliegue web en el VPS")
    add_text(doc, "En producción, Docker Compose se ejecuta en el VPS y mantiene coordinados el frontend, backend, PostgreSQL y Mosquitto. El usuario final solo necesita un navegador; no instala Python, Node, Docker ni el simulador. Los cambios de código se publican en el VPS mediante el flujo de despliegue definido para el proyecto.")
    add_table(doc, ["Servicio", "Puerto local", "Función"], [
        ("Frontend", "15173", "Aplicación web React."),
        ("Backend", "18000", "API FastAPI y WebSocket."),
        ("PostgreSQL", "55478", "Base de datos relacional."),
        ("Mosquitto MQTT", "11883", "Conexiones MQTT TCP."),
        ("Mosquitto WebSocket", "19001", "Transporte WebSocket del broker cuando sea necesario."),
    ], widths=[2.0, 1.2, 3.4])
    add_subtitle(doc, "Comandos básicos")
    add_callout(doc, "Actualizar servicios", "docker compose pull && docker compose up -d", fill=LIGHT_GREEN, accent=GREEN)
    add_callout(doc, "Ver estado", "docker compose ps", fill=LIGHT_BLUE, accent=BLUE)
    add_callout(doc, "Revisar logs", "docker compose logs -f backend frontend mosquitto", fill=LIGHT_GRAY, accent=NAVY)
    add_callout(doc, "Nota operativa", "Los comandos se ejecutan únicamente en el VPS por el administrador.", fill="FFF0F1", accent=RED)
    doc.add_page_break()

    add_section_title(doc, "27", "Datos, seguridad y auditoría")
    add_subtitle(doc, "Modelo de información")
    add_text(doc, "La estructura principal enlaza usuario → integrante de proyecto → proyecto → ubicación → dispositivo → canal. Los canales reciben lecturas o comandos; los eventos y auditorías permiten reconstruir qué ocurrió y quién ejecutó una operación sensible.")
    add_subtitle(doc, "Controles implementados")
    add_bullets(doc, [
        "Access token de corta duración y refresh token revocable almacenado como sesión.",
        "Cierre de una sesión específica o de todas las sesiones de un usuario.",
        "Permisos globales y permisos contextuales por proyecto.",
        "Credenciales MQTT separadas de la tabla de dispositivos y rotación bajo demanda.",
        "Contraseñas y secretos fuera del código fuente mediante archivos .env ignorados.",
        "Archivado y desactivación como operación habitual; eliminación definitiva solo con confirmación.",
        "Logs estructurados sin contraseñas, tokens ni credenciales completas.",
        "Auditoría de acciones sensibles y eventos de desconexión, datos inválidos o comandos fallidos.",
    ])
    add_subtitle(doc, "Políticas de telemetría")
    add_table(doc, ["Política", "Propósito"], [
        ("Intervalo", "Evita guardar con una frecuencia mayor a la configurada."),
        ("Solo cuando cambie", "Reduce históricos repetidos."),
        ("Cambio mínimo", "Ignora variaciones menores sin valor analítico."),
        ("Retención", "Elimina automáticamente lecturas vencidas."),
        ("Paginación y fechas", "Mantiene consultas controladas aun con muchos datos."),
    ], widths=[1.8, 4.8])
    doc.add_page_break()

    add_section_title(doc, "28", "Comprobación funcional")
    add_table(doc, ["Prueba", "Resultado esperado"], [
        ("Inicio de sesión", "Acceso válido y sesión revocable."),
        ("Proyecto e integrantes", "Proyecto visible y roles aplicados correctamente."),
        ("Conexión del simulador", "Dispositivo marcado como conectado."),
        ("Telemetría", "Temperatura y humedad actualizadas en pantalla e histórico."),
        ("Control del LED", "Comando enviado, estado cambiado y ACK recibido."),
        ("Desconexión", "Evento registrado y estado actualizado."),
        ("Permisos", "Un visualizador no ve operaciones de edición o control no autorizadas."),
        ("Retención", "Lecturas antiguas eliminadas según la política."),
    ], widths=[2.0, 4.6])
    add_callout(doc, "Criterio de éxito del MVP", "Un usuario autorizado inicia sesión, abre un proyecto, observa temperatura y humedad en tiempo real, controla el LED virtual y recibe confirmación del dispositivo.", fill=LIGHT_GREEN, accent=GREEN)
    add_subtitle(doc, "Conclusión")
    add_text(doc, "UDLAIoT integra las piezas fundamentales de una plataforma IoT educativa: identidad, organización por proyectos, inventario técnico, mensajería MQTT, tiempo real, persistencia y control de actuadores. El simulador alojado en el VPS permite demostrar el funcionamiento completo desde cualquier navegador, mientras que la conexión por Wi-Fi o el puente USB/Serial permiten incorporar hardware físico sin trasladar la aplicación fuera del entorno web.")

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build_document()
