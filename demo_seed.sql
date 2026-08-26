-- =====================================================================
-- FASE 2 · Cuenta demo (correr TODO junto en el SQL Editor de Supabase)
-- Usuario demo esperado: demo@organizador.app  (creá el usuario primero
-- en Authentication > Users > Add user, con "Auto Confirm").
-- =====================================================================

-- 1) tabla semilla
create table if not exists public.demo_seed (data jsonb not null);

-- 2) asegurar unique en user_id (necesario para el reset). Si ya existe, se ignora.
do $$ begin
  begin
    alter table public.estado add constraint estado_user_id_key unique (user_id);
  exception when others then null;
  end;
end $$;

-- 3) función de reseteo (sin semilla => no toca nada)
create or replace function public.reset_demo() returns void
language plpgsql security definer set search_path = public as $$
declare demo_id uuid; seed jsonb;
begin
  select id into demo_id from auth.users where email = 'demo@organizador.app';
  if demo_id is null then return; end if;
  select data into seed from public.demo_seed limit 1;
  if seed is null then return; end if;
  insert into public.estado (user_id, data, updated_at)
    values (demo_id, seed, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = now();
end $$;
grant execute on function public.reset_demo() to authenticated, anon;

-- 4) cargar la semilla (datos de ejemplo)
delete from public.demo_seed;
insert into public.demo_seed (data) values ('{"username":"Demo","schedule":{"0":[{"id":"s00","time":"12:00","label":"Día libre","kind":"libre"},{"id":"s01","time":"20:00","label":"Planificar la semana","kind":"rutina"}],"1":[{"id":"s10","time":"08:00","label":"Análisis Matemático II","kind":"cursada"},{"id":"s11","time":"10:00","label":"Física I","kind":"cursada"},{"id":"s12","time":"14:00","label":"Estudiar para el parcial","kind":"estudio"},{"id":"s13","time":"19:00","label":"Gimnasio - Empuje","kind":"gym"}],"2":[{"id":"s20","time":"09:00","label":"Algoritmos y Estructuras de Datos","kind":"cursada"},{"id":"s21","time":"13:00","label":"TP de Programación","kind":"estudio"},{"id":"s22","time":"20:00","label":"Gimnasio - Tirón","kind":"gym"}],"3":[{"id":"s30","time":"08:00","label":"Álgebra","kind":"cursada"},{"id":"s31","time":"11:00","label":"Química","kind":"cursada"},{"id":"s32","time":"18:00","label":"boot.dev - backend","kind":"boot"}],"4":[{"id":"s40","time":"09:00","label":"Física I - práctica","kind":"cursada"},{"id":"s41","time":"14:00","label":"Estudiar Análisis","kind":"estudio"},{"id":"s42","time":"19:00","label":"Gimnasio - Pierna","kind":"gym"}],"5":[{"id":"s50","time":"10:00","label":"Sistemas de Representación","kind":"cursada"},{"id":"s51","time":"15:00","label":"Repaso semanal","kind":"estudio"},{"id":"s52","time":"23:00","label":"Descanso","kind":"dormir"}],"6":[{"id":"s60","time":"11:00","label":"Mecanografía","kind":"typing"},{"id":"s61","time":"16:00","label":"Proyecto personal","kind":"laburo"}]},"gym":{"days":[{"id":"gd1","name":"Empuje (pecho/hombro/tríceps)","exs":[{"id":"ge1","name":"Press de banca","sets":"4×8"},{"id":"ge2","name":"Press militar","sets":"4×10"},{"id":"ge3","name":"Aperturas con mancuernas","sets":"3×12"},{"id":"ge4","name":"Fondos","sets":"3×10"},{"id":"ge5","name":"Extensión de tríceps","sets":"3×12"}]},{"id":"gd2","name":"Tirón (espalda/bíceps)","exs":[{"id":"ge6","name":"Dominadas","sets":"4×8"},{"id":"ge7","name":"Remo con barra","sets":"4×10"},{"id":"ge8","name":"Jalón al pecho","sets":"3×12"},{"id":"ge9","name":"Curl con barra","sets":"3×10"},{"id":"ge10","name":"Curl martillo","sets":"3×12"}]},{"id":"gd3","name":"Pierna","exs":[{"id":"ge11","name":"Sentadilla","sets":"4×8"},{"id":"ge12","name":"Prensa","sets":"4×12"},{"id":"ge13","name":"Peso muerto rumano","sets":"3×10"},{"id":"ge14","name":"Extensión de cuádriceps","sets":"3×15"},{"id":"ge15","name":"Gemelos","sets":"4×15"}]}]},"pendientes":[{"id":"p1","text":"Entregar TP de Programación — 15/9","done":false,"cat":"facu"},{"id":"p2","text":"Preparar parcial de Análisis Matemático II","done":false,"cat":"facu"},{"id":"p3","text":"Leer capítulo 4 de Física","done":false,"cat":"facu"},{"id":"p4","text":"Terminar informe de laboratorio de Química","done":true,"cat":"facu"},{"id":"p5","text":"Renovar la SUBE","done":false,"cat":"otro"},{"id":"p6","text":"Pagar la cuota del gimnasio","done":false,"cat":"otro"},{"id":"p7","text":"Llamar al dentista","done":false,"cat":"otro"}],"videos":[{"id":"v1","url":"https://www.youtube.com/watch?v=rfscVS0vtbw","vid":"rfscVS0vtbw","title":"Learn Python - Full Course for Beginners","watched":false,"pid":null},{"id":"v2","url":"https://www.youtube.com/watch?v=RGOj5yH7evk","vid":"RGOj5yH7evk","title":"Git and GitHub for Beginners - Crash Course","watched":false,"pid":null},{"id":"v3","url":"https://www.youtube.com/watch?v=RBSGKlAvoiM","vid":"RBSGKlAvoiM","title":"Data Structures - Full Course (Google Engineer)","watched":false,"pid":null},{"id":"v4","url":"https://www.youtube.com/watch?v=HXV3zeQKqGY","vid":"HXV3zeQKqGY","title":"SQL Tutorial - Full Database Course for Beginners","watched":true,"pid":null},{"id":"v5","url":"https://www.youtube.com/watch?v=-uleG_Vecis","vid":"-uleG_Vecis","title":"100+ Computer Science Concepts Explained","watched":false,"pid":null}],"links":[{"id":"l1","label":"Microsoft Teams","url":"https://teams.microsoft.com"},{"id":"l2","label":"Notion","url":"https://notion.so"},{"id":"l3","label":"GitHub","url":"https://github.com"},{"id":"l4","label":"WebCampus UADE","url":"https://webcampus.uade.edu.ar"},{"id":"l5","label":"UADE Virtual","url":"https://virtual.uade.edu.ar"}],"notes":{"1":"Día cargado: facu a la mañana + gym","4":"Día full: práctica y gym","5":"Cursada + repaso, arranca el finde"}}'::jsonb);

-- 5) aplicar la semilla YA a la fila del usuario demo
insert into public.estado (user_id, data, updated_at)
select id, (select data from public.demo_seed limit 1), now()
from auth.users where email = 'demo@organizador.app'
on conflict (user_id) do update set data = excluded.data, updated_at = now();
