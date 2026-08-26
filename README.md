# Organizador Personal

Mi organizador diario en una sola página HTML. Sin build, sin backend, sin dependencias: se abre `index.html` y anda. Todo lo que cargás se guarda en el `localStorage` de tu navegador, así que cada persona que entra ve su propia versión.

## Qué tiene

- **Hoy** — la agenda del día, con check para marcar lo hecho y un anillo de progreso arriba.
- **Semana** — vista de los 7 días en tarjetas; tocás una y editás el día.
- **Estudio** — lo que elegís hacer hoy de la facu (sale de Pendientes o lo agregás suelto).
- **Gym** — rutina editable por día y ejercicio.
- **Videos** — pegás un link de YouTube y queda con miniatura para ver después.
- **Pendientes** — dos categorías, facultad y otras cosas.
- **Nombre de usuario editable** en el saludo del header: quien entra escribe el suyo y queda guardado en su navegador.

## Cómo usarlo

Abrilo directo en el navegador:

```
open index.html
```

O serví la carpeta con cualquier server estático (por ejemplo `python3 -m http.server`) si querés probarlo desde otro dispositivo de la red.

## Dónde se guardan los datos

En `localStorage`, bajo claves con prefijo `org:` (`org:schedule`, `org:pendientes`, `org:gym`, `org:videos`, `org:username`, `org:checks:YYYY-MM-DD`, etc.). No sale nada del navegador. Si limpiás los datos del sitio, se borra.

## Stack

HTML + CSS + JS vanilla en un solo archivo (`index.html`). Fuentes desde Google Fonts, miniaturas desde `i.ytimg.com`. Nada más.
