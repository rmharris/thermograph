package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"

	migrate "github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/gorilla/websocket"
	flags "github.com/jessevdk/go-flags"
	_ "github.com/mattn/go-sqlite3"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

var opts struct {
	DbPath       string `short:"d" long:"dbPath" description:"database path" required:"true"`
	Port         uint   `short:"p" long:"port" description:"backend port" default:"8080"`
	FrontEndPath string `short:"f" long:"frontEnd" description:"path to front-end static content" required:"true"`
}

type reading struct {
	Id       int
	Time     int64   `json:"time"`
	SensorId int     `json:"sensor_id"`
	Seqno    int     `json:"seqno"`
	Rtype    int     `json:"rtype"`
	Value    float32 `json:"value"`
}

type sensor struct {
	SensorId int    `json:"sensor_id"`
	Name     string `json:"name"`
	Internal bool   `json:"internal"`
}

func initDB(dbPath string, logger *log.Logger) *sql.DB {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		logger.Panicf("could not open database file: %s", dbPath)
	}

	d, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		logger.Panicf("could not create database driver: %s", err)
	}

	migrationSource, err := iofs.New(migrationFiles, "migrations")
	if err != nil {
		logger.Panicf("could not create migration source: %s", err)
	}

	m, err := migrate.NewWithInstance("iofs", migrationSource, "sqlite3", d)
	if err != nil {
		logger.Panicf("could not create migrate: %s", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(err)
	}

	return db
}

type handle struct {
	db      *sql.DB
	handler http.HandlerFunc
}

func (h *handle) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.handler(w, r)
}

var db *sql.DB

var wsMap map[*websocket.Conn]int
var wsMapLock sync.Mutex

func main() {
	_, err := flags.Parse(&opts)
	if err != nil {
		panic(err)
	}

	logger := log.Default()
	wsMap = make(map[*websocket.Conn]int)

	db = initDB(opts.DbPath, logger)
	defer db.Close()

	routes := []struct {
		path    string
		handler func(w http.ResponseWriter, r *http.Request)
	}{
		{"GET /api/v1/ws", handleWs},
		{"GET /api/v1/readings", handleGetReading},
		{"GET /api/v1/readings/latest", handleGetLatestReadings},
		{"POST /api/v1/readings", handlePostReading},
		{"GET /api/v1/sensors", handleGetSensors},
		{"POST /api/v1/sensors", handlePostSensor},
	}
	for _, route := range routes {
		http.Handle(route.path, &handle{db: db, handler: route.handler})
	}
	http.Handle("GET /", http.FileServer(http.Dir(opts.FrontEndPath)))

	log.Fatal(http.ListenAndServe(":"+strconv.FormatUint(uint64(opts.Port), 10), nil))
}

func handleWs(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
	}
	wsMapLock.Lock()
	wsMap[ws] = 1
	wsMapLock.Unlock()

	select {
	case <-r.Context().Done():
		break
	}
}

func handleGetReading(w http.ResponseWriter, r *http.Request) {
	var filters []string

	startString := r.URL.Query().Get("start")
	endString := r.URL.Query().Get("end")

	if startString != "" {
		if _, err := strconv.ParseUint(startString, 10, 64); err != nil {
			http.Error(w, "illegal start time", http.StatusBadRequest)
			return
		} else {
			filters = append(filters, "time >= "+startString)
		}
	}

	if endString != "" {
		if _, err := strconv.ParseUint(endString, 10, 64); err != nil {
			http.Error(w, "illegal end time", http.StatusBadRequest)
			return
		} else {
			filters = append(filters, "time < "+endString)
		}
	}

	var filter string
	if len(filters) > 0 {
		filter = "WHERE " + strings.Join(filters, " AND ")
	}
	queryStr := fmt.Sprintf("SELECT time, sensor_id, type, value FROM readings %s ORDER BY time ASC", filter)

	rows, err := db.Query(queryStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	readings := []reading{}
	for rows.Next() {
		var rd reading
		if err := rows.Scan(&rd.Time, &rd.SensorId, &rd.Rtype, &rd.Value); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		readings = append(readings, rd)
	}

	err = json.NewEncoder(w).Encode(readings)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handleGetLatestReadings(w http.ResponseWriter, r *http.Request) {
	queryStr := ("SELECT readings.time, readings.sensor_id, readings.type, readings.value FROM latest_readings INNER JOIN readings ON latest_readings.last_reading_id = readings.id;")
	rows, err := db.Query(queryStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	readings := []reading{}
	for rows.Next() {
		var rd reading
		if err := rows.Scan(&rd.Time, &rd.SensorId, &rd.Rtype, &rd.Value); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		readings = append(readings, rd)
	}

	err = json.NewEncoder(w).Encode(readings)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handlePostReading(w http.ResponseWriter, r *http.Request) {
	var rd reading

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.Panicf("can't read body: %s", err)
	}

	err = json.Unmarshal(body, &rd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = db.Exec("INSERT INTO readings(time, sensor_id, seqno, type, value) VALUES(?,?,?,?,?)", rd.Time, rd.SensorId, rd.Seqno, rd.Rtype, rd.Value)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	} else {
		wsMapLock.Lock()
		for ws := range wsMap {
			err = ws.WriteMessage(websocket.TextMessage, body)
			if err != nil {
				ws.Close()
				delete(wsMap, ws)
			}
		}
		wsMapLock.Unlock()
	}
}

func handleGetSensors(w http.ResponseWriter, r *http.Request) {
	queryStr := ("SELECT sensors.sensor_id, sensors.name, sensors.internal FROM sensors;")
	rows, err := db.Query(queryStr)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	sensors := []sensor{}
	for rows.Next() {
		var sensor sensor
		if err := rows.Scan(&sensor.SensorId, &sensor.Name, &sensor.Internal); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		sensors = append(sensors, sensor)
	}

	err = json.NewEncoder(w).Encode(sensors)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func handlePostSensor(w http.ResponseWriter, r *http.Request) {
	var sensor sensor

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.Panicf("can't read body: %s", err)
	}

	err = json.Unmarshal(body, &sensor)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = db.Exec("INSERT INTO sensors(sensor_id, name, internal) VALUES(?,?,?) ON CONFLICT DO UPDATE SET name=excluded.name, internal=excluded.internal;", sensor.SensorId, sensor.Name, sensor.Internal)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
