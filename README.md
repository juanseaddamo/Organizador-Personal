# Organizador Personal

Organizador diario en una sola página: agenda por día y por semana, pendientes, estudio, rutina de gym, videos para ver después y accesos rápidos. Los datos se sincronizan entre tus dispositivos con una cuenta (email + contraseña) y podés elegir entre varios temas tipo editor de código.

**🔗 En vivo:** https://juanseaddamo.github.io/Organizador-Personal/

## Probalo sin registrarte (cuenta demo)

Entrá con esta cuenta de ejemplo para ver la página llena:

- **Email:** `demo@organizador.app`
- **Contraseña:** `123456789`

> La demo se **resetea sola cada vez que alguien entra**: podés tocar y editar todo lo que quieras; al salir y volver a entrar vuelve a los datos de ejemplo. También hay un botón **"Resetear demo"** para volver a los ejemplos sin salir.

## Qué tiene

- **Hoy** — la agenda del día, con check para marcar lo hecho y un anillo de progreso arriba.
- **Semana** — los 7 días en tarjetas; tocás uno y editás ese día.
- **Estudio** — lo que elegís hacer hoy de la facu (sale de Pendientes o lo agregás suelto). Al marcarlo hecho, se tacha también en Pendientes.
- **Gym** — rutina editable por día y ejercicio (series y repes).
- **Videos** — pegás un link de YouTube y queda con miniatura y título para ver después.
- **Links** — accesos rápidos (Teams, Notion, GitHub, campus, etc.), cada uno se abre en una pestaña nueva.
- **Pendientes** — dos categorías: facultad y otras cosas.
- **Temas** — elegís entre 7 paletas (Editor de código, Dracula, Nord, Gruvbox, Rosé Pine, Solarized Light, GitHub Light). Tu elección se guarda en tu cuenta.
- **Nombre editable** en el saludo del header.

## Cuentas y privacidad

- El acceso es con **email + contraseña**. El registro está abierto pero filtra por dominios conocidos (Gmail, Hotmail, Outlook, Yahoo, iCloud, Proton).
- Cada usuario ve **solo sus datos**: la base usa Row Level Security (RLS), así que una cuenta no puede leer ni tocar los datos de otra.
- No hay datos personales hardcodeados: si entrás con una cuenta nueva, arranca vacía.

## Cómo funciona

- **Front-end:** HTML + CSS + JavaScript vanilla, sin build ni framework. Está separado en `index.html` (estructura), `styles.css` (estilos y temas) y `app.js` (lógica).
- **Persistencia:** `localStorage` funciona como cache local y, al mismo tiempo, todo el estado se guarda como un único blob JSON por usuario en la tabla `estado` de **Supabase** (Postgres). Eso es lo que permite abrir la página en otro dispositivo y ver lo mismo.
- **Auth:** Supabase Auth con email/contraseña; la sesión persiste en el navegador.
- **Temas:** todo el estilo sale de variables CSS (`:root`), y cada tema es un bloque `[data-theme="..."]` que las redefine. Un script chico en el `<head>` aplica el tema guardado antes de pintar, para que no haya parpadeo.
- **Demo:** una función `reset_demo()` en la base copia unos datos semilla sobre la cuenta demo; la app la llama cada vez que se entra con esa cuenta.

## Stack

- HTML/CSS/JS vanilla (sin dependencias ni bundler)
- [Supabase](https://supabase.com) — Auth (email + contraseña), Postgres con RLS y una función RPC para la demo
- Google Fonts (Space Grotesk, Inter, JetBrains Mono)
- Hosting: GitHub Pages

## Correr local

No necesita build. Serví la carpeta con cualquier server estático:

```bash
python3 -m http.server 8000
# después abrí http://localhost:8000
```

> Se puede abrir `index.html` directo, pero conviene servirlo por HTTP para que el login de Supabase funcione bien.
