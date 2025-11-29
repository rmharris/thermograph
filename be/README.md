This directory contains the back end.  It is essentially a wrapper around sqlite3, storing readings it receives from the base station and serving them, along with the static front end itself, to a client.

Edit etc/be.conf to modify the port on which the back end should listen and the paths for the database and the front end.  Note that the default values  specify _volatile_ paths, reflecting the current developmental status.

Run 'make install' to install and start the back end;  the front end must be copied by hand to the path above.