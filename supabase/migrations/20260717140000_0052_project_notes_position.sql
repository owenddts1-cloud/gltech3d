-- 0052_project_notes_position
-- Quadro branco de briefing LIVRE: as notas ganham posição x/y no plano (malha 3D estilo
-- AutoCAD). Substitui o modelo de raias (phase/sort_order da 0051, que ficam forward-only,
-- sem uso na UI). Idempotent — safe to re-apply.

alter table public.project_notes
  add column if not exists pos_x numeric,
  add column if not exists pos_y numeric;
