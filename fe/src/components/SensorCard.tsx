import React from 'react';
import styles from "./SensorCard.module.css";
import TimeRangeSelector from './TimeRangeSelector';
import type {Interval, SensorName, SingleSensorMap, Point, ObservationData, ReadingType} from './models';
import HorizontalLine from './HorizontalLine';
import {decimalPlaces} from '../utils';
import { Chart} from "chart.js/auto";
import { Line } from "react-chartjs-2";
import { LinearScale, TimeScale } from "chart.js";
import 'luxon';
import 'chartjs-adapter-luxon';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(LinearScale, TimeScale);
Chart.register(annotationPlugin);
Chart.defaults.color = "#ffffff";

function LineChart({yrange, chartData}: {yrange: {min: number, max: number} | undefined, chartData: Point[]}) {
  return (
    <div className={styles.chartContainer}>
      <Line
        data={{
          datasets: [
            {
              data: chartData
            }
          ]
        }}
        options={{
          animation: false,
          elements: {
            point: {
              radius: 1,
              hoverRadius: 2
            }
          },
          spanGaps: 0,
          plugins: {
            legend: {
              display: false,
              labels: {
                    font: {
                        size: 12,      
                        weight: 'bold',  
                    },
                },
              },
          },
          scales: {
            x: {
              type: 'time',
              display: true,
              ticks: {
                maxTicksLimit: 5,
              }
            },
            y: {
              ...(yrange ? {min: yrange.min} : {}),
              ...(yrange ? {max: yrange.max} : {}),
              ticks: {
                maxTicksLimit: 5,
              }
            }
          }
        }}
      />
    </div>
  );
}

function TemperatureObservation({observationData, scale}: {observationData: ObservationData | undefined, scale: {min: number, max: number} | undefined}) {
  return <>
    {observationData &&
    <>
      <div className={styles.observationHeader}>
        <div className={styles.observationHeaderText}>
        Temperature
        </div>
        <div className={styles.observationHeaderSummary}>
          ▲ {decimalPlaces(observationData?.data[observationData.max].y, 1)} ▼ {decimalPlaces(observationData?.data[observationData.min].y, 1)}
        </div>
      </div>

      <HorizontalLine />
      <LineChart
        yrange={scale}
        chartData={observationData.data}
      />
      </>
    }
    {
      !observationData && <p>Temperature: No observation data</p>
    }
    </>
}

function VoltageObservation({observationData}: {observationData: ObservationData | undefined}) {
  return <>
     {observationData &&
    <>
      <div className={styles.observationHeader}>
        <div className={styles.observationHeaderText}>
        Voltage
        </div>
        <div className={styles.observationHeaderSummary}>
          ▲ {decimalPlaces(observationData?.data[observationData.max].y, 1)} ▼ {decimalPlaces(observationData?.data[observationData.min].y, 1)}
        </div>
      </div>

      <HorizontalLine />
      <LineChart yrange={{min: 2.9, max: 3.1}} chartData={observationData.data} />
      </>
    }
    {
      !observationData && <p>No observation data</p>
    }
    </>
}

function SensorCard({sensorName, intervalName, intervalClickHandler, rangeData, closeHandler, scaleMap}: {sensorName: SensorName, intervalName: Interval, intervalClickHandler: any, rangeData: SingleSensorMap, closeHandler: any, scaleMap: Map<ReadingType, {min: number, max: number}>|undefined}) {
  return <div className={styles.card}>
    <div className={styles.sensorHeader}>
      <div className={styles.headerTop}>
        <div className={styles.cardHeaderText}>{sensorName}</div>
        <button className={styles.cardCloseButton} onClick={closeHandler}>╳</button>
      </div>

        <TimeRangeSelector currentSetting={intervalName} intervalClickHandler={intervalClickHandler}/>
      <HorizontalLine />
    </div>

    <div className="content">
      {!rangeData && <p>waiting for graph data</p>}
      {rangeData &&
      
        <div>
        <TemperatureObservation observationData={rangeData.get("temperature")} scale={scaleMap?.get("temperature")}/>
        <VoltageObservation observationData={rangeData.get("voltage")} />
        </div>
      }
    </div>
  </div>;
}

export default SensorCard;
