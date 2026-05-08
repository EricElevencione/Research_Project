create view public.geometry_columns as
select
  current_database()::character varying(256) as f_table_catalog,
  n.nspname as f_table_schema,
  c.relname as f_table_name,
  a.attname as f_geometry_column,
  COALESCE(postgis_typmod_dims (a.atttypmod), sn.ndims, 2) as coord_dimension,
  COALESCE(
    NULLIF(postgis_typmod_srid (a.atttypmod), 0),
    sr.srid,
    0
  ) as srid,
  replace(
    replace(
      COALESCE(
        NULLIF(
          upper(postgis_typmod_type (a.atttypmod)),
          'GEOMETRY'::text
        ),
        st.type,
        'GEOMETRY'::text
      ),
      'ZM'::text,
      ''::text
    ),
    'Z'::text,
    ''::text
  )::character varying(30) as type
from
  pg_class c
  join pg_attribute a on a.attrelid = c.oid
  and not a.attisdropped
  join pg_namespace n on c.relnamespace = n.oid
  join pg_type t on a.atttypid = t.oid
  left join (
    select
      s.connamespace,
      s.conrelid,
      s.conkey,
      replace(
        split_part(s.consrc, ''''::text, 2),
        ')'::text,
        ''::text
      ) as type
    from
      (
        select
          pg_constraint.connamespace,
          pg_constraint.conrelid,
          pg_constraint.conkey,
          pg_get_constraintdef(pg_constraint.oid) as consrc
        from
          pg_constraint
      ) s
    where
      s.consrc ~~* '%geometrytype(% = %'::text
  ) st on st.connamespace = n.oid
  and st.conrelid = c.oid
  and (a.attnum = any (st.conkey))
  left join (
    select
      s.connamespace,
      s.conrelid,
      s.conkey,
      replace(
        split_part(s.consrc, ' = '::text, 2),
        ')'::text,
        ''::text
      )::integer as ndims
    from
      (
        select
          pg_constraint.connamespace,
          pg_constraint.conrelid,
          pg_constraint.conkey,
          pg_get_constraintdef(pg_constraint.oid) as consrc
        from
          pg_constraint
      ) s
    where
      s.consrc ~~* '%ndims(% = %'::text
  ) sn on sn.connamespace = n.oid
  and sn.conrelid = c.oid
  and (a.attnum = any (sn.conkey))
  left join (
    select
      s.connamespace,
      s.conrelid,
      s.conkey,
      replace(
        replace(
          split_part(s.consrc, ' = '::text, 2),
          ')'::text,
          ''::text
        ),
        '('::text,
        ''::text
      )::integer as srid
    from
      (
        select
          pg_constraint.connamespace,
          pg_constraint.conrelid,
          pg_constraint.conkey,
          pg_get_constraintdef(pg_constraint.oid) as consrc
        from
          pg_constraint
      ) s
    where
      s.consrc ~~* '%srid(% = %'::text
  ) sr on sr.connamespace = n.oid
  and sr.conrelid = c.oid
  and (a.attnum = any (sr.conkey))
where
  (
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
  and not c.relname = 'raster_columns'::name
  and t.typname = 'geometry'::name
  and not pg_is_other_temp_schema(c.relnamespace)
  and has_table_privilege(c.oid, 'SELECT'::text);