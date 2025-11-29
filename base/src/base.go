package main

// #include <sys/ioctl.h>
// #include "rfm70.h"
import "C"

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
	"unsafe"

	flags "github.com/jessevdk/go-flags"
	"golang.org/x/sys/unix"
)

var opts struct {
	Channel  C.__u8 `short:"c" long:"channel" description:"radio channel" required:"true"`
	Device   string `short:"d" long:"device" description:"radio character device" required:"true"`
	Endpoint string `short:"e" long:"endpoint" description:"upload endpoint"`
}

func main() {
	_, err := flags.Parse(&opts)
	if err != nil {
		panic(err)
	}

	fd, err := unix.Open(opts.Device, unix.O_RDONLY, 0)
	if err != nil {
		log.Fatal(err)
	}

	rfm70_config := C.struct_rfm70_config{
		address_width: 5,
		channel:       opts.Channel,
		crc:           2,
		power:         C.RFM70_PWR_5DBM,
		dr:            C.RFM70_DR_1MBPS,
		lna:           C.RFM70_LNA_HIGH,
	}
	for i := 0; i < 6; i++ {
		rfm70_config.pipes[i].rx_address[0] = C.__u8(i)
		for j := 1; j < 5; j++ {
			rfm70_config.pipes[i].rx_address[j] = 0xb7
		}
		rfm70_config.pipes[i].enable = 1
		rfm70_config.pipes[i].dpl = 1
		rfm70_config.pipes[i].aa = 1
	}

	if r, _, errno := unix.Syscall(unix.SYS_IOCTL, uintptr(fd), uintptr(C.RFM70_IOC_SET_CONFIG), uintptr(unsafe.Pointer(&rfm70_config))); r != 0 {
		fmt.Printf("Radio configuraton failed: %s\n", errno)
		os.Exit(1)
	}

	// Hide these for now;  provide them on the command line if necessary.
	names := []string{
		"Sensor 1",
		"Sensor 2",
		"Sensor 3",
		"Sensor 4",
		"Sensor 5",
		"Sensor 6",
	}

	rtypes := []string{
		"T_NULL",
		"T_TEMPERATURE",
		"T_PRESSURE",
		"T_VOLTAGE",
	}

	buf := make([]byte, 64)
	for {
		n, err := unix.Read(fd, buf)
		if err == io.EOF {
			break
		} else if err != nil {
			log.Fatal(err)
		}

		if n != 17 {
			fmt.Printf("Skipping malsized packet: %d\n", n)
			continue
		}

		ns := binary.NativeEndian.Uint64(buf[:8])
		t := time.Unix(0, int64(ns))

		pipe := buf[8]

		seqno := binary.NativeEndian.Uint16(buf[15:17])

		var value float32
		if n, err := binary.Decode(buf[11:15], binary.LittleEndian, &value); n != 4 || err != nil {
			fmt.Printf("couldn't decode float, n = %d, err = %s", n, err)
			value = 0
		}
		readingType := binary.NativeEndian.Uint16(buf[9:11])

		body, err := json.Marshal(
			struct {
				Time     uint64  `json:"time"`
				SensorId int     `json:"sensor_id"`
				Seqno    int     `json:"seqno"`
				Rtype    int     `json:"rtype"`
				Value    float32 `json:"value"`
			}{
				Time:     ns,
				SensorId: int(pipe),
				Seqno:    int(seqno),
				Rtype:    int(readingType),
				Value:    value,
			},
		)
		if err != nil {
			fmt.Println(err)
		}

		if opts.Endpoint != "" {
			resp, err := http.Post(opts.Endpoint+"/api/v1/readings", "encoding/json", bytes.NewBuffer(body))
			if err != nil {
				fmt.Print(" (", err, ")")
			} else {
				resp.Body.Close()
				if resp.StatusCode != http.StatusOK {
					fmt.Print(" (", resp.Status, ")")
				}
			}
		} else {
			fmt.Printf("%s %-20s %13s = %5.3f (%d)\n", t.Format(time.DateTime), names[pipe], rtypes[readingType], value, seqno)
		}
	}
}
