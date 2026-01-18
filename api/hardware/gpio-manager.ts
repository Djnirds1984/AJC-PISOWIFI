import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GPIOManagerConfig {
  pin: number;
  debounceTime?: number;
  boardType?: 'raspberry' | 'orange' | 'unknown';
}

export interface CoinPulseEvent {
  timestamp: number;
  pin: number;
  totalPulses: number;
  value: number; // Calculated coin value
}

export class GPIOManager extends EventEmitter {
  private pin: number;
  private debounceTime: number;
  private boardType: 'raspberry' | 'orange' | 'unknown';
  private gpio: any = null;
  private pulseCount: number = 0;
  private lastPulseTime: number = 0;
  private isInitialized: boolean = false;
  private pulseTimeout: NodeJS.Timeout | null = null;
  private totalPulses: number = 0;

  constructor(config: GPIOManagerConfig) {
    super();
    this.pin = config.pin;
    this.debounceTime = config.debounceTime || 50; // 50ms debounce
    this.boardType = config.boardType || 'unknown';
  }

  async initialize(): Promise<void> {
    try {
      // Detect board type if not specified
      if (this.boardType === 'unknown') {
        this.boardType = await this.detectBoardType();
      }

      // Initialize GPIO based on board type
      if (this.boardType === 'raspberry') {
        await this.initializeRaspberryPi();
      } else if (this.boardType === 'orange') {
        await this.initializeOrangePi();
      } else {
        // Fallback to mock mode for development
        console.log('GPIO: Running in mock mode for development');
        this.initializeMockMode();
        return;
      }

      this.isInitialized = true;
      this.emit('initialized', { boardType: this.boardType, pin: this.pin });
      
      console.log(`GPIO: Initialized ${this.boardType} on pin ${this.pin}`);
    } catch (error) {
      console.error('GPIO: Initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async detectBoardType(): Promise<'raspberry' | 'orange' | 'unknown'> {
    try {
      // Check if running on Windows - force mock mode
      if (process.platform === 'win32' || process.platform === 'cygwin') {
        console.log('GPIO: Windows detected, using mock mode');
        return 'unknown';
      }

      // Check for Raspberry Pi
      try {
        await execAsync('cat /proc/device-tree/model | grep -i raspberry');
        return 'raspberry';
      } catch {}

      // Check for Orange Pi
      try {
        await execAsync('cat /proc/device-tree/model | grep -i orange');
        return 'orange';
      } catch {}

      // Check CPU info as fallback
      const { stdout } = await execAsync('cat /proc/cpuinfo');
      if (stdout.toLowerCase().includes('raspberry')) {
        return 'raspberry';
      }
      if (stdout.toLowerCase().includes('allwinner') || stdout.toLowerCase().includes('sunxi')) {
        return 'orange';
      }

      return 'unknown';
    } catch (error) {
      console.warn('GPIO: Board detection failed, using mock mode');
      return 'unknown';
    }
  }

  private async checkGPIOAvailability(pin: number): Promise<boolean> {
    try {
      // Check if GPIO pin is already exported
      const { stdout } = await execAsync(`ls /sys/class/gpio/ | grep gpio${pin}`);
      if (stdout.trim()) {
        console.log(`GPIO: Pin ${pin} is already exported, attempting to unexport`);
        try {
          await execAsync(`echo ${pin} > /sys/class/gpio/unexport`);
          console.log(`GPIO: Successfully unexported pin ${pin}`);
          // Wait a moment for the system to release the pin
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (unexportError) {
          console.warn(`GPIO: Failed to unexport pin ${pin}:`, unexportError);
          return false;
        }
      }
      return true;
    } catch (error) {
      // Pin is not exported, which is good
      return true;
    }
  }

  private async initializeRaspberryPi(): Promise<void> {
    try {
      const onoff = await import('onoff');
      const Gpio = onoff.Gpio;
      
      // Enhanced debugging for GPIO2 (SDA) initialization
      console.log(`GPIO: Attempting to initialize Raspberry Pi GPIO pin ${this.pin} (GPIO${this.pin})`);
      
      // Check if GPIO pin is available
      const isAvailable = await this.checkGPIOAvailability(this.pin);
      if (!isAvailable) {
        console.warn(`GPIO: Pin ${this.pin} may not be available, attempting initialization anyway`);
      }
      
      // Check if running with proper permissions
      try {
        this.gpio = new Gpio(this.pin, 'in', 'rising', { 
          debounceTimeout: this.debounceTime 
        });
      } catch (gpioError: any) {
        console.error(`GPIO: Detailed error for pin ${this.pin}:`, {
          code: gpioError.code,
          message: gpioError.message,
          errno: gpioError.errno,
          syscall: gpioError.syscall
        });
        
        if (gpioError.code === 'EACCES' || gpioError.code === 'EPERM') {
          throw new Error(`GPIO access denied. Try running with sudo or add user to gpio group: sudo usermod -a -G gpio $USER`);
        } else if (gpioError.code === 'EINVAL') {
          // Enhanced error message for EINVAL with specific guidance
          throw new Error(`Invalid GPIO pin ${this.pin}. This usually means:
1. Pin is reserved for I2C/SPI/UART (even if disabled in config)
2. Pin is already exported by another process
3. Pin number is out of range for this Raspberry Pi model

Try these solutions:
- Use GPIO17 (Physical Pin 11) instead
- Check if pin is already exported: ls /sys/class/gpio/
- Unexport the pin first: echo ${this.pin} > /sys/class/gpio/unexport
- Ensure I2C is fully disabled: sudo raspi-config
- Run with sudo to test permissions`);
        } else {
          throw gpioError;
        }
      }

      this.gpio.watch((err: Error | null, value: number) => {
        if (err) {
          this.emit('error', err);
          return;
        }
        this.handlePulse(value);
      });

      console.log(`GPIO: Raspberry Pi GPIO initialized successfully on pin ${this.pin} (GPIO${this.pin})`);
    } catch (error) {
      throw new Error(`Failed to initialize Raspberry Pi GPIO: ${error}`);
    }
  }

  private async initializeOrangePi(): Promise<void> {
    try {
      const opio = await import('orange-pi-gpio');
      this.gpio = opio.default({
        pin: this.pin,
        mode: 'input',
        edge: 'rising',
        debounce: this.debounceTime
      });

      this.gpio.read((err: Error | null, value: number) => {
        if (err) {
          this.emit('error', err);
          return;
        }
        this.handlePulse(value);
      });

      console.log('GPIO: Orange Pi GPIO initialized');
    } catch (error) {
      throw new Error(`Failed to initialize Orange Pi GPIO: ${error}`);
    }
  }

  private initializeMockMode(): void {
    // Mock mode for development - simulate coin pulses
    console.log('GPIO: Mock mode enabled - use keyboard to simulate coin pulses');
    console.log('GPIO: Press 1 for ₱1, 5 for ₱5, 0 for ₱10, or any key for random pulse');
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      process.stdin.on('data', (key: string) => {
        if (key === '\u0003') { // Ctrl+C
          process.exit();
        }
        
        let pulses = 1;
        if (key === '1') pulses = 1;
        else if (key === '5') pulses = 5;
        else if (key === '0') pulses = 10;
        
        for (let i = 0; i < pulses; i++) {
          setTimeout(() => this.handlePulse(1), i * 100);
        }
      });
    }
  }

  private handlePulse(value: number): void {
    const now = Date.now();
    
    // Debounce check
    if (now - this.lastPulseTime < this.debounceTime) {
      return;
    }
    
    this.lastPulseTime = now;
    this.pulseCount++;
    this.totalPulses++;
    
    // Reset pulse count after 1 second of inactivity
    if (this.pulseTimeout) {
      clearTimeout(this.pulseTimeout);
    }
    
    this.pulseTimeout = setTimeout(() => {
      this.processCoinPulse();
    }, 1000);
  }

  private processCoinPulse(): void {
    if (this.pulseCount === 0) return;
    
    const coinValue = this.calculateCoinValue(this.pulseCount);
    const event: CoinPulseEvent = {
      timestamp: Date.now(),
      pin: this.pin,
      totalPulses: this.totalPulses,
      value: coinValue
    };
    
    console.log(`GPIO: Detected ${this.pulseCount} pulses = ₱${coinValue}`);
    this.emit('coinPulse', event);
    
    this.pulseCount = 0;
  }

  private calculateCoinValue(pulses: number): number {
    // Multi-coin slot logic: 1 pulse = ₱1, 5 pulses = ₱5, 10 pulses = ₱10
    if (pulses === 1) return 1;
    if (pulses === 5) return 5;
    if (pulses === 10) return 10;
    
    // Fallback: assume ₱1 per pulse for unknown patterns
    return pulses;
  }

  public getTotalPulses(): number {
    return this.totalPulses;
  }

  public getBoardType(): string {
    return this.boardType;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public cleanup(): void {
    if (this.pulseTimeout) {
      clearTimeout(this.pulseTimeout);
    }
    
    if (this.gpio) {
      if (this.boardType === 'raspberry') {
        try {
          this.gpio.unexport();
        } catch (error) {
          console.warn('GPIO: Error during cleanup:', error);
        }
      } else if (this.boardType === 'orange') {
        try {
          this.gpio.destroy();
        } catch (error) {
          console.warn('GPIO: Error during cleanup:', error);
        }
      }
    }
    
    if (process.stdin.isTTY && this.boardType === 'unknown') {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    
    this.isInitialized = false;
    console.log('GPIO: Cleanup completed');
  }
}

export default GPIOManager;