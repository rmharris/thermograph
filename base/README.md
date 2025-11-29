This directory contains the client application for the base station.  It reads
packets received by the radio and forwards them via a REST API to the back end.

The reference hardware for the base station is a Rapsberry Pi Zero 2 W with
either an RFM70 or an nRF24L01(+) transceiver.  A suitable Device Tree overlay
and driver should be installed, both provided by linux-rfm70.

Modify etc/base.conf to specify the character device for the radio, the sensor
channel and the location of the backend.  Then run 'make install'.

Finally, and optionally, run 'sudo raspi-config', select "Performance Options"
and enable the overlay file system for / and /boot.  This makes them read-only,
at which point the base station becomes a stateless device that can be powered
on and off at will.
