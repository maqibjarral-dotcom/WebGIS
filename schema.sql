-- STEP A: run this ONE line alone in pgAdmin (connected to "postgres" db), then connect to env_gis:
-- CREATE DATABASE env_gis;
-- STEP B: connect to env_gis and run everything below.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Monitoring locations (one row per physical station)
CREATE TABLE IF NOT EXISTS stations (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('Rain Gauge','Weather Station','Air Quality Monitor','Other')),
  city         TEXT,
  province     TEXT,
  status       TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Maintenance')),
  installed_on DATE,
  geom         GEOMETRY(Point,4326) NOT NULL        -- lon/lat WGS84
);
CREATE INDEX IF NOT EXISTS stations_geom_idx ON stations USING GIST (geom);

-- Time-stamped readings (many per station)
CREATE TABLE IF NOT EXISTS observations (
  id            SERIAL PRIMARY KEY,
  station_id    INT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  temperature_c NUMERIC(4,1),
  humidity_pct  NUMERIC(4,1),
  rainfall_mm   NUMERIC(6,1),
  pm25          NUMERIC(6,1),     -- ug/m3
  wind_kph      NUMERIC(5,1),
  notes         TEXT,
  recorded_by   TEXT,
  source        TEXT NOT NULL DEFAULT 'student-collected' CHECK (source IN ('student-collected','official'))
);
CREATE INDEX IF NOT EXISTS obs_station_time_idx ON observations (station_id, observed_at DESC);

-- SAMPLE DATA (mock values for demo; replace/extend with real data you collect)
INSERT INTO stations (name,type,city,province,status,installed_on,geom) VALUES
('Islamabad G-8 Weather Station','Weather Station','Islamabad','ICT','Active','2022-03-01',ST_SetSRID(ST_MakePoint(73.0479,33.6844),4326)),
('Rawalpindi Saddar Rain Gauge','Rain Gauge','Rawalpindi','Punjab','Active','2021-07-15',ST_SetSRID(ST_MakePoint(73.0169,33.5951),4326)),
('Lahore Gulberg AQ Monitor','Air Quality Monitor','Lahore','Punjab','Active','2023-01-10',ST_SetSRID(ST_MakePoint(74.3436,31.5204),4326)),
('Karachi Clifton Weather Station','Weather Station','Karachi','Sindh','Active','2020-05-20',ST_SetSRID(ST_MakePoint(67.0011,24.8138),4326)),
('Peshawar University Rain Gauge','Rain Gauge','Peshawar','KP','Maintenance','2021-09-01',ST_SetSRID(ST_MakePoint(71.4870,34.0087),4326)),
('Quetta Airport Weather Station','Weather Station','Quetta','Balochistan','Active','2019-11-11',ST_SetSRID(ST_MakePoint(66.9380,30.2514),4326)),
('Multan Cantt AQ Monitor','Air Quality Monitor','Multan','Punjab','Inactive','2022-12-05',ST_SetSRID(ST_MakePoint(71.4753,30.1978),4326)),
('Gilgit River Level Sensor','Other','Gilgit','GB','Active','2022-06-30',ST_SetSRID(ST_MakePoint(74.3080,35.9208),4326));

INSERT INTO observations (station_id,observed_at,temperature_c,humidity_pct,rainfall_mm,pm25,wind_kph,notes,recorded_by,source) VALUES
(1,now()-interval '2 hours',24.5,58,0,35,8,'Clear sky','demo','student-collected'),
(1,now()-interval '1 day',22.0,70,4.2,28,12,'Light rain','demo','student-collected'),
(2,now()-interval '3 hours',26.0,65,12.5,NULL,NULL,'Heavy shower','demo','student-collected'),
(3,now()-interval '1 hour',27.8,45,0,148,5,'Smog, unhealthy','demo','student-collected'),
(4,now()-interval '2 hours',31.2,72,0,62,18,'Sea breeze','demo','student-collected'),
(5,now()-interval '5 days',19.5,60,1.0,NULL,NULL,'Last reading before maintenance','demo','student-collected'),
(6,now()-interval '4 hours',12.3,30,0,22,15,'Cold, dry','demo','student-collected'),
(8,now()-interval '6 hours',9.0,55,0,NULL,6,'River level 2.1 m','demo','student-collected');
