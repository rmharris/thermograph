CREATE TABLE IF NOT EXISTS sensors (
        sensor_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        internal BOOLEAN,
        PRIMARY KEY (sensor_id)
);
