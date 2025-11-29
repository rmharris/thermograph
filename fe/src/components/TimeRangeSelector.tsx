import React, { useId } from 'react';
import styles from "./TimeRangeSelector.module.css";
import type {Interval} from './models';

function TimeRange({name, defaultChecked, onChange, value}: {name: string, defaultChecked: boolean, onChange: any, value: string}) {
  const id = name + value;

  return <div className={styles.timeRange}>
    <input type="radio" id={id} checked={defaultChecked} name={name} value={value} onChange={onChange}></input>
    <label htmlFor={id}>{value}</label> 
  </div>;
}

function TimeRangeSelector({currentSetting, intervalClickHandler}: {currentSetting: Interval, intervalClickHandler: any}) {
  const name = useId();
  
  return <div className={styles.timeRangeSelector}>
    <TimeRange name={name} defaultChecked={currentSetting == "1D"} onChange={intervalClickHandler} value="1D" />
    <TimeRange name={name} defaultChecked={currentSetting == "1W"} onChange={intervalClickHandler} value="1W" />
    <TimeRange name={name} defaultChecked={currentSetting == "1M"} onChange={intervalClickHandler} value="1M" />
    <TimeRange name={name} defaultChecked={currentSetting == "1Y"} onChange={intervalClickHandler} value="1Y" />
  </div>;
}

export default TimeRangeSelector;
