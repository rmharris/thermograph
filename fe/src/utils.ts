import type {Reading, ReadingType, SensorMap, SingleSensorMap} from './components/models';

export function addReadingToMap(sensorMap: SensorMap, reading: Reading) {
  const readingTypes:ReadingType[] = ["NULL", "temperature", "pressure", "voltage"];
  const readingType:ReadingType = readingTypes[reading.rtype];

  if (!sensorMap.has(reading.sensor_id)) {
    sensorMap.set(reading.sensor_id, new Map());
  }
  const sensorData: SingleSensorMap  = sensorMap.get(reading.sensor_id)!;

    const point = {x: reading.time / 1000000, y: reading.value};

    if (sensorData.has(readingType)) {
        const observationData = sensorData.get(readingType)!;
        if (point.y > observationData?.data[observationData.max]?.y) {
                observationData.max = observationData.data.length;
        } else if (point.y < observationData?.data[observationData.min]?.y) {
                observationData.min = observationData.data.length;
        }
        observationData!.data.push(point);
         
    } else {
      sensorData.set(readingType, {min: 0, max: 0, data: [point]});
    }
}

export function readingsToMap(readings: Reading[]): SensorMap {
  const data = new Map();
  readings.forEach(reading  => {addReadingToMap(data, reading)});
  return data;
}

export function decimalPlaces(n: number, dp: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: dp, minimumFractionDigits: dp });
}
