import React, {useEffect,useState} from 'react';
import HorizontalLine from './HorizontalLine';
import styles from "./SensorOverviews.module.css";
import type {Reading, Sensor, SensorMap, SingleSensorMap, SensorName} from './models';
import {decimalPlaces} from '../utils';
import {readingsToMap} from '../utils';

function SensorOverviewName({name}: {name?: string}) {
  return <td className={styles.sensorOverviewName}>{name}</td>;
}

function SensorOverviewValue({value}: {value: string}) {
  return <td className={styles.sensorOverviewValue}>{value}</td>;
}

function SensorOverviewUnit({unit}: {unit: string}) {
  return <td className={styles.sensorOverviewUnit}>{unit}</td>;
}

function SensorOverviewAge({age}: {age: string}) {
  return <td className={styles.sensorOverviewAge}>{age}</td>;
}

function getAge(t: number) {
  const interval = (Date.now() / 1000) - (t / 1000);
  var value;
  var unit;

  if (interval < 60) {
    value = interval;
    unit = "s";
  } else if (interval < 3600) {
    value = interval / 60;
    unit = "m";
  } else if (interval < 3600 * 24) {
    value = interval / 3600;
    unit = "h";
  } else if (interval < 3600 * 24 * 7) {
    value = interval / (3600 * 24);
    unit = "d";
  } else if (interval < 3600 * 24 * 365) {
    value = interval / (3600 * 24 * 7);
    unit = "w";
  } else {
    value = interval / (3600 * 24 * 364);
    unit = "y";
  }

  return Math.floor(value) + " " + unit;
}

function SensorOverview({sensorName, data, onClick}: {sensorName: SensorName, data: SingleSensorMap, onClick: any}) {
  const temp = data?.get("temperature");
  const latestTtime = (temp === undefined) ? -1 : temp.data[0].x;
  const latestTvalue = (temp === undefined) ? -1 : temp.data[0].y

  return <table onClick={onClick}>
    <tbody>
    <tr>
      <SensorOverviewName name={sensorName.toUpperCase()} />
      <SensorOverviewValue value={decimalPlaces(latestTvalue, 1)} />
      <SensorOverviewUnit unit="°C" />
      <SensorOverviewAge age={getAge(   latestTtime   )} />
    </tr>
    {/* <tr>
      <SensorOverviewName />
      <SensorOverviewValue value={decimalPlaces(42, 2)} />
      <SensorOverviewUnit unit="%" />
      <SensorOverviewAge age="3m" />
    </tr> */}
    {/* <tr>
      <SensorOverviewName />
      <SensorOverviewValue value={decimalPlaces(data.get(3)[0].y, 2)} />
      <SensorOverviewUnit unit="V" />
      <SensorOverviewAge age={getAge(data.get(3)[0].x)} />
    </tr> */}
    </tbody>
  </table>;          
}

function SensorOverviews({sensors, onClick}: {sensors: Sensor[], onClick: any}) {
  const [latestReadings, setLatestReadings] = useState<SensorMap>(new Map());

  useEffect(() => {
      (async () => {
        const response = await fetch("/api/v1/readings/latest");
        const readings: Reading[] = await response.json();
        const NewLatestReadings =  readingsToMap(readings);
        setLatestReadings(NewLatestReadings);
      })();
    }, []);

  return (
    <div className="styles.sensorOverviews">
      {(latestReadings.size === 0) && <p>nothing yet</p>}
      {(latestReadings.size !== 0) &&
        sensors.map((sensor, i: number) => {
          return <div key={sensor.sensor_id}>
            <SensorOverview
              sensorName={sensor.name}
              data={latestReadings.get(sensor.sensor_id) as SingleSensorMap}
              onClick={() => onClick(i)}
            />
            <HorizontalLine />
          </div>
        })
      }
    </div>
  );
}

export default SensorOverviews;
