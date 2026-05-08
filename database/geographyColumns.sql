create view public.geography_columns as
select
  current_database() as f_table_catalog,
  n.nspname as f_table_schema,
  c.relname as f_table_name,
  a.attname as f_geography_column,
  postgis_typmod_dims (a.atttypmod) as coord_dimension,
  postgis_typmod_srid (a.atttypmod) as srid,
  postgis_typmod_type (a.atttypmod) as type
from
  pg_class c,
  pg_attribute a,
  pg_type t,
  pg_namespace n
where
  t.typname = 'geography'::name
  and a.attisdropped = false
  and a.atttypid = t.oid
  and a.attrelid = c.oid
  and c.relnamespace = n.oid
  and (
    c.relkind = any (
      array[
        'r'::"char",
        'v'::"char",
        'm'::"char",
        'f'::"char",
        'p'::"char"
      ]
    )
  )
  and not pg_is_other_temp_schema(c.relnamespace)
  and has_table_privilege(c.oid, 'SELECT'::text);