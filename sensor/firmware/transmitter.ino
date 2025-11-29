#include <SPI.h>
#include <Wire.h>
#include <RFM70.h>
#include <RFM70_impl.h>
#include <TMP102.h>
#include "radio.h"

#define	RADIO_CHANNEL		0
#define	RADIO_ADDRESS		0

#define	RADIO_SLAVE_SELECT	10
#define	RADIO_ENABLE		5
#define	RADIO_IRQ		6
#define	LED_GREEN		16	// analogue output
#define	LED_RED			17	// analogue output
#define	BATTERY_INPUT		1	// analogue input
#define	THERMOMETER_ADDRESS	72

// The battery voltage is reduced by a potential divider so that it may be
// safely compared by the ADC to the internal reference voltage. V_RATIO
// compensates for this divider; its value, below, reflects the nominal
// resistor values, i.e. 1 Mohm and 499 Kohm. For a given sensor, a more
// accurate value of V_RATIO can be found by powering the board and measuring
// the divider's input and output with a voltmeter.
#define	V_REFERENCE		1.1
#define	V_RATIO			(1499.0 / 499)
#define	V_SCALED		(V_REFERENCE * V_RATIO)

// Flags for the flash() function.
#define	FLASH_GREEN		0x1
#define	FLASH_RED		0x2

// Once the device has initialised, it transmits a datum after every
// READING_COUNT increments of the watchdog timer. 1 datum out of every
// VOLTAGE_COUNT is a voltage measurement; the rest are temperatures.
#define	READING_COUNT		38
#define	VOLTAGE_COUNT		24

RFM70 radio(RADIO_SLAVE_SELECT, RADIO_ENABLE, RADIO_IRQ);
TMP102 t(THERMOMETER_ADDRESS);
byte wd_count = 0;
byte int_reset = 0;

void
led_set_state(int leds, int state)
{
	if (leds & FLASH_GREEN)
		digitalWrite(LED_GREEN, state);
	if (leds & FLASH_RED)
		digitalWrite(LED_RED, state);
}

void
flash(int leds, unsigned long time)
{
	led_set_state(leds, HIGH);
	delay(time);
	led_set_state(leds, LOW);
}

void
send_packet(unsigned long seqno, type_t type, float value)
{
	byte buffer[MAX_PACKET_LEN];
	struct payload *pp = (struct payload *) buffer;
	byte status;
	static byte power_level = 0;


	// Construct the packet.
	pp->p_type = type;
	pp->p_value = value;
	pp->p_seqno = seqno;

	// Wake up the radio.
	radio.set_mode(MODE_STANDBY_ONE);
	delay(200);

	// Flush both the TX and RX FIFOs, even though there shouldn't be
	// anything in either.
	(void) radio.command(C_FLUSH_TX, 0, NULL, 0);
	(void) radio.command(C_FLUSH_RX, 0, NULL, 0);

	// Clear any outstanding interrupts, of which there should be none.
	radio.write(R_STATUS, radio.read(R_STATUS));

	// Send the payload; given our previous directives this will by
	// default request an acknowledgement.
	(void) radio.command(C_W_TX_PAYLOAD, 0, buffer, sizeof (*pp));

	// Periodically reset the power level to its minimum value in case the
	// circumstances that led to its increase were transitory.
	if (seqno % 100 ==  0 && power_level != 0) {
		power_level = 0;
		radio.set_power_level(power_level);
	}

	// Prepare the radio for transmission. MODE_TX corresponds to a state
	// in which the radio's CE pin is held high. This means that the radio
	// will transmit immediately since there is already a packet in the
	// FIFO.
	radio.set_mode(MODE_TX);

	// Either the transmission succeeds or we will have performed the
	// maximum number of retries. In both cases there will be an
	// interrupt so we just wait for one.
	while (digitalRead(RADIO_IRQ) == HIGH)
		;

	// If no acknowledgement has been received even after the maximum number
	// of automatic retries then it is declared lost and transmission
	// ceases. In this case we increase the transmission power to the next
	// level and try again.
	while (((status = radio.read(R_STATUS)) & B_STATUS_MAX_RT) &&
	    power_level < V_RF_SETUP_PWR_N - 1) {
		radio.set_power_level(++power_level);
		radio.write(R_STATUS, status);
		while (digitalRead(RADIO_IRQ) == HIGH)
			;
	}

	// If we failed to transmit the packet then there's nothing else we can
	// do that's useful.
	if (type == T_NULL) {
		if (status & B_STATUS_TX_DS)
			flash(FLASH_GREEN, 10);
		else
			flash(FLASH_RED, 10);
	}

	// Turn off the radio; this will clear outstanding interrupts and the
	// value of R_OBSERVE_TX.
	radio.set_mode(MODE_POWER_DOWN);
}

// Setup the watchdog timer to provide interrupts at the given period (there is
// considerable uncertainty in the exact period because the watchdog uses an
// internal, apparently less accurate, oscillator.
//
// The sequence below is more or less as prescribed in the ATmega328 datasheet.
// Note that resetting the WDRF bit in the MCUSR is in this case cosmetic:
// following a watchdog reset the prescaler is reset to its fastest setting, and
// the resulting period (15 ms) is so short that there isn't time for the
// bootloader to complete, resulting in a permanent reset loop. Using a
// bootloader compiled with WATCHDOG_MODS would allow for a more robust
// solution. Note also that modifying the prescaler appears to require that the
// WDE bit is set first; this isn't mentioned in the datasheet.
void
set_watchdog_timeout(int time)
{
	cli();
	__asm__ __volatile__ ("wdr");
	MCUSR &= ~_BV(WDRF);
	WDTCSR |= _BV(WDCE) | _BV(WDE);
	WDTCSR = _BV(WDIE) | time;
	sei();
}

void
loop()
{
	static boolean_t initialising = B_TRUE;
	static byte seqno = 1;
	static type_t type;
	float value;


	// Disable brown-out detection and go to sleep; the watchdog will wake
	// us shortly.
	SMCR |= _BV(SE);
	// MCUCR |= _BV(BODS) | _BV(BODSE);
	// MCUCR = (MCUCR & ~(_BV(BODS) | _BV(BODSE))) | _BV(BODS);
	__asm__ __volatile__ ("sleep");

	// Execution resumes at this point following a wake-up event, which for
	// us will be a watchdog interrupt
	SMCR &= ~_BV(SE);
	
	switch (wd_count) {
	case 1:
		if (initialising == B_FALSE)
			return;
		if (seqno == 60) {
			initialising = B_FALSE;
			set_watchdog_timeout(_BV(WDP3) | _BV(WDP0));
		}
		type = T_NULL;
		wd_count = 0;
		break;
	case (READING_COUNT - 1):
		if (seqno % VOLTAGE_COUNT == 0) {
			type = T_VOLTAGE;
		} else {
			type = T_TEMPERATURE;
			t.prepare_reading();
		}
		return;
	case READING_COUNT:
		if (type == T_TEMPERATURE) {
			value = t.get_reading();
		} else {
			ADCSRA |= _BV(ADEN);
			value = V_SCALED * analogRead(BATTERY_INPUT) / 1024.0;	
			ADCSRA &= ~_BV(ADEN);
		}
		wd_count = 0;
		break;
	default:
		return;
	}
	
	send_packet(seqno++, type, value);
}

ISR(WDT_vect) {
	wd_count++;
};

void
configure_rfm70(int address)
{
	// Initialise the radio in a power-down state; its SPI bus and
	// registers will still be available. Enable CRC encoding with a
	// one-byte result.
	radio.write(R_CONFIG, B_CONFIG_EN_CRC | B_CONFIG_CRCO);

	// The data pipe shall have an address width of five bytes.
	radio.write(R_SETUP_AW, V_SETUP_AW_5);

	// We require only data pipe zero. The transmitter address is the
	// address of the receiver's data pipe to which we will be sending
	// packets. In order to be able to receive acknowledgements then our own
	// data pipe zero must be set to the same address.
	radio.write(R_TX_ADDR, address, ADDR3, ADDR2, ADDR1, ADDR0);
	radio.write(R_RX_ADDR_P0, address, ADDR3, ADDR2, ADDR1, ADDR0);
	radio.write(R_EN_RXADDR, B_EN_RXADDR_P0);
	
	// Although the datasheet does not say this explicitly, we need to
	// enable auto acknowledgement on our RX data pipe even for
	// transmission.
	radio.write(R_EN_AA, B_EN_AA_P0);
	
	// Packets requiring acknowledgement should be retried up to 15 times,
	// with a delay of 1750 uS between each one. There appears to be an
	// undocumented time window, corresponding to the product of these
	// values, in which a packet must be acknowledged.
	radio.write(R_SETUP_RETR, V_SETUP_RETR_ARD_1750 | V_SETUP_RETR_ARC_15);

	radio.write(R_RF_CH, RADIO_CHANNEL);
	
	// Use a data rate of only 1 Mbs in the (untested) expectation that
	// this will increase robustness of the connection. Default to the
	// lowest power available.
	radio.write(R_RF_SETUP, V_RF_SETUP_MAGIC | V_RF_SETUP_DR_1MBPS |
	    V_RF_SETUP_PWR_m10DBM | V_RF_SETUP_LNA_HIGH);

	// We'll be requiring various special features that are set in the
	// FEATURE register, but this is read-only and zero unless enabled.
	// We therefore test its status and toggle it if necessary.
	if (radio.read(R_FEATURE) == 0) {
		radio.write(R_FEATURE, 1);
		if (radio.read(R_FEATURE) == 0) {
			byte activate = ACTIVATE_FEATURES;
			(void) radio.command(C_ACTIVATE, 0, &activate, 1);
		}
	}
	
	// We'd like dynamic payload length and the ability to send packets
	// *without* receiving an acknowledgement.
	radio.write(R_FEATURE, B_EN_DPL | B_EN_DYN_ACK);
	
	// I'm not sure about this; the receiver never formally transmits and
	// therefore has no need of DPL, therefore we are never transmitting to
	// a PRX with DPL enabled.
	radio.write(R_DYNPD, V_DYNPD_DPL_ALL);

	// Initialise the manufacturer's secret settings.
	radio.config_magic();
}

void
setup(void)
{
	DDRC = 0;
	PORTC = 0;

	pinMode(LED_GREEN, OUTPUT);
	pinMode(LED_RED, OUTPUT);

	// Initialise the SPI bus.
	SPI.begin();
	SPI.setClockDivider(SPI_CLOCK_DIV8);
	SPI.setBitOrder(MSBFIRST);
	SPI.setDataMode(SPI_MODE0);

	// Prepare and initialise the radio.
	pinMode(RADIO_IRQ, INPUT);
	radio.begin();
	configure_rfm70(RADIO_ADDRESS);

	// Prepare the temperature probe.
	Wire.begin();
	t.begin();

	// Disable analogue-to-digital conversion.
	analogReference(INTERNAL);
	ADCSRA &= ~_BV(ADEN);

	// Set the sleep mode to Power Down.
	SMCR = _BV(SM1);

	// Advertise this device's address to the user; the pipe addresses are
	// numbered 0..5 but we transform them to 1..6.
	set_watchdog_timeout(_BV(WDP2) | _BV(WDP0));
	for (int i = 0; i <= RADIO_ADDRESS; i++) {
		flash(FLASH_GREEN | FLASH_RED, 10);
		SMCR |= _BV(SE);
		__asm__ __volatile__ ("sleep");
	}

	// Set the watchdog timer for 1 second intervals in preparation for the
	// initialisation sequence.
	set_watchdog_timeout(_BV(WDP2) | _BV(WDP1));
	wd_count = 0;
}
