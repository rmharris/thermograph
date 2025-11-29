type SensorId = number;
type SensorName = string;
type ReadingType = "NULL" | "temperature" | "pressure" | "voltage";
type Point = {x: number, y: number};
type ObservationData = {min: number, max: number, data: Point[]};
type SingleSensorMap = Map<ReadingType, ObservationData>;
type SensorMap = Map<SensorId, SingleSensorMap>;
type Interval = "1D" | "1W" | "1M" | "1Y";

type Reading = {
  time: number,
  rtype: number,
  sensor_id: number,
  value: number,
}

type Sensor = {
  sensor_id: number,
  name: string,
  internal: boolean,
}

export type {Interval, Reading, SensorId, SingleSensorMap, ObservationData, Sensor, SensorName, SensorMap, ReadingType, Point};
