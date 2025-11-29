# thermograph

## Overview

This repository contains the source for a thermograph — a product that records and displays temperatures.  It is a personal project intended to provide exposure to very different parts of the stack, from board design to the front end.  The pictures on the left show the front and back of a single sensor, which periodically measures and reports the temperature.  The video on the right shows the screen of a phone as the user browses the data.

<p align="center"> <img src="docs/images/combined.mov" width="80%"> </p>

## System design

Each sensor is built around an ATmega168;  the MCU obtains a temperature reading from a TMP102 and broadcasts it in the 2.4 GHz band using an RFM70 transceiver.  The readings are received by a base station equipped with a similar transceiver.  The reference hardware is a Raspberry Pi Zero 2 W with an nRF24L01+ (I discovered late in the day that the RFM70 is a clone of the nRF24L01 and they are almost completely compatible).  The base station transmits each datum across the internet via REST to a back end that serves a browser-based front end.  In summary:

<p align="center"> <img src="docs/images/architecture.svg" width="80%"> </p>

## Components

The parts of the system that I have written myself are

- An Eagle [sensor schematic and PCB design](sensor/hardware) (there is no stencil:  I applied solder paste straight from a syringe and used a £30 oven from Argos for the reflow),
- C [firmware for the sensor MCU](sensor/firmware),
- C libraries for the [RFM70](https://github.com/rmharris/rfm70) and the TMP102,
- a C [Linux device driver for the RFM70/nRF24L01](https://github.com/rmharris/linux-rfm70),
- the go [base station client](base) that forwards data from the radio to the backend,
- the go [back end](be) that wraps sqlite3 and
- a React/TypeScript [front end](fe).
