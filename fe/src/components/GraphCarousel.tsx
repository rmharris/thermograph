import React, {useEffect, useRef, useState} from 'react';
import styles from "./GraphCarousel.module.css";
import { Swiper, SwiperSlide, SwiperClass } from 'swiper/react';
import SensorCard from './SensorCard';
import type {Interval, ObservationData, Reading, ReadingType, Sensor, SensorId, SensorMap, SingleSensorMap} from './models';
import 'swiper/css';
import {readingsToMap} from '../utils';

async function fetchRangeData(start: number, end: number): Promise<SensorMap> {
  const response = await fetch("/api/v1/readings?start=" + start + "&end=" + end);
  const readings: Reading[] = await response.json();
  return readingsToMap(readings);
};

function intervalToStartEnd(interval: string, now: number): {start: number, end: number} {
  const nanoSecondsInDay = 24 * 3600 * 1000000000;
  const params: {[key: string]: number}= {
    "1D": nanoSecondsInDay,
    "1W": nanoSecondsInDay * 7,
    "1M": nanoSecondsInDay * 30,
    "1Y": nanoSecondsInDay * 365
  };
  return {start: now - params[interval], end: now}
}

function GraphCarousel({setSwiper, sensors, closeHandler}: {setSwiper: any, sensors: Sensor[], closeHandler: any}) {
  const startTime = useRef<number>(Date.now());
  const [currentInterval, setCurrentInterval] = useState<Interval>("1D");
  const [allData, setAllData] = useState<Map<Interval, SensorMap>>(new Map());

  useEffect(() => {
    (async () => {
      if (!allData.has(currentInterval)) {
        const range = intervalToStartEnd(currentInterval, startTime.current * 1000000);
        try {
          const rangeData = await(fetchRangeData(range.start, range.end));
          setAllData((prevAllData) => {
            const updatedData = new Map(prevAllData);
            updatedData.set(currentInterval, rangeData);
            return updatedData;
          })
        } catch (error) {
          console.log("Fetching range threw " + error);
        }
      } 
    })();
  }, [currentInterval]);

  const intervalClickHandler = function(e: any) {
    setCurrentInterval(e.target.value);
  }

  const sensorsLookup = new Map<SensorId, Sensor>();
  sensors.map((sensor) => {
    sensorsLookup.set(sensor.sensor_id, sensor);
  });

  const rangeData = allData.get(currentInterval);

  // For a given reading type, ensure a consistent vertical scale across all
  // grouped sensors.  The purpose is to allow internal temperatures, which are
  // expected to be broadly similar, to be comparable when swiping from one to
  // the next.  An external temperature should be excluded since it will likely
  // be significantly different.
  const scaleMap = new Map<ReadingType, {min: number, max: number}>();
  rangeData?.forEach((singleSensorMap: SingleSensorMap, sensorId: SensorId) => {
    if (!(sensorsLookup.get(sensorId) as Sensor).internal) {
      return;
    }

    singleSensorMap.forEach((observationData: ObservationData, readingType: ReadingType) => {
      const min = Math.floor(observationData.data[observationData.min].y);
      const max = Math.ceil(observationData.data[observationData.max].y);

      if (!scaleMap.has(readingType)) {
        scaleMap.set(readingType, {min: min, max: max});
      } else {
        const entry: {min: number, max: number} = scaleMap.get(readingType)!;
        if (min < entry.min) {
          entry.min = min;
        }
        if (max > entry.max) {
          entry.max = max;
        }
      }
    })
  });

  return (
    <Swiper
      style={{ height: "100%" }}
      spaceBetween={25}
      slidesPerView={1}
      onSlideChange={() => console.log('slide change')}
      onSwiper={(swiper: SwiperClass): void => {setSwiper(swiper)}}
    >
     {
      sensors.map((sensor, i) => {
        return (
          <SwiperSlide id={sensor.name}>
            <SensorCard
              intervalClickHandler={intervalClickHandler}
              rangeData={rangeData?.get(sensor.sensor_id) as SingleSensorMap}
              sensorName={sensor.name}
              intervalName={currentInterval}
              closeHandler={closeHandler}
              scaleMap={sensor.internal ? scaleMap : undefined}
            />
          </SwiperSlide>
        );
      })
    }
    </Swiper>
  );
}

export default GraphCarousel;
