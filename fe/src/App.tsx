import React, { useEffect, useReducer, useState } from 'react';
import './App.css';
import SensorOverviews from './components/SensorOverviews';
import GraphCarousel from './components/GraphCarousel';
import type {Sensor, SensorName, ReadingType} from './components/models';
import HorizontalLine from './components/HorizontalLine';
import { Swiper, SwiperSlide, SwiperClass } from 'swiper/react';

function App() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [swiper, setSwiper] = useState<SwiperClass>();
  const [isSheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/v1/sensors");
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const NewSensors: Sensor[] = await response.json();
        NewSensors.sort((a, b) => {
          if (a.internal && !b.internal) {
            return -1;
          }
          if (!a.internal && b.internal) {
            return 1;
          }
          return a.sensor_id - b.sensor_id;
        });
        setSensors(NewSensors);
      } catch (err) {
        console.log("Couldn't get sensors: ", err);
      }
     
      const socket = new WebSocket("/api/v1/ws");
      socket.onopen = () => {
          console.log("Successfully Connected");
      };
      socket.onmessage = (event) => {
        // XXX publish
      };
    })();
  }, []);

  const clickHandler = function(index: number) {
    swiper?.slideTo(index, 0);
    setSheetOpen(true);
  };

  const closeHandler = function() {
    setSheetOpen(false);
  }

  return (
    <div className="app-container">

      <div className="header">
        <div className="header-text">thermograph</div>
        <HorizontalLine />
      </div>

      <div className="content">
        {sensors && <SensorOverviews sensors={sensors} onClick={clickHandler}/>}
        
        <div className={`bottom-sheet ${isSheetOpen ? "open" : ""}`}>  
          <GraphCarousel
            sensors={sensors}
            setSwiper={setSwiper}
            closeHandler={closeHandler}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
