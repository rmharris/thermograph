CREATE TABLE IF NOT EXISTS readings (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        time INTEGER,
        sensor_id INTEGER,
        seqno INTEGER,
        type INTEGER,
        value float
);

CREATE TABLE IF NOT EXISTS latest_readings (
        sensor_id INTEGER NOT NULL,
        reading_type INTEGER NOT NULL,
        last_reading_id INTEGER NOT NULL,
        PRIMARY KEY (sensor_id,reading_type),
        FOREIGN KEY (last_reading_id) REFERENCES readings (id)
);

CREATE TRIGGER IF NOT EXISTS update_latest_readings
AFTER INSERT ON readings
BEGIN
        INSERT INTO latest_readings (sensor_id, reading_type, last_reading_id)
        VALUES (NEW.sensor_id, NEW.type, NEW.id)
        ON CONFLICT (sensor_id, reading_type) DO UPDATE
        SET last_reading_id = excluded.last_reading_id;
END;
