-- h3_postgis requires postgis and postgis_raster, and pulls h3 via CASCADE.
-- All three are available on Neon and in the local postgis/postgis image.
create extension if not exists postgis;
create extension if not exists postgis_raster;
create extension if not exists h3;
create extension if not exists h3_postgis cascade;
