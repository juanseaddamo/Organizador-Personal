# Requerimientos — Organizador Personal

Contexto de la app (para quien implemente): front-end vanilla (HTML/CSS/JS), persistencia en Supabase (tabla `estado`, un JSON por usuario) + localStorage como cache. Pestañas actuales: **Hoy**, **Semana**, **Estudio**, **Gym**, **Videos**, **Links**, **Pendientes** (categorías `facu` / `otras`). El horario semanal (`schedule`) tiene bloques tipados por `KLABEL`: `cursada`, `gym`, `estudio`, `laburo`, `boot`, `typing`, `rutina`, `libre`, `dormir`.

## 1. Integrar "Estudio" a la vista "Hoy"
Actualmente lo elegido en la pestaña **Estudio** vive aparte. Se pide que los ítems de Estudio del día aparezcan también en la lista de tareas de **Hoy** (agenda del día), no solo en su propia pestaña. El check debería sincronizarse entre ambas vistas (ya existe esa sincronización entre Estudio y Pendientes; extenderla a Hoy).

## 2. Programación de tareas para toda la semana
Agregar una forma de programar/agendar un ítem para que se repita o se distribuya a lo largo de **toda la semana**, y que eso se refleje automáticamente en la vista **Semana** (las tarjetas de los 7 días). Hoy la vista Semana solo muestra el `schedule` fijo por día de la semana; se necesita poder cargar algo una vez y que aparezca en los días correspondientes sin tener que repetirlo día por día.

## 3. Redefinir los bloques de horario de programación como "Estudio"
Los bloques de horario que hoy están tipados como `cursada` (curso de programación) deben pasar a ser del tipo `estudio` (mismo tratamiento que el resto de los bloques de estudio, para que cuenten como tiempo disponible de estudio en el día).

## 4. Boot.dev pasa a ser actividad de verano / proyectos
El bloque tipo `boot` (boot.dev) deja de usarse en el horario regular de la semana. Se reserva para la temporada de verano y para trabajar en proyectos. No requiere borrar el tipo, pero no debería programarse en el horario semanal normal por ahora.

## 5. Horario estimado en Pendientes de Facultad
Al agregar un ítem en **Pendientes → Facultad**, pedir una **duración estimada** (aproximada, +/- 1 hora) de cuánto tiempo lleva esa tarea.

## 6. Auto-asignación de pendientes de facultad al tiempo de estudio del día
Usando esa duración estimada, la app debería poder **ubicar automáticamente** las tareas pendientes de facultad dentro de los bloques de tipo `estudio` disponibles ese día, respetando el tiempo total asignado a estudio en la agenda diaria (no exceder ese tiempo disponible).

## 7. Priorización por materia según cercanía en la semana
La asignación automática (punto 6) debe tener en cuenta qué **materia** tiene algo (parcial, entrega, clase) más próximo dentro de la semana, para priorizar esas tareas antes que las de una materia sin nada urgente en el corto plazo.

## 8. Campo "materia" en Pendientes de Facultad
Cada ítem agregado en **Pendientes → Facultad** debe permitir indicar **de qué materia** es (campo obligatorio o al menos disponible al cargar el pendiente).

## 9. Horario de inicio y fin en actividades de Hoy
Las actividades que se agregan manualmente en la pestaña **Hoy** deben tener **horario de comienzo y de fin** (hoy en día, a juzgar por el flujo actual, se agregan solo como texto suelto sin horario). Esto también sería la base para poder ubicar ahí, con su franja horaria, los pendientes de facultad que se auto-asignen (punto 6).

## 10. Nueva sección: Materias cursando
Agregar una nueva ventana/sección donde cargar el **listado de materias que se están cursando** actualmente. Esta lista:
- Se vincula con los pendientes de facultad (para el campo "materia" del punto 8, probablemente como selector en vez de texto libre).
- Se vincula con el/los **calendario(s)** de cada materia (fechas de parciales, entregas, clases).
- Alimenta el algoritmo de auto-asignación diaria de estudio (puntos 6 y 7), para decidir de manera automática **qué estudiar cada día** según lo que se viene antes en cada materia.

---

### Resumen de dependencias entre puntos
- El punto 10 (materias + calendario) es la base de la que dependen el 7 (priorización) y el 8 (campo materia en pendientes).
- El punto 5 (duración estimada) y el 8 (materia) son los dos datos nuevos que necesita cada pendiente de facultad para que funcione la auto-asignación (6).
- El punto 3 (bloques `cursada` → `estudio`) es necesario para que el tiempo de estudio disponible por día (usado en el punto 6) sea correcto.
- El punto 9 (horario de inicio/fin en Hoy) es lo que permite que la auto-asignación (6) pueda ubicar cada pendiente en una franja horaria concreta dentro del día, en vez de solo agregarlo como texto suelto.
